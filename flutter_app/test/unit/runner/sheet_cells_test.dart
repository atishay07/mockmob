import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/data/runner_effects.dart';
import 'package:mockmob/features/runner/logic/sheet_cells.dart';

import 'support/fake_session.dart';

void main() {
  group('sheet cells', () {
    test('each fact is its own flag', () {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(5),
        currentIndex: 2,
        answers: {'q1': 0, 'q3': 2},
        marked: {'q2'},
        visited: {'q1', 'q2'},
        unsynced: {'q3'},
      );
      final cells = sheetCellsOf(s);
      expect(cells.map((c) => c.answered), [true, false, true, false, false]);
      expect(cells.map((c) => c.visited), [true, true, true, false, false]);
      expect(cells.map((c) => c.marked), [false, true, false, false, false]);
      expect(cells.map((c) => c.unsynced), [false, false, true, false, false]);
      expect(cells.map((c) => c.current), [false, false, true, false, false]);
    });

    test('counts add up: not answered includes not visited', () {
      final s = FakeRunnerSession(
        questions: accountancyQuestions(10),
        currentIndex: 4,
        answers: {'q1': 0, 'q2': 1, 'q4': 3},
        marked: {'q2', 'q3'},
        visited: {'q1', 'q2', 'q3', 'q4'},
      );
      final counts = sheetCountsOf(sheetCellsOf(s));
      expect(counts.answered, 3);
      expect(counts.notAnswered, 7);
      expect(counts.notVisited, 5);
      expect(counts.marked, 2);
      expect(counts.total, 10);
    });

    test('a passage range covers the neighbours that share it', () {
      final s = FakeRunnerSession(questions: [...accountancyQuestions(2), ...passageQuestions()]);
      expect(passageRangeOf(s, 0), isNull);
      expect(passageRangeOf(s, 2), (3, 5));
      expect(passageRangeOf(s, 4), (3, 5));
    });
  });

  group('copy', () {
    test('durations read as words', () {
      expect(RunnerCopy.durationWords(const Duration(minutes: 2, seconds: 10)), '2 minutes 10 seconds');
      expect(RunnerCopy.durationWords(const Duration(minutes: 47, seconds: 12)), '47 minutes 12 seconds');
      expect(RunnerCopy.durationWords(const Duration(hours: 1, minutes: 2, seconds: 18)), '1 hour 2 minutes 18 seconds');
      expect(RunnerCopy.durationWords(const Duration(minutes: 5)), '5 minutes');
      expect(RunnerCopy.durationWords(Duration.zero), '0 seconds');
      expect(RunnerCopy.timerSemantics(const Duration(minutes: 47, seconds: 12)), 'Time left, 47 minutes 12 seconds');
    });

    test('palette cells read every fact', () {
      expect(
        RunnerCopy.cellSemantics(number: 12, answered: true, visited: true, marked: true, unsynced: true, current: false),
        'Question 12, answered, marked for review, on this phone',
      );
      expect(
        RunnerCopy.cellSemantics(number: 30, answered: false, visited: false, marked: false, unsynced: false, current: false),
        'Question 30, not visited',
      );
    });

    test('the leave guard names the real deadline in 12-hour time', () {
      expect(
        RunnerCopy.leaveBody(isMock: true, until: DateTime(2026, 10, 13, 23, 42)),
        'The clock keeps running. Your answers stay in the mock and you can continue until 11:42 PM.',
      );
    });

    test('received names the acknowledgement time', () {
      expect(RunnerCopy.received(DateTime(2026, 10, 13, 22, 42)), 'Answers received. Saved on the server at 10:42 PM.');
    });

    test('labels', () {
      expect(RunnerCopy.sessionLabel(isMock: true, mode: 'full', mockNumber: 7), 'Mock 7');
      expect(RunnerCopy.sessionLabel(isMock: true, mode: 'nta', mockNumber: null), 'NTA mode');
      expect(RunnerCopy.sessionLabel(isMock: false, mode: 'quick', mockNumber: null), 'Quick practice');
      expect(RunnerCopy.subjectLine('business_studies', 'Planning'), 'Business Studies, Planning');
    });
  });

  test('a received mock opens the sealed sheet, practice the practice result', () {
    expect(resultRouteFor(isMock: true, attemptId: 'a1'), '/result/a1/sealed');
    expect(resultRouteFor(isMock: false, attemptId: 'a1'), '/practice/result/a1');
  });
}
