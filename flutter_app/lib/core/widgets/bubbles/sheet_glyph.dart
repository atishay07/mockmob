import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'bubble_painter.dart';

/// Small answer-sheet drawings that stand for a kind of session, instead of stock icons.
enum SheetGlyph {
  /// A row half inked: a paper in progress.
  resume,

  /// Ten bubbles in two rows: a Quick 10.
  quick,

  /// One row, its first two inked, under a chapter rule: one chapter.
  chapter,

  /// A 5 by 5 micro-grid: a full paper.
  mock,

  /// The micro-grid with a timing mark down its side: the exam-day layout.
  exam,

  /// One wrong bubble in a volt ring: the mistake about to be repaired.
  repair,
}

/// A [SheetGlyph] in a 40 dp tile.
class SheetGlyphTile extends StatelessWidget {
  const SheetGlyphTile(this.glyph, {super.key, this.size = 40});

  final SheetGlyph glyph;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised2,
          shape: RoundedSuperellipseBorder(borderRadius: BorderRadius.circular(size * 0.3), side: BorderSide(color: colors.line)),
        ),
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: SheetGlyphPainter(glyph, colors: colors),
          ),
        ),
      ),
    );
  }
}

class SheetGlyphPainter extends CustomPainter {
  const SheetGlyphPainter(this.glyph, {required this.colors});

  final SheetGlyph glyph;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final b = BubblePaint(colors);
    final c = size.center(Offset.zero);
    final volt = colors.isNight ? colors.volt : colors.accentText;
    void grid({double dx = 0}) {
      for (var row = 0; row < 5; row++) {
        for (var col = 0; col < 5; col++) {
          b.paint(canvas, Offset(c.dx + dx + (col - 2) * 5.5, c.dy + (row - 2) * 5.5), 1.6, BubbleState.hollow);
        }
      }
    }

    switch (glyph) {
      case SheetGlyph.resume:
        for (var col = 0; col < 5; col++) {
          b.paint(canvas, Offset(c.dx + (col - 2) * 6.5, c.dy), 2.6, col < 3 ? BubbleState.filled : BubbleState.hollow);
        }
      case SheetGlyph.quick:
        for (var row = 0; row < 2; row++) {
          for (var col = 0; col < 5; col++) {
            final o = Offset(c.dx + (col - 2) * 6.5, c.dy + (row - 0.5) * 8);
            b.paint(canvas, o, 2.5, row == 0 && col < 3 ? BubbleState.filled : BubbleState.hollow);
          }
        }
      case SheetGlyph.chapter:
        canvas.drawLine(
          Offset(c.dx - 14, c.dy - 6),
          Offset(c.dx + 14, c.dy - 6),
          Paint()
            ..strokeWidth = 1.5
            ..strokeCap = StrokeCap.round
            ..color = colors.ink2,
        );
        for (var col = 0; col < 5; col++) {
          b.paint(canvas, Offset(c.dx + (col - 2) * 6.5, c.dy + 4), 2.5, col < 2 ? BubbleState.filled : BubbleState.hollow);
        }
      case SheetGlyph.mock:
        grid();
      case SheetGlyph.exam:
        grid(dx: 3);
        for (var row = 0; row < 5; row++) {
          canvas.drawRect(Rect.fromLTWH(c.dx - 15, c.dy + (row - 2) * 5.5 - 1, 3, 2), Paint()..color = colors.ink2);
        }
      case SheetGlyph.repair:
        canvas.drawCircle(
          c,
          11,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = volt,
        );
        b.paint(canvas, c, 8, BubbleState.wrong);
    }
  }

  @override
  bool shouldRepaint(SheetGlyphPainter old) => old.glyph != glyph || old.colors != colors;
}
