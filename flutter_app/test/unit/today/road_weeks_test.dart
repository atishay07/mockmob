// The road's strip of weeks (L05) and the pace strip's weekday picks: pure arithmetic, so the
// pips on the rail and the lead figure's study days can never disagree.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/logic/plan_adjust.dart';
import 'package:mockmob/features/today/logic/road_board.dart' show sessionsUntil;
import 'package:mockmob/features/today/logic/road_weeks.dart';

void main() {
  final today = DateTime(2026, 10, 16);
  final windowStart = DateTime(2027, 5, 1);

  group('buildRoadWeeks', () {
    test('one column a week from today to the exam, the exam column last', () {
      final weeks = buildRoadWeeks(today: today, examDate: windowStart, goal: 4, weekDone: 1);
      final whole = windowStart.difference(today).inDays ~/ 7;
      expect(weeks.length, whole + 1);
      expect(weeks.last.exam, isTrue);
      expect(weeks.first.done, 1);
      expect(weeks.first.thisWeek, isTrue);
    });

    test('boards weeks hold two study days at most', () {
      final weeks = buildRoadWeeks(today: today, examDate: windowStart, goal: 5);
      final boards = weeks.where((w) => w.boards).toList();
      expect(boards, isNotEmpty);
      expect(boards.every((w) => w.planned == 2), isTrue);
      expect(weeks.where((w) => !w.boards && !w.exam).every((w) => w.planned == 5), isTrue);
    });

    test('the planned days add up to sessionsUntil for every goal and three dates', () {
      for (final exam in [windowStart, DateTime(2027, 5, 20), DateTime(2027, 1, 10)]) {
        for (var goal = 1; goal <= 7; goal++) {
          final weeks = buildRoadWeeks(today: today, examDate: exam, goal: goal);
          expect(plannedTotal(weeks), sessionsUntil(today, exam, daysPerWeek: goal), reason: 'goal $goal to $exam');
        }
      }
    });

    test('no goal plans no days', () {
      final weeks = buildRoadWeeks(today: today, examDate: windowStart, goal: null);
      expect(plannedTotal(weeks), 0);
    });

    test('mocks spread evenly after this week, skipping boards while other weeks suffice', () {
      final weeks = buildRoadWeeks(today: today, examDate: windowStart, goal: 4, mocksLeft: 8);
      expect(weeks.fold<int>(0, (s, w) => s + w.plannedMocks), 8);
      expect(weeks.first.plannedMocks, 0);
      expect(weeks.where((w) => w.boards).every((w) => w.plannedMocks == 0), isTrue);
    });

    test('more mocks than weeks put two in a week', () {
      final weeks = buildRoadWeeks(today: today, examDate: DateTime(2026, 11, 20), goal: 4, mocksLeft: 7);
      expect(weeks.fold<int>(0, (s, w) => s + w.plannedMocks), 7);
      expect(weeks.any((w) => w.plannedMocks == 2), isTrue);
      expect(weeks.every((w) => w.plannedMocks <= 2), isTrue);
    });

    test('an exam today or past gives no road', () {
      expect(buildRoadWeeks(today: today, examDate: today, goal: 4), isEmpty);
    });
  });

  group('adjustPlan', () {
    test('keeps the student\'s own picks and adds or drops one at a time', () {
      final plan = {0, 1, 3, 5}; // Mon, Tue, Thu, Sat
      final five = adjustPlan(plan, 5);
      expect(five.length, 5);
      expect(five.containsAll(plan), isTrue);
      final three = adjustPlan(plan, 3);
      expect(three.length, 3);
      expect(plan.containsAll(three), isTrue);
    });

    test('every size from every size lands on the asked count, stably', () {
      for (var from = 1; from <= 7; from++) {
        for (var to = 1; to <= 7; to++) {
          final start = adjustPlan(null, from);
          final a = adjustPlan(start, to), b = adjustPlan(start, to);
          expect(a.length, to);
          expect(a, b);
        }
      }
    });

    test('no plan spreads the days', () {
      expect(adjustPlan(null, 3).length, 3);
      expect(adjustPlan(const {}, 7), {0, 1, 2, 3, 4, 5, 6});
    });
  });
}
