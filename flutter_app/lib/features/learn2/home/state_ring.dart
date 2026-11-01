import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// The ring beside a chapter's state word (the web's StateRing): the word says the state first, the shape is the second,
/// non-colour cue. [shape] is `HomeModel.stateShape`: none (dashed), thin (empty), weak (a quarter), mid (half), strong
/// (full), unknown (a bar through it). Drawn in [color]; 14 dp, from a 16-unit drawing.
class LearnStateRing extends StatelessWidget {
  const LearnStateRing({super.key, required this.shape, required this.color, this.size = 14});

  final String shape;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: SizedBox.square(dimension: size, child: CustomPaint(painter: _RingPainter(shape, color))),
      );
}

class _RingPainter extends CustomPainter {
  const _RingPainter(this.shape, this.color);

  final String shape;
  final Color color;

  static const double _c = 8;
  static const double _r = 6.25;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 16);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = color
      ..isAntiAlias = true;
    final fill = Paint()
      ..style = PaintingStyle.fill
      ..color = color
      ..isAntiAlias = true;
    const centre = Offset(_c, _c);
    final circle = Path()..addOval(Rect.fromCircle(center: centre, radius: _r));
    if (shape == 'none') {
      // A dashed ring: 2.2 on, 2.2 off, round to the whole circle by the path's own length.
      for (final metric in circle.computeMetrics()) {
        for (var d = 0.0; d < metric.length; d += 4.4) {
          canvas.drawPath(metric.extractPath(d, math.min(d + 2.2, metric.length)), stroke);
        }
      }
    } else {
      canvas.drawPath(circle, stroke);
    }
    final share = switch (shape) {
      'thin' => 0.0,
      'weak' => 0.25,
      'mid' => 0.5,
      'strong' => 1.0,
      _ => 0.0,
    };
    if (share >= 1) {
      canvas.drawCircle(centre, _r, fill);
    } else if (share > 0) {
      final pie = Path()
        ..moveTo(_c, _c)
        ..lineTo(_c, _c - _r)
        ..arcTo(Rect.fromCircle(center: centre, radius: _r), -math.pi / 2, share * 2 * math.pi, false)
        ..close();
      canvas.drawPath(pie, fill);
    }
    if (shape == 'unknown') {
      canvas.drawLine(
        const Offset(_c - 2.6, _c),
        const Offset(_c + 2.6, _c),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.shape != shape || old.color != color;
}
