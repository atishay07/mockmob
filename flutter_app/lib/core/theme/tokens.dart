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

/// The look of the Start key (NAV-1017 section 6.2): [volt] is the lime-filled key the owner chose
/// on 17 Oct (A1); [glass] is the quiet glass key with a lime ring and glyph (A).
enum StartKeyStyle { volt, glass }

/// The bottom bar (docs/design-decisions/pass-1017/NAV-1017.md section 6, which replaces
/// app-ia-1016.md section 4): one 64 dp row holding a glass capsule of five tabs (Today, Practice,
/// Review, Colleges, You) and, 8 dp to its right, a separate 64 dp round Start key. The capsule
/// and the key are the same 64 dp box, top and bottom, and the key's glyph and word sit in the
/// tabs' icon and label boxes, so every icon, every label and the key share two centre lines by
/// construction (L31). A live capsule rises above the whole row while something is in progress.
abstract final class MmBar {
  /// The row's painted height, expanded and compact (scrolled down).
  static const double height = 64;
  static const double compactHeight = 52;

  /// Gap between the row's bottom edge and the gesture inset (or the 3-button bar).
  static const double lift = 12;

  /// Padding inside the capsule, left and right of the five slots (3 below 360 dp).
  static const double pad = 4;
  static const double narrowPad = 3;

  /// The Start key: a circle as tall as the row, and its gap from the capsule (6 below 360 dp).
  static const double keySize = 64;
  static const double keyGap = 8;
  static const double narrowKeyGap = 6;

  /// The key's look. The owner chose the lime-filled key (A1) on 17 Oct; the glass key (A) stays
  /// one switch away.
  static const StartKeyStyle startKeyStyle = StartKeyStyle.volt;

  /// The capsule's and the live capsule's blur (L33: frost, so what scrolls under the bar shows as
  /// soft colour and shape, never as readable text). GLASS-1017 section 8 keeps the frost value
  /// under this name too, so the owner's answer to its question 1 is one number.
  ///
  /// v14: 16, down from 32. At 32 a 64 dp bar averages Today's rail, dots and lines into one flat
  /// tone, so the Night bar read as an opaque pill on the device walk (F3, L33, GLASS A1). The
  /// owner's newest words (F3, 17 Oct) ask for Apple's glass, where content stays recognisable
  /// as shape; GLASS-1017 6.1 sets the lighter blur and leaves legibility to the luminosity step
  /// (`BarGlass.backdropMatrix`), which holds 4.5:1 over a solid volt key. Text under the bar
  /// still never reads: an 11 to 16 sp glyph is gone at sigma 16.
  static const double blurSigma = 16;
  static const double frostBlurSigma = blurSigma;

  /// The backdrop's saturation lift under the glass (Apple's regular material, NAV 6.2).
  static const double saturation = 1.5;

  /// The five tab slots, all the same width.
  static const int slots = 5;

  /// The lens is a slot less this much on each side (1, not the 2 of NAV 6.1: the extra 2 dp of
  /// width buy the lens's corners about 2 dp more radius around the label, see `BarLensPainter`).
  static const double lensInset = 1;

  /// The label box is the lens less this much on each side, so a word never meets the lens's
  /// side.
  static const double labelInset = 3;

  /// The lens's height, expanded (y 4 to 60 of the row) and compact (y 16 to 60).
  static const double lensHeight = 56;
  static const double compactLensHeight = 44;

  /// How far a finger's flick projects the lens when it lets go: `v / 1000 * d / (1 - d)` dp.
  /// UIKit's scroll rate (0.998) sends any flick to the end of a 300 dp bar, so the bar uses
  /// UIKit's fast rate (0.99): a 1,000 dp/s flick travels about 99 dp, a slot and a half.
  static const double projectionDecay = 0.99;

  /// The icon box (24 by 24) and its top, measured from the expanded row's top: y 11 to 35,
  /// centre 23.
  static const double icon = 24;
  static const double iconTop = 11;

  /// The label's line box: 11 sp, line height 14, at y 39 to 53 (centre 46). The icon, the 4 dp
  /// gap and the label make a 42 dp group centred on y 32, the capsule's and the key's centre.
  static const double labelTop = 39;
  static const double labelHeight = 14;
  static const double labelSize = 11;

  /// Compact: the icons move down this far to centre on y 38, the compact row's centre.
  static const double compactShift = height - compactHeight / 2 - (iconTop + icon / 2);

  /// The live capsule's height and its gap above the row.
  static const double capsuleHeight = 44;
  static const double capsuleGap = 8;

  /// The row's side gutter (8 on phones narrower than 360 dp) and its widest size.
  static const double gutter = 16;
  static const double narrowGutter = 8;
  static const double maxWidth = 440;

  /// Below this screen width the gutter, the key gap and the capsule padding narrow.
  static const double narrowBelow = 360;

  /// Space between the row's top edge and the end of a tab root's content.
  static const double contentGap = 20;

  /// What the capsule adds to a tab root's bottom padding while it shows.
  static const double capsuleClearance = capsuleHeight + capsuleGap;

  /// What the shell adds to a tab root's bottom padding (on top of the gesture inset) so the
  /// last row scrolls clear of the expanded bar.
  static const double clearanceAbove = lift + height + contentGap;

  /// The row's width on a screen [screenWidth] wide: the screen less a gutter each side, at most
  /// 440.
  static double widthFor(double screenWidth) =>
      (screenWidth - 2 * (screenWidth < narrowBelow ? narrowGutter : gutter)).clamp(0.0, maxWidth);

  /// The key's gap from the capsule on a screen [screenWidth] wide.
  static double keyGapFor(double screenWidth) => screenWidth < narrowBelow ? narrowKeyGap : keyGap;

  /// The capsule's inner padding on a screen [screenWidth] wide.
  static double padFor(double screenWidth) => screenWidth < narrowBelow ? narrowPad : pad;

  /// The capsule's width: the row less the key and its gap.
  static double capsuleWidthFor(double screenWidth) => widthFor(screenWidth) - keySize - keyGapFor(screenWidth);

  /// Each tab slot's width: `(row - 64 - gap - 2 x pad) / 5` (45.6 dp at 320, 49.6 at 360, 60 at
  /// 412, 72 from 472 up).
  static double slotFor(double screenWidth) => (capsuleWidthFor(screenWidth) - 2 * padFor(screenWidth)) / slots;
}
