// The road to May as a strip of weeks (L05, app-today-1016 section 8.15): one column per week from
// today to the exam, each holding what that week asks for (planned study days, a planned mock,
// boards, registration). The weeks are the same seven-day blocks `sessionsUntil` counts, so the
// pips on the rail and the lead figure's study days can never disagree. Pure; tests feed fixtures.
import '../../onboarding/data/calendar.dart';
import 'today_model.dart' show RoadStop, RoadStopKind;

class RoadWeek {
  const RoadWeek({
    required this.start,
    required this.planned,
    this.done,
    this.boards = false,
    this.registration = false,
    this.exam = false,
    this.plannedMocks = 0,
    this.paused = false,
  });

  /// The week's first day (today for the first column), the student's local date.
  final DateTime start;

  /// Study days planned in this week: the goal, two at most in a boards week, 0 without a goal.
  final int planned;

  /// Study days the server counted (the first column only).
  final int? done;
  final bool boards, registration, exam;

  /// Full mocks planned in this week: 0, 1 or 2.
  final int plannedMocks;

  /// The rhythm is paused (the first column only).
  final bool paused;

  bool get thisWeek => done != null || paused;
}

/// The planned study days of one seven-day block starting [weekStart], for an exam in [examYear].
int plannedFor(DateTime weekStart, int examYear, int? goal) {
  if (goal == null || goal <= 0) return 0;
  final boardsStart = CuetCalendar.boardsStart(examYear), boardsEnd = CuetCalendar.boardsEnd(examYear);
  final inBoards = !weekStart.isBefore(boardsStart) && weekStart.isBefore(boardsEnd);
  return inBoards && goal > CuetCalendar.boardWeekSessions ? CuetCalendar.boardWeekSessions : goal;
}

bool _overlaps(DateTime weekStart, DateTime start, DateTime? end) {
  final weekEnd = weekStart.add(const Duration(days: 7));
  final last = end ?? start;
  return weekStart.isBefore(last.add(const Duration(days: 1))) && start.isBefore(weekEnd);
}

/// The weeks from [today] to [examDate]. The last column holds the exam day; the columns before
/// it are the whole seven-day blocks `sessionsUntil` counts.
List<RoadWeek> buildRoadWeeks({
  required DateTime today,
  required DateTime examDate,
  int? goal,
  int? weekDone,
  bool paused = false,
  int? mocksLeft,
  List<RoadStop> stops = const [],
}) {
  final start = DateTime(today.year, today.month, today.day);
  final end = DateTime(examDate.year, examDate.month, examDate.day);
  final days = end.difference(start).inDays;
  if (days <= 0) return const [];
  final whole = days ~/ 7;
  final boardsStart = CuetCalendar.boardsStart(end.year), boardsEnd = CuetCalendar.boardsEnd(end.year);
  RoadStop? registration;
  for (final s in stops) {
    if (s.kind == RoadStopKind.registration) registration = s;
  }
  final starts = [for (var w = 0; w < whole; w++) start.add(Duration(days: w * 7))];
  // The exam's own column, unless the exam day starts a block of its own already counted.
  final examStart = start.add(Duration(days: whole * 7));
  final mocks = _spreadMocks(starts, mocksLeft ?? 0, boardsStart, boardsEnd);
  return [
    for (var w = 0; w < starts.length; w++)
      RoadWeek(
        start: starts[w],
        planned: plannedFor(starts[w], end.year, goal),
        done: w == 0 ? weekDone : null,
        paused: w == 0 && paused,
        boards: !starts[w].isBefore(boardsStart) && starts[w].isBefore(boardsEnd),
        registration: registration != null && _overlaps(starts[w], registration.start, registration.end),
        plannedMocks: mocks[w],
      ),
    RoadWeek(start: examStart, planned: 0, exam: true),
  ];
}

/// [left] mocks over the weeks after this one, boards weeks skipped while the others suffice,
/// two to a week when there are more mocks than weeks.
List<int> _spreadMocks(List<DateTime> starts, int left, DateTime boardsStart, DateTime boardsEnd) {
  final out = List<int>.filled(starts.length, 0);
  if (left <= 0 || starts.length < 2) return out;
  bool boards(int w) => !starts[w].isBefore(boardsStart) && starts[w].isBefore(boardsEnd);
  final open = [for (var w = 1; w < starts.length; w++) if (!boards(w)) w];
  final pool = open.length >= left ? open : [for (var w = 1; w < starts.length; w++) w];
  var remaining = left;
  // Evenly: the k-th mock lands on the pool slot k * n / left.
  for (var round = 0; round < 2 && remaining > 0; round++) {
    final take = remaining < pool.length ? remaining : pool.length;
    for (var k = 0; k < take; k++) {
      final w = pool[(k * pool.length / take).floor()];
      out[w]++;
    }
    remaining -= take;
  }
  return out;
}

/// The sum of planned days in [weeks] (the lead figure's study days).
int plannedTotal(List<RoadWeek> weeks) => weeks.fold(0, (sum, w) => sum + w.planned);
