import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/insights/data/stream_controller.dart';

import '../core_data/support/fakes.dart';
import 'support/insights_fixtures.dart';

class _FakeAuth extends AuthController {
  _FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;
}

class _FixedInsights extends InsightsRepository {
  _FixedInsights(this.value);

  final PrepInsights? value;

  @override
  RemoteState<PrepInsights> build() => RemoteState(value: value);
}

class _NoCredits extends CreditsRepository {
  int refreshes = 0;

  @override
  RemoteState<AiCredits> build() => const RemoteState();

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

class _NoSaved extends SavedRepository {
  @override
  RemoteState<SavedList> build() => const RemoteState();

  @override
  Future<void> refresh({bool force = false}) async {}
}

Map<String, dynamic> _body(RecordedRequest r) => r.body is String ? jsonDecode(r.body! as String) as Map<String, dynamic> : Map<String, dynamic>.from(r.body! as Map);

void main() {
  late FakeHttpAdapter http;
  late ProviderContainer c;
  var now = DateTime.utc(2026, 10, 13, 15);

  ProviderContainer make({PrepInsights? insights, bool pro = false}) => ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(() => _FakeAuth(AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', isPro: pro))),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        insightsRepositoryProvider.overrideWith(() => _FixedInsights(insights)),
        savedRepositoryProvider.overrideWith(_NoSaved.new),
        creditsRepositoryProvider.overrideWith(_NoCredits.new),
      ]);

  setUp(() {
    http = FakeHttpAdapter();
    now = DateTime.utc(2026, 10, 13, 15);
  });

  tearDown(() => c.dispose());

  Future<void> settle() async {
    for (var i = 0; i < 10; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  Iterable<RecordedRequest> logged(String type) =>
      http.requests.where((r) => r.path.endsWith('/interact') && _body(r)['interaction_type'] == type);

  group('StreamController', () {
    test('keeps paging past pages emptied by the quality filter, and de-duplicates', () async {
      c = make();
      final keep = c.listen(streamControllerProvider, (_, _) {});
      http.handler = (o) {
        if (!o.path.endsWith('/feed')) return const FakeReply(200, {});
        final offset = int.parse('${o.queryParameters['offset']}');
        return switch (offset) {
          0 => const FakeReply(200, {'questions': [], 'nextOffset': 12, 'hasMore': true}),
          12 => FakeReply(200, {'questions': [questionJson('q1'), questionJson('q2')], 'nextOffset': 24, 'hasMore': true}),
          _ => FakeReply(200, {'questions': [questionJson('q2'), questionJson('q3')], 'nextOffset': 36, 'hasMore': false}),
        };
      };
      final ctl = c.read(streamControllerProvider.notifier);
      await ctl.open(const StreamFilters(subject: 'accountancy'));
      var s = c.read(streamControllerProvider);
      expect(s.questions.map((q) => q.id), ['q1', 'q2']);
      expect(s.phase, StreamPhase.ready);
      await settle();
      expect(logged('seen').length, 1);

      // Moving on near the end reads ahead; q2 is not repeated.
      ctl.next();
      await settle();
      s = c.read(streamControllerProvider);
      expect(s.questions.map((q) => q.id), ['q1', 'q2', 'q3']);
      ctl.next();
      ctl.next();
      expect(c.read(streamControllerProvider).phase, StreamPhase.end);
      keep.close();
    });

    test('a pick reveals once and logs the answer with its dwell; a skip logs a skip', () async {
      c = make();
      final keep = c.listen(streamControllerProvider, (_, _) {});
      Object? difficulty;
      http.handler = (o) {
        if (!o.path.endsWith('/feed')) return const FakeReply(200, {});
        difficulty = o.queryParameters['difficulty'];
        return FakeReply(200, {'questions': [questionJson('q1'), questionJson('q2')], 'nextOffset': 12, 'hasMore': false});
      };
      final ctl = c.read(streamControllerProvider.notifier);
      await ctl.open(const StreamFilters(subject: 'accountancy', difficulty: 'hard'));
      expect(difficulty, 'hard');
      now = now.add(const Duration(seconds: 42));
      ctl.pick('C');
      ctl.pick('A');
      final s = c.read(streamControllerProvider);
      expect(s.pickOf('q1'), 'C');
      expect(s.right, 0);
      expect(s.answered, 1);
      await settle();
      final attempted = _body(logged('attempted').single);
      expect(attempted['dwell_ms'], 42000);
      expect(attempted['flow_context'], 'explore');
      expect((attempted['metadata'] as Map)['selected_key'], 'C');
      ctl.next();
      ctl.skip();
      await settle();
      expect(logged('skip'), hasLength(1));
      expect(c.read(streamControllerProvider).phase, StreamPhase.end);
      keep.close();
    });

    test('a question with no usable key cannot be answered', () async {
      c = make();
      final keep = c.listen(streamControllerProvider, (_, _) {});
      c.read(streamControllerProvider.notifier).openSaved([question('q1', key: 'Z')]);
      c.read(streamControllerProvider.notifier).pick('A');
      expect(c.read(streamControllerProvider).answered, 0);
      keep.close();
    });

    test('offline on the first page shows the failure, with nothing invented', () async {
      c = make();
      final keep = c.listen(streamControllerProvider, (_, _) {});
      http.handler = (_) => const FakeReply.network();
      await c.read(streamControllerProvider.notifier).open(const StreamFilters(subject: 'economics'));
      final s = c.read(streamControllerProvider);
      expect(s.phase, StreamPhase.failed);
      expect(s.error!.isOffline, isTrue);
      expect(s.questions, isEmpty);
      keep.close();
    });

    test('a vote changes the counts only after the server answers', () async {
      c = make();
      final keep = c.listen(streamControllerProvider, (_, _) {});
      final ctl = c.read(streamControllerProvider.notifier)..openSaved([question('q1')]);
      var voteReply = const FakeReply(500, {});
      http.handler = (o) => o.path.endsWith('/vote') ? voteReply : const FakeReply(200, {});
      expect(await ctl.vote('q1', 'up'), isFalse);
      expect(c.read(streamControllerProvider).current!.upvotes, 14);
      voteReply = const FakeReply(200, {'upvotes': 15, 'downvotes': 1, 'userVote': 'up'});
      expect(await ctl.vote('q1', 'up'), isTrue);
      expect(c.read(streamControllerProvider).current!.upvotes, 15);
      expect(c.read(streamControllerProvider).current!.userVote, 'up');
      keep.close();
    });
  });

  group('SaveController', () {
    test('saved only after the acknowledgement; the free limit is its own outcome', () async {
      c = make();
      final ctl = c.read(saveControllerProvider.notifier);
      http.replies.add(const FakeReply(200, {'saved': true, 'count': 4, 'limit': 25}));
      final q = question('q1');
      final pending = ctl.set('q1', saved: true);
      expect(c.read(saveControllerProvider).pending, contains('q1'));
      expect(c.read(saveControllerProvider).savedOf(q), isFalse);
      expect(await pending, isA<SaveDone>());
      expect(c.read(saveControllerProvider).savedOf(q), isTrue);
      expect(c.read(saveControllerProvider).count, 4);

      http.replies.add(const FakeReply(402, {'error': 'Free bookmark limit reached', 'limit': 25}));
      expect(await ctl.set('q2', saved: true), isA<SaveLimitReached>());
      expect(c.read(saveControllerProvider).savedOf(question('q2')), isFalse);
    });
  });

  group('AskController', () {
    test('record questions are answered on the phone, without a request', () async {
      c = make(insights: rich());
      await c.read(askControllerProvider.notifier).send('Where am I losing marks?');
      final m = c.read(askControllerProvider).messages;
      expect(m, hasLength(2));
      expect(m.last.origin, AskOrigin.phone);
      expect(m.last.text, contains('Partnership: admission of a partner'));
      expect(http.requests, isEmpty);
    });

    test('other questions go through the server, and say what they cost', () async {
      c = make(insights: rich());
      http.handler = (o) => o.path.contains('/mentor/chat')
          ? const FakeReply(200, {
              'ok': true,
              'reply': 'Goodwill is paid for future profits.',
              'origin': 'model',
              'sessionId': 's-1',
              'actions': [
                {'label': 'See pricing', 'type': 'navigate', 'route': '/pricing'},
              ],
              'charge': {'kind': 'prepos_credit', 'creditUnits': 1},
            })
          : const FakeReply(200, {'state': 'available'});
      await c.read(askControllerProvider.notifier).send('What is goodwill?');
      final s = c.read(askControllerProvider);
      expect(s.messages.last.origin, AskOrigin.model);
      expect(s.sessionId, 's-1');
      final sent = _body(http.requests.firstWhere((r) => r.path.contains('/mentor/chat')));
      expect(sent['message'], 'What is goodwill?');
      expect(sent['requestId'], isNotEmpty);
      // A charged reply re-reads the wallet.
      expect((c.read(creditsRepositoryProvider.notifier) as _NoCredits).refreshes, 1);
    });

    test('an offline send keeps the request id for the retry; no credits is not retried as offline', () async {
      c = make(insights: rich());
      http.handler = (o) => const FakeReply.network();
      final ctl = c.read(askControllerProvider.notifier);
      await ctl.send('Explain accrual');
      expect(c.read(askControllerProvider).messages.last.failure, AskFailure.offline);
      final first = _body(http.requests.last)['requestId'];
      http.handler = (o) => const FakeReply(402, {'ok': false, 'status': 'blocked', 'balance': 0});
      await ctl.retry();
      expect(_body(http.requests.last)['requestId'], first);
      final last = c.read(askControllerProvider).messages.last;
      expect(last.failure, AskFailure.noCredits);
      expect(last.balance, 0);
    });

    test('a paused service answers for free and says so', () async {
      c = make();
      http.handler = (o) => const FakeReply(200, {'reply': 'Paid replies are paused.', 'origin': 'status', 'actions': []});
      await c.read(askControllerProvider.notifier).send('Make me a plan for tonight');
      expect(c.read(askControllerProvider).messages.last.origin, AskOrigin.paused);
    });
  });
}
