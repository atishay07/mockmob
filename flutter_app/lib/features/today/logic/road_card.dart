// "Your road to CUET" as plain values (V15-SPEC section 2): the card on Today and everything the
// Adjust plan sheet shows. Pure arithmetic on the student's own plan and record: the weeks to the
// date, this week's study days and full mocks, one milestone in words, three named mock plans with
// their computed totals, and the week-by-week list that only the sheet draws. Nothing here
// predicts marks or chances.
import 'dart:math' as math;

import '../../../core/copy/formatters.dart' show formatDayMonthShort;
import '../../rhythm/logic/plan_week.dart' show PlanDayMark;
import '../../onboarding/data/calendar.dart';
import '../copy.dart';
import 'road_board.dart';
import 'road_weeks.dart' show plannedFor;
import 'today_model.dart';

/// The three named mock plans (the old slider, as choices a student can read).
enum MockPace {
  light(0.5),
  steady(1),
  intense(2);

  const MockPace(this.perWeek);

  /// Full mocks a week.
  final double perWeek;
}

/// One plan as a row of the Adjust plan sheet: its name, its pace in words and its total.
class MockPlanChoice {
  const MockPlanChoice({required this.pace, required this.name, required this.line, required this.total, required this.recommended});

  final MockPace pace;
  final String name;

  /// "One every two weeks".
  final String line;

  /// Full mocks on the record plus the ones this plan adds before the date.
  final int total;
  final bool recommended;
}

/// Weeks the plans are counted over: the weeks to the date, at least one. This week is the first
/// of them, so a plan's total counts the mocks taken before this week plus one slot for each week.
int planWeekCount(RoadBoard b) => math.max(1, b.weeksToExam);

/// Full mocks taken in the week that today is in (Monday to Sunday).
int mocksThisWeek(RoadBoard b) {
  final monday = mondayOf(b.today);
  final next = monday.add(const Duration(days: 7));
  return b.mockDays.where((d) {
    final day = _day(d);
    return !day.isBefore(monday) && day.isBefore(next);
  }).length;
}

/// Full mocks on the record before this week began: what a plan's total builds on.
int mocksBeforeThisWeek(RoadBoard b) => math.max(0, (b.mocksTaken ?? b.mockDays.length) - mocksThisWeek(b));

/// The three plans for [b], each with the total it saves as the mock target.
List<MockPlanChoice> mockPlanChoices(RoadBoard b) {
  final n = planWeekCount(b);
  final before = mocksBeforeThisWeek(b);
  int total(int extra) => (before + extra).clamp(mockTargetMin, mockTargetMax);
  return [
    MockPlanChoice(pace: MockPace.light, name: TodayCopy.planLight, line: TodayCopy.planLightLine, total: total((n / 2).ceil()), recommended: false),
    MockPlanChoice(pace: MockPace.steady, name: TodayCopy.planSteady, line: TodayCopy.planSteadyLine, total: total(n), recommended: true),
    MockPlanChoice(pace: MockPace.intense, name: TodayCopy.planIntense, line: TodayCopy.planIntenseLine, total: total(2 * n), recommended: false),
  ];
}

/// The plan a saved target reads as: Steady while the student has set nothing, else the plan whose
/// pace the target asks for (the nearest of the three). Null when the target is already met.
MockPace? selectedMockPace(RoadBoard b) {
  final target = b.mockTarget;
  if (target == null) return MockPace.steady;
  if (target <= (b.mocksTaken ?? 0)) return null;
  final rate = (target - mocksBeforeThisWeek(b)) / planWeekCount(b);
  MockPace? best;
  var gap = double.infinity;
  for (final p in MockPace.values) {
    final d = (rate - p.perWeek).abs();
    if (d < gap) {
      gap = d;
      best = p;
    }
  }
  return best;
}

/// One week of the plan, as the sheet's list draws it.
class PlanWeek {
  const PlanWeek({
    required this.monday,
    required this.mocks,
    required this.mocksDone,
    this.days,
    this.daysDone,
    this.current = false,
    this.past = false,
    this.boards = false,
    this.registration = false,
  });

  /// The week's Monday (the student's calendar date).
  final DateTime monday;

  /// Study days planned (the goal, two at most in a boards week); null for a past week, whose
  /// study days this phone does not hold.
  final int? days;
  final int? daysDone;

  /// Full mocks planned (0 to 2) and taken in this week.
  final int mocks;
  final int mocksDone;
  final bool current;
  final bool past;
  final bool boards;
  final bool registration;

  DateTime get sunday => monday.add(const Duration(days: 6));
}

DateTime _day(DateTime d) => DateTime.utc(d.year, d.month, d.day);

bool _overlaps(DateTime monday, DateTime start, DateTime? end) {
  final last = end ?? start;
  return monday.isBefore(last.add(const Duration(days: 1))) && start.isBefore(monday.add(const Duration(days: 7)));
}

DateTime mondayOf(DateTime d) {
  final day = _day(d);
  return day.subtract(Duration(days: day.weekday - 1));
}

/// The weeks of the plan: up to four weeks behind (only those with a mock in them), this week, and
/// one row for every week to the date. Mocks are spread over the weeks to come so the plan's
/// total lands exactly: the mocks still to take, divided evenly, at most two to a week.
List<PlanWeek> buildPlanWeeks(RoadBoard b, {List<RoadStop> stops = const []}) {
  final monday0 = mondayOf(b.today);
  final n = planWeekCount(b);
  final goal = b.goal;
  final year = b.examDate.year;
  final boardsStart = CuetCalendar.boardsStart(year), boardsEnd = CuetCalendar.boardsEnd(year);
  RoadStop? registration;
  for (final s in stops) {
    if (s.kind == RoadStopKind.registration) registration = s;
  }
  bool inWeek(DateTime d, DateTime monday) => !d.isBefore(monday) && d.isBefore(monday.add(const Duration(days: 7)));
  final takenBefore = mocksBeforeThisWeek(b);
  // Nothing set: the Steady plan, one a week from this week on.
  final target = b.mockTarget;
  final remaining = target == null ? n : math.max(0, target - takenBefore);
  int planned(int w) => math.min(2, ((w + 1) * remaining / n).ceil() - (w * remaining / n).ceil());

  final rows = <PlanWeek>[];
  for (var k = 4; k >= 1; k--) {
    final monday = monday0.subtract(Duration(days: 7 * k));
    final done = b.mockDays.where((d) => inWeek(_day(d), monday)).length;
    if (done > 0) rows.add(PlanWeek(monday: monday, mocks: done, mocksDone: done, past: true));
  }
  for (var w = 0; w < n; w++) {
    final monday = monday0.add(Duration(days: 7 * w));
    if (!monday.isBefore(_day(b.examDate)) && w > 0) break;
    rows.add(PlanWeek(
      monday: monday,
      days: goal == null ? null : plannedFor(monday, year, goal),
      daysDone: w == 0 ? b.weekDone : null,
      mocks: planned(w),
      mocksDone: w == 0 ? b.mockDays.where((d) => inWeek(_day(d), monday)).length : 0,
      current: w == 0,
      boards: !monday.isBefore(boardsStart) && monday.isBefore(boardsEnd),
      registration: registration != null && _overlaps(monday, registration.start, registration.end),
    ));
  }
  return rows;
}

/// The month a week is listed under ("October 2026"), by its Monday.
String monthOf(DateTime d) => '${TodayCopy.monthNames[d.month - 1]} ${d.year}';

/// Weeks grouped by month, in order.
List<(String, List<PlanWeek>)> groupByMonth(List<PlanWeek> weeks) {
  final out = <(String, List<PlanWeek>)>[];
  for (final w in weeks) {
    final m = monthOf(w.monday);
    if (out.isEmpty || out.last.$1 != m) {
      out.add((m, <PlanWeek>[]));
    }
    out.last.$2.add(w);
  }
  return out;
}

/// "Sun 26 Oct".
String dayWithWeekday(DateTime d) => '${TodayCopy.weekdayShort[d.weekday - 1]} ${formatDayMonthShort(d)}';

/// The next thing the plan asks for, in one line: the next full mock and its Sunday, or (nothing
/// left to take) the next stop on the calendar.
String milestoneLine(RoadBoard b, List<PlanWeek> weeks, List<RoadStop> stops, {bool mocksKnown = true}) {
  if (mocksKnown) {
    final taken = b.mocksTaken ?? 0;
    for (final w in weeks) {
      if (w.past || w.mocks <= w.mocksDone) continue;
      final due = w.sunday;
      final by = _day(due) == _day(b.today) ? TodayCopy.byTonight : TodayCopy.byDay(dayWithWeekday(due));
      return taken == 0 ? TodayCopy.nextFirstMock(by) : TodayCopy.nextMock(taken + 1, by);
    }
  }
  for (final s in stops) {
    if ((s.end ?? s.start).isBefore(b.today)) continue;
    return TodayCopy.nextStop(s.title, s.when);
  }
  return TodayCopy.mockTargetReached;
}

/// "Your road to CUET" for the Today card.
class RoadCardModel {
  const RoadCardModel({
    required this.phase,
    required this.count,
    required this.countsDays,
    required this.windowLine,
    required this.ownDate,
    this.goal,
    this.daysDone = 0,
    this.ringAt,
    this.paused = false,
    this.mocksPlanned,
    this.mocksDone = 0,
    this.milestone,
  });

  final RoadPhase phase;

  /// The big figure: weeks to the date (days once under a week; days left while the window is open).
  final int count;
  final bool countsDays;

  /// "Expected window: May 2027" or "Your date: 12 May 2027".
  final String windowLine;
  final bool ownDate;

  /// Study days a week, or null with no plan; [daysDone] counted this week.
  final int? goal;
  final int daysDone;

  /// The dot that carries today's ring, or null (a rest day, or the goal already met).
  final int? ringAt;
  final bool paused;

  /// Full mocks planned and taken this week; null while the record is not known.
  final int? mocksPlanned;
  final int mocksDone;
  final String? milestone;

  /// Dots shown for the study days: the goal (at most 7).
  int get dayDots => goal == null ? 0 : goal!.clamp(0, 7);
}

/// The card from the board and the week's marks. [week] is the header's week (null while the
/// rhythm loads or when it failed); [mocksKnown] says the papers are in hand.
RoadCardModel? buildRoadCard(RoadModel road, WeekModel? week, {required bool mocksKnown, bool mocksFailed = false}) {
  final board = road.board;
  if (road.phase == RoadPhase.window) {
    return RoadCardModel(
      phase: RoadPhase.window,
      count: road.daysLeft ?? 0,
      countsDays: true,
      windowLine: TodayCopy.windowOpen,
      ownDate: false,
    );
  }
  if (board == null) return null;
  final weeksTo = board.weeksToExam;
  final days = weeksTo < 1;
  final weeks = buildPlanWeeks(board, stops: road.stops);
  final current = weeks.firstWhere((w) => w.current, orElse: () => weeks.last);
  final goal = week == null || week.paused ? null : week.goal;
  var done = week?.done ?? board.weekDone ?? 0;
  int? ring;
  if (week != null && goal != null) {
    final today = week.days.where((d) => d.isToday).toList();
    if (today.isNotEmpty) {
      final counted = today.first.mark == PlanDayMark.done;
      final planned = today.first.mark == PlanDayMark.planned;
      if (counted && done > 0) {
        ring = math.min(done, goal) - 1;
      } else if (planned && done < goal) {
        ring = done;
      }
    }
  }
  return RoadCardModel(
    phase: RoadPhase.countdown,
    count: days ? board.daysToExam : weeksTo,
    countsDays: days,
    windowLine: board.ownDate ? TodayCopy.yourDateLine(board.examDate) : TodayCopy.expectedWindowLine,
    ownDate: board.ownDate,
    goal: goal,
    daysDone: done,
    ringAt: ring,
    paused: week?.paused ?? false,
    mocksPlanned: mocksKnown ? current.mocks : null,
    mocksDone: mocksKnown ? current.mocksDone : 0,
    // While the papers load there is no honest milestone yet; if they failed, the calendar's next stop.
    milestone: mocksKnown || mocksFailed ? milestoneLine(board, weeks, road.stops, mocksKnown: mocksKnown) : null,
  );
}
