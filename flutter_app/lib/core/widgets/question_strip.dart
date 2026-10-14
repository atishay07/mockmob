import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../copy/formatters.dart';
import '../theme/theme.dart';
import 'bubbles/bubble_painter.dart';

/// The state of one bubble of the answer sheet. Each has its own shape, so state is never colour
/// alone.
enum QuestionCell {
  /// Inked bubble.
  right,

  /// Coral bubble with a cross.
  wrong,

  /// Dashed ring: not attempted.
  blank,

  /// The answer was changed: a ring with a centre dot.
  changed,

  /// A wrong answer the student repaired: the wrong bubble inside a volt ring.
  repaired,
}

/// The answer sheet as a strip of bubbles, one per question (spec 5.6 card 1, 5.8 ending). In [dimmed]
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

/// Paints the strip as answer bubbles: right is inked, wrong is coral with a cross, blank is a
/// dashed ring, changed is a ring with a dot, repaired is the wrong bubble inside a volt ring.
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
    final bubbles = BubblePaint(colors);
    final exact = reveal == null ? double.infinity : reveal!.value * cells.length;
    // Leave room for the repaired ring inside the cell.
    final r = cellSize / 2 - math.max(1.0, cellSize * 0.08);

    for (var i = 0; i < cells.length; i++) {
      final col = i % columns;
      final row = i ~/ columns;
      final center = Offset(col * (cellSize + gap) + cellSize / 2, row * (cellSize + gap) + cellSize / 2);
      if (dimmed) {
        bubbles.paint(canvas, center, r, BubbleState.hollow, dim: 0.6);
        continue;
      }
      final fill = (exact - i).clamp(0.0, 1.0);
      if (fill <= 0) {
        bubbles.paint(canvas, center, r, BubbleState.hollow, dim: 0.6);
        continue;
      }
      final cell = cells[i];
      switch (cell) {
        case QuestionCell.right:
          bubbles.paint(canvas, center, r, BubbleState.filled, fill: fill);
        case QuestionCell.wrong:
          bubbles.paint(canvas, center, r, BubbleState.wrong, fill: fill);
        case QuestionCell.repaired:
          bubbles.paint(canvas, center, r * 0.82, BubbleState.wrong, fill: fill);
          canvas.drawCircle(
            center,
            cellSize / 2 - 0.75,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.5
              ..color = (colors.isNight ? colors.volt : colors.accentText).withValues(alpha: fill),
          );
        case QuestionCell.blank:
          bubbles.paint(canvas, center, r, BubbleState.blank, dim: fill);
        case QuestionCell.changed:
          bubbles.paint(canvas, center, r, BubbleState.marked, dim: fill);
      }
    }
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
