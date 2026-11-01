/// The stage's size rules for a Key card on a phone (A1 3.2, 3.4; B7), in one light place so the skeleton and the
/// card share them.
library;

import 'dart:math' as math;

abstract final class StageSizes {
  /// The card's corner radius.
  static const double cardRadius = 24;

  /// The card's least height on a screen [screenHeight] tall: clamp(300, 46%, 380).
  static double cardMin(double screenHeight) => (0.46 * screenHeight).clamp(300.0, 380.0);

  /// The card's greatest height in an item area [area] tall: the area less the stamp line (28) and 4% of the screen,
  /// never under [cardMin].
  static double cardMax(double area, double screenHeight) => math.max(cardMin(screenHeight), area - 28 - 0.04 * screenHeight);

  /// The prompt's size, line height and tracking (em) by its size step and the screen's width.
  static ({double size, double height, double tracking}) prompt(String step, double screenWidth) {
    final narrow = screenWidth < 380;
    return switch (step) {
      'm' => (size: narrow ? 26 : 28, height: 1.16, tracking: -0.02),
      'l' => (size: narrow ? 21 : 22, height: 1.3, tracking: -0.01),
      _ => (size: narrow ? 32 : 34, height: 1.12, tracking: -0.025),
    };
  }
}
