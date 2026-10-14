import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';

import '../../helpers/fonts.dart';
import '../../unit/runner/support/fake_session.dart';
import '../../unit/runner/support/harness.dart';

Map<String, int> _answered(int n, {int skipFrom = 999}) => {
  for (var i = 1; i <= n; i++)
    if (i < skipFrom) 'q$i': (i * 7) % 4,
};

Future<void> _shot(WidgetTester tester, String name, Brightness b) =>
    expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${b == Brightness.dark ? 'night' : 'day'}.png'));

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    group(b == Brightness.dark ? 'night' : 'day', () {
      testWidgets('first question of a mock', (tester) async {
        await pumpRunner(tester, session: FakeRunnerSession(), brightness: b);
        await settle(tester);
        await _shot(tester, 'mock_first', b);
      });

      testWidgets('an answer inked and marked for review', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 11,
          answers: {..._answered(11), 'q12': 0},
          marked: {'q4', 'q12'},
          visited: {for (var i = 1; i <= 12; i++) 'q$i'},
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'mock_answered', b);
      });

      testWidgets('answers held back by the network', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 20,
          answers: _answered(20),
          visited: {for (var i = 1; i <= 21; i++) 'q$i'},
          unsynced: {'q18', 'q19', 'q20'},
          save: const SaveSnapshot(state: SaveState.waitingForNetwork, unsyncedAnswers: 3),
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'mock_offline', b);
      });

      testWidgets('the five minute warning', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 44,
          answers: _answered(44),
          visited: {for (var i = 1; i <= 45; i++) 'q$i'},
          remaining: const Duration(minutes: 4, seconds: 59),
          save: const SaveSnapshot(state: SaveState.saving, unsyncedAnswers: 1),
        );
        await pumpRunner(tester, session: s, brightness: b);
        s.warningController.add(SessionWarning.fiveMinutes);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        await _shot(tester, 'mock_warning', b);
        await tester.pump(const Duration(seconds: 4));
      });

      testWidgets('a passage question', (tester) async {
        final s = FakeRunnerSession(questions: passageQuestions(), subject: 'english', mockNumber: 3, currentIndex: 1, answers: {'p1': 0});
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'mock_passage', b);
      });

      testWidgets('practice skin at the start', (tester) async {
        final s = FakeRunnerSession(
          questions: accountancyQuestions(10),
          mode: 'quick',
          mockNumber: null,
          chapter: 'Admission of a partner',
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'practice_first', b);
      });

      // The practice skin on the paper sizes the bubble track has to fit (finding runner-practice-01).
      for (final (name, size, index) in [
        ('practice_q19_360', const Size(360, 780), 18),
        ('practice_q19_320', const Size(320, 640), 18),
        ('practice_q20_320', const Size(320, 640), 19),
      ]) {
        testWidgets('practice of 20 on question ${index + 1} at ${size.width.toInt()} dp', (tester) async {
          final s = FakeRunnerSession(
            questions: accountancyQuestions(20),
            mode: 'quick',
            mockNumber: null,
            chapter: 'Admission of a partner',
            currentIndex: index,
            answers: _answered(index, skipFrom: 6),
            visited: {for (var i = 1; i <= index + 1; i++) 'q$i'},
            save: const SaveSnapshot(state: SaveState.saved),
          );
          await pumpRunner(tester, session: s, brightness: b, size: size);
          await settle(tester);
          await _shot(tester, name, b);
        });
      }

      // The track with marked questions: the notch above each one is reviewable here.
      testWidgets('practice of 20 with marked questions on the track', (tester) async {
        final s = FakeRunnerSession(
          questions: accountancyQuestions(20),
          mode: 'quick',
          mockNumber: null,
          chapter: 'Admission of a partner',
          currentIndex: 9,
          answers: {..._answered(9), 'q10': 2}..remove('q6'),
          marked: {'q4', 'q6', 'q10', 'q14'},
          visited: {for (var i = 1; i <= 10; i++) 'q$i'},
          save: const SaveSnapshot(state: SaveState.saved),
        );
        await pumpRunner(tester, session: s, brightness: b, size: const Size(360, 780));
        await settle(tester);
        await _shot(tester, 'practice_marked_360', b);
      });

      testWidgets('practice: back after an interruption, the away strip over the meta line', (tester) async {
        final s = FakeRunnerSession(
          questions: accountancyQuestions(10),
          mode: 'quick',
          mockNumber: null,
          chapter: 'Goodwill',
          currentIndex: 4,
          answers: _answered(4),
          visited: {for (var i = 1; i <= 5; i++) 'q$i'},
          away: const AwayInfo(duration: Duration(minutes: 2, seconds: 10), allSaved: true, unsyncedAnswers: 0),
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'practice_away', b);
      });

      testWidgets('practice: answers held back by the network', (tester) async {
        final s = FakeRunnerSession(
          questions: accountancyQuestions(15),
          mode: 'quick',
          mockNumber: null,
          chapter: 'Retirement of a partner',
          currentIndex: 8,
          answers: _answered(8),
          visited: {for (var i = 1; i <= 9; i++) 'q$i'},
          unsynced: {'q6', 'q7', 'q8'},
          save: const SaveSnapshot(state: SaveState.waitingForNetwork, unsyncedAnswers: 3),
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'practice_offline', b);
      });

      testWidgets('practice: the server refused the answers, tap to retry', (tester) async {
        final s = FakeRunnerSession(
          questions: accountancyQuestions(10),
          mode: 'quick',
          mockNumber: null,
          chapter: 'Goodwill',
          currentIndex: 5,
          answers: _answered(5),
          visited: {for (var i = 1; i <= 6; i++) 'q$i'},
          unsynced: {'q4', 'q5'},
          save: const SaveSnapshot(state: SaveState.notSaved, unsyncedAnswers: 2),
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'practice_not_saved', b);
      });

      testWidgets('practice: large text 1.5x on a small phone', (tester) async {
        final s = FakeRunnerSession(
          questions: accountancyQuestions(10),
          mode: 'quick',
          mockNumber: null,
          chapter: 'Admission of a partner',
          currentIndex: 3,
          answers: {..._answered(3), 'q4': 1},
          visited: {for (var i = 1; i <= 4; i++) 'q$i'},
        );
        await pumpRunner(tester, session: s, brightness: b, size: const Size(360, 780), textScale: 1.5);
        await settle(tester);
        await _shot(tester, 'practice_large_text', b);
      });

      testWidgets('practice: a passage question', (tester) async {
        final s = FakeRunnerSession(
          questions: passageQuestions(),
          mode: 'quick',
          mockNumber: null,
          subject: 'english',
          chapter: 'Reading comprehension',
          currentIndex: 1,
          answers: {'p1': 0},
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'practice_passage', b);
      });

      testWidgets('back after an interruption', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 7,
          answers: _answered(7),
          visited: {for (var i = 1; i <= 8; i++) 'q$i'},
          away: const AwayInfo(duration: Duration(minutes: 2, seconds: 10), allSaved: true, unsyncedAnswers: 0),
        );
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'mock_away', b);
      });

      testWidgets('the palette sheet', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 23,
          answers: _answered(23)
            ..remove('q9')
            ..remove('q15'),
          marked: {'q4', 'q15', 'q21'},
          visited: {for (var i = 1; i <= 24; i++) 'q$i'},
          unsynced: {'q22', 'q23'},
          save: const SaveSnapshot(state: SaveState.saving, unsyncedAnswers: 2),
        );
        await pumpRunner(tester, session: s, brightness: b);
        await tester.tap(find.text('Questions'));
        await settle(tester);
        await _shot(tester, 'palette', b);
      });

      testWidgets('the leave guard', (tester) async {
        final s = FakeRunnerSession(currentIndex: 5, answers: _answered(5));
        await pumpRunner(tester, session: s, brightness: b);
        await tester.binding.handlePopRoute();
        await settle(tester);
        await _shot(tester, 'leave_guard', b);
      });

      testWidgets('submit page before submitting', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 49,
          answers: _answered(50)..removeWhere((k, _) => ['q9', 'q15', 'q31', 'q32', 'q47'].contains(k)),
          marked: {'q4', 'q15', 'q21', 'q40'},
          visited: {for (var i = 1; i <= 50; i++) 'q$i'},
        );
        await pumpRunner(tester, session: s, brightness: b, location: '/run/sess-1/submit');
        await settle(tester);
        await _shot(tester, 'submit_ready', b);
      });

      testWidgets('submit sending', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 49,
          answers: _answered(50)..remove('q9'),
          visited: {for (var i = 1; i <= 50; i++) 'q$i'},
          submit: const SubmitUiState(SubmitStage.sending),
          canAnswer: false,
        );
        await pumpRunner(tester, session: s, brightness: b, location: '/run/sess-1/submit');
        await settle(tester);
        await _shot(tester, 'submit_sending', b);
      });

      testWidgets('submit received', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 49,
          answers: _answered(50)..remove('q9'),
          visited: {for (var i = 1; i <= 50; i++) 'q$i'},
          canAnswer: false,
          submit: SubmitUiState(
            SubmitStage.received,
            outcome: SubmitReceived(attempt: const {'id': 'att-1'}, receivedAt: DateTime(2026, 10, 13, 22, 42)),
          ),
        );
        await pumpRunner(tester, session: s, brightness: b, location: '/run/sess-1/submit');
        await tester.pump(const Duration(milliseconds: 400));
        await tester.pump(const Duration(milliseconds: 400));
        await _shot(tester, 'submit_received', b);
        await tester.pump(const Duration(seconds: 2));
      });

      testWidgets('time up with no network', (tester) async {
        final s = FakeRunnerSession(
          currentIndex: 36,
          answers: _answered(36),
          visited: {for (var i = 1; i <= 37; i++) 'q$i'},
          endedByTimeUp: true,
          canAnswer: false,
          submit: const SubmitUiState(
            SubmitStage.pending,
            outcome: SubmitPending(ApiError(kind: ApiErrorKind.network, code: 'network')),
          ),
        );
        await pumpRunner(tester, session: s, brightness: b, location: '/run/sess-1/submit');
        await settle(tester);
        await _shot(tester, 'submit_pending', b);
      });

      testWidgets('submission window closed', (tester) async {
        final s = FakeRunnerSession(
          answers: _answered(31),
          endedByTimeUp: true,
          canAnswer: false,
          submit: const SubmitUiState(SubmitStage.windowClosed, outcome: SubmitWindowClosed()),
        );
        await pumpRunner(tester, session: s, brightness: b, location: '/run/sess-1/submit');
        await settle(tester);
        await _shot(tester, 'submit_closed', b);
      });

      testWidgets('large text on a small phone', (tester) async {
        final s = FakeRunnerSession(currentIndex: 11, answers: {'q12': 2}, marked: {'q12'});
        await pumpRunner(tester, session: s, brightness: b, size: const Size(360, 640), textScale: 2);
        await settle(tester);
        await _shot(tester, 'mock_large_text', b);
      });

      testWidgets('time ran out while away', (tester) async {
        await pumpRunner(tester, load: const RunnerEnded(isMock: true), brightness: b);
        await settle(tester);
        await _shot(tester, 'ended', b);
      });
    });
  }
}
