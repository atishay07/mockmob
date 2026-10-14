import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import 'paper.dart';

/// One soft band of warm lamp light crossing the open sheet, once (brief section 7: 700 ms).
/// Clipped to the paper; drawn as a single gradient rect, no layers.
class LightSweep extends StatelessWidget {
  const LightSweep({super.key, required this.progress});

  /// 0 before, 1 after; the band is only visible in between.
  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: const PaperClipper(),
      child: CustomPaint(painter: _SweepPainter(progress), child: const SizedBox.expand()),
    );
  }
}

class _SweepPainter extends CustomPainter {
  _SweepPainter(this.progress) : super(repaint: progress);

  final Animation<double> progress;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.sweepCurve.transform(progress.value.clamp(0.0, 1.0));
    if (t <= 0 || t >= 1) return;
    // The band travels from beyond the upper left to beyond the lower right, along the lamp's
    // direction, and is brightest mid-way.
    final span = size.width + size.height;
    final center = -span * 0.35 + span * 1.35 * t;
    final strength = 0.16 * (1 - (2 * t - 1).abs());
    final rect = Rect.fromLTWH(center - 90, 0, 180, size.height);
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-0.5);
    canvas.translate(-size.width / 2, -size.height / 2);
    canvas.drawRect(
      Rect.fromLTWH(rect.left, -size.height, rect.width, size.height * 3),
      Paint()
        ..shader = LinearGradient(
          colors: [
            const Color(0x00FFF1D6),
            Color.fromRGBO(255, 241, 214, strength),
            Color.fromRGBO(255, 248, 232, strength * 1.4),
            Color.fromRGBO(255, 241, 214, strength),
            const Color(0x00FFF1D6),
          ],
          stops: const [0, 0.35, 0.5, 0.65, 1],
        ).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.progress != progress;
}
