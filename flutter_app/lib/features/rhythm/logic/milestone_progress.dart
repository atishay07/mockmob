// How far along the next milestone is, only where the app can count it exactly. The server
// dates milestones but sends no counts, so the app counts from records it holds in full:
// scored sets from the complete attempts list (server-scored, 5 or more answers, as the server
// counts them) and weeks at the goal from the closed-week history while that history reaches
// back to the first week. Repairs are not counted: the phone does not hold every repair (some
// are done on the website), so a count would guess. A count that disagrees with the server (it
// reaches the target while the server has not dated the step) is dropped, never shown.
import '../../../core/models/attempt.dart';
import '../../../core/models/rhythm.dart';
import 'derived_badges.dart';

/// Closed weeks the server sends at most (`HISTORY_WEEKS`). A shorter history is complete.
const int rhythmHistoryWeeks = 12;

/// Targets of the counted steps.
const Map<String, int> milestoneTargets = {'sessions_10': 10, 'weeks_met_4': 4, ...derivedTargets};

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
