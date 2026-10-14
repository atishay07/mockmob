import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The spacing of Review in one place (docs/brain/ui-phase2/SPACING.md): a 4 dp grid, one screen
/// gutter, a wider gutter for the moment screens (repair entry and ending), the hero tier's
/// padding and the subject emblem's box. Kept here, not in the shared tokens, so the area does not
/// wait on them; every value is the one the spec names.
abstract final class ReviewSpace {
  /// The screen gutter of every list and card screen (E0).
  static const double gutter = 16;

  /// The gutter of a moment: type and art, no cards.
  static const double moment = 24;

  /// Padding of a hero card.
  static const double heroPad = 20;

  /// Padding of a plain card.
  static const double plainPad = 16;

  /// Between sibling items.
  static const double item = 12;

  /// Hero to the next block.
  static const double group = 24;

  /// Section to section.
  static const double section = 32;

  /// The subject emblem on a hero: a 156 dp box holding a 136 dp drawing, 8 dp from the top and
  /// bled 10 dp past the right edge, so its ink ends on the card edge and is never cropped.
  static const double artBox = 156;
  static const double artSize = 136;
  static const double artTop = 8;
  static const double artBleedRight = 10;

  /// How far a row inside the hero's header band keeps clear of the emblem (measured from the
  /// card edge): the box, less its bleed, plus 12 dp of air.
  static const double artClear = artBox - artBleedRight + 12;
}

/// The surface of a selected or answered row. Night lifts it (`raised2`); Day cannot go lighter
/// than `raised`, and its `raised2` is darker than the page, so Day keeps `raised` and the 2 px ink
/// border does the work (SPACING.md 8.1).
Color selectedSurfaceOf(MmColors colors) => colors.isNight ? colors.raised2 : colors.raised;

/// The volt of a filled mark or bar: volt in both themes, with a 1 dp olive rim in Day so it reads
/// on paper (SPACING.md 8.3, MOTION.md 1.4).
class VoltMark {
  const VoltMark._();

  static Color fill(MmColors colors) => colors.volt;

  /// The rim, or null on Night.
  static Color? rim(MmColors colors) => colors.isNight ? null : colors.accentText;
}
