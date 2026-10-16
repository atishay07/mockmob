// CUET subject combination planner, ported from the website's `src/lib/du/combos.js`.
//
// The student lists the DU programmes they want and the subjects they could realistically take.
// Every combination of up to `maxPapers` of those subjects is checked against DU's own 2026
// eligibility rules (the same evaluator as Compass), then ranked by how many target programmes
// it unlocks, how many DU programmes it unlocks in total, and how few papers it needs. It says
// nothing about scores, cutoffs or admission chances. Pure and isolate-safe.

import 'du_eligibility.dart';
import 'du_models.dart';

/// The CUET UG 2026 limit; 2027 rules are provisional.
const int duDefaultMaxPapers = 5;
const int duMaxPool = 12;
const int duMaxTargets = 6;

/// A target the combination does not reach, with the nearest rule and its gaps.
class DuMissedTarget {
  const DuMissedTarget({required this.id, required this.name, this.nearest});

  final String id;
  final String name;
  final DuNearest? nearest;
}

class DuCombo {
  const DuCombo({required this.items, required this.selection, required this.unlocked, required this.met, this.missed = const []});

  final List<DuPick> items;
  final DuSelection selection;

  /// DU programmes these subjects open, of all 73.
  final int unlocked;

  /// Target ids met.
  final List<String> met;
  final List<DuMissedTarget> missed;
}

class DuComboPlan {
  const DuComboPlan({this.ranked = const [], this.keep = const []});

  static const empty = DuComboPlan();

  final List<DuCombo> ranked;

  /// Subjects present in every combination that meets all targets: the ones not to drop.
  final List<DuPick> keep;
}

DuSelection _selectionOf(List<DuPick> items) => DuSelection(
      languages: [for (final i in items) if (i.kind == DuPickKind.language) i.id],
      domains: [for (final i in items) if (i.kind == DuPickKind.domain) i.id],
      gat: items.any((i) => i.kind == DuPickKind.gat),
    );

/// Every non-empty subset of up to [max] items, in the website's depth-first order.
List<List<DuPick>> _subsets(List<DuPick> items, int max) {
  final out = <List<DuPick>>[];
  final pick = <int>[];
  void walk(int start) {
    if (pick.isNotEmpty) out.add([for (final i in pick) items[i]]);
    if (pick.length == max) return;
    for (var i = start; i < items.length; i++) {
      pick.add(i);
      walk(i + 1);
      pick.removeLast();
    }
  }

  walk(0);
  return out;
}

/// Ranked combinations plus `keep`. Alternatives must reach as many targets as the best one, and
/// a larger combination is only shown if it unlocks more.
DuComboPlan duPlanCombos({
  required List<DuGroup> groups,
  required List<DuPick> pool,
  List<String> targets = const [],
  int maxPapers = duDefaultMaxPapers,
  int limit = 5,
}) {
  final items = pool.take(duMaxPool).toList();
  if (items.isEmpty) return DuComboPlan.empty;
  final targetSet = targets.toSet();
  final results = <DuCombo>[];
  for (final combo in _subsets(items, maxPapers)) {
    final selection = _selectionOf(combo);
    var unlocked = 0;
    final met = <String>[];
    for (final group in groups) {
      if (!duEvaluateGroup(group, selection).eligible) continue;
      unlocked += 1;
      if (targetSet.contains(group.id)) met.add(group.id);
    }
    results.add(DuCombo(items: combo, selection: selection, unlocked: unlocked, met: met));
  }

  // Dart's sort is not stable; JavaScript's is. Break ties by the original order.
  final order = {for (var i = 0; i < results.length; i++) results[i]: i};
  results.sort((a, b) {
    final byMet = b.met.length - a.met.length;
    if (byMet != 0) return byMet;
    final byUnlocked = b.unlocked - a.unlocked;
    if (byUnlocked != 0) return byUnlocked;
    final byPapers = a.items.length - b.items.length;
    if (byPapers != 0) return byPapers;
    return order[a]! - order[b]!;
  });

  final bestMet = results.first.met.length;
  final full = targets.isEmpty ? <DuCombo>[] : results.where((r) => r.met.length == targets.length).toList();
  final keep = full.isEmpty
      ? <DuPick>[]
      : [
          for (final item in full.first.items)
            if (full.every((r) => r.items.contains(item))) item,
        ];

  final out = <DuCombo>[];
  for (final r in results) {
    if (r.met.length < bestMet) break;
    if (out.any((o) => o.met.length >= r.met.length && o.unlocked >= r.unlocked && o.items.length <= r.items.length)) {
      continue;
    }
    out.add(r);
    if (out.length >= limit) break;
  }
  final byId = {for (final g in groups) g.id: g};
  final ranked = [
    for (final r in out)
      DuCombo(
        items: r.items,
        selection: r.selection,
        unlocked: r.unlocked,
        met: r.met,
        missed: [
          for (final id in targets)
            if (!r.met.contains(id))
              DuMissedTarget(
                id: id,
                name: byId[id]?.name ?? id,
                nearest: byId[id] == null ? null : duEvaluateGroup(byId[id]!, r.selection).nearest,
              ),
        ],
      ),
  ];
  return DuComboPlan(ranked: ranked, keep: keep);
}

/// Why one subject of [DuComboPlan.keep] matters, in real counts: what the best plan without it
/// loses. [lostTarget] is the first target it no longer reaches (null when all still open);
/// [fewer] is how many fewer DU programmes the best plan opens; [nothing] when no combination
/// opens anything without it.
typedef DuKeepReason = ({DuPick pick, String? lostTarget, int fewer, bool nothing});

/// The keep reasons for [plan], given the plan [without] would make with each kept subject
/// taken out of the pool (the caller runs the planner; tests pass it in).
List<DuKeepReason> duKeepReasons(DuComboPlan plan, Map<DuPick, DuComboPlan> without, String Function(String id) targetName) {
  final best = plan.ranked.firstOrNull;
  if (best == null) return const [];
  return [
    for (final k in plan.keep)
      if (without[k] case final DuComboPlan alt)
        () {
          final altBest = alt.ranked.firstOrNull;
          if (altBest == null || altBest.unlocked == 0) return (pick: k, lostTarget: null, fewer: best.unlocked, nothing: true);
          final lost = best.met.where((t) => !altBest.met.contains(t)).firstOrNull;
          return (pick: k, lostTarget: lost == null ? null : targetName(lost), fewer: best.unlocked - altBest.unlocked, nothing: false);
        }(),
  ];
}
