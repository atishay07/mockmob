// How far along the next milestone is, only where the count is exact. Two sources, both records
// the phone already reads:
//  - the server's own `counts` in `GET /api/me/rhythm` (scored sets, finished repairs, weeks that
//    reached the goal): the authority, because the phone does not hold every repair (some are
//    done on the website), so it never counts repairs itself;
//  - the complete attempts list (scored sets, full mocks, subjects) and the closed-week history
//    while that history reaches back to the first week, for a server that sends no `counts`.
// "3 weeks in a row" counts the run now (`weeksMetStreak`), never an older best run. A count that
// disagrees with the server (it reaches the target while the server has not dated the step) is
// dropped, never shown, and a count that is unknown is absent, never 0.
import '../../../core/models/attempt.dart';
import '../../../core/models/rhythm.dart';
import 'derived_badges.dart';

/// Closed weeks the server sends at most (`HISTORY_WEEKS`). A shorter history is complete.
const int rhythmHistoryWeeks = 12;

/// Targets of the counted steps.
const Map<String, int> milestoneTargets = {
  'sessions_10': 10,
  'weeks_met_4': 4,
  'repairs_5': 5,
  'repairs_10': 10,
  'repairs_25': 25,
  'run_weeks_3': 3,
  ...derivedTargets,
};

/// Step id to the count so far, for the steps that can be counted exactly.
Map<String, int> milestoneProgress({List<Attempt>? attempts, Rhythm? rhythm}) {
  final out = <String, int>{};
  if (attempts != null) {
    out['sessions_10'] = attempts.where((a) => a.selectionMeta.isServerScored && a.correct + a.wrong >= 5).length;
    out.addAll(derivedProgress(attempts));
  }
  final history = rhythm?.history;
  if (rhythm != null && history != null && history.length < rhythmHistoryWeeks) {
    out['weeks_met_4'] = history.where((w) => w.met).length + (rhythm.metThisWeek ? 1 : 0);
  }
  final counts = rhythm?.counts;
  if (rhythm != null) {
    // The server's own counts win where the phone could only have guessed (repairs) or only counted part of the record.
    final sets = counts?.sessions;
    if (sets != null && !out.containsKey('sessions_10')) out['sessions_10'] = sets;
    final weeks = counts?.weeksMet;
    if (weeks != null) out['weeks_met_4'] = weeks;
    final repairs = counts?.repairs;
    if (repairs != null) {
      for (final id in const ['repairs_5', 'repairs_10', 'repairs_25']) {
        out[id] = repairs;
      }
    }
    out['run_weeks_3'] = rhythm.weeksMetStreak;
  }
  final earned = {for (final m in rhythm?.milestones ?? const <RhythmMilestone>[]) if (m.earned) m.id};
  out.removeWhere((id, n) => earned.contains(id) || n >= (milestoneTargets[id] ?? 1 << 30) || n < 0);
  return out;
}

/// How far along [stepId] is, 0 to 1, only where [progress] holds an exact count (see
/// [milestoneProgress]); null for a step the app cannot count, so no arc is ever drawn on a guess.
double? milestoneFraction(String stepId, Map<String, int> progress) {
  final count = progress[stepId];
  final target = milestoneTargets[stepId];
  if (count == null || target == null || target <= 0) return null;
  return (count / target).clamp(0.0, 1.0);
}
