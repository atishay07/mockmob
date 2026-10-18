// The weeks ahead (D52 item 2, TODAY-SWIPE-1018): after Road to CUET, the next three calendar weeks
// as a dated list, then the milestones at this pace up to the exam. Pure arithmetic on the student's
// own plan (study days a week, the planned weekdays, the full-mock pace Road to CUET already shows)
// and the dates CuetDates states. Nothing here predicts marks:
//
// * a full mock in a week is the pace's suggestion ("suggested"), never a promise;
// * NTA's dates keep "expected";
// * a week with nothing planned is a "Rest week";
// * without a plan (no study days a week) there are no week rows, only the milestones;
// * what comes back in Revise is shown only when the server's due dates are known (never guessed
//   from the papers: the Revise schedule depends on answers the phone does not hold).
import 'dart:math' as math;

import '../../../core/domain/cuet_dates.dart';
import '../../onboarding/data/calendar.dart';
import 'road_board.dart';
import 'today_inputs.dart';

/// How many weeks the list names before the milestones.
const int aheadWeeks = 3;

/// One suggested full mock: its number in the overall goal and the day it lands on.
class AheadMock {
  const AheadMock({required this.number, required this.on});

  final int number;
  final DateTime on;
}

/// One calendar week ahead (Monday to Sunday).
class AheadWeek {
  const AheadWeek({
    required this.monday,
    required this.studyDays,
    this.days,
    this.mocks = const [],
    this.reviseBack,
    this.boards = false,
    this.next = false,
  });

  /// The week's Monday (a UTC date).
  final DateTime monday;
  DateTime get sunday => monday.add(const Duration(days: 6));

  /// Study days the plan asks for that week (board weeks at two).
  final int studyDays;

  /// The planned weekdays (0 = Monday), when the plan names them for this week; null otherwise.
  final Set<int>? days;
  final List<AheadMock> mocks;

  /// Questions due back in Revise that week, when the server's dates are known; null otherwise.
  final int? reviseBack;

  /// A week of the Class 12 boards: the plan goes lighter.
  final bool boards;

  /// The week right after this one ("Next week").
  final bool next;

  bool get rest => studyDays <= 0 && mocks.isEmpty;
}

enum AheadMilestoneKind { halfGoal, registration, boards, exam }

class AheadMilestone {
  const AheadMilestone({required this.kind, required this.from, this.to, this.number, this.daysAway = 0});

  final AheadMilestoneKind kind;
  final DateTime from;

  /// The end of a span (the boards).
  final DateTime? to;

  /// The full mock's number (half the goal).
  final int? number;

  /// Whole days from today.
  final int daysAway;
}

class WeeksAhead {
  const WeeksAhead({
    required this.weeks,
    required this.milestones,
    required this.daysToExam,
    required this.examDate,
    required this.ownDate,
    required this.mockTarget,
    this.perWeek,
    this.studyDaysLeft,
    this.mocksLeft,
  });

  /// Empty without a plan (then only the milestones show).
  final List<AheadWeek> weeks;
  final List<AheadMilestone> milestones;
  final int daysToExam;
  final DateTime examDate;
  final bool ownDate;
  final int mockTarget;

  /// Study days a week, null without a plan.
  final int? perWeek;
  final int? studyDaysLeft;

  /// Full mocks still to take for the goal; null while the record is unknown.
  final int? mocksLeft;

  bool get planned => perWeek != null;
}

/// The student's planned weekdays (0 = Monday): the week's own, else every day but the rest days.
Set<int>? plannedWeekdays(TodayInputs i) {
  final w = i.week;
  if (w == null) return null;
  final rest = i.profile?.restWeekdays ?? const <int>{};
  return w.planned ?? (rest.isEmpty ? null : {for (var d = 0; d < 7; d++) if (!rest.contains(d + 1)) d});
}

/// The day a suggested full mock lands on: its own day when the plan studies then, else the next
/// planned day (a full mock is a study day, never a day the plan leaves free). Road to CUET names
/// the same day, so the two never disagree.
DateTime snapToPlan(DateTime day, Set<int>? planned) {
  if (planned == null || planned.isEmpty) return day;
  for (var k = 0; k < 7; k++) {
    final d = day.add(Duration(days: k));
    if (planned.contains(d.weekday - 1)) return d;
  }
  return day;
}

bool _boardWeek(DateTime monday, DateTime exam) {
  final start = CuetCalendar.boardsStart(exam.year), end = CuetCalendar.boardsEnd(exam.year);
  final m = DateTime(monday.year, monday.month, monday.day);
  return !m.isBefore(start) && m.isBefore(end);
}

/// The weeks ahead for [board] (Road to CUET's own board). [reviseByWeek] is what the server says
/// comes back in Revise each week, by the week's Monday, when it says it; nothing is shown without it.
WeeksAhead buildWeeksAhead(TodayInputs i, {required RoadBoard board, Map<DateTime, int>? reviseByWeek}) {
  final today = i.date();
  final monday = today.subtract(Duration(days: i.clock().weekday - 1));
  final sunday = monday.add(const Duration(days: 6));
  final all = i.attempts;
  final known = all != null;
  final taken = board.mocksTaken ?? 0;
  final target = board.mockTarget ?? fortnightTarget(weeks: board.weeksToExam, taken: taken);
  final exam = board.examDate;
  final w = i.week;
  final perWeek = w == null || w.paused ? null : board.goal;
  final planned = plannedWeekdays(i);

  // The pace Road to CUET says: the rest of the target spread evenly to the exam, from the last mock.
  final paced = board.withTarget(target);
  final every = paced.daysPerMock;
  final mocks = <AheadMock>[];
  if (known && every != null) {
    final list = all;
    final mocksThisWeek = list.where((a) => a.isMock && !i.date(a.completedAt).isBefore(monday)).length;
    final last = board.lastMockAt;
    final nextDue = last == null ? today : last.add(Duration(days: every));
    final base = nextDue.isBefore(today) ? today : nextDue;
    // This week's suggested mock (the one Road to CUET's "Due this week" already holds) comes first.
    final dueThisWeek = list.isNotEmpty && mocksThisWeek == 0 && !base.isAfter(sunday);
    var number = taken + 1;
    var on = base;
    if (dueThisWeek) {
      number++;
      on = base.add(Duration(days: every));
    }
    final nextMonday = sunday.add(const Duration(days: 1));
    if (on.isBefore(nextMonday)) on = nextMonday;
    // The pace keeps its own rhythm; each mock is said on the planned day it lands on.
    while (number <= target && on.isBefore(exam)) {
      final day = snapToPlan(on, planned);
      if (!day.isBefore(exam)) break;
      mocks.add(AheadMock(number: number, on: day));
      number++;
      on = on.add(Duration(days: every));
    }
  }

  // Week rows only with a plan.
  final weeks = <AheadWeek>[];
  if (perWeek != null) {
    for (var k = 1; k <= aheadWeeks; k++) {
      final start = monday.add(Duration(days: 7 * k));
      final end = start.add(const Duration(days: 6));
      if (!start.isBefore(exam)) break;
      final boards = _boardWeek(start, exam);
      final days = boards && perWeek > CuetCalendar.boardWeekSessions ? CuetCalendar.boardWeekSessions : perWeek;
      // The weekdays are named only when the plan names exactly that many (a board week does not).
      final named = planned != null && planned.length == days ? planned : null;
      // The mock is on a planned day, the one Road to CUET names ("Next full mock Thu 22 Oct").
      final inWeek = [
        for (final m in mocks)
          if (!m.on.isBefore(start) && !m.on.isAfter(end)) m,
      ];
      weeks.add(AheadWeek(
        monday: start,
        studyDays: days,
        days: named,
        mocks: inWeek,
        reviseBack: reviseByWeek?[start],
        boards: boards,
        next: k == 1,
      ));
    }
  }

  // Then, at this pace: half the goal (when it lands after the listed weeks), registration, the
  // boards and the exam, each only while it is still ahead and before the exam.
  final milestones = <AheadMilestone>[];
  final listedTo = weeks.isEmpty ? sunday : weeks.last.sunday;
  if (perWeek != null && known) {
    final half = (target / 2).ceil();
    if (taken < half) {
      final at = mocks.where((m) => m.number == half).firstOrNull;
      if (at != null && at.on.isAfter(listedTo)) {
        milestones.add(AheadMilestone(kind: AheadMilestoneKind.halfGoal, from: at.on, number: half, daysAway: at.on.difference(today).inDays));
      }
    }
  }
  void add(AheadMilestoneKind kind, DateTime from, {DateTime? to}) {
    final end = to ?? from;
    if (!end.isAfter(today) || !from.isBefore(exam)) return;
    milestones.add(AheadMilestone(kind: kind, from: from, to: to, daysAway: math.max(0, from.difference(today).inDays)));
  }

  add(AheadMilestoneKind.registration, CuetDates.registrationStart);
  add(AheadMilestoneKind.boards, CuetDates.boardsStart, to: CuetDates.boardsEnd);
  milestones.sort((a, b) => a.from.compareTo(b.from));
  milestones.add(AheadMilestone(kind: AheadMilestoneKind.exam, from: exam, daysAway: board.daysToExam));

  return WeeksAhead(
    weeks: weeks,
    milestones: milestones,
    daysToExam: board.daysToExam,
    examDate: exam,
    ownDate: board.ownDate,
    mockTarget: target,
    perWeek: perWeek,
    studyDaysLeft: perWeek == null ? null : board.studyDaysLeft,
    mocksLeft: known ? math.max(0, target - taken) : null,
  );
}

