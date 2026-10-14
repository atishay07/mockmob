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
  });

  /// Fits a sheet for [questions] into [maxWidth] by [maxHeight].
  factory SheetGeometry.fit({required double maxWidth, required double maxHeight, required int questions}) {
    final width = math.min(maxWidth, 400.0);
    const columns = 10;
    final rows = math.max(1, (questions / columns).ceil());
    for (var bubble = 20.0; bubble >= 12; bubble -= 1) {
      final figure = (bubble / 20 * 112).clamp(72.0, 112.0);
      final flap = _flap(figure);
      final body = math.max(_body(rows, bubble), flap + 44);
      if (flap + body <= maxHeight || bubble <= 12) {
        return SheetGeometry(
          width: width,
          flapHeight: flap,
          bodyHeight: body,
          bubble: bubble,
          columns: columns,
          rows: rows,
          figureSize: figure,
        );
      }
    }
    throw StateError('unreachable');
  }

  static const double pad = 18;
  static const double headerHeight = 18;
  static const double headerGap = 12;
  static const double numberSpace = 16;
  static const double rowGap = 10;

  static double _flap(double figure) => math.max(pad + headerHeight + 6 + figure * 0.9 + 8 + 36 + pad - 4, 206);

  static double _body(int rows, double bubble) => pad + headerHeight + headerGap + gridHeight(rows, bubble) + pad;

  static double gridHeight(int rows, double bubble) => rows * (bubble + numberSpace) + (rows - 1) * rowGap;

  final double width;
  final double flapHeight;
  final double bodyHeight;
  final double bubble;
  final int columns;
  final int rows;

  /// The marks figure, 112 sp at full size.
  final double figureSize;

  double get height => flapHeight + bodyHeight;

  /// The body's own height without the room a folded flap needs (a flat, settled sheet).
  double get naturalBodyHeight => _body(rows, bubble);
}
