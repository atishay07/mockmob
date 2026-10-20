import 'package:flutter/material.dart';
import 'dart:ui' show Tristate;

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiCharacter;
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/runner/screens/submit_screen.dart';
import 'package:mockmob/features/runner/widgets/palette_sheet.dart';
import 'package:mockmob/features/runner/widgets/runner_controls.dart' show SheetKey;

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

Future<void> _flush(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 1));
  }
}

/// Fails with the full diagnostics (which widget, which constraints) when layout overflowed.
void _expectClean(WidgetTester tester) {
  final e = tester.takeException();
  if (e is FlutterError) fail(e.toStringDeep());
  expect(e, isNull);
}

void main() {
  setUpAll(loadAppFonts);

  group('answering', () {
    testWidgets('opens in focus mode and leaves it when the runner closes', (tester) async {
      final s = FakeRunnerSession();
      final h = await pumpRunner(tester, session: s);
      expect(h.systemUi.calls, ['enter']);
      expect(find.text('Questions'), findsOneWidget);
      expect(find.text('47:12'), findsOneWidget);

      await tester.binding.handlePopRoute();
      await settle(tester);
      await tester.tap(find.text('Leave the mock'));
      await settle(tester);
      expect(h.location, '/practice');
      expect(h.systemUi.calls, ['enter', 'exit']);
      // The open session was flushed and closed, never discarded.
      expect(s.closed, isTrue);
      expect(s.calls, isNot(contains('submit')));
    });

    testWidgets('choosing an option writes it, then ticks', (tester) async {
      final s = FakeRunnerSession();
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.text('3:2:1'));
      await tester.pump();
      expect(s.answers['q1'], 1);
      expect(h.haptics.calls, ['selection']);
      final node = tester.getSemantics(find.bySemanticsLabel('Option B, 3:2:1'));
      expect(node.flagsCollection.isSelected, Tristate.isTrue);

      await tester.tap(find.text('Clear my answer').last);
      await tester.pump();
      expect(s.answers.containsKey('q1'), isFalse);
      // Clearing is not a selection: no second tick.
      expect(h.haptics.calls, ['selection']);
    });

    testWidgets('the tick is the lock-in and nothing else', (tester) async {
      final s = FakeRunnerSession();
      final h = await pumpRunner(tester, session: s);
      // Locking an answer in ticks once.
      await tester.tap(find.text('3:2:1'));
      await tester.pump();
      expect(h.haptics.calls, ['selection']);
      // The same option again changes nothing: silent.
      await tester.tap(find.text('3:2:1'));
      await tester.pump();
      expect(h.haptics.calls, ['selection']);
      // Marking, moving and coming back are not lock-ins.
      await tester.tap(find.text('Mark for review'));
      await tester.pump();
      await tester.tap(find.text('Next'));
      await tester.pump();
      await tester.tap(find.text('Previous').last);
      await tester.pump();
      expect(h.haptics.calls, ['selection']);
      // Changing the answer to another option is a new lock-in; clearing it is not.
      await tester.tap(find.text('11:5:4'));
      await tester.pump();
      expect(h.haptics.calls, ['selection', 'selection']);
      await tester.tap(find.text('Clear my answer').last);
      await tester.pump();
      expect(h.haptics.calls, ['selection', 'selection']);
    });

    testWidgets('options are closed once answering stops', (tester) async {
      final s = FakeRunnerSession(canAnswer: false);
      await pumpRunner(tester, session: s);
      await tester.tap(find.text('3:2:1'));
      await tester.pump();
      expect(s.calls, isNot(contains('select q1 1')));
    });

    testWidgets('save and next, previous and mark move through the paper', (tester) async {
      final s = FakeRunnerSession();
      await pumpRunner(tester, session: s);
      expect(find.bySemanticsLabel('Question 1 of 50'), findsOneWidget);
      await tester.tap(find.text('Next'));
      await tester.pump();
      expect(s.currentIndex, 1);
      expect(find.bySemanticsLabel('Question 2 of 50'), findsOneWidget);
      // The question just left fades out under the arriving one for 110 ms.
      await settle(tester);

      await tester.tap(find.text('Mark for review'));
      await tester.pump();
      expect(s.marked, contains('q2'));
      expect(find.text('Marked for review'), findsOneWidget);

      await tester.tap(find.text('Previous').last);
      await tester.pump();
      expect(s.currentIndex, 0);
    });

    testWidgets('the palette jumps to a question', (tester) async {
      final s = FakeRunnerSession();
      await pumpRunner(tester, session: s);
      await tester.tap(find.text('Questions'));
      await settle(tester);
      expect(find.text('Your answer sheet'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Question 6, not visited'));
      await settle(tester);
      expect(s.currentIndex, 5);
      expect(find.text('Your answer sheet'), findsNothing);
    });

    testWidgets('no Mobi in the Questions sheet of a mock (L35)', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession());
      await tester.tap(find.text('Questions'));
      await settle(tester);
      expect(find.byType(PaletteSheet), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing, reason: 'nothing moves inside a timed paper');
    });

    testWidgets('a practice set keeps its one Mobi in the Questions sheet (L35)', (tester) async {
      await pumpRunner(tester, session: FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null));
      await tester.tap(find.text('Questions'));
      await settle(tester);
      expect(find.byType(MobiCharacter), findsOneWidget, reason: 'a practice set keeps its one Mobi');
    });

    testWidgets('keep going keeps the student in the mock', (tester) async {
      final s = FakeRunnerSession();
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.bySemanticsLabel('Leave the mock'));
      await settle(tester);
      expect(find.text('Leave this mock?'), findsOneWidget);
      // The warn pattern: two light impacts.
      expect(h.haptics.calls, ['light', 'light']);
      await tester.tap(find.text('Keep going'));
      await settle(tester);
      expect(h.location, '/run/sess-1');
      expect(s.closed, isFalse);
    });

    testWidgets('a warning holds the meta line for three seconds', (tester) async {
      final s = FakeRunnerSession(remaining: const Duration(minutes: 4, seconds: 59));
      final h = await pumpRunner(tester, session: s);
      s.warningController.add(SessionWarning.fiveMinutes);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.text('5 minutes left'), findsOneWidget);
      expect(h.haptics.calls, ['light']);
      await tester.pump(const Duration(seconds: 3, milliseconds: 100));
      expect(find.text('5 minutes left'), findsNothing);
    });

    testWidgets('pause and resume reach the engine', (tester) async {
      final s = FakeRunnerSession();
      await pumpRunner(tester, session: s);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(s.calls, containsAllInOrder(['paused', 'resumed']));
    });

    testWidgets('the practice skin hides the timer and says when marks come', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      expect(find.text('47:12'), findsNothing);
      expect(find.text('Marks come after you submit.'), findsOneWidget);
      await tester.tap(find.text('3:2:1'));
      await tester.pump();
      expect(find.textContaining('Marks come after you submit.'), findsNothing);
    });
  });

  group('submit', () {
    Map<String, int> all(int n) => {for (var i = 1; i <= n; i++) 'q$i': 0};

    testWidgets('review and submit, then the sealed sheet opens after the acknowledgement', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), currentIndex: 4, answers: all(4));
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.text('Review and submit'));
      await settle(tester);
      expect(find.text('Submit now?'), findsOneWidget);
      expect(find.text('1 not answered'), findsOneWidget);

      await tester.tap(find.text('Submit mock'));
      await _flush(tester);
      expect(find.text('Saved to your account at 10:42 PM.'), findsOneWidget);
      expect(h.afterSubmit, [s]);
      // The success pattern only after the 200: medium then light.
      await tester.pump(const Duration(milliseconds: 100));
      expect(h.haptics.calls, containsAllInOrder(['medium', 'light']));

      await tester.pump(SubmitPage.handOffDelay);
      await settle(tester);
      expect(h.location, '/result/att-1/sealed');
    });

    testWidgets('the hand-off line fills under the key, and a touch stops it (AP3-07, A22)', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), currentIndex: 4, answers: all(4));
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.text('Review and submit'));
      await settle(tester);
      await tester.tap(find.text('Submit mock'));
      await _flush(tester);
      await tester.pump(SubmitPage.handOffDelay ~/ 2);
      final line = find.byKey(const ValueKey('submit-handoff-line'));
      expect(line, findsOneWidget);
      expect(tester.widget<FractionallySizedBox>(line).widthFactor, closeTo(0.5, 0.1), reason: 'linear over the hand-off');
      await tester.tap(find.text(RunnerCopy.receivedTitle));
      await tester.pump(SubmitPage.handOffDelay);
      await settle(tester);
      expect(h.location, isNot('/result/att-1/sealed'), reason: 'a touch keeps the page');
      await tester.tap(find.text(RunnerCopy.openResult(true)));
      await settle(tester);
      expect(h.location, '/result/att-1/sealed');
    });

    testWidgets('practice hands off to the practice result', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(3), mode: 'quick', mockNumber: null, currentIndex: 2, answers: all(3));
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.text('Review and submit'));
      await settle(tester);
      await tester.tap(find.text('Submit practice'));
      await _flush(tester);
      await tester.tap(find.text('See your answers'));
      await settle(tester);
      expect(h.location, '/practice/result/att-1');
    });

    testWidgets('the receipt waits long enough to be read and its key tapped before the result opens by itself', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(3), mode: 'quick', mockNumber: null, currentIndex: 2, answers: all(3));
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.text('Review and submit'));
      await settle(tester);
      await tester.tap(find.text('Submit practice'));
      await _flush(tester);

      // The key showed for about 0.4 s on the device, then the result replaced it.
      await tester.pump(const Duration(milliseconds: 1500));
      expect(h.location, isNot(startsWith('/practice/result')), reason: 'still on the receipt, so it can be read');
      expect(find.text('Saved to your account at 10:42 PM.'), findsOneWidget);
      expect(find.text('See your answers'), findsOneWidget);

      await tester.pump(SubmitPage.handOffDelay);
      await settle(tester);
      expect(h.location, '/practice/result/att-1', reason: 'it still moves on by itself');
    });

    testWidgets('keep working goes back to the question', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(3), currentIndex: 2);
      final h = await pumpRunner(tester, session: s);
      await tester.tap(find.text('Review and submit'));
      await settle(tester);
      await tester.tap(find.text('Keep working'));
      await settle(tester);
      expect(h.location, '/run/sess-1');
      expect(find.text('Next'), findsNothing);
      expect(find.text('Review and submit'), findsOneWidget);
      expect(s.submits, 0);
    });

    testWidgets('time up opens the submit page with its stage', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5))..nextOutcome = null;
      final h = await pumpRunner(tester, session: s);
      // The engine submits by itself at zero.
      await s.submit(timedOut: true);
      await settle(tester);
      expect(find.text('Time is up.'), findsOneWidget);
      expect(find.text('Sending your answers'), findsOneWidget);
      expect(h.afterSubmit, isEmpty);
    });

    testWidgets('a submit owed from before a restart is retried on open', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5), submitOwedOnOpen: true)
        ..nextOutcome = const SubmitPending(ApiError(kind: ApiErrorKind.network, code: 'network'));
      final h = await pumpRunner(tester, session: s);
      await settle(tester);
      expect(s.submits, 1);
      expect(find.text('Not sent yet'), findsOneWidget);
      // One message, not two: where the answers are and what happens next.
      expect(find.text('Saved on this phone, not in your account yet. We send it when you are online.'), findsOneWidget);
      expect(find.text('Not on the server yet'), findsNothing);

      s.nextOutcome = SubmitReceived(attempt: const {'id': 'att-9'}, receivedAt: DateTime(2026, 10, 13, 22, 50));
      await tester.tap(find.text('Try again'));
      await _flush(tester);
      expect(s.submits, 2);
      expect(find.text('Saved to your account at 10:50 PM.'), findsOneWidget);
      await tester.pump(SubmitPage.handOffDelay);
      await settle(tester);
      expect(h.location, '/result/att-9/sealed');
    });

    testWidgets('back while sending does nothing; back after the window closed goes to Today', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(5))..nextOutcome = null;
      final h = await pumpRunner(tester, session: s, location: '/run/sess-1/submit');
      await settle(tester);
      await tester.tap(find.text('Submit mock'));
      await settle(tester);
      await tester.binding.handlePopRoute();
      await settle(tester);
      expect(h.location, '/run/sess-1/submit');

      s.submitState.value = const SubmitUiState(SubmitStage.windowClosed, outcome: SubmitWindowClosed());
      await settle(tester);
      expect(find.text('The submission window has ended, so this mock could not be recorded.'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await settle(tester);
      expect(h.location, '/today');
    });
  });

  group('opening', () {
    testWidgets('a session that is not on this phone offers Practice, and back goes there too', (tester) async {
      final h = await pumpRunner(tester, load: const RunnerMissing());
      await settle(tester);
      expect(find.text('This session is not on this phone.'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await settle(tester);
      expect(h.location, '/practice');
    });

    testWidgets('an ended session points to Today', (tester) async {
      final h = await pumpRunner(tester, load: const RunnerEnded(isMock: true));
      await settle(tester);
      expect(find.text('Time ran out on this mock.'), findsOneWidget);
      await tester.tap(find.text('Go to Today'));
      await settle(tester);
      expect(h.location, '/today');
    });
  });

  group('large text', () {
    for (final scale in [1.3, 2.0]) {
      testWidgets('runner, palette and submit page hold at $scale on a small phone', (tester) async {
        final s = FakeRunnerSession(currentIndex: 2, answers: {'q1': 0, 'q3': 2}, marked: {'q3'});
        await pumpRunner(tester, session: s, size: const Size(360, 640), textScale: scale);
        await settle(tester);
        _expectClean(tester);
        // At large text the Questions key keeps its glyph and gives up the word, so the count and
        // the clock keep their size.
        expect(find.text('Questions'), findsNothing);
        await tester.tap(find.byType(SheetKey));
        await settle(tester);
        _expectClean(tester);
        Navigator.of(tester.element(find.byType(PaletteSheet))).pop();
        await settle(tester);
        await s.goTo(49);
        await tester.pump();
        // On a 360 dp phone at large text the last key says "Review" (the long label would wrap).
        await tester.tap(find.text('Review'));
        await settle(tester);
        _expectClean(tester);
        expect(find.text('Submit mock'), findsOneWidget);
      });
    }
  });
}
