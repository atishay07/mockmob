import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Where the rows of the answer sheet's bubble grid sit, so the reader line and the ink agree.
class GridRows {
  const GridRows({
    required this.count,
    required this.columns,
    required this.questions,
    required this.bubble,
    required this.rowGap,
    required this.numberSpace,
  });

  final int count;
  final int columns;
  final int questions;
  final double bubble;
  final double rowGap;

  /// The number line above each row of bubbles plus its 3 dp gap, or 0 without numbers.
  final double numberSpace;

  double get rowHeight => bubble + numberSpace;
  double get pitch => rowHeight + rowGap;
  double get height => count * rowHeight + math.max(0, count - 1) * rowGap;

  /// The top of row [r]'s bubbles.
  double bandTop(int r) => r * pitch + numberSpace;

  /// Bubbles in row [r] (the last row may be short).
  int inRow(int r) => math.min(columns, questions - r * columns).clamp(0, columns);

  /// Where the reader line is for [scan] (0 to 1): from just above the first row to just past the
  /// last.
  double lineY(double scan) => -6 + (height + 12) * scan;

  /// How far the ink has got through the paper, in question order (0 to 1), when the line is at
  /// [y]. A row inks left to right while the line crosses its bubbles (from their top to 6 dp
  /// below them), so rows ink one after another, each as the reader passes it, and the last row
  /// is complete where the line ends.
  double inkAt(double y) {
    if (questions == 0) return 1;
    final span = bubble + 6;
    var done = 0.0;
    for (var r = 0; r < count; r++) {
      final f = ((y - bandTop(r)) / span).clamp(0.0, 1.0);
      done += f * inRow(r);
      if (f < 1) break;
    }
    return (done / questions).clamp(0.0, 1.0);
  }
}

/// The ink progress of the grid, derived from the reader's [scan] progress.
class ScanInk extends Animation<double> with AnimationWithParentMixin<double> {
  ScanInk(this.parent, this.rows);

  @override
  final Animation<double> parent;
  final GridRows rows;

  @override
  double get value {
    final s = parent.value;
    if (s >= 1) return 1;
    return rows.inkAt(rows.lineY(s));
  }
}

/// The OMR reader passing down the sheet once: a fine volt hairline with a warm trail above it.
/// It is light on paper, so it is drawn only over the grid's band and clipped by the paper face.
class ReadLinePainter extends CustomPainter {
  ReadLinePainter({
    required this.scan,
    required this.rows,
    required this.top,
    required this.bleedLeft,
    required this.bleedRight,
    required this.volt,
  }) : super(repaint: scan);

  final Animation<double> scan;
  final GridRows rows;

  /// Where the grid starts inside this painter's box.
  final double top;

  /// How far past the box the line reaches on each side (to the paper's edges).
  final double bleedLeft;
  final double bleedRight;
  final Color volt;

  static const double trail = 44;

  @override
  void paint(Canvas canvas, Size size) {
    final s = scan.value;
    if (s <= 0 || s >= 1) return;
    // In over the first 6% of the travel, out over the last 10%.
    final a = (math.min(s / 0.06, (1 - s) / 0.1)).clamp(0.0, 1.0);
    final y = top + rows.lineY(s);
    final left = -bleedLeft;
    final right = size.width + bleedRight;
    final trailRect = Rect.fromLTRB(left, y - trail, right, y);
    canvas.drawRect(
      trailRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            volt.withValues(alpha: 0),
            volt.withValues(alpha: 0.05 * a),
            volt.withValues(alpha: 0.16 * a),
          ],
          stops: const [0, 0.6, 1],
        ).createShader(trailRect),
    );
    // The bloom under the hairline, then the hairline itself, brightest at the middle of the sheet.
    final lineRect = Rect.fromLTRB(left, y - 1.5, right, y + 1.5);
    canvas.drawRect(Rect.fromLTRB(left, y - 3, right, y + 3), Paint()..color = volt.withValues(alpha: 0.12 * a));
    canvas.drawRect(
      lineRect,
      Paint()
        ..shader = LinearGradient(
          colors: [
            volt.withValues(alpha: 0.15 * a),
            volt.withValues(alpha: 0.95 * a),
            volt.withValues(alpha: 0.15 * a),
          ],
          stops: const [0, 0.5, 1],
        ).createShader(lineRect),
    );
  }

  @override
  bool shouldRepaint(ReadLinePainter old) =>
      old.scan != scan ||
      old.top != top ||
      old.volt != volt ||
      old.bleedLeft != bleedLeft ||
      old.bleedRight != bleedRight ||
      old.rows.height != rows.height;
}
