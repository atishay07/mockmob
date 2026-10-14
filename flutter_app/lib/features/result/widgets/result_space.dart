import '../../../core/art/art.dart' show EmblemSizes;
import '../../../core/theme/theme.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode;
import '../model/recap_variant.dart';

/// The result screens' share of the spacing system (docs/brain/ui-phase2/SPACING.md).
abstract final class ResultSpace {
  /// The moment gutter (SPACING 1.1): the sealed sheet and the recap cards are type and art with
  /// no cards, so they sit 24 dp in from the screen's sides. The full result is a page of lists
  /// and keeps the 16 dp screen gutter.
  static const double moment = MmSpace.s24;

  /// One Mobi size on every recap card, beside the headline (audit X5: 68, 72 and 76 before).
  static const double mobi = 72;

  /// The subject emblem beside the full result's figure: the tile size of the emblem scale
  /// (24, 40, 56, 136; audit X5). The figure is the hero there, not the object.
  static const double emblem = EmblemSizes.tile;

  /// Moment scaffold (SPACING 7): free height splits 2 above the content to 3 below it, so the
  /// content sits at about 40% of the free band instead of stacking at the top.
  static const double momentWeight = -0.2;
}

/// The result screens' share of the motion spec (docs/brain/ui-phase2/MOTION.md 4.8 and 6).
abstract final class ResultMotion {
  /// The marks meters fill in 420 ms (P1-6: it took 600 to 720).
  static const Duration meter = Duration(milliseconds: 420);

  /// Blocks within a recap card arrive 45 ms apart, each in 420 ms, rising 12 dp.
  static const Duration blockStagger = Duration(milliseconds: 45);
  static const Duration block = Duration(milliseconds: 420);
  static const double blockRise = 12;
}

/// How much of the reveal plays, from the result's variant and the student's Celebrations
/// setting (MOTION 1.2, P0-5, P0-6).
enum RevealLevel {
  /// Words only: the sheet opens with a quiet fade, the figure is simply there.
  words,

  /// T1: the read inks the rows, the figure rolls, the meter fills. No light event, no cheer.
  plain,

  /// T2, a higher result with Celebrations on Full: [plain], then one light sweep across the
  /// sheet, then Mobi cheers once the figure has landed.
  celebrate;

  static RevealLevel of(RecapVariant variant, CelebrationMode mode, {required bool reduced}) {
    if (reduced || !variant.celebratory || mode == CelebrationMode.off) return RevealLevel.words;
    if (variant == RecapVariant.higher && mode == CelebrationMode.full) return RevealLevel.celebrate;
    return RevealLevel.plain;
  }

  /// The ink, the roll and the meter play.
  bool get moves => this != words;

  /// The single light event (the sweep) and Mobi's cheer play.
  bool get lights => this == celebrate;
}
