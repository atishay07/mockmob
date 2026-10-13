import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';

/// Paints one palette bubble with its question number (spec 5.5): answered is inked, not
/// answered an empty ring, not visited a faint dashed ring on the sunken well, the current
/// question carries an ink ring, a mark is a small flag at the top right, and an answer still on
/// this phone a hollow dot at the bottom right. Each fact is a shape, never colour alone.
class SheetCellPainter extends CustomPainter {
  SheetCellPainter({required this.cell, required this.colors, required this.numberStyle});

  final SheetCell cell;
  final MmColors colors;
  final TextStyle numberStyle;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.min(size.width, size.height) / 2 - 5;
    final bubbles = BubblePaint(colors);

    if (cell.answered) {
      bubbles.paint(canvas, c, r, BubbleState.filled, emphasis: cell.current);
    } else if (cell.visited) {
      bubbles.paint(canvas, c, r, BubbleState.hollow, emphasis: cell.current);
    } else {
      canvas.drawCircle(c, r, Paint()..color = colors.sunken);
      bubbles.paint(canvas, c, r, BubbleState.blank, emphasis: cell.current);
    }

    final number = TextPainter(
      text: TextSpan(
        text: '${cell.number}',
        style: numberStyle.copyWith(color: cell.answered ? colors.voltInk : (cell.visited ? colors.ink : colors.ink2)),
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    number.paint(canvas, c - Offset(number.width / 2, number.height / 2));

    if (cell.marked) _flag(canvas, c + Offset(r * 0.78, -r * 0.82));
    if (cell.unsynced) _dot(canvas, c + Offset(r * 0.8, r * 0.8));
  }

  /// A small flag on a ground-coloured disc so it reads over any bubble.
  void _flag(Canvas canvas, Offset at) {
    canvas.drawCircle(at, 8, Paint()..color = colors.raised);
    canvas.drawCircle(
      at,
      8,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.line,
    );
    final pole = Paint()
      ..color = colors.ink
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(at + const Offset(-2.6, -4.2), at + const Offset(-2.6, 4.4), pole);
    final cloth = Path()
      ..moveTo(at.dx - 2.6, at.dy - 4.2)
      ..lineTo(at.dx + 4, at.dy - 2.4)
      ..lineTo(at.dx - 2.6, at.dy + 0.8)
      ..close();
    canvas.drawPath(cloth, Paint()..color = colors.ink);
  }

  /// The unsynced mark: a hollow dot.
  void _dot(Canvas canvas, Offset at) {
    canvas.drawCircle(at, 5, Paint()..color = colors.raised);
    canvas.drawCircle(
      at,
      3,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = colors.warnText,
    );
  }

  @override
  bool shouldRepaint(SheetCellPainter old) => old.cell != cell || old.colors != colors || old.numberStyle != numberStyle;
}

/// A 48 dp palette cell. Tapping it goes to that question.
class SheetCellKey extends StatelessWidget {
  const SheetCellKey({super.key, required this.cell, required this.onTap});

  final SheetCell cell;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.label.copyWith(fontSize: 14, height: 1, fontWeight: FontWeight.w700);
    return Semantics(
      container: true,
      button: true,
      selected: cell.current,
      label: RunnerCopy.cellSemantics(
        number: cell.number,
        answered: cell.answered,
        visited: cell.visited,
        marked: cell.marked,
        unsynced: cell.unsynced,
        current: cell.current,
      ),
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          height: 52,
          child: CustomPaint(
            painter: SheetCellPainter(cell: cell, colors: colors, numberStyle: style),
          ),
        ),
      ),
    );
  }
}
