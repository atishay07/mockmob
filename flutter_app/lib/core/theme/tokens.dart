import 'package:flutter/widgets.dart';

/// Spacing scale. Use these instead of ad-hoc numbers.
abstract final class MmSpace {
  static const double s2 = 2;
  static const double s4 = 4;
  static const double s6 = 6;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s20 = 20;
  static const double s24 = 24;
  static const double s32 = 32;
  static const double s40 = 40;
  static const double s48 = 48;
  static const double s64 = 64;

  /// Horizontal screen gutter: every screen that holds cards, lists, tiles or forms (all tab
  /// roots, sub-pages, runner, tools, rhythm, insights, learn, onboarding steps). It is the E0 text
  /// edge. SPACING.md 1.1.
  static const double gutter = 16;

  /// Gutter of a moment: type and art with no cards (welcome, plan reveal, result recap, repair
  /// entry and ending, sealed sheet). A screen never mixes this with [gutter].
  static const double momentGutter = 24;

  /// The old 20 dp card gutter. Superseded: cards use [gutter], moments use [momentGutter]. Kept
  /// only so screens not yet migrated still compile; do not use it in new code.
  static const double cardGutter = 20;

  /// Padding of a hero card (the plain card is 16: `MmRhythm.plainPad`).
  static const double cardPadding = 20;

  /// Side padding of a sheet and its dialogs (the 32 dp top radius needs the optical inset).
  static const double sheetSide = 20;

  /// Section gap: between independent sections, with a 1 dp hairline rule at the top of the new
  /// one. A hero to the next block is `s24`; sibling cards are `s12`.
  static const double group = 32;

  /// Content never grows wider than this on large screens.
  static const double contentMaxWidth = 600;
}

/// Corner radii. Glass and solid surfaces use continuous (superellipse) corners where drawn by
/// the foundation widgets.
abstract final class MmRadius {
  /// Small controls, chips' inner parts.
  static const double small = 12;

  /// Fields, answer options, selectable rows.
  static const double key = 18;

  /// Panels, cards and the inner cards of sheets.
  static const double panel = 24;

  /// Pills (large enough to always round fully).
  static const double pill = 999;

  static const BorderRadius smallAll = BorderRadius.all(Radius.circular(small));
  static const BorderRadius keyAll = BorderRadius.all(Radius.circular(key));
  static const BorderRadius panelAll = BorderRadius.all(Radius.circular(panel));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));

  /// Top corners of a sheet (32 dp).
  static const BorderRadius sheetTopOnly = BorderRadius.vertical(top: Radius.circular(32));
}

/// Minimum touch targets (48 dp floor, brief section 10).
abstract final class MmTarget {
  static const double min = 48;
  static const double primaryKey = 56;
  static const double option = 56;
}

/// Layer order of the three planes: the room (art), glass (cards), chrome (dock and sheets).
abstract final class MmElevation {
  /// Pressed glass brightens its edge light by this factor.
  static const double pressedEdgeBoost = 1.6;

  /// Blur sigma per glass role. The dock reads as frost only when the blur is strong under a
  /// thinner tint (owner test 15 Oct: "the blur reads weak"): 24 for the bar, 18 for sheets.
  static const double sigmaDock = 24;
  static const double sigmaSheet = 18;
  static const double sigmaControl = 12;
}

/// The bottom bar (docs/design-decisions/app-ia-1016.md section 4, which replaces DOCK.md 3.1):
/// one centred glass bar of six equal slots, Today, Practice, Start, Review, Colleges and You,
/// with a live capsule that rises above it while something is in progress. Start is laid out
/// exactly like a tab (icon over label, on a volt pill the size of the lens), so every icon,
/// every label and the Start pill share their centre lines by construction (L31).
abstract final class MmBar {
  /// The bar's painted height, expanded and compact (scrolled down).
  static const double height = 64;
  static const double compactHeight = 52;

  /// Gap between the bar's bottom edge and the gesture inset (or the 3-button bar).
  static const double lift = 12;

  /// Padding inside the bar, every side.
  static const double pad = 6;

  /// The six slots, all the same width (Start included).
  static const int slots = 6;

  /// The lens and the Start pill are a slot less this much on each side.
  static const double pillInset = 2;

  /// The icon box (24 by 24) and its top, measured from the expanded bar's top: y 11 to 35,
  /// centre 23.
  static const double icon = 24;
  static const double iconTop = 11;

  /// The label's line box: 11 sp, line height 14, at y 39 to 53 (centre 46). The icon, the 4 dp
  /// gap and the label make a 42 dp group centred on y 32, the pill's centre.
  static const double labelTop = 39;
  static const double labelHeight = 14;
  static const double labelSize = 11;

  /// Compact: the icons move down this far to centre on y 38, the compact pill's centre.
  static const double compactShift = (height - compactHeight) + (compactHeight - 2 * pad) / 2 + pad - (iconTop + icon / 2);

  /// The live capsule's height and its gap above the bar.
  static const double capsuleHeight = 44;
  static const double capsuleGap = 8;

  /// The bar's side gutter (8 on phones narrower than 360 dp) and its widest size.
  static const double gutter = 16;
  static const double narrowGutter = 8;
  static const double maxWidth = 440;

  /// Space between the bar's top edge and the end of a tab root's content.
  static const double contentGap = 20;

  /// What the capsule adds to a tab root's bottom padding while it shows.
  static const double capsuleClearance = capsuleHeight + capsuleGap;

  /// What the shell adds to a tab root's bottom padding (on top of the gesture inset) so the
  /// last row scrolls clear of the expanded bar.
  static const double clearanceAbove = lift + height + contentGap;

  /// The bar's width on a screen [screenWidth] wide.
  static double widthFor(double screenWidth) =>
      (screenWidth - 2 * (screenWidth < 360 ? narrowGutter : gutter)).clamp(0.0, maxWidth);

  /// Each slot's width on a screen [screenWidth] wide: (W - 12) / 6.
  static double slotFor(double screenWidth) => (widthFor(screenWidth) - 2 * pad) / slots;
}
