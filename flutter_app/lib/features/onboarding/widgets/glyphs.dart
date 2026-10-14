import 'dart:math' as math;

import 'package:flutter/material.dart';

/// "I knew it and still got it wrong": an answer bubble, inked, with a stroke through it. Drawn
/// in code to the stroke weight of the icon set beside it.
class TrapGlyph extends StatelessWidget {
  const TrapGlyph({super.key, required this.color, required this.mark, this.size = 22});

  final Color color;

  /// The ink in the bubble.
  final Color mark;
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _TrapPainter(color: color, mark: mark));
}

class _TrapPainter extends CustomPainter {
  const _TrapPainter({required this.color, required this.mark});

  final Color color;
  final Color mark;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final c = size.center(Offset.zero);
    final r = s * 0.36;
    canvas.drawCircle(c, r * 0.72, Paint()..color = mark);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.085
        ..color = color,
    );
    final d = s * 0.42;
    canvas.drawLine(
      c + Offset(-d, d),
      c + Offset(d, -d),
      Paint()
        ..strokeWidth = s * 0.095
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_TrapPainter old) => old.color != color || old.mark != mark;
}

/// The skyline of a course's colleges: its top closing scores as bars, highest first, each as
/// tall as its score between 800 and 1000 on a hairline floor. A steep, crowded course and a
/// short one read differently at a glance. Real CSAS 2026 figures only; the top bar takes
/// [accent].
class LadderGlyph extends StatelessWidget {
  const LadderGlyph({super.key, required this.scores, required this.color, this.accent, this.height = 30, this.rungs = 8});

  final List<double> scores;
  final Color color;
  final Color? accent;
  final double height;
  final int rungs;

  static const double _bar = 7;
  static const double _gap = 3;

  @override
  Widget build(BuildContext context) {
    final shown = scores.take(rungs).toList();
    return ExcludeSemantics(
      child: CustomPaint(
        size: Size(rungs * _bar + (rungs - 1) * _gap, height + 2),
        painter: _LadderPainter(scores: shown, color: color, accent: accent, rungs: rungs),
      ),
    );
  }
}

class _LadderPainter extends CustomPainter {
  const _LadderPainter({required this.scores, required this.color, required this.accent, required this.rungs});

  final List<double> scores;
  final Color color;
  final Color? accent;
  final int rungs;

  @override
  void paint(Canvas canvas, Size size) {
    final floor = size.height - 1;
    final paint = Paint();
    canvas.drawLine(Offset(0, floor + 0.5), Offset(size.width, floor + 0.5), paint..color = color.withValues(alpha: 0.4));
    for (var i = 0; i < rungs; i++) {
      final x = i * (LadderGlyph._bar + LadderGlyph._gap);
      if (i >= scores.length) {
        // No college here: a dot on the floor, so a short skyline reads as short.
        canvas.drawCircle(Offset(x + LadderGlyph._bar / 2, floor - 2), 1.2, paint..color = color.withValues(alpha: 0.45));
        continue;
      }
      final f = ((scores[i] - 800) / 200).clamp(0.08, 1.0);
      final h = (floor - 1) * f;
      paint.color = i == 0 && accent != null ? accent! : color.withValues(alpha: math.max(0.5, 1 - i * 0.07));
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, floor - h, LadderGlyph._bar, h),
          topLeft: const Radius.circular(2),
          topRight: const Radius.circular(2),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_LadderPainter old) =>
      old.color != color || old.accent != accent || old.rungs != rungs || !_same(old.scores, scores);

  static bool _same(List<double> a, List<double> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

/// The timing marks printed down the edge of an OMR sheet: short ink bars the scanner reads.
/// Here they make the student's sheet read as an answer sheet at a glance.
class TimingMarks extends StatelessWidget {
  const TimingMarks({super.key, required this.color, this.pitch = 12, this.width = 6, this.mark = 3});

  final Color color;

  /// Distance between marks, as on a printed sheet: one every [pitch] dp, evenly filling the
  /// height it is given.
  final double pitch;
  final double width;
  final double mark;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: CustomPaint(
          size: Size(width, double.infinity),
          painter: _TimingPainter(color: color, pitch: pitch, mark: mark),
        ),
      );
}

class _TimingPainter extends CustomPainter {
  const _TimingPainter({required this.color, required this.pitch, required this.mark});

  final Color color;
  final double pitch;
  final double mark;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.height < 24) return;
    final count = ((size.height - mark) / pitch).floor() + 1;
    if (count < 2) return;
    final paint = Paint()..color = color;
    final step = (size.height - mark) / (count - 1);
    for (var i = 0; i < count; i++) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(0, i * step, size.width, mark), Radius.circular(mark / 2)),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_TimingPainter old) => old.color != color || old.pitch != pitch || old.mark != mark;
}
