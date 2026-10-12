import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../copy/formatters.dart';
import '../theme/theme.dart';

/// The state of one cell of the answer sheet. Each has its own glyph or shape, so state is
/// never colour alone.
enum QuestionCell {
  /// Ink fill with a check.
  right,

  /// Wrong surface, wrong border and a cross.
  wrong,

  /// Hollow, no glyph: not attempted.
  blank,

  /// The answer was changed: hollow with a small diamond.
  changed,

  /// A wrong answer the student repaired: the wrong cell plus a small ink corner notch.
  repaired,
}

/// The answer sheet: one small cell per question (spec 5.6 card 1, 5.8 ending). In [dimmed]
/// mode every cell is uncoloured and has no glyph, for the sealed sheet where nothing may leak
/// before it is opened. [reveal] (0 to 1) fills the cells in question order for the opening
/// animation; cells not yet revealed are drawn dimmed.
class QuestionStrip extends StatelessWidget {
  const QuestionStrip({
    super.key,
    required this.cells,
    this.columns = 10,
    this.cellSize = 16,
    this.gap = 3,
    this.dimmed = false,
    this.reveal,
    this.semanticsLabel,
  }) : assert(columns > 0);

  final List<QuestionCell> cells;
  final int columns;
  final double cellSize;
  final double gap;
  final bool dimmed;

  /// Drives the in-order fill. Null means fully shown.
  final Animation<double>? reveal;

  /// Overrides the generated summary.
  final String? semanticsLabel;

  Size get size {
    final cols = math.min(columns, math.max(cells.length, 1));
    final rows = (cells.length / columns).ceil();
    return Size(cols * cellSize + (cols - 1) * gap, rows == 0 ? 0 : rows * cellSize + (rows - 1) * gap);
  }

  String _describe() {
    if (dimmed) return 'Answer sheet, ${plural(cells.length, 'question')}';
    int count(bool Function(QuestionCell) test) => cells.where(test).length;
    final right = count((c) => c == QuestionCell.right);
    final repaired = count((c) => c == QuestionCell.repaired);
    final wrong = count((c) => c == QuestionCell.wrong) + repaired;
    final blank = count((c) => c == QuestionCell.blank);
    final changed = count((c) => c == QuestionCell.changed);
    return [
      '$right correct',
      '$wrong wrong',
      '$blank not attempted',
      if (changed > 0) '$changed changed',
      if (repaired > 0) '$repaired repaired',
    ].join(', ');
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: semanticsLabel ?? _describe(),
      excludeSemantics: true,
      child: RepaintBoundary(
        child: CustomPaint(
          size: size,
          painter: QuestionStripPainter(
            cells: cells,
            columns: columns,
            cellSize: cellSize,
            gap: gap,
            dimmed: dimmed,
            colors: context.mmColors,
            reveal: reveal,
          ),
        ),
      ),
    );
  }
}

class QuestionStripPainter extends CustomPainter {
  QuestionStripPainter({
    required this.cells,
    required this.columns,
    required this.cellSize,
    required this.gap,
    required this.dimmed,
    required this.colors,
    this.reveal,
  }) : super(repaint: reveal);

  final List<QuestionCell> cells;
  final int columns;
  final double cellSize;
  final double gap;
  final bool dimmed;
  final MmColors colors;
  final Animation<double>? reveal;

  @override
  void paint(Canvas canvas, Size size) {
    final shown = reveal == null ? cells.length : (reveal!.value * cells.length).ceil();
    final radius = Radius.circular(cellSize * 0.25);
    final glyph = cellSize * 0.5;
    final stroke = math.max(1.2, cellSize * 0.1);

    final fill = Paint();
    final border = Paint()..style = PaintingStyle.stroke;
    final mark = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (var i = 0; i < cells.length; i++) {
      final col = i % columns;
      final row = i ~/ columns;
      final origin = Offset(col * (cellSize + gap), row * (cellSize + gap));
      final rect = Rect.fromLTWH(origin.dx, origin.dy, cellSize, cellSize);
      final center = rect.center;
      final cell = cells[i];

      if (dimmed || i >= shown) {
        _box(canvas, rect, radius, fill, border, colors.sunken, colors.line, 1);
        continue;
      }

      switch (cell) {
        case QuestionCell.right:
          _box(canvas, rect, radius, fill, border, colors.ink, null, 0);
          mark.color = colors.ground;
          canvas.drawPath(_check(center, glyph), mark);
        case QuestionCell.wrong || QuestionCell.repaired:
          _box(canvas, rect, radius, fill, border, colors.wrongSurface, colors.wrongBorder, 1.2);
          mark.color = colors.wrongText;
          canvas.drawPath(_cross(center, glyph), mark);
          if (cell == QuestionCell.repaired) _notch(canvas, rect, radius);
        case QuestionCell.blank:
          _box(canvas, rect, radius, fill, border, colors.sunken, colors.lineStrong, 1);
        case QuestionCell.changed:
          _box(canvas, rect, radius, fill, border, colors.raised2, colors.ink2, 1.5);
          fill.color = colors.ink2;
          final d = glyph * 0.36;
          canvas.drawPath(
            Path()
              ..moveTo(center.dx, center.dy - d)
              ..lineTo(center.dx + d, center.dy)
              ..lineTo(center.dx, center.dy + d)
              ..lineTo(center.dx - d, center.dy)
              ..close(),
            fill,
          );
      }
    }
  }

  void _box(
    Canvas canvas,
    Rect rect,
    Radius radius,
    Paint fill,
    Paint border,
    Color fillColor,
    Color? borderColor,
    double borderWidth,
  ) {
    final rrect = RRect.fromRectAndRadius(rect, radius);
    fill.color = fillColor;
    canvas.drawRRect(rrect, fill);
    if (borderColor != null) {
      border
        ..color = borderColor
        ..strokeWidth = borderWidth;
      canvas.drawRRect(rrect.deflate(borderWidth / 2), border);
    }
  }

  Path _check(Offset c, double g) {
    return Path()
      ..moveTo(c.dx - g * 0.42, c.dy + g * 0.02)
      ..lineTo(c.dx - g * 0.1, c.dy + g * 0.34)
      ..lineTo(c.dx + g * 0.44, c.dy - g * 0.3);
  }

  Path _cross(Offset c, double g) {
    final h = g * 0.34;
    return Path()
      ..moveTo(c.dx - h, c.dy - h)
      ..lineTo(c.dx + h, c.dy + h)
      ..moveTo(c.dx + h, c.dy - h)
      ..lineTo(c.dx - h, c.dy + h);
  }

  /// The signature mark: a small ink triangle folded into the top-right corner.
  void _notch(Canvas canvas, Rect rect, Radius radius) {
    final n = rect.width * 0.46;
    final path = Path()
      ..moveTo(rect.right - n, rect.top)
      ..lineTo(rect.right - radius.x, rect.top)
      ..arcToPoint(Offset(rect.right, rect.top + radius.y), radius: radius)
      ..lineTo(rect.right, rect.top + n)
      ..close();
    canvas.drawPath(path, Paint()..color = colors.ink);
  }

  @override
  bool shouldRepaint(QuestionStripPainter old) =>
      old.colors != colors ||
      old.dimmed != dimmed ||
      old.columns != columns ||
      old.cellSize != cellSize ||
      old.gap != gap ||
      old.reveal != reveal ||
      !_sameCells(old.cells);

  bool _sameCells(List<QuestionCell> other) {
    if (identical(other, cells)) return true;
    if (other.length != cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (other[i] != cells[i]) return false;
    }
    return true;
  }
}
