// The weekly ending card (spec 6.9): one dismissible summary of the week that just closed.
// Bounded, no verdict, no comparison with other students.
import '../../../core/models/rhythm.dart';
import '../copy.dart';
import 'dates.dart';
import 'week_view.dart';

enum EndingAction { keep, raise, lighter, lower, rest }

class EndingKey {
  const EndingKey(this.action, this.label, {this.goal});

  final EndingAction action;
  final String label;

  /// The goal this key sets, when it changes the goal.
  final int? goal;
}

class WeeklyEndingData {
  const WeeklyEndingData({
    required this.weekId,
    required this.met,
    required this.studyDays,
    required this.goal,
    required this.body,
    required this.keys,
    this.runNote,
    required this.restUntil,
  });

  /// The closed week's stable id (`lastClosedWeek.id`, its Monday).
  final String weekId;
  final bool met;
  final int studyDays;

  /// The goal the closed week was held to.
  final int goal;
  final String body;
  final String? runNote;
  final List<EndingKey> keys;

  /// `YYYY-MM-DD` of this week's Sunday: what "Take a rest week" pauses until.
  final String? restUntil;

  /// The id kept locally so the card shows once.
  String get dismissId => 'week-card:$weekId';

  /// The id of the "week closed as met" celebration (6.1).
  String get celebrationId => 'week:$weekId';
}

/// The card for the week that just closed, or null when there is nothing honest to say: no
/// closed week, a week with no study days, a stale cache, or an unmet week while paused.
/// [dismissed] holds the `week-card:<id>` ids already seen.
WeeklyEndingData? weeklyEndingFor(Rhythm rhythm, {required Set<String> dismissed}) {
  final closed = rhythm.lastClosedWeek;
  if (closed == null || closed.studyDays <= 0) return null;
  if (!closed.met && rhythm.paused) return null;

  // The server's `lastClosedWeek.id` is the Monday right before the current `weekStart`. The core
  // model keeps only `weekStart` (empty for this block), so the id is derived the same way.
  final start = parseIsoDate(rhythm.weekStart);
  if (start == null) return null;
  final closedId = formatIsoDate(start.subtract(const Duration(days: 7)));
  if (dismissed.contains('week-card:$closedId')) return null;

  final goalNow = rhythm.daysGoal;
  final keys = <EndingKey>[EndingKey(EndingAction.keep, RhythmCopy.keep(goalNow), goal: goalNow)];
  if (closed.met) {
    if (goalNow < 7) keys.add(EndingKey(EndingAction.raise, RhythmCopy.tryMore(goalNow + 1), goal: goalNow + 1));
    if (goalNow > 1) keys.add(const EndingKey(EndingAction.lighter, RhythmCopy.lighterWeek));
  } else {
    final lower = closed.studyDays.clamp(1, 7);
    if (lower < goalNow) keys.add(EndingKey(EndingAction.lower, RhythmCopy.makeIt(lower), goal: lower));
    keys.add(const EndingKey(EndingAction.rest, RhythmCopy.restWeek));
  }
  // The lighter week lowers the goal by one day; fix its goal now so the card and the action agree.
  final fixed = [
    for (final k in keys)
      if (k.action == EndingAction.lighter) EndingKey(k.action, k.label, goal: goalNow - 1) else k,
  ];

  return WeeklyEndingData(
    weekId: closedId,
    met: closed.met,
    studyDays: closed.studyDays,
    goal: closed.goal,
    body: closed.met ? RhythmCopy.endingMet(closed.studyDays) : RhythmCopy.endingNotMet(closed.studyDays, closed.goal),
    runNote: closed.met ? null : runNote(rhythm),
    keys: fixed,
    restUntil: formatIsoDate(start.add(const Duration(days: 6))),
  );
}
