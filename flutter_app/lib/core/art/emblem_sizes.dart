/// The four sizes a subject emblem is drawn at (SPACING 4.1 and audit X5). One object, four
/// optical sizes, so the same subject reads as the same object on every screen:
///
/// - [glyph] 24: a chip or a dense row. Silhouette, fold and mark only.
/// - [chip] 40: a list row (Review, You, Learn). Silhouette plus the main detail.
/// - [tile] 56: a picker tile or a card header. The printed grid is visible.
/// - [hero] 136: the prop on a hero card (Today, Review tonight, Practice suggestion, resume).
///
/// The size never changes with the theme or the screen's text scale: the emblem is a picture, not
/// text. Pass one of these to `SubjectEmblem.size`; [snap] maps an older odd size to the nearest.
abstract final class EmblemSizes {
  static const double glyph = 24;
  static const double chip = 40;
  static const double tile = 56;
  static const double hero = 136;

  /// The whole scale, smallest first.
  static const List<double> all = [glyph, chip, tile, hero];

  /// The scale size nearest to [size]. A tie goes to the larger one. Non-finite or non-positive
  /// input gives [glyph], the safest size for a row.
  static double snap(double size) {
    if (!size.isFinite || size <= 0) return glyph;
    var best = all.first;
    var bestGap = (size - best).abs();
    for (final candidate in all.skip(1)) {
      final gap = (size - candidate).abs();
      if (gap <= bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
    return best;
  }

  /// True when [size] is one of the four.
  static bool isOnScale(double size) => all.any((s) => (s - size).abs() < 0.01);
}
