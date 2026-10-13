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

  /// Horizontal screen gutter.
  static const double gutter = 16;

  /// Gutter on Today cards and moment screens.
  static const double cardGutter = 20;

  /// Padding inside a card.
  static const double cardPadding = 20;

  /// Gap between independent groups.
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

  /// Top corners of a sheet.
  static const double sheetTop = 32;

  /// Pills (large enough to always round fully).
  static const double pill = 999;

  static const BorderRadius smallAll = BorderRadius.all(Radius.circular(small));
  static const BorderRadius keyAll = BorderRadius.all(Radius.circular(key));
  static const BorderRadius panelAll = BorderRadius.all(Radius.circular(panel));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTopOnly = BorderRadius.vertical(top: Radius.circular(sheetTop));
}

/// Minimum touch targets (48 dp floor, brief section 10).
abstract final class MmTarget {
  static const double min = 48;
  static const double tab = 48;
  static const double primaryKey = 56;
  static const double runnerKey = 56;
  static const double option = 56;
}

/// Layer order of the three planes: the room (art), glass (cards), chrome (dock and sheets).
abstract final class MmElevation {
  /// Pressed glass brightens its edge light by this factor.
  static const double pressedEdgeBoost = 1.6;

  /// Blur sigma per glass role. Capped at 14 (perf review, round 1): under the dense tint the
  /// difference from 20 to 28 is invisible, and every point of radius costs a weak GPU each
  /// scrolling frame.
  static const double sigmaDock = 14;
  static const double sigmaSheet = 14;
  static const double sigmaControl = 12;
}

/// The split glass dock (brief section 6).
abstract final class MmDock {
  static const double height = 60;
  static const double startSize = 60;

  /// Gap between the pill and the Start circle.
  static const double gap = 12;

  /// Lift above the gesture inset.
  static const double lift = 10;

  /// What the shell adds to a tab root's bottom padding (on top of the gesture inset) so the last
  /// row scrolls clear of the dock and its scrim.
  static const double clearanceAbove = height + lift + 24;
}
