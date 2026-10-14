import 'package:flutter/widgets.dart';

import '../theme/theme.dart';

/// The Daylight form of every light event, decided once (docs/brain/ui-phase2/MOTION.md 1.4).
///
/// A lamp-amber or white sweep is invisible on paper (`#F3EFE6`) and on a raised card (`#FFFDF8`);
/// a glow vanishes; a 9% volt wash disappears under a chosen row. Every moment that paints light
/// (a sweep over a card, a wash behind a chosen row, particles, shards, foil, the ink in a bubble)
/// reads its colour from here, so Night and Day are designed twins and not the same code with the
/// lights swapped.
abstract final class MmLight {
  /// The band that travels across a surface: Night keeps the soft lamp-white, Day uses a 14% volt
  /// band at the same speed so it still reads on paper.
  static Color sweepColor(BuildContext context) {
    final colors = context.mmColors;
    return colors.isNight ? colors.edgeTop.withValues(alpha: 0.30) : colors.volt.withValues(alpha: 0.14);
  }

  /// The wash behind a chosen row or tile: 9% volt on Night, 16% on Day (at 9% on paper the
  /// runner's chosen-row wash disappears).
  static Color washColor(BuildContext context) {
    final colors = context.mmColors;
    return colors.volt.withValues(alpha: colors.isNight ? 0.09 : 0.16);
  }

  /// The soft bloom behind a lit object. Daylight has none: use [rimColor] as a 1 dp edge instead.
  static Color glowColor(BuildContext context, {double alpha = 0.14}) {
    final colors = context.mmColors;
    return colors.isNight ? colors.volt.withValues(alpha: alpha) : const Color(0x00000000);
  }

  /// Whether this theme paints blooms at all.
  static bool glows(BuildContext context) => context.mmColors.isNight;

  /// The 1 dp edge that stands in for a glow on Daylight (olive `#526700`); transparent on Night,
  /// where the light itself is the edge.
  static Color rimColor(BuildContext context) {
    final colors = context.mmColors;
    return colors.isNight ? const Color(0x00000000) : colors.accentText;
  }

  /// A particle, shard or foil piece: volt fill on both themes.
  static Color particleFill(BuildContext context) => context.mmColors.volt;

  /// The paint for a particle's 1 dp rim: olive on Daylight so the volt reads on paper, none on
  /// Night. Null when no rim should be drawn.
  static Paint? particleRim(BuildContext context) {
    final colors = context.mmColors;
    if (colors.isNight) return null;
    return Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = colors.accentText;
  }

  /// Ink that sits on an icon or text (the bar bubble, the onboarding bubble): opaque volt on both
  /// themes, never a translucent volt over grey, which is what made olive mud.
  static Color inkFill(BuildContext context) => context.mmColors.volt;

  /// The glyph colour on top of [inkFill].
  static Color onInk(BuildContext context) => context.mmColors.voltInk;
}
