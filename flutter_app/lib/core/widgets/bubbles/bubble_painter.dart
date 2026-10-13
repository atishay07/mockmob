import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';

/// The states of one answer bubble. Each has its own shape, so state is never colour alone.
enum BubbleState {
  /// An empty ring waiting for an answer.
  hollow,

  /// Inked: the answer, the done day, the right answer. Volt on Night.
  filled,

  /// A wrong answer: a coral disc with a cross.
  wrong,

  /// Left blank: a dashed ring.
  blank,

  /// Marked for review or changed: a ring with a centre dot.
  marked,

  /// A rest day: a dashed hairline with a short bar. Distinct, never a failure.
  rest,
}

/// Paints MockMob's answer bubbles. Shared by every bubble widget, the dock and the brand mark,
/// so the sheet looks the same everywhere.
class BubblePaint {
  const BubblePaint(this.colors);

  final MmColors colors;

  double _stroke(double r) => (r * 0.12).clamp(1.0, 2.0);

  Color get _wrongFill => colors.wrongMark;

  /// Draws one bubble of radius [r] at [c].
  ///
  /// [fill] (0 to 1) inks a filled or wrong bubble from [origin], a point in the bubble's own
  /// unit space (-1 to 1 on each axis; the touch point), so the ink spreads from the finger.
  /// [emphasis] draws a 2 dp ink ring around the bubble (today, the current question).
  void paint(
    Canvas canvas,
    Offset c,
    double r,
    BubbleState state, {
    double fill = 1,
    Offset origin = Offset.zero,
    bool emphasis = false,
    double dim = 1,
  }) {
    final stroke = _stroke(r);
    Color d(Color color) => dim >= 1 ? color : color.withValues(alpha: color.a * dim);

    if (emphasis) {
      canvas.drawCircle(
        c,
        r + stroke + 2.5,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = d(colors.ink),
      );
    }

    switch (state) {
      case BubbleState.hollow:
        _ring(canvas, c, r, stroke, d(colors.lineStrong));
      case BubbleState.blank:
        _dashedRing(canvas, c, r - stroke / 2, stroke, d(colors.ink4), dashes: 8);
      case BubbleState.marked:
        _ring(canvas, c, r, stroke * 1.2, d(colors.ink2));
        canvas.drawCircle(c, r * 0.36, Paint()..color = d(colors.ink2));
      case BubbleState.rest:
        _dashedRing(canvas, c, r - stroke / 2, stroke * 0.9, d(colors.ink4), dashes: 10);
        final bar = Paint()
          ..color = d(colors.ink3)
          ..strokeWidth = stroke * 1.1
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(c - Offset(r * 0.32, 0), c + Offset(r * 0.32, 0), bar);
      case BubbleState.filled:
        _inked(canvas, c, r, stroke, fill, origin, dim, wrong: false);
      case BubbleState.wrong:
        _inked(canvas, c, r, stroke, fill, origin, dim, wrong: true);
    }
  }

  void _ring(Canvas canvas, Offset c, double r, double stroke, Color color) {
    canvas.drawCircle(
      c,
      r - stroke / 2,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = color,
    );
  }

  void _dashedRing(Canvas canvas, Offset c, double r, double stroke, Color color, {required int dashes}) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    final rect = Rect.fromCircle(center: c, radius: r);
    final step = 2 * math.pi / dashes;
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(rect, i * step - math.pi / 2, step * 0.5, false, paint);
    }
  }

  void _inked(Canvas canvas, Offset c, double r, double stroke, double fill, Offset origin, double dim, {required bool wrong}) {
    final base = wrong ? _wrongFill : colors.volt;
    Color d(Color color) => dim >= 1 ? color : color.withValues(alpha: color.a * dim);
    final t = fill.clamp(0.0, 1.0);

    if (t < 1) {
      _ring(canvas, c, r, stroke, d(colors.lineStrong));
      if (t == 0) return;
    }

    canvas.save();
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: c, radius: r)));
    final from = c + Offset(origin.dx.clamp(-1.0, 1.0) * r, origin.dy.clamp(-1.0, 1.0) * r);
    final reach = r * (1 + origin.distance.clamp(0.0, 1.5));
    // Ink with a lamp highlight from the upper left and a deeper rim, like a filled pencil mark
    // catching the desk lamp.
    final shader = RadialGradient(
      center: const Alignment(-0.45, -0.5),
      radius: 1.1,
      colors: [Color.lerp(base, Colors.white, wrong ? 0.12 : 0.28)!, base, Color.lerp(base, Colors.black, 0.22)!],
      stops: const [0, 0.55, 1],
    ).createShader(Rect.fromCircle(center: c, radius: r));
    final paint = Paint()
      ..shader = shader
      ..color = Color.fromRGBO(0, 0, 0, dim.clamp(0.0, 1.0));
    canvas.drawCircle(from, reach * Curves.easeOut.transform(t), paint);
    canvas.restore();

    if (!colors.isNight && !wrong && t >= 1) {
      _ring(canvas, c, r, 1, d(colors.accentText.withValues(alpha: 0.55)));
    }

    if (wrong && t >= 1 && r >= 6) {
      final h = r * 0.34;
      final mark = Paint()
        ..color = d(colors.isNight ? colors.ground : colors.raised)
        ..strokeWidth = math.max(1.2, r * 0.16)
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(c + Offset(-h, -h), c + Offset(h, h), mark);
      canvas.drawLine(c + Offset(h, -h), c + Offset(-h, h), mark);
    }
  }
}
