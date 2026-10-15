// What the evening reminder says: tonight's move, taken from the same rules Today uses, and the
// real week for the Sunday line. Pure: everything is passed in, nothing is read or written, so the
// rules are unit tested and the reminder can never name a move Today would not.
//
// Read-only use of Today's logic: `buildMove` is the function Today's card is built from. A
// reminder is planned ahead of time, so it is built for the moment the reminder will arrive
// (late night and the "Not today" dismissal are judged at that moment, not now), and anything the
// phone cannot know is left out (no move at all, never a guess).
import 'package:timezone/timezone.dart' as tz;

import '../../../core/copy/copy.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/repositories/repair_local_repository.dart' show RepairLocalRecord;
import '../../rhythm/logic/dates.dart' show formatIsoDate, parseIsoDate;
import '../../today/logic/move_builder.dart';
import '../../today/logic/today_inputs.dart';
import '../../today/logic/today_model.dart';
import '../../../core/domain/next_move.dart' show NextMoveState;
import '../copy.dart';

enum EveningMoveKind {
  /// Tonight's chapter of open mistakes (Mistake Repair).
  repair,

  /// A practice run of a known length (the default when nothing needs repairing).
  practice,

  /// The server's own plan action, in its own words.
  plan,
}

/// One move, ready to say in a notification and to open on a tap.
class EveningMove {
  const EveningMove({required this.kind, required this.line, required this.route, this.mistakes, this.minutes});

  final EveningMoveKind kind;

  /// "3 Partnership mistakes to repair, about 10 minutes". No day word: the title carries it.
  final String line;

  /// The in-app location Today's own button opens for this move.
  final String route;

  /// For a repair: how many mistakes it names.
  final int? mistakes;
  final int? minutes;

  @override
  bool operator ==(Object other) =>
      other is EveningMove && other.kind == kind && other.line == line && other.route == route && other.mistakes == mistakes && other.minutes == minutes;

  @override
  int get hashCode => Object.hash(kind, line, route, mistakes, minutes);

  @override
  String toString() => 'EveningMove($kind, $line, $route)';
}

/// The student's current week as the server counts it, for the Sunday line.
class WeekLine {
  const WeekLine({required this.weekStart, required this.studied, required this.goal, this.paused = false});

  /// The Monday of the week (`YYYY-MM-DD`).
  final String weekStart;
  final int studied;
  final int goal;
  final bool paused;

  factory WeekLine.fromRhythm(Rhythm r) =>
      WeekLine(weekStart: r.weekStart, studied: r.studyDays, goal: r.daysGoal, paused: r.paused);

  @override
  bool operator ==(Object other) =>
      other is WeekLine && other.weekStart == weekStart && other.studied == studied && other.goal == goal && other.paused == paused;

  @override
  int get hashCode => Object.hash(weekStart, studied, goal, paused);
}

/// Everything the plan needs from the student's record, as plain values that compare equal, so a
/// change in what a reminder would say is a change in this value and nothing else.
class EveningFacts {
  const EveningFacts({required this.day, this.today, this.later, this.studiedToday = false, this.week});

  /// The student's calendar date these facts were taken on (`YYYY-MM-DD`). The plan ignores
  /// facts from another day.
  final String day;

  /// The move for the slot today (honours "Not today" on Today and the length chip).
  final EveningMove? today;

  /// The move for any later day's slot: the ordinary pick for that evening.
  final EveningMove? later;

  /// A session, a repair or a study day on the server is already recorded for [day].
  final bool studiedToday;
  final WeekLine? week;

  @override
  bool operator ==(Object other) =>
      other is EveningFacts &&
      other.day == day &&
      other.today == today &&
      other.later == later &&
      other.studiedToday == studiedToday &&
      other.week == week;

  @override
  int get hashCode => Object.hash(day, today, later, studiedToday, week);
}

/// The same inputs as of [at]: the clock moves (so late night and "returning" are judged then),
/// the phone's connection and any open draft are not part of a reminder's promise.
TodayInputs inputsAt(TodayInputs i, DateTime at, {required bool keepToday}) => TodayInputs(
      now: at,
      timezone: i.timezone,
      firstName: i.firstName,
      subjects: i.subjects,
      attempts: i.attempts,
      attemptsFailed: i.attemptsFailed,
      attemptsFetchedAt: i.attemptsFetchedAt,
      attemptsStale: i.attemptsStale,
      plan: i.plan,
      planFetchedAt: i.planFetchedAt,
      planStale: i.planStale,
      week: i.week,
      returning: i.returning,
      unopened: i.unopened,
      // "Not today" lasts until 4 AM, so it speaks for today's slot only.
      dismissed: keepToday ? i.dismissed : const {},
      repaired: i.repaired,
      profile: i.profile,
      selectedMinutes: keepToday ? i.selectedMinutes : null,
      roadPlan: i.roadPlan,
    );

/// Tonight's move as Today's card would show it at [at], or null when there is nothing the phone
/// can truthfully name: the record has not loaded, could not be read, or the move is not one that
/// opens a screen (a retry, the alternatives sheet).
EveningMove? eveningMoveFrom(TodayInputs inputs, DateTime at, {bool keepToday = true}) {
  // A record still loading reads as "no attempts", which would call a student with a history a
  // new user. No attempts list, no move.
  if (inputs.attempts == null) return null;
  final i = inputsAt(inputs, at, keepToday: keepToday);
  final hero = buildMove(i);
  if (hero.state == NextMoveState.historyUnavailable) return null;
  final target = hero.primary.target;
  if (target is! GoTo) return null;
  final route = target.location;
  final subject = hero.subjectLine;

  // A client-built repair carries the paper it comes from; the server's own action does not.
  if (hero.state == NextMoveState.ready && hero.evidenceId != null) {
    final n = int.tryParse(hero.number ?? '');
    if (n == null || n < 1) return null;
    final minutes = hero.selectedMinutes;
    final facts = MoveFacts(i);
    final tonight = facts.tonight;
    final chapter = tonight != null && tonight.hasNamedChapter ? tonight.chapter : null;
    return EveningMove(
      kind: EveningMoveKind.repair,
      line: NotificationsCopy.moveRepair(n, chapter, minutes),
      route: route,
      mistakes: n,
      minutes: minutes,
    );
  }
  if (hero.state == NextMoveState.ready) {
    final title = hero.summary.trim();
    if (title.isEmpty) return null;
    return EveningMove(kind: EveningMoveKind.plan, line: NotificationsCopy.movePlan(title), route: route);
  }
  final n = hero.selectedMinutes ?? int.tryParse(hero.number ?? '') ?? 10;
  return EveningMove(
    kind: EveningMoveKind.practice,
    line: NotificationsCopy.movePractice(n, subject),
    route: route,
    minutes: n,
  );
}

/// Whether the student already studied on [day] (the student's calendar date): an attempt
/// finished that day, a mistake repaired that day (acknowledged by the server), or the server's
/// own study-day list holds it. Never a guess: no record, not studied.
bool studiedOn({
  required String day,
  required String timezone,
  required List<DateTime> attemptsCompleted,
  required List<RepairLocalRecord> repairs,
  Rhythm? rhythm,
  required tz.Location location,
}) {
  String dayOf(DateTime t) {
    final l = tz.TZDateTime.from(t, location);
    return formatIsoDate(DateTime.utc(l.year, l.month, l.day));
  }

  if (attemptsCompleted.any((t) => dayOf(t) == day)) return true;
  for (final r in repairs) {
    final at = r.ackedAt;
    if (r.isRepaired && at != null && dayOf(at) == day) return true;
  }
  return rhythm != null && rhythm.studyDayDates.contains(day);
}

/// The facts of [now]: today's move and the usual later move (each as of its own slot time, the
/// student's [slot] clock time, or 7:00 PM when none), whether today is already studied and the
/// week so far.
EveningFacts eveningFactsFrom({
  required TodayInputs inputs,
  required List<RepairLocalRecord> repairs,
  required tz.Location location,
  required ({int hour, int minute}) slot,
  required DateTime now,
  Rhythm? rhythm,
}) {
  final local = tz.TZDateTime.from(now, location);
  final day = formatIsoDate(DateTime.utc(local.year, local.month, local.day));
  tz.TZDateTime slotOn(int addDays) => tz.TZDateTime(location, local.year, local.month, local.day + addDays, slot.hour, slot.minute);
  final attempts = inputs.attempts ?? const [];
  return EveningFacts(
    day: day,
    today: eveningMoveFrom(inputs, slotOn(0)),
    later: eveningMoveFrom(inputs, slotOn(1), keepToday: false),
    studiedToday: studiedOn(
      day: day,
      timezone: inputs.timezone,
      attemptsCompleted: [for (final a in attempts) a.completedAt],
      repairs: repairs,
      rhythm: rhythm,
      location: location,
    ),
    week: rhythm == null ? null : WeekLine.fromRhythm(rhythm),
  );
}

/// The Sunday line for the week that holds [sunday], or null when the numbers cannot be told
/// truthfully: no week, a paused week, a week that is not the one [sunday] falls in, nothing
/// studied yet, or no goal. The weekly reminder then says its ordinary line.
({String title, String body})? weeklyLineFor(WeekLine? week, DateTime sunday) {
  if (week == null || week.paused || week.studied <= 0 || week.goal <= 0) return null;
  final start = parseIsoDate(week.weekStart);
  if (start == null) return null;
  final date = DateTime.utc(sunday.year, sunday.month, sunday.day);
  final offset = date.difference(start).inDays;
  if (offset < 0 || offset > 6) return null;
  return (title: NotificationsCopy.weeklyPersonalTitle, body: NotificationsCopy.weeklyPersonalBody(week.studied, week.goal));
}

/// "Tonight" from 4:00 PM to 4:59 AM, otherwise "Today", for the reminder's title.
String eveningTitle(DateTime slot) => tonightOrTodayTitle(slot);
