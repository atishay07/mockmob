// Regression tests for the verified robustness bugs in the insights area (ROBUSTNESS.json:
// ask-01 to ask-06) and for the motion rules the record and Ask follow in phase 2.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/insights/data/stream_controller.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/insights/screens/stream_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';
import 'package:mockmob/features/insights/widgets/motion_bits.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';
import 'support/insights_fixtures.dart';

class _SwitchableAuth extends AuthController {
  _SwitchableAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;

  void switchTo(AuthSnapshot next) => state = next;
}

class _FixedInsights extends InsightsRepository {
  _FixedInsights(this.value);

  final PrepInsights? value;

  @override
  RemoteState<PrepInsights> build() => RemoteState(value: value);
}

class _Credits extends CreditsRepository {
  @override
  RemoteState<AiCredits> build() => const RemoteState();

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _NoSaved extends SavedRepository {
  @override
  RemoteState<SavedList> build() => const RemoteState();

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Gate {
  final Completer<void> done = Completer<void>();
}

/// Records which question each key was drawn for.
class _SpyStream extends FixedStream {
  _SpyStream(super.fixed);

  final List<String> calls = [];

  @override
  void next([String? fromId]) => calls.add('next:$fromId');

  @override
  void skip([String? fromId]) => calls.add('skip:$fromId');

  @override
  void previous([String? fromId]) => calls.add('previous:$fromId');
}

Map<String, dynamic> _body(RecordedRequest r) => r.body is String ? jsonDecode(r.body! as String) as Map<String, dynamic> : Map<String, dynamic>.from(r.body! as Map);

const _pendingKey = 'ask_pending_request';

void main() {
  final containers = <ProviderContainer>[];
  final now = DateTime.utc(2026, 10, 13, 15);

  ProviderContainer make(FakeHttpAdapter http, {MemoryPrefsStore? store, PrepInsights? insights, String user = 'u1', FakeTokens? tokens}) {
    final c = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(() => _SwitchableAuth(AuthSnapshot(status: AuthStatus.signedIn, userId: user))),
      apiClientProvider.overrideWithValue(newApiClient(http, now: () => now, tokens: tokens ?? FakeTokens(userId: user))),
      nowProvider.overrideWithValue(() => now),
      insightsRepositoryProvider.overrideWith(() => _FixedInsights(insights)),
      savedRepositoryProvider.overrideWith(_NoSaved.new),
      creditsRepositoryProvider.overrideWith(_Credits.new),
      insightsPrefsStoreProvider.overrideWithValue(store ?? MemoryPrefsStore()),
    ]);
    containers.add(c);
    return c;
  }

  tearDown(() {
    for (final c in containers) {
      c.dispose();
    }
    containers.clear();
    MobiRation.reset();
  });

  Future<void> settle() async {
    for (var i = 0; i < 10; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  Iterable<RecordedRequest> logged(FakeHttpAdapter http, String type) =>
      http.requests.where((r) => r.path.endsWith('/interact') && _body(r)['interaction_type'] == type);

  // ---- ask-01: a double tap on Next or Skip -------------------------------------------------
  group('ask-01 the stream moves on once per question', () {
    test('a second Next from the same question does nothing; a stale Skip logs nothing', () async {
      final http = FakeHttpAdapter();
      final c = make(http);
      final keep = c.listen(streamControllerProvider, (_, _) {});
      final ctl = c.read(streamControllerProvider.notifier)..openSaved([question('q1'), question('q2'), question('q3')]);
      ctl.pick('A');

      ctl.next('q1');
      ctl.next('q1');
      expect(c.read(streamControllerProvider).index, 1, reason: 'the second tap was for a question that has already gone');

      // The Skip that was drawn for q1 lands after the screen is on q2: nothing is logged for q2.
      ctl.skip('q1');
      await settle();
      expect(c.read(streamControllerProvider).index, 1);
      expect(logged(http, 'skip'), isEmpty);

      // A Skip drawn for q2 is a real skip, once.
      ctl.skip('q2');
      ctl.skip('q2');
      await settle();
      expect(c.read(streamControllerProvider).index, 2);
      expect(logged(http, 'skip'), hasLength(1));

      ctl.previous('q3');
      ctl.previous('q3');
      expect(c.read(streamControllerProvider).index, 1, reason: 'Previous moves back one question, not two');
      keep.close();
    });

    testWidgets('each key on the screen names the question it was drawn for', (tester) async {
      final spy = _SpyStream(
        StreamState(
          filters: const StreamFilters(subject: 'accountancy'),
          questions: [question('q1'), question('q2')],
          phase: StreamPhase.ready,
          index: 1,
          picks: const {'q2': 'A'},
        ),
      );
      await pumpMockmob(
        tester,
        const StreamScreen(),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: [...insightsOverrides(), streamControllerProvider.overrideWith(() => spy)],
        wrapInScaffold: false,
      );
      await tester.tap(find.text(InsightsCopy.next));
      // The key itself ignores a second tap for 300 ms; one that lands later still names q2.
      await tester.tap(find.text(InsightsCopy.next));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text(InsightsCopy.next));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text(InsightsCopy.previous));
      expect(spy.calls, ['next:q2', 'next:q2', 'previous:q2']);
    });
  });

  // ---- ask-03: a question in flight survives the app being killed ---------------------------
  group('ask-03 a model question in flight is remembered', () {
    test('it is written before the request goes and cleared when the reply lands', () async {
      final http = FakeHttpAdapter();
      final store = MemoryPrefsStore();
      final c = make(http, store: store, insights: rich());
      final gate = _Gate();
      http.hold = gate.done;
      http.handler = (_) => const FakeReply(200, {'reply': 'Accrual is income earned, not yet received.', 'origin': 'model', 'actions': []});
      final sending = c.read(askControllerProvider.notifier).send('Explain accrual');
      await settle();
      final note = jsonDecode(store.values[_pendingKey]! as String) as Map<String, dynamic>;
      expect(note['text'], 'Explain accrual');
      expect(note['userId'], 'u1');
      expect(note['requestId'], _body(http.requests.single)['requestId']);

      gate.done.complete();
      expect(await sending, isNull);
      expect(store.values.containsKey(_pendingKey), isFalse);
    });

    test('after the process is killed the question comes back with Send again, on the same request id', () async {
      final store = MemoryPrefsStore();
      final firstHttp = FakeHttpAdapter();
      final gate = _Gate();
      firstHttp.hold = gate.done;
      final first = make(firstHttp, store: store, insights: rich());
      unawaited(first.read(askControllerProvider.notifier).send('Explain accrual'));
      await settle();
      final sentId = _body(firstHttp.requests.single)['requestId'];

      // A new process: the thread is empty, the note is on disk.
      final secondHttp = FakeHttpAdapter();
      final second = make(secondHttp, store: store, insights: rich());
      final ctl = second.read(askControllerProvider.notifier);
      expect(second.read(askControllerProvider).messages, isEmpty);
      await ctl.restoreInterrupted();
      final m = second.read(askControllerProvider).messages;
      expect(m, hasLength(2));
      expect(m[0].fromStudent, isTrue);
      expect(m[0].text, 'Explain accrual');
      expect(m[1].failure, AskFailure.interrupted);
      expect(m[1].requestId, sentId);

      secondHttp.handler = (_) => const FakeReply(200, {'reply': 'Accrual is income earned, not yet received.', 'origin': 'model', 'actions': []});
      await ctl.retry();
      expect(_body(secondHttp.requests.single)['requestId'], sentId, reason: 'the server dedupes on this id, so no second charge');
      expect(second.read(askControllerProvider).messages[1].origin, AskOrigin.model);
      expect(store.values.containsKey(_pendingKey), isFalse);

      gate.done.complete();
    });

    test('another account\'s note and an old note are not brought back; an old one is cleared', () async {
      final store = MemoryPrefsStore();
      store.values[_pendingKey] = jsonEncode({'text': 'Explain accrual', 'requestId': 'r1', 'userId': 'u2', 'at': now.toIso8601String()});
      final c = make(FakeHttpAdapter(), store: store);
      await c.read(askControllerProvider.notifier).restoreInterrupted();
      expect(c.read(askControllerProvider).messages, isEmpty);
      expect(store.values.containsKey(_pendingKey), isTrue, reason: 'it belongs to the other account');

      store.values[_pendingKey] = jsonEncode({
        'text': 'Explain accrual',
        'requestId': 'r1',
        'userId': 'u1',
        'at': now.subtract(const Duration(hours: 30)).toIso8601String(),
      });
      final c2 = make(FakeHttpAdapter(), store: store);
      await c2.read(askControllerProvider.notifier).restoreInterrupted();
      expect(c2.read(askControllerProvider).messages, isEmpty);
      expect(store.values.containsKey(_pendingKey), isFalse);
    });

    test('an offline send stays remembered; a refusal that charged nothing does not', () async {
      final store = MemoryPrefsStore();
      final http = FakeHttpAdapter();
      final c = make(http, store: store, insights: rich());
      final ctl = c.read(askControllerProvider.notifier);
      http.handler = (_) => const FakeReply.network();
      expect(await ctl.send('Explain accrual'), AskFailure.offline);
      expect(store.values.containsKey(_pendingKey), isTrue);

      http.handler = (_) => const FakeReply(402, {'ok': false, 'status': 'blocked', 'balance': 0});
      expect(await ctl.retry(), AskFailure.noCredits);
      expect(store.values.containsKey(_pendingKey), isFalse);
    });
  });

  // ---- ask-04: the question is never lost ---------------------------------------------------
  group('ask-04 the student\'s question stays', () {
    test('too long: the question stays in the thread, as its own bubble', () async {
      final c = make(FakeHttpAdapter(), insights: rich());
      final text = 'x' * (askMaxChars + 1);
      expect(await c.read(askControllerProvider.notifier).send(text), AskFailure.tooLong);
      final m = c.read(askControllerProvider).messages;
      expect(m, hasLength(2));
      expect(m[0].fromStudent, isTrue);
      expect(m[0].text, text);
      expect(m[1].failure, AskFailure.tooLong);
    });

    test('no credits: the bubble keeps the question, and Send again sends the same words after a top up', () async {
      final http = FakeHttpAdapter();
      final c = make(http, insights: rich());
      final ctl = c.read(askControllerProvider.notifier);
      http.handler = (_) => const FakeReply(402, {'ok': false, 'status': 'blocked', 'balance': 0});
      await ctl.send('Explain accrual');
      final failed = c.read(askControllerProvider).messages.last;
      expect(failed.failure, AskFailure.noCredits);
      expect(failed.retryText, 'Explain accrual');

      http.handler = (_) => const FakeReply(200, {'reply': 'Accrual is income earned, not yet received.', 'origin': 'model', 'actions': []});
      await ctl.retry();
      expect(_body(http.requests.last)['message'], 'Explain accrual');
      expect(c.read(askControllerProvider).messages.last.origin, AskOrigin.model);
    });

    for (final (failure, shown) in [
      (AskFailure.noCredits, true),
      (AskFailure.paused, true),
      (AskFailure.interrupted, true),
      (AskFailure.offline, true),
      (AskFailure.tooLong, false),
    ]) {
      testWidgets('${failure.name}: Send again is ${shown ? 'there' : 'not offered'}', (tester) async {
        await pumpMockmob(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: AskMessageView(message: AskMessage.failed(failure, balance: 0, retryText: 'Explain accrual'), onRetry: () {}),
          ),
          brightness: Brightness.dark,
          disableAnimations: true,
        );
        expect(find.text(InsightsCopy.sendAgain), shown ? findsOneWidget : findsNothing);
      });
    }

    testWidgets('a seed longer than the field takes is cut to what can be sent', (tester) async {
      await pumpMockmob(
        tester,
        AskScreen(seed: 'a' * 2000),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: insightsOverrides(),
        wrapInScaffold: false,
      );
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text.length, askMaxChars);
    });
  });

  // ---- ask-05: a save finishing after the account changed -----------------------------------
  group('ask-05 a save belongs to the account that tapped it', () {
    test('an answer that lands after another account signed in is not drawn into its marks', () async {
      final http = FakeHttpAdapter();
      final c = make(http);
      final ctl = c.read(saveControllerProvider.notifier);
      final gate = _Gate();
      http.hold = gate.done;
      http.handler = (_) => const FakeReply(200, {'saved': true, 'count': 9, 'limit': 25});
      final pending = ctl.set('q1', saved: true);
      await settle();
      expect(c.read(saveControllerProvider).pending, contains('q1'));

      // Account B signs in while the request is on its way.
      (c.read(authSnapshotProvider.notifier) as _SwitchableAuth).switchTo(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2'));
      gate.done.complete();
      final outcome = await pending;

      expect(outcome, isA<SaveDone>());
      final marks = c.read(saveControllerProvider);
      expect(marks.acked, isEmpty);
      expect(marks.count, isNull);
      expect(marks.limit, isNull);
      expect(marks.savedOf(question('q1')), isFalse);
    });

    test('a request for an account that has gone is refused before it is sent, and is not a save failure to show', () async {
      final http = FakeHttpAdapter();
      final tokens = FakeTokens(userId: 'u2');
      final c = make(http, tokens: tokens);
      final outcome = await c.read(saveControllerProvider.notifier).set('q1', saved: true);
      expect(http.requests, isEmpty);
      expect(outcome, isA<SaveFailed>());
      expect((outcome as SaveFailed).error.isAccountChanged, isTrue);
    });
  });

  // ---- ask-06: no control that is known to fail ---------------------------------------------
  group('ask-06 Report this reply only when the server can take it', () {
    final modelReply = AskState(messages: [
      const AskMessage.student('Explain accrual'),
      const AskMessage.reply('Accrual is income earned, not yet received.', origin: AskOrigin.model, requestId: 'r1'),
    ]);

    testWidgets('it is shown now that the endpoint is live (POST /api/ai/mentor/report, release 11)', (tester) async {
      expect(aiReplyReportLive, isTrue);
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: insightsOverrides(ask: modelReply),
        wrapInScaffold: false,
      );
      expect(find.text('Accrual is income earned, not yet received.'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.info));
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.aiCaveat), findsOneWidget);
      expect(find.text(InsightsCopy.reportReply), findsOneWidget);
    });

    testWidgets('it is shown once the endpoint is live', (tester) async {
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: [...insightsOverrides(ask: modelReply), aiReplyReportAvailableProvider.overrideWithValue(true)],
        wrapInScaffold: false,
      );
      expect(find.text(InsightsCopy.reportReply), findsNothing, reason: 'the report lives in the About sheet');
      await tester.tap(find.byIcon(LucideIcons.info));
      await tester.pumpAndSettle();
      expect(find.text(InsightsCopy.reportReply), findsOneWidget);
    });
  });

  // ---- Motion rules --------------------------------------------------------------------------
  group('a long wait says so (MOTION.md 1.1)', () {
    testWidgets('after 12 seconds the pending bubble changes its words and the dots stop looping', (tester) async {
      await pumpMockmob(
        tester,
        const Padding(padding: EdgeInsets.all(16), child: AskMessageView(message: AskMessage.sending(), onRetry: _noop)),
        brightness: Brightness.dark,
      );
      expect(find.text(InsightsCopy.askThinking), findsOneWidget);
      expect(find.text(InsightsCopy.askStillThinking), findsNothing);
      await tester.pump(const Duration(seconds: 12));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(InsightsCopy.askStillThinking), findsOneWidget);
      expect(find.text(InsightsCopy.askThinking), findsNothing);
    });
  });

  group('charts and figures start when they can be seen', () {
    setUpAll(loadAppFonts);

    Widget list(List<Widget> items) => SizedBox(height: 300, child: ListView(children: items));

    testWidgets('a bar below the fold waits for the scroll; reading the page does not start it early', (tester) async {
      var t = -1.0;
      await pumpMockmob(
        tester,
        list([
          const SizedBox(height: 450),
          GrowIn(builder: (context, v) {
            t = v;
            return const SizedBox(height: 40);
          }),
          const SizedBox(height: 600),
        ]),
        size: const Size(384, 300),
      );
      await tester.pump(const Duration(seconds: 1));
      expect(t, 0, reason: 'built a little ahead of the screen, but not drawn until it is in view');

      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pump(); // the frame after the scroll sees it and starts the draw
      await tester.pump();
      await tester.pump(Motion.drawIn + const Duration(milliseconds: 50));
      expect(t, 1);
    });

    testWidgets('under reduced motion a chart is drawn complete at once', (tester) async {
      var t = -1.0;
      await pumpMockmob(
        tester,
        list([
          const SizedBox(height: 450),
          GrowIn(builder: (context, v) {
            t = v;
            return const SizedBox(height: 40);
          }),
        ]),
        size: const Size(384, 300),
        disableAnimations: true,
      );
      expect(t, 1);
    });

    testWidgets('a figure rolls up once seen, and follows a new value from the old one', (tester) async {
      final value = ValueNotifier<int>(42);
      await pumpMockmob(
        tester,
        list([
          const SizedBox(height: 450),
          ValueListenableBuilder<int>(
            valueListenable: value,
            builder: (context, v, _) => CountOnView(value: v, style: const TextStyle(fontSize: 20)),
          ),
          const SizedBox(height: 600),
        ]),
        size: const Size(384, 300),
      );
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('0', skipOffstage: false), findsOneWidget);

      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pump();
      await tester.pump();
      await tester.pump(Motion.countUp + const Duration(milliseconds: 50));
      expect(find.text('42'), findsOneWidget);

      value.value = 50;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      final mid = int.parse(tester.widget<Text>(find.byType(Text).last).data!);
      expect(mid, inInclusiveRange(42, 50), reason: 'it rolls from 42, never from 0');
      await tester.pump(Motion.countUp);
      expect(find.text('50'), findsOneWidget);
    });
  });

  group('the record page', () {
    testWidgets('sections do not fade up as they are built, and the pull is the app\'s own', (tester) async {
      await pumpMockmob(
        tester,
        const InsightsScreen(),
        brightness: Brightness.dark,
        disableAnimations: true,
        size: const Size(384, 3000),
        overrides: insightsOverrides(),
        wrapInScaffold: false,
      );
      expect(find.byType(RiseIn), findsNothing);
      expect(find.byType(RefreshIndicator), findsNothing);
      expect(find.byType(MmPullRefresh), findsOneWidget);
    });
  });
}

void _noop() {}
