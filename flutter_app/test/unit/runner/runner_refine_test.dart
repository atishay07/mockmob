import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/runner_bottom_bar.dart';
import 'package:mockmob/features/runner/widgets/runner_meta_row.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// The practice's stall fact on the meta line, and the bottom bar's one ready beat.
void main() {
  setUpAll(loadAppFonts);

  List<String> optionsOf(FakeRunnerSession s, int i) => [for (final o in s.questions[i].options) o.text];

  Finder stallLine() => find.descendant(of: find.byType(RunnerMetaRow), matching: find.textContaining('On this question for'));

  group('the stall fact (practice only)', () {
    test('it reads as real minutes and seconds', () {
      expect(RunnerCopy.onThisQuestion(const Duration(seconds: 90)), 'On this question for 1:30');
      expect(RunnerCopy.onThisQuestion(const Duration(minutes: 12, seconds: 5)), 'On this question for 12:05');
    });

    // The session's clock ticks the time left every second; the fake's is moved by hand.
    Future<void> elapse(WidgetTester tester, FakeRunnerSession s, int seconds) async {
      for (var i = 0; i < seconds; i++) {
        s.remaining.value -= const Duration(seconds: 1);
      }
      await tester.pump();
    }

    testWidgets('after 90 s untouched the meta line says so, and a tap takes it away', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await elapse(tester, s, 89);
      expect(stallLine(), findsNothing, reason: 'nothing before 90 s');
      await elapse(tester, s, 1);
      expect(find.text('On this question for 1:30'), findsOneWidget);
      await elapse(tester, s, 5);
      expect(find.text('On this question for 1:35'), findsOneWidget, reason: 'the real elapsed time');
      await tester.tap(find.text(optionsOf(s, 0)[1]));
      await tester.pump();
      expect(stallLine(), findsNothing);
      await elapse(tester, s, 30);
      expect(stallLine(), findsNothing, reason: 'the count starts again from the tap');
      await settle(tester);
    });

    testWidgets('moving to another question starts its own count', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s);
      await settle(tester);
      await elapse(tester, s, 60);
      await tester.tap(find.text('Next'));
      await settle(tester);
      await elapse(tester, s, 60);
      expect(stallLine(), findsNothing);
      await elapse(tester, s, 30);
      expect(stallLine(), findsOneWidget);
    });

    testWidgets('a timed mock never shows it', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'full');
      await pumpRunner(tester, session: s);
      await settle(tester);
      await elapse(tester, s, 200);
      expect(stallLine(), findsNothing);
    });
  });

  group('the ready beat', () {
    testWidgets('the last answer, once saved, plays one beat with a soft haptic', (tester) async {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(3),
        mode: 'quick',
        mockNumber: null,
        currentIndex: 2,
        answers: {'q1': 0, 'q2': 1},
      );
      final h = await pumpRunner(tester, session: s);
      await settle(tester);
      h.haptics.calls.clear();
      await tester.tap(find.text(optionsOf(s, 2)[0]));
      await tester.pump();
      expect(h.haptics.calls, ['selection', 'selection'], reason: 'the option tick, then the ready beat');
      await tester.pump(RunnerBottomBar.readyBeat);
      await settle(tester);
      // Clearing and answering again does not replay it.
      await tester.tap(find.text(RunnerCopy.clearAnswer).last);
      await settle(tester, ms: 400);
      h.haptics.calls.clear();
      await tester.tap(find.text(optionsOf(s, 2)[1]));
      await settle(tester);
      expect(h.haptics.calls, ['selection'], reason: 'the beat plays once');
    });

    testWidgets('it waits for the save to be acknowledged', (tester) async {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(3),
        mode: 'quick',
        mockNumber: null,
        currentIndex: 2,
        answers: {'q1': 0, 'q2': 1},
        save: const SaveSnapshot(state: SaveState.saving),
      );
      final h = await pumpRunner(tester, session: s);
      await settle(tester);
      h.haptics.calls.clear();
      await tester.tap(find.text(optionsOf(s, 2)[0]));
      await settle(tester);
      expect(h.haptics.calls, ['selection'], reason: 'no beat before the server holds the answer');
      s.saveState.value = const SaveSnapshot(state: SaveState.saved);
      await tester.pump();
      expect(h.haptics.calls, ['selection', 'selection']);
      await settle(tester);
    });

    testWidgets('never on a reload of a paper already complete', (tester) async {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(3),
        mode: 'quick',
        mockNumber: null,
        answers: {'q1': 0, 'q2': 1, 'q3': 2},
      );
      final h = await pumpRunner(tester, session: s);
      await settle(tester);
      expect(h.haptics.calls, isNot(contains('selection')));
      expect(find.byType(RunnerBottomBar), findsOneWidget);
    });

    testWidgets('in Daylight the edge is drawn round the key and stays', (tester) async {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(3),
        mode: 'quick',
        mockNumber: null,
        currentIndex: 2,
        answers: {'q1': 0, 'q2': 1},
      );
      await pumpRunner(tester, session: s, brightness: Brightness.light);
      await settle(tester);
      final edge = find.descendant(of: find.byType(RunnerBottomBar), matching: find.byType(CustomPaint));
      final before = edge.evaluate().length;
      await tester.tap(find.text(optionsOf(s, 2)[0]));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(edge.evaluate().length, greaterThan(before), reason: 'the edge painter is up while the beat draws');
      await settle(tester);
      expect(tester.takeException(), isNull);
    });
  });
}
