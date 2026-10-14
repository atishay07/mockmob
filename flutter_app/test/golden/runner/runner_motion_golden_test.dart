import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/sync/session/save_state.dart';

import '../../helpers/fonts.dart';
import '../../unit/runner/support/fake_session.dart';
import '../../unit/runner/support/harness.dart';

/// Frames from the middle of the runner's motion (runner.md 3.3 and 3.4, MOTION.md 4.6), so the
/// choreography itself can be looked at, not only the rest states. Every frame is rendered in
/// both themes: the lock-in dot and the chosen row's wash must read on paper as well as on night.
/// The test clock is fake, so every frame is the same on every run.
Future<void> _shot(String name, Brightness b) =>
    expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/motion_${name}_${b == Brightness.dark ? 'night' : 'day'}.png'));

FakeRunnerSession _practice({int index = 5, Map<String, int>? answers}) => FakeRunnerSession(
  questions: accountancyQuestions(20),
  mode: 'quick',
  mockNumber: null,
  chapter: 'Admission of a partner',
  currentIndex: index,
  answers: answers ?? {for (var i = 1; i <= index; i++) 'q$i': i % 4},
  visited: {for (var i = 1; i <= index + 1; i++) 'q$i'},
  save: const SaveSnapshot(state: SaveState.saved),
);

FakeRunnerSession _mock({int index = 5}) => FakeRunnerSession(
  questions: accountancyQuestions(50),
  currentIndex: index,
  answers: {for (var i = 1; i <= index; i++) 'q$i': i % 4},
  visited: {for (var i = 1; i <= index + 1; i++) 'q$i'},
  save: const SaveSnapshot(state: SaveState.saved),
);

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    group(b == Brightness.dark ? 'night' : 'day', () {
      testWidgets('practice lock-in: the wash bleeds out and one small dot is in the air, in the gutter', (tester) async {
        final s = _practice();
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await tester.tap(find.text(s.questions[s.currentIndex].options[1].text));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 110));
        await _shot('lock_in_mid', b);
        await tester.pump(const Duration(milliseconds: 200));
        await _shot('lock_in_landing', b);
        await tester.pump(const Duration(seconds: 1));
        await _shot('lock_in_settled', b);
      });

      testWidgets('mock lock-in: the wash only, no flight, the cell inks as it arrives', (tester) async {
        final s = _mock();
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await tester.tap(find.text(s.questions[s.currentIndex].options[1].text));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 110));
        await _shot('lock_in_mock_mid', b);
        await tester.pump(const Duration(milliseconds: 300));
        await _shot('lock_in_mock_landing', b);
        await tester.pump(const Duration(seconds: 1));
        await _shot('lock_in_mock_settled', b);
      });

      testWidgets('moving on: the next question rises in, the ring glides', (tester) async {
        await pumpRunner(tester, session: _practice(answers: {'q1': 0, 'q2': 1, 'q3': 2, 'q6': 1}), brightness: b);
        await settle(tester);
        await tester.tap(find.text('Next'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 90));
        await _shot('next_mid', b);
        await tester.pump(const Duration(seconds: 1));
        await _shot('next_settled', b);
      });

      testWidgets('the answer sheet opens as a wave', (tester) async {
        await pumpRunner(tester, session: _practice(index: 11), brightness: b);
        await settle(tester);
        await tester.tap(find.text('Questions'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 380));
        await _shot('palette_wave', b);
        await tester.pump(const Duration(seconds: 1));
      });
    });
  }
}
