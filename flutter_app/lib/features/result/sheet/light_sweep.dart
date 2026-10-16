import 'package:flutter/material.dart';

import '../../../core/motion/mm_light.dart';
import '../../../core/motion/motion.dart';
import 'paper.dart';

/// One soft band of light crossing the open sheet, once (brief section 7: 700 ms on the sweep
/// curve). Its colour is [MmLight.sweepColor]: lamp-white at 30% on Night, volt at 14% on Day, so
/// the band reads on paper too (APP-PASS AP2-05, M10; MOTION.md 1.4; owner Night/Day parity, L36).
/// Clipped to the paper; drawn as a single gradient rect, no layers.
class LightSweep extends StatelessWidget {
  const LightSweep({super.key, required this.progress});

  /// 0 before, 1 after; the band is only visible in between.
  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: const PaperClipper(),
      child: CustomPaint(painter: _SweepPainter(progress, MmLight.sweepColor(context)), child: const SizedBox.expand()),
    );
  }
}

class _SweepPainter extends CustomPainter {
  _SweepPainter(this.progress, this.color) : super(repaint: progress);

  final Animation<double> progress;

  /// The band's colour at its brightest (its alpha is the peak).
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.sweepCurve.transform(progress.value.clamp(0.0, 1.0));
    if (t <= 0 || t >= 1) return;
    // The band travels from beyond the upper left to beyond the lower right, along the lamp's
    // direction, and is brightest mid-way.
    final span = size.width + size.height;
    final center = -span * 0.35 + span * 1.35 * t;
    final peak = color.a * (1 - (2 * t - 1).abs());
    Color at(double share) => color.withValues(alpha: peak * share);
    final rect = Rect.fromLTWH(center - 90, 0, 180, size.height);
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-0.5);
    canvas.translate(-size.width / 2, -size.height / 2);
    canvas.drawRect(
      Rect.fromLTWH(rect.left, -size.height, rect.width, size.height * 3),
      Paint()
        ..shader = LinearGradient(
          colors: [at(0), at(0.7), at(1), at(0.7), at(0)],
          stops: const [0, 0.35, 0.5, 0.65, 1],
        ).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.progress != progress || old.color != color;
}
