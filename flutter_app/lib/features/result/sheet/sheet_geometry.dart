import 'dart:math' as math;

/// Sizes of the answer sheet for the space it is given. The sheet is folded along a horizontal
/// crease: the flap (the marks box) above, the body (the bubbles) below. Folded, the flap lies
/// over the top of the body, so the body is always a little taller than the flap.
class SheetGeometry {
  const SheetGeometry({
    required this.width,
    required this.flapHeight,
    required this.bodyHeight,
    required this.bubble,
    required this.columns,
    required this.rows,
    required this.figureSize,
    this.numberSpace = defaultNumberSpace,
  });

  /// Fits a sheet for [questions] into [maxWidth] by [maxHeight]. [numberHeight] is the height of
  /// the number line above each row of bubbles at the sheet's text size (13 dp at 1x), so the body
  /// is as tall as the numbers need and they never give way at a larger text size. [flapHeight]
  /// fixes the flap's height where its content is shorter than the figure's box (the marks held
  /// state), instead of leaving a void in it.
  factory SheetGeometry.fit({
    required double maxWidth,
    required double maxHeight,
    required int questions,
    double numberHeight = 13,
    double? flapHeight,
  }) {
    final numberSpace = numberHeight > 0 ? numberHeight + 3 : 0.0;
    final width = math.min(maxWidth, 400.0);
    const columns = 10;
    final rows = math.max(1, (questions / columns).ceil());
    for (var bubble = 20.0; bubble >= 12; bubble -= 1) {
      final figure = (bubble / 20 * 112).clamp(72.0, 112.0);
      final flap = flapHeight ?? _flap(figure);
      final body = math.max(_body(rows, bubble, numberSpace), flap + 44);
      if (flap + body <= maxHeight || bubble <= 12) {
        return SheetGeometry(
          width: width,
          flapHeight: flap,
          bodyHeight: body,
          bubble: bubble,
          columns: columns,
          rows: rows,
          figureSize: figure,
          numberSpace: numberSpace,
        );
      }
    }
    throw StateError('unreachable');
  }

  static const double pad = 18;
  static const double headerHeight = 18;
  static const double headerGap = 12;
  /// The number line over a row at 1x text (13 dp) and its 3 dp gap.
  static const double defaultNumberSpace = 16;
  static const double rowGap = 10;

  /// The marks meter under the figure, and the gap between it and the scheme line.
  static const double meterHeight = 4;
  static const double meterGap = 10;

  static double _flap(double figure) => math.max(pad + headerHeight + 6 + figure * 0.9 + 8 + meterHeight + meterGap + 36 + pad - 4, 220);

  static double _body(int rows, double bubble, double numberSpace) =>
      pad + headerHeight + headerGap + gridHeight(rows, bubble, numberSpace: numberSpace) + pad;

  static double gridHeight(int rows, double bubble, {double numberSpace = defaultNumberSpace}) =>
      rows * (bubble + numberSpace) + (rows - 1) * rowGap;

  final double width;
  final double flapHeight;
  final double bodyHeight;
  final double bubble;
  final int columns;
  final int rows;

  /// The number line over each row of bubbles, with its gap (0 when the numbers are left out).
  final double numberSpace;

  /// The marks figure, 112 sp at full size.
  final double figureSize;

  double get height => flapHeight + bodyHeight;

  /// The body's own height without the room a folded flap needs (a flat, settled sheet).
  double get naturalBodyHeight => _body(rows, bubble, numberSpace);
}
