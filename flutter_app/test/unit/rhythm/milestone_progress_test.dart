import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/milestone_progress.dart';
import 'package:mockmob/features/rhythm/logic/plan_week.dart';

Attempt _set(String id, {int correct = 7, int wrong = 2, String scoring = 'server_practice_v1'}) => Attempt.fromJson({
      'id': id,
      'subject': 'accountancy',
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': 1,
      'total': 10,
      'details': const [],
      'questionsSnapshot': const [],
      'selectionMeta': {'mode': 'quick', 'scoringVersion': scoring},
      'completedAt': DateTime.utc(2026, 10, 1).millisecondsSinceEpoch,
    });

Rhythm _rhythm({List<RhythmWeek>? history, bool metThisWeek = false, List<RhythmMilestone> milestones = const []}) => Rhythm(
      timeZone: 'Asia/Kolkata',
      weekStart: '2026-10-12',
      studyDays: 1,
      studyDayDates: const ['2026-10-12'],
      daysGoal: 4,
      metThisWeek: metThisWeek,
      paused: false,
      weeksMetStreak: 0,
      bestRun: 0,
      history: history,
      milestones: milestones,
    );

void main() {
  group('milestone progress counts only what the app holds in full', () {
    test('scored sets: server scored with 5 or more answers', () {
      final attempts = [_set('a'), _set('b'), _set('c', correct: 2, wrong: 1), _set('d', scoring: 'device_v0')];
      expect(milestoneProgress(attempts: attempts)['sessions_10'], 2);
    });

    test('weeks at the goal from a complete history plus this week once met', () {
      const history = [
        RhythmWeek(weekStart: '2026-10-05', studyDays: 4, goal: 4, met: true),
        RhythmWeek(weekStart: '2026-09-28', studyDays: 1, goal: 4, met: false),
      ];
      expect(milestoneProgress(rhythm: _rhythm(history: history, metThisWeek: true))['weeks_met_4'], 2);
    });

    test('a history cut at the server limit is not counted', () {
      final history = [for (var k = 0; k < rhythmHistoryWeeks; k++) RhythmWeek(weekStart: 'w$k', studyDays: 0, goal: 4, met: false)];
      expect(milestoneProgress(rhythm: _rhythm(history: history)).containsKey('weeks_met_4'), isFalse);
    });

    test('a count that disagrees with the server is dropped, and an earned step needs none', () {
      final ten = [for (var k = 0; k < 10; k++) _set('s$k')];
      expect(milestoneProgress(attempts: ten).containsKey('sessions_10'), isFalse);
      final earned = _rhythm(milestones: [RhythmMilestone(id: 'sessions_10', achievedAt: DateTime.utc(2026, 10, 1))]);
      expect(milestoneProgress(attempts: [_set('a')], rhythm: earned).containsKey('sessions_10'), isFalse);
    });

    test('repairs are never guessed', () {
      expect(milestoneProgress(attempts: [_set('a')], rhythm: _rhythm(history: const [])).keys, isNot(contains('repairs_5')));
    });
  });

  group('the planned week', () {
    test('counted, planned ahead, rest by choice, and a passed planned day is just open', () {
      final days = planWeek(studied: [false, true, false, false, false, false, false], todayIndex: 3, planned: {0, 1, 3, 5});
      expect(days.map((d) => d.mark), [
        PlanDayMark.open,
        PlanDayMark.done,
        PlanDayMark.rest,
        PlanDayMark.planned,
        PlanDayMark.rest,
        PlanDayMark.planned,
        PlanDayMark.rest,
      ]);
      expect(days[3].describe(), 'Thursday, today, planned study day');
    });

    test('a rest day studied anyway counts', () {
      final days = planWeek(studied: [false, false, true, false, false, false, false], todayIndex: 2, planned: {0, 1});
      expect(days[2].mark, PlanDayMark.done);
    });

    test('a day that passed is read as rest or not studied, never "no study yet"', () {
      final days = planWeek(studied: [true, false, false, false, false, false, false], todayIndex: 3, planned: {0, 1, 3, 5});
      expect(days[0].describe(), 'Monday, study day, counted');
      expect(days[1].describe(), 'Tuesday, not studied');
      expect(days[2].describe(), 'Wednesday, rest day');
      expect(days[3].describe(), 'Thursday, today, planned study day');
      expect(days[5].describe(), 'Saturday, planned study day');
      // With no plan, a passed day is still not studied; today and ahead have no study yet.
      final noPlan = planWeek(studied: List.filled(7, false), todayIndex: 2);
      expect(noPlan[1].describe(), 'Tuesday, not studied');
      expect(noPlan[2].describe(), 'Wednesday, today, no study yet');
      expect(noPlan[4].describe(), 'Friday, no study yet');
    });

    test('without a plan nothing is drawn as rest', () {
      final days = planWeek(studied: List.filled(7, false), todayIndex: 0);
      expect(days.every((d) => d.mark == PlanDayMark.open), isTrue);
    });
  });
}
