// A small drawn paper that shows what a way of practising is, by its shape (ui-blitz/today.md,
// the alternatives sheet): a full mock is a tall stack of pages with many lines, a quick
// practice one short page with three, one chapter a page with a single band inked, and Review a
// wrong line turning into an inked one. Drawn in code from rules and pages, not bubbles: the
// answer-bubble motif stays with the week and the evidence, where it carries state.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

enum SessionGlyphKind { fullMock, quick, chapter, review }

class SessionGlyph extends StatelessWidget {
  const SessionGlyph({super.key, required this.kind, this.height = 56});

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

  static const double _page = 44;

  @override
  void paint(Canvas canvas, Size size) {
    switch (kind) {
      case SessionGlyphKind.fullMock:
        // Two pages, the second peeking from behind: a whole paper.
        _paper(canvas, Rect.fromLTWH(10, 0, _page, size.height - 4), rules: 8, dim: true);
        _paper(canvas, Rect.fromLTWH(0, 4, _page, size.height - 4), rules: 8);
      case SessionGlyphKind.quick:
        // One short page: ten questions, not a paper.
        _paper(canvas, Rect.fromLTWH(0, size.height - 34, _page * 0.82, 34), rules: 3);
      case SessionGlyphKind.chapter:
        // A page with one band inked: only this chapter.
        final page = Rect.fromLTWH(0, 0, _page, size.height);
        _paper(canvas, page, rules: 7, band: (2, 4));
      case SessionGlyphKind.review:
        _review(canvas, size);
    }
  }

  /// A page: a faint sheet, a hairline edge and [rules] lines of text. [band] inks a run of
  /// rules (first, last) as one block; [dim] sets the page back.
  void _paper(Canvas canvas, Rect page, {required int rules, bool dim = false, (int, int)? band}) {
    final a = dim ? 0.55 : 1.0;
    final sheet = RRect.fromRectAndRadius(page, const Radius.circular(5));
    canvas.drawRRect(sheet, Paint()..color = colors.ink.withValues(alpha: 0.06 * a));
    canvas.drawRRect(
      sheet.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.lineStrong.withValues(alpha: a),
    );
    const pad = 7.0;
    final top = page.top + pad + 1;
    final gap = (page.height - pad * 2 - 2) / (rules - 1).clamp(1, 99);
    final line = Paint()
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..color = colors.ink.withValues(alpha: (band == null ? 0.42 : 0.2) * a);
    for (var i = 0; i < rules; i++) {
      if (band != null && i >= band.$1 && i <= band.$2) continue;
      final y = top + gap * i;
      final w = i == rules - 1 ? (page.width - pad * 2) * 0.55 : page.width - pad * 2;
      canvas.drawLine(Offset(page.left + pad, y), Offset(page.left + pad + w, y), line);
    }
    if (band != null) {
      final y0 = top + gap * band.$1 - 3.5, y1 = top + gap * band.$2 + 3.5;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(page.left + 4, y0, page.right - 4, y1), const Radius.circular(3)),
        Paint()..color = colors.ink.withValues(alpha: 0.82),
      );
    }
  }

  /// A wrong line, struck, then the same line inked with a tick: Review turns a miss into a mark.
  void _review(Canvas canvas, Size size) {
    const w = 96.0, line = w * 0.78;
    final y0 = size.height * 0.24, y1 = size.height * 0.76;
    final wrong = colors.wrongMark;
    final stroke = Paint()
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(0, y0), Offset(line, y0), stroke..color = wrong.withValues(alpha: 0.9));
    canvas.drawLine(
      Offset(line * 0.5, y0 - 7),
      Offset(line * 0.6, y0 + 7),
      Paint()
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = wrong,
    );
    // The way down from the wrong line to the inked one.
    final arrow = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = colors.ink3;
    canvas.drawLine(Offset(6, y0 + 7), Offset(6, y1 - 6), arrow);
    canvas.drawPath(
      Path()
        ..moveTo(2, y1 - 10)
        ..lineTo(6, y1 - 6)
        ..lineTo(10, y1 - 10),
      arrow,
    );
    canvas.drawLine(Offset(18, y1), Offset(line, y1), stroke..color = colors.ink.withValues(alpha: 0.85));
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.86, y1)
        ..lineTo(w * 0.91, y1 + 5)
        ..lineTo(w, y1 - 6),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = colors.ink,
    );
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.kind != kind || old.colors != colors;
}
