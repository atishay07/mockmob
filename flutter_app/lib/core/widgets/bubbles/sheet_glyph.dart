import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/theme.dart';
import 'bubble_painter.dart';

/// Small answer-sheet drawings that stand for a kind of session, instead of stock icons.
enum SheetGlyph {
  /// A row half inked: a paper in progress.
  resume,

  /// A spark: a quick set.
  quick,

  /// An open book: one or more chapters.
  chapter,

  /// A stopwatch: a full timed paper.
  mock,

  /// The exam's own question palette in miniature (answered, not answered, marked, not
  /// visited): the exam-day layout. The only grid glyph, because it is what that screen shows.
  exam,

  /// One wrong bubble in a volt ring: the mistake about to be repaired.
  repair,

  /// A speech bubble with three typing dots: ask Mobi about your record.
  ask,
}

/// A [SheetGlyph] in a 40 dp tile, or [bare] (the drawing alone in the same square, no tile and
/// no outline: for rows and tiles that are not the one hero choice).
class SheetGlyphTile extends StatelessWidget {
  const SheetGlyphTile(this.glyph, {super.key, this.size = 40, this.bare = false});

  final SheetGlyph glyph;
  final double size;
  final bool bare;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (bare) {
      return ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: switch (glyph) {
            SheetGlyph.quick => Icon(LucideIcons.zap, size: size * 0.6, color: colors.ink),
            SheetGlyph.chapter => Icon(LucideIcons.bookOpen, size: size * 0.6, color: colors.ink),
            SheetGlyph.mock => Icon(LucideIcons.timer, size: size * 0.6, color: colors.ink),
            _ => CustomPaint(painter: SheetGlyphPainter(glyph, colors: colors)),
          },
        ),
      );
    }
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised2,
          shape: RoundedSuperellipseBorder(borderRadius: BorderRadius.circular(size * 0.3), side: BorderSide(color: colors.line)),
        ),
        child: SizedBox.square(
          dimension: size,
          child: switch (glyph) {
            SheetGlyph.quick => Icon(LucideIcons.zap, size: size * 0.5, color: colors.ink),
            SheetGlyph.chapter => Icon(LucideIcons.bookOpen, size: size * 0.5, color: colors.ink),
            SheetGlyph.mock => Icon(LucideIcons.timer, size: size * 0.5, color: colors.ink),
            _ => CustomPaint(painter: SheetGlyphPainter(glyph, colors: colors)),
          },
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
    switch (glyph) {
      case SheetGlyph.resume:
        for (var col = 0; col < 5; col++) {
          b.paint(canvas, Offset(c.dx + (col - 2) * 6.5, c.dy), 2.6, col < 3 ? BubbleState.filled : BubbleState.hollow);
        }
      case SheetGlyph.quick || SheetGlyph.chapter || SheetGlyph.mock:
        // Drawn as icons by [SheetGlyphTile].
        break;
      case SheetGlyph.exam:
        // Three rows of the palette's chips in the exam's own colours. Identical in Night and Day on
        // purpose: it mirrors the real exam's palette (SPACING.md 8.4, the NTA look is not themed).
        const states = [
          [Color(0xFF309816), Color(0xFF309816), Color(0xFFD84500)],
          [Color(0xFF512593), Color(0xFF309816), Color(0xFFE4E4E4)],
          [Color(0xFFE4E4E4), Color(0xFFE4E4E4), Color(0xFFE4E4E4)],
        ];
        const cell = 6.0;
        const gap = 2.5;
        final origin = c.translate(-(cell * 1.5 + gap), -(cell * 1.5 + gap));
        for (var row = 0; row < 3; row++) {
          for (var col = 0; col < 3; col++) {
            final r = Rect.fromLTWH(origin.dx + col * (cell + gap), origin.dy + row * (cell + gap), cell, cell);
            final fill = states[row][col];
            canvas.drawRRect(RRect.fromRectAndRadius(r, const Radius.circular(1.5)), Paint()..color = fill);
            if (fill == const Color(0xFFE4E4E4)) {
              canvas.drawRRect(
                RRect.fromRectAndRadius(r.deflate(0.25), const Radius.circular(1.5)),
                Paint()
                  ..style = PaintingStyle.stroke
                  ..strokeWidth = 0.5
                  ..color = const Color(0xFFB3B3B3),
              );
            }
          }
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
      case SheetGlyph.ask:
        final body = RRect.fromRectAndRadius(Rect.fromCenter(center: c.translate(0, -1.5), width: 24, height: 16), const Radius.circular(6));
        final tail = Path()
          ..moveTo(c.dx - 6, c.dy + 6)
          ..lineTo(c.dx - 8, c.dy + 11)
          ..lineTo(c.dx - 1, c.dy + 6);
        final stroke = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeJoin = StrokeJoin.round
          ..color = colors.ink2;
        canvas
          ..drawRRect(body, stroke)
          ..drawPath(tail, stroke);
        for (var i = -1; i <= 1; i++) {
          b.paint(canvas, Offset(c.dx + i * 6, c.dy - 1.5), 1.8, BubbleState.filled);
        }
    }
  }

  @override
  bool shouldRepaint(SheetGlyphPainter old) => old.glyph != glyph || old.colors != colors;
}
