/// Standard competition ranking ("1224"): chapters that lost the same marks share one rank, and the next distinct
/// value is ranked after the whole tied group (12, 12, 12, 12, 6 is 1, 1, 1, 1, 5). One rule for every screen that
/// says "most", "costliest" or a place, so a tie is never broken silently by list order (owner I14, 19 Oct).
class RankPlace {
  const RankPlace({required this.rank, required this.tied});

  /// 1 + the number of values strictly higher than this one.
  final int rank;

  /// How many values share it, this one included. 1 means it stands alone.
  final int tied;

  bool get isTied => tied > 1;
  bool get isFirst => rank == 1;

  @override
  bool operator ==(Object other) => other is RankPlace && other.rank == rank && other.tied == tied;

  @override
  int get hashCode => Object.hash(rank, tied);

  @override
  String toString() => 'RankPlace(rank: $rank, tied: $tied)';
}

/// The place of [value] among [all] (higher is better, [all] holds [value] once for itself).
RankPlace rankOf(int value, Iterable<int> all) {
  var above = 0;
  var same = 0;
  for (final v in all) {
    if (v > value) {
      above++;
    } else if (v == value) {
      same++;
    }
  }
  return RankPlace(rank: above + 1, tied: same < 1 ? 1 : same);
}

/// The place of each value, in the order given.
List<RankPlace> competitionRanks(List<int> values) => [for (final v in values) rankOf(v, values)];
