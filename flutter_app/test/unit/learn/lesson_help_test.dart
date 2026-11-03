// Lesson help (owner ledger L39): "Explain this another way" on a lesson step. It calls the
// website's route, POST /api/ai/mentor/chat, with the study fields, and keeps the website's credit
// rules: the cost before sending, a failed call charges nothing, a repeat of an unknown outcome
// reuses the request id, a saved reply comes back free, and zero credits says when they renew.
// Every body below has the shape the real route sends (src/app/api/ai/mentor/chat/route.js).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/features/insights/data/ask_wallet.dart';
import 'package:mockmob/features/learn/lesson_help/lesson_help_controller.dart';
import 'package:mockmob/features/learn/lesson_help/lesson_help_copy.dart';
import 'package:mockmob/features/learn/lesson_help/lesson_help_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

class _Credits extends CreditsRepository {
  _Credits(this.value);

  final AiCredits? value;
  int refreshes = 0;

  @override
  RemoteState<AiCredits> build() => RemoteState(value: value);

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

/// `GET /api/ai/credits` as the server sends it: `spendable` is a yes or no, the count is `total`.
AiCredits wallet({int total = 9, String? state}) => AiCredits.fromJson({
      'ok': true,
      'state': state ?? (total > 0 ? 'available' : 'empty'),
      'isPaid': false,
      'wallet': {
        'state': state ?? (total > 0 ? 'available' : 'empty'),
        'known': true,
        'spendable': total > 0,
        'includedMonthlyCredits': 10,
        'includedRemaining': total,
        'bonusCredits': 0,
        'total': total,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

const _study = {'runId': 'run-7', 'revision': 4, 'itemId': 'u1-read-2'};

Map<String, Object?> _snapshot(int total) => {
      'tier': 'free',
      'isPaid': false,
      'aiWallet': {
        'state': total > 0 ? 'available' : 'empty',
        'known': true,
        'spendable': total > 0,
        'total': total,
        'includedRemaining': total,
        'includedMonthlyCredits': 10,
        'bonusCredits': 0,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    };

/// A paid model reply: the route spreads the reply into the body and again under `response`.
Map<String, Object?> modelReply({int amount = 1, int total = 8, bool replayed = false, String text = 'Goodwill is what a buyer pays above the value of the net assets.'}) {
  final response = {
    'reply': text,
    'confidence': 0.6,
    'cards': <Object?>[],
    'origin': 'model',
    'mode': 'revision',
    'usage': {'inputTokens': 410, 'outputTokens': 96},
    'study': _study,
    'charge': {'kind': 'prepos_credit', 'creditUnits': replayed ? 0 : 1, 'amount': amount, 'reference': 'prepos:u1:abc'},
    if (replayed) 'replayed': true,
  };
  return {
    'sessionId': 's-1',
    'ok': true,
    ...response,
    'response': response,
    'runtimeState': replayed ? 'replayed' : 'live',
    'usageSnapshot': _snapshot(total),
  };
}

Map<String, dynamic> _body(RecordedRequest r) => r.body is String ? jsonDecode(r.body! as String) as Map<String, dynamic> : Map<String, dynamic>.from(r.body! as Map);

const _key = LessonHelpKey(runId: 'run-7', itemId: 'u1-read-2', revision: 4);

void main() {
  late FakeHttpAdapter http;
  late ProviderContainer c;
  late MemoryPrefsStore prefs;
  final now = DateTime.utc(2026, 10, 16, 9);

  ProviderContainer make({AiCredits? credits}) => ProviderContainer(overrides: [
        authSnapshotProvider.overrideWith(_FakeAuth.new),
        apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
        nowProvider.overrideWithValue(() => now),
        insightsPrefsStoreProvider.overrideWithValue(prefs),
        creditsRepositoryProvider.overrideWith(() => _Credits(credits ?? wallet())),
      ]);

  setUp(() {
    http = FakeHttpAdapter();
    prefs = MemoryPrefsStore();
  });
  tearDown(() {
    try {
      c.dispose();
    } on Error {
      // A test that never made a container has nothing to dispose.
    }
  });

  LessonHelpController ctl([LessonHelpKey key = _key]) => c.read(lessonHelpProvider(key).notifier);
  LessonHelpState state([LessonHelpKey key = _key]) => c.read(lessonHelpProvider(key));
  int refreshes() => (c.read(creditsRepositoryProvider.notifier) as _Credits).refreshes;
  List<RecordedRequest> chats() => http.requests.where((r) => r.path.contains('/mentor/chat')).toList();
  String sentId() => _body(chats().last)['requestId'] as String;

  group('the request is the website\'s', () {
    test('POST /api/ai/mentor/chat with the study fields, mode revision and a 32 character request id', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().send('Explain this more simply with an example.');
      expect(chats(), hasLength(1));
      final r = chats().single;
      expect(r.method, 'POST');
      expect(r.path, '/api/ai/mentor/chat');
      final body = _body(r);
      expect(body['message'], 'Explain this more simply with an example.');
      expect(body['mode'], 'revision');
      expect(body['studyRunId'], 'run-7');
      expect(body['studyRevision'], 4);
      expect(body['studyItemId'], 'u1-read-2');
      expect(body['requestId'], matches(RegExp(r'^[0-9a-f]{32}$')));
      // Nothing about the student's record or a question reference goes with it.
      expect(body.keys, unorderedEquals(['message', 'mode', 'studyRunId', 'studyRevision', 'studyItemId', 'requestId']));
    });

    test('the question is trimmed, an empty one sends nothing', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply());
      expect(await ctl().send('   '), isNull);
      expect(chats(), isEmpty);
      await ctl().send('  why  ');
      expect(_body(chats().single)['message'], 'why');
    });

    test('more than 500 characters is refused here and sends nothing', () async {
      c = make();
      expect(await ctl().send('x' * 501), HelpFailure.tooLong);
      expect(chats(), isEmpty);
      expect(state().failure, HelpFailure.tooLong);
    });

    test('a second send while one is on its way sends nothing', () async {
      c = make();
      http.hold = Completer<void>();
      http.handler = (o) => FakeReply(200, modelReply());
      final first = ctl().send('one');
      await Future<void>.delayed(Duration.zero);
      expect(state().sending, isTrue);
      expect(await ctl().send('two'), isNull);
      http.hold!.complete();
      await first;
      expect(chats(), hasLength(1));
    });
  });

  group('a reply says what the server charged', () {
    test('1 credit used, and the balance the server reported after it', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply());
      expect(await ctl().send('why'), isNull);
      final s = state();
      expect(s.answered, isTrue);
      expect(s.reply, contains('Goodwill'));
      expect(s.charged, 1);
      expect(s.left, 8);
      expect(c.read(lessonHelpWalletProvider(_key))!.total, 8);
      expect(LessonHelpCopy.charged(s.charged, s.left), '1 AI credit used. 8 left');
      expect(refreshes(), 1);
    });

    test('a saved reply comes back free: amount 0, replayed, no second charge', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply(amount: 0, total: 9, replayed: true));
      await ctl().send('why');
      final s = state();
      expect(s.replayed, isTrue);
      expect(s.charged, 0);
      expect(LessonHelpCopy.charged(s.charged, s.left, replayed: s.replayed), 'Already answered. No more credit used');
      expect(refreshes(), 0);
    });

    test('a reply whose charge did not commit says no credit was used', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply(amount: 0, total: 9));
      await ctl().send('why');
      expect(state().charged, 0);
      expect(LessonHelpCopy.charged(0, 9), 'No credit used');
    });

    test('a reply with no charge reported never claims one', () async {
      c = make();
      http.handler = (o) {
        final b = modelReply()..remove('charge');
        (b['response']! as Map).remove('charge');
        return FakeReply(200, b);
      };
      await ctl().send('why');
      expect(state().charged, isNull);
      expect(LessonHelpCopy.charged(null, 8), 'Check your AI credits for the final charge');
    });

    test('a reply with no words is not an explanation: nothing is shown as answered', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply(text: '   '));
      expect(await ctl().send('why'), HelpFailure.unavailable);
      expect(state().answered, isFalse);
    });

    test('paused: the server explains instead of answering and charges nothing', () async {
      c = make();
      http.handler = (o) => FakeReply(200, {
            'sessionId': 's-1',
            'ok': true,
            'reply': 'Replies are paused just now. Your free next step is: Revise ratios.',
            'origin': 'status',
            'confidence': 0,
            'cards': <Object?>[],
            'charge': {'kind': 'none', 'creditUnits': 0, 'amount': 0},
            'usageSnapshot': {..._snapshot(9), 'aiWallet': {..._snapshot(9)['aiWallet']! as Map, 'state': 'paused'}},
          });
      expect(await ctl().send('why'), HelpFailure.paused);
      expect(state().answered, isFalse);
      expect(c.read(lessonHelpWalletProvider(_key))!.paused, isTrue);
      expect(refreshes(), 0);
    });
  });

  group('each refusal ends in its own plain line and nothing is charged', () {
    test('402 insufficient_ai_credits: the balance it named, the wallet re-read, the renewal day', () async {
      c = make();
      http.handler = (o) => const FakeReply(402, {'ok': false, 'error': 'insufficient_ai_credits', 'status': 'blocked', 'required': 1, 'balance': 0, 'charged': 0});
      expect(await ctl().send('why'), HelpFailure.noCredits);
      expect(state().balance, 0);
      expect(c.read(lessonHelpWalletProvider(_key))!.empty, isTrue);
      expect(refreshes(), 1);
      expect(LessonHelpCopy.failNoCredits(0, '1 November'), contains('1 November'));
      expect(LessonHelpCopy.failNoCredits(0, '1 November'), contains('Lessons and recall cards stay free'));
    });

    test('422 ANSWER_FIRST: the step has not been answered yet, help is refused', () async {
      c = make();
      http.handler = (o) => const FakeReply(422, {'error': 'ANSWER_FIRST', 'message': 'Answer the current card first, or reopen the current lesson. No credits used.'});
      expect(await ctl().send('why'), HelpFailure.stepMoved);
      expect(state().answered, isFalse);
      expect(state().requestId, isNotNull, reason: 'a fresh id is made for the next question');
    });

    test('422 REVISION_CONFLICT and 400 invalid_run are the same: the step moved on', () async {
      c = make();
      http.handler = (o) => const FakeReply(422, {'error': 'REVISION_CONFLICT', 'message': 'x'});
      expect(await ctl().send('why'), HelpFailure.stepMoved);
      http.handler = (o) => const FakeReply(400, {'error': 'invalid_run'});
      expect(await ctl().send('why again'), HelpFailure.stepMoved);
    });

    test('operation_released: Send again goes with a fresh request id', () async {
      c = make();
      http.handler = (o) => const FakeReply(409, {'ok': false, 'error': 'operation_released', 'status': 'resend', 'charged': 0});
      expect(await ctl().send('why'), HelpFailure.resend);
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), isNot(first));
      expect(state().answered, isTrue);
    });

    test('in_progress: Send again asks for the same request, so it is not charged twice', () async {
      c = make();
      http.handler = (o) => const FakeReply(409, {'ok': false, 'error': 'in_progress', 'status': 'in_progress', 'charged': 0});
      expect(await ctl().send('why'), HelpFailure.inProgress);
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), first);
      expect(state().charged, 1);
    });

    test('offline: the same request id on the next try, and the question is kept', () async {
      c = make();
      http.handler = (o) => const FakeReply(-1, null);
      expect(await ctl().send('why'), HelpFailure.offline);
      expect(state().question, 'why');
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().retry();
      expect(sentId(), first);
      expect(state().answered, isTrue);
    });

    test('a changed question after a failure is a new request', () async {
      c = make();
      http.handler = (o) => const FakeReply(-1, null);
      await ctl().send('why');
      final first = sentId();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().send('why not');
      expect(sentId(), isNot(first));
    });

    for (final (code, status, failure) in [
      ('paused', 503, HelpFailure.paused),
      ('budget_reached', 503, HelpFailure.budgetReached),
      ('wallet_unavailable', 503, HelpFailure.walletUnavailable),
      ('provider_error', 502, HelpFailure.unavailable),
      ('unusable_output', 502, HelpFailure.unavailable),
      ('message_too_long', 413, HelpFailure.tooLong),
    ]) {
      test('$code ends as $failure and the question stays', () async {
        c = make();
        http.handler = (o) => FakeReply(status, {'ok': false, 'error': code, 'status': 'failed', 'charged': 0});
        expect(await ctl().send('why'), failure);
        expect(state().answered, isFalse);
        expect(state().question, 'why');
      });
    }

    test('429 from the rate limit says to wait', () async {
      c = make();
      http.handler = (o) => const FakeReply(429, {'error': 'Too many requests'});
      expect(await ctl().send('why'), HelpFailure.rateLimited);
    });
  });

  group('a question that was on its way when the app closed', () {
    test('comes back as a failed attempt with the same request id, for this step only', () async {
      c = make();
      http.handler = (o) => const FakeReply(-1, null);
      await ctl().send('why');
      final id = sentId();
      c.dispose();

      c = make();
      await ctl().restoreInterrupted();
      expect(state().failure, HelpFailure.interrupted);
      expect(state().question, 'why');
      expect(state().requestId, id);

      // Another step of the same lesson starts clean.
      await ctl(const LessonHelpKey(runId: 'run-7', itemId: 'u1-read-3', revision: 5)).restoreInterrupted();
      expect(state(const LessonHelpKey(runId: 'run-7', itemId: 'u1-read-3', revision: 5)).phase, HelpPhase.idle);
    });

    test('an answered question is forgotten', () async {
      c = make();
      http.handler = (o) => FakeReply(200, modelReply());
      await ctl().send('why');
      c.dispose();
      c = make();
      await ctl().restoreInterrupted();
      expect(state().phase, HelpPhase.idle);
    });
  });

  group('the words', () {
    test('the cost before sending names the pool and the balance', () {
      expect(LessonHelpCopy.cost(9), 'Uses 1 of your 9 AI credits');
      expect(LessonHelpCopy.cost(2), 'Uses 1 of your 2 AI credits');
      expect(LessonHelpCopy.cost(1), 'Uses your last AI credit');
      expect(LessonHelpCopy.cost(null), 'Uses 1 AI credit', reason: 'an unknown balance is never written as zero');
    });

    test('zero credits says when they renew, and that lessons stay free', () {
      expect(LessonHelpCopy.empty('1 November'), 'No AI credits left. They renew on 1 November. Lessons and recall cards stay free.');
      expect(renewDay(AskWallet.fromCredits(wallet(total: 0)), now), '1 November');
    });
  });

  group('the entry and the sheet', () {
    setUpAll(loadAppFonts);

    Future<void> pump(WidgetTester tester, {AiCredits? credits, bool disclosed = true}) async {
      c = make(credits: credits);
      if (disclosed) await prefs.setBool('ask_ai_service_disclosed', true);
      await pumpMockmob(
        tester,
        UncontrolledProviderScope(
          container: c,
          child: const Align(alignment: Alignment.topCenter, child: Padding(padding: EdgeInsets.all(16), child: LessonHelpEntry(helpKey: _key))),
        ),
        wrapInScaffold: true,
      );
    }

    testWidgets('the entry shows the cost against the balance before anything is sent', (tester) async {
      await pump(tester);
      expect(find.text('Explain this another way'), findsOneWidget);
      expect(find.text('Uses 1 of your 9 AI credits'), findsOneWidget);
      expect(chats(), isEmpty);
    });

    testWidgets('at zero the entry says when credits renew, and Ask is off in the sheet', (tester) async {
      await pump(tester, credits: wallet(total: 0));
      expect(find.text('No AI credits left. They renew on 1 November'), findsOneWidget);
      await tester.tap(find.text('Explain this another way'));
      await tester.pumpAndSettle();
      expect(find.text('No AI credits left. They renew on 1 November. Lessons and recall cards stay free.'), findsOneWidget);
      final ask = tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Ask'));
      expect(ask.onPressed, isNull);
      expect(chats(), isEmpty);
    });

    testWidgets('asking: the notice once, then the reply, what it cost and the balance left', (tester) async {
      await pump(tester, disclosed: false);
      http.handler = (o) => FakeReply(200, modelReply());
      await tester.tap(find.text('Explain this another way'));
      await tester.pumpAndSettle();
      expect(find.text('Uses 1 of your 9 AI credits'), findsWidgets);
      await tester.tap(find.text('Ask'));
      await tester.pumpAndSettle();
      expect(find.text('This question goes to an AI service'), findsOneWidget);
      expect(chats(), isEmpty, reason: 'nothing leaves the phone before the student agrees');
      await tester.tap(find.text('Send it'));
      await tester.pumpAndSettle();
      expect(chats(), hasLength(1));
      expect(find.textContaining('Goodwill is what a buyer pays'), findsOneWidget);
      expect(find.text('1 AI credit used. 8 left'), findsOneWidget);
      expect(find.text('Back to the lesson'), findsOneWidget);
    });

    testWidgets('a failed call says so, says no credit was used, and keeps the question', (tester) async {
      await pump(tester);
      http.handler = (o) => const FakeReply(502, {'ok': false, 'error': 'provider_error', 'status': 'failed', 'charged': 0});
      await tester.tap(find.text('Explain this another way'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ask'));
      await tester.pumpAndSettle();
      expect(find.text(LessonHelpCopy.failUnavailable), findsOneWidget);
      expect(find.text('No credit used'), findsOneWidget);
      expect(find.text(LessonHelpCopy.defaultQuestion), findsOneWidget);
    });
  });
}
