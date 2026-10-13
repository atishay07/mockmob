// "The road to May" as plain values: the weeks to the expected CUET window, the stops on the way
// (registration, boards, the exam window, CSAS after the results: every date comes from
// CuetDates), and the student's dream ladder with real CSAS 2026 Round 1 closing scores. After
// 1 May 2027 the road stays: first the window is open, then CSAS follows the results. Calendar
// arithmetic and the student's own choices only: no projections of marks or chances.
import '../../../core/domain/cuet_dates.dart';
import '../../onboarding/data/calendar.dart';
import '../copy.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// The start of the expected CUET UG window. NTA has not published 2027 dates, so the copy
/// always says "expected".
final DateTime expectedWindowStart = CuetDates.windowStart;

/// Boards take the evenings from mid-February.
final DateTime boardsStart = CuetDates.boardsStart;

final List<RoadStop> roadStops = [
  RoadStop(
    kind: RoadStopKind.registration,
    title: TodayCopy.stopRegistration,
    when: TodayCopy.whenRegistration,
    start: CuetDates.registrationStart,
    end: CuetDates.registrationEnd,
    expected: true,
  ),
  RoadStop(
    kind: RoadStopKind.boards,
    title: TodayCopy.stopBoards,
    when: TodayCopy.whenBoards,
    start: boardsStart,
    end: CuetDates.boardsEnd,
    note: TodayCopy.noteBoards,
    // CBSE has not published the 2027 date sheet.
    expected: true,
  ),
  RoadStop(
    kind: RoadStopKind.exam,
    title: TodayCopy.stopExam,
    when: TodayCopy.whenExam,
    start: expectedWindowStart,
    end: CuetDates.windowEnd,
    expected: true,
  ),
  RoadStop(
    kind: RoadStopKind.counselling,
    title: TodayCopy.stopCounselling,
    when: TodayCopy.whenCounselling,
    start: CuetDates.counsellingStart,
    expected: true,
  ),
];

/// The right edge of the road: the first of the month after the last stop.
DateTime roadEndFor(List<RoadStop> stops) {
  final last = stops.map((s) => s.end ?? s.start).reduce((a, b) => a.isAfter(b) ? a : b);
  return DateTime.utc(last.year, last.month + 1);
}

final DateTime roadEnd = roadEndFor(roadStops);

RoadModel? buildRoad(TodayInputs i) {
  final today = i.date();
  if (!today.isBefore(roadEnd)) return null;
  final days = expectedWindowStart.difference(today).inDays;
  final phase = days > 0
      ? RoadPhase.countdown
      : (today.isAfter(CuetDates.windowEnd) ? RoadPhase.csas : RoadPhase.window);
  final countdown = phase == RoadPhase.countdown;
  final weeks = countdown ? days ~/ 7 : 0;
  final profile = i.profile;
  final picks = profile?.ladder.take(3).toList() ?? const [];
  final toBoards = boardsStart.difference(today).inDays;
  final goal = i.week?.goal;
  // The same count onboarding gave: board weeks count two sessions at most.
  final sessions = goal == null || !countdown || weeks < 2
      ? null
      : CuetCalendar.sessionsBefore(expectedWindowStart.year, today.toLocal(), daysPerWeek: goal, boards: true);
  return RoadModel(
    weeks: weeks,
    today: today,
    end: roadEnd,
    phase: phase,
    daysLeft: phase == RoadPhase.window ? CuetDates.windowEnd.difference(today).inDays + 1 : null,
    stops: [for (final s in roadStops) if (!(s.end ?? s.start).isBefore(today)) s],
    weeksToBoards: toBoards > 0 ? toBoards ~/ 7 : 0,
    studyDays: sessions,
    goal: goal,
    category: profile?.category,
    ladder: [
      for (var k = 0; k < picks.length; k++)
        LadderRung(
          college: picks[k].college,
          course: picks[k].course,
          score: _score(picks[k].closingScore),
          outOf: picks[k].outOf,
          dream: k == 0,
        ),
    ],
  );
}

String _score(num score) => score == score.roundToDouble() ? '${score.round()}' : score.toStringAsFixed(1);
