import 'package:flutter/widgets.dart';

/// Spacing scale from spec 2.3. Use these instead of ad-hoc numbers.
abstract final class MmSpace {
  static const double s4 = 4;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s20 = 20;
  static const double s24 = 24;
  static const double s32 = 32;
  static const double s48 = 48;

  /// Horizontal screen gutter.
  static const double gutter = 16;

  /// Gutter on Today cards.
  static const double cardGutter = 20;

  /// Padding inside a card.
  static const double cardPadding = 20;

  /// Gap between independent groups.
  static const double group = 32;

  /// Content never grows wider than this on large screens.
  static const double contentMaxWidth = 600;
}

/// Corner radii from spec 2.3.
abstract final class MmRadius {
  /// Small controls.
  static const double small = 10;

  /// Keys, fields, answer options.
  static const double key = 14;

  /// Panels and the inner cards of sheets.
  static const double panel = 20;

  /// Top corners of a modal sheet.
  static const double sheetTop = 28;

  /// Pill chips (large enough to always round fully).
  static const double pill = 999;

  static const BorderRadius smallAll = BorderRadius.all(Radius.circular(small));
  static const BorderRadius keyAll = BorderRadius.all(Radius.circular(key));
  static const BorderRadius panelAll = BorderRadius.all(Radius.circular(panel));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTopOnly = BorderRadius.vertical(top: Radius.circular(sheetTop));
}

/// Minimum touch targets from binding rule 7.
abstract final class MmTarget {
  static const double min = 44;
  static const double tab = 48;
  static const double primaryKey = 54;
  static const double runnerKey = 56;
  static const double option = 56;
}
