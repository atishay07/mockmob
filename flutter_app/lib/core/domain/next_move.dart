import 'package:timezone/timezone.dart' as tz;

/// The state of Today's next-move card (design spec 5.3). The first matching rule decides.
/// Returning and late night change defaults only, never the state; the resume, ended and
/// result slots are independent and always sit above the card.
enum NextMoveState {
  historyUnavailable,
  newUser,
  subjectChanged,
  stale,
  noEligibleContent,
  thinHistory,
  ready,
  repairedCheckNotDue,
  noStrongWeakness,
}

/// A suggestion older than this many days is "Stale".
const nextMoveStaleAfterDays = 14;

/// Facts about the student's record, gathered by the Today module. Plain values so the
/// precedence is a pure table and unit tested.
class NextMoveInputs {
  const NextMoveInputs({
    this.historyUnavailable = false,
    this.hasAttempts = true,
    this.subjectsChangedWithoutAttempt = false,
    this.basisAgeDays,
    this.noEligibleContent = false,
    this.thinEvidence = false,
    this.hasReadyAction = false,
    this.repairedCheckNotDue = false,
  });

  /// `recordState == 'unavailable'` or the plan failed to load.
  final bool historyUnavailable;

  /// The student has at least one attempt.
  final bool hasAttempts;

  /// Subjects were edited and there is no attempt in the new set.
  final bool subjectsChangedWithoutAttempt;

  /// Age of the attempt the suggestion is based on, in days. Null when there is no basis.
  final int? basisAgeDays;

  /// There is no reviewed content for a repair.
  final bool noEligibleContent;

  /// Evidence is under the threshold ("Early signal from 6 questions").
  final bool thinEvidence;

  /// A client-built or plan `repair` or `investigate` action exists.
  final bool hasReadyAction;

  /// A repair was done and its fresh check is not due (always so while the gate is closed).
  final bool repairedCheckNotDue;
}

typedef _Rule = (NextMoveState, bool Function(NextMoveInputs));

/// Rules in precedence order. Table driven on purpose: adding or moving a state is one line.
final List<_Rule> _rules = [
  (NextMoveState.historyUnavailable, (i) => i.historyUnavailable),
  (NextMoveState.newUser, (i) => !i.hasAttempts),
  (NextMoveState.subjectChanged, (i) => i.subjectsChangedWithoutAttempt),
  (NextMoveState.stale, (i) => i.basisAgeDays != null && i.basisAgeDays! > nextMoveStaleAfterDays),
  (NextMoveState.noEligibleContent, (i) => i.noEligibleContent),
  (NextMoveState.thinHistory, (i) => i.thinEvidence),
  (NextMoveState.ready, (i) => i.hasReadyAction),
  (NextMoveState.repairedCheckNotDue, (i) => i.repairedCheckNotDue),
];

/// The first matching state, or [NextMoveState.noStrongWeakness] when none matches.
NextMoveState nextMoveState(NextMoveInputs inputs) {
  for (final (state, matches) in _rules) {
    if (matches(inputs)) return state;
  }
  return NextMoveState.noStrongWeakness;
}

/// The precedence order, for tests and documentation.
List<NextMoveState> get nextMovePrecedence => [for (final (state, _) in _rules) state, NextMoveState.noStrongWeakness];

/// 11 PM to 7 AM local time.
bool isLateNight(DateTime local) => local.hour >= 23 || local.hour < 7;

/// Default minutes for the duration chooser: returning (3 or more days away) gets 5, otherwise
/// late night gets 10, otherwise the plan's own minutes. The plan honours only 10, 20 and 30.
int defaultNextMoveMinutes({required bool returning, required DateTime localNow, required int planMinutes}) {
  if (returning) return 5;
  if (isLateNight(localNow)) return 10;
  return planMinutes;
}

/// When a "Not today" dismissal stops hiding a suggestion: the next 4:00 AM in the student's
/// timezone. A new submitted attempt ends it sooner (the repository checks that separately).
DateTime dismissalExpiry(DateTime now, tz.Location location) {
  final local = tz.TZDateTime.from(now, location);
  var at = tz.TZDateTime(location, local.year, local.month, local.day, 4);
  if (!at.isAfter(local)) at = tz.TZDateTime(location, local.year, local.month, local.day + 1, 4);
  return at;
}
