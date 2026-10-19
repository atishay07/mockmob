// The ghost pace chip (MOB-BUILD-SPEC-V3 5.3 R4): the only figure the app computes in the Mob, from
// server-sent times only, with the spec's fixed formula (the server's copy is unit-tested the same way):
//
//   you   = the server's elapsedMs of your latest answer
//   k     = the index of that answer
//   ghost = the one whose arrivalsMs[k] is nearest to you (the first such ghost on a tie)
//   delta = round((ghost.arrivalsMs[k] - you) / 1000), rounded like JavaScript's Math.round
//
// A positive delta means you are ahead ("4 s ahead of Kabir"), a negative one that the ghost was
// quicker there ("4 s behind Kabir"), and 0 reads "Level with Kabir". The chip appears only after
// your first answer, and never says anything about a ghost's picks or marks (there are none to say).

import '../copy_v3.dart';
import '../data/mob_v3_models.dart';

class GhostPace {
  const GhostPace({required this.memberId, required this.name, required this.delta});

  final String memberId;
  final String name;

  /// Whole seconds; positive when you reached that question first.
  final int delta;

  String get text => MobV3Copy.pace(delta, name);

  @override
  bool operator ==(Object other) => other is GhostPace && other.memberId == memberId && other.delta == delta && other.name == name;

  @override
  int get hashCode => Object.hash(memberId, name, delta);
}

abstract final class GhostPaceCalc {
  /// The chip for your answer at index [k] given at [youMs] (server elapsed), or null when no ghost
  /// has an arrival at [k] (no ghosts, or a ghost run shorter than this game).
  static GhostPace? of({required int youMs, required int k, required List<Ghost> ghosts}) {
    if (k < 0) return null;
    Ghost? best;
    int? bestGap;
    for (final g in ghosts) {
      if (k >= g.arrivalsMs.length) continue;
      final gap = (g.arrivalsMs[k] - youMs).abs();
      if (bestGap == null || gap < bestGap) {
        best = g;
        bestGap = gap;
      }
    }
    if (best == null) return null;
    return GhostPace(memberId: best.memberId, name: best.name, delta: jsRound((best.arrivalsMs[k] - youMs) / 1000));
  }

  /// The chip after the latest of [answers] (ordered by question), or null before the first answer.
  static GhostPace? afterAnswers(List<RunAnswer> answers, List<Ghost> ghosts) {
    if (answers.isEmpty) return null;
    var latest = answers.first;
    for (final a in answers) {
      if (a.q > latest.q) latest = a;
    }
    return of(youMs: latest.elapsedMs, k: latest.q, ghosts: ghosts);
  }

  /// JavaScript's Math.round: halves go up (-3.5 is -3, 3.5 is 4), so both sides agree.
  static int jsRound(double x) => (x + 0.5).floor();
}
