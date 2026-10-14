// A small drawn answer sheet that shows what a way of practising is, by its shape
// (ui-blitz/today.md, the alternatives sheet): a full mock is a 10 by 5 sheet of bubbles, a
// quick practice two rows of five, one chapter a sheet with only its own row lit, and Review a
// wrong mark turning into an inked one. Code-drawn with the shared bubble painter, so it is the
// same sheet as everywhere else; every bubble is a question, never decoration.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

enum SessionGlyphKind { fullMock, quick, chapter, review }

class SessionGlyph extends StatelessWidget {
  const SessionGlyph({super.key, required this.kind, this.height = 34});

  final SessionGlyphKind kind;
  final double height;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: RepaintBoundary(
          child: CustomPaint(size: Size(height * 2.2, height), painter: _GlyphPainter(kind: kind, colors: context.mmColors)),
        ),
      );
}

class _GlyphPainter extends CustomPainter {
  const _GlyphPainter({required this.kind, required this.colors});

  final SessionGlyphKind kind;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final b = BubblePaint(colors);
    void grid(int cols, int rows, {int? litRow, double dimOthers = 1}) {
      final cell = (size.height / rows).clamp(0.0, size.width / cols);
      final r = cell * 0.36;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          final c = Offset(cell * (x + 0.5), cell * (y + 0.5) + (size.height - cell * rows) / 2);
          final lit = litRow == null || litRow == y;
          b.paint(canvas, c, r, BubbleState.hollow, dim: lit ? 1 : dimOthers);
        }
      }
    }

    switch (kind) {
      case SessionGlyphKind.fullMock:
        grid(10, 5);
      case SessionGlyphKind.quick:
        grid(5, 2);
      case SessionGlyphKind.chapter:
        grid(5, 3, litRow: 1, dimOthers: 0.3);
        // The chapter's row, underlined.
        final cell = size.height / 3;
        canvas.drawLine(
          Offset(cell * 0.15, cell * 2 + 1),
          Offset(cell * 4.85, cell * 2 + 1),
          Paint()
            ..color = colors.ink.withValues(alpha: 0.7)
            ..strokeWidth = 1.5
            ..strokeCap = StrokeCap.round,
        );
      case SessionGlyphKind.review:
        final r = size.height * 0.26;
        final y = size.height / 2;
        final a = Offset(r + 1, y), c = Offset(r * 5 + 1, y);
        b.paint(canvas, a, r, BubbleState.wrong);
        canvas.drawLine(
          Offset(a.dx + r + 4, y),
          Offset(c.dx - r - 4, y),
          Paint()
            ..color = colors.ink3
            ..strokeWidth = 1.5
            ..strokeCap = StrokeCap.round,
        );
        b.paint(canvas, c, r, BubbleState.filled);
    }
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.kind != kind || old.colors != colors;
}
