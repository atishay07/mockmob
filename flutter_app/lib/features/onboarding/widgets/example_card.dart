import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';

/// The dashed-outline card of spec 5.1.4: what the next move will look like once there is a real
/// mock behind it. The dashed outline and the label both say it is an example, not the student's
/// plan, and it carries no numbers.
class ExampleCard extends StatelessWidget {
  const ExampleCard({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: CustomPaint(
        painter: _DashedBorderPainter(color: colors.lineStrong, radius: MmRadius.panel),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(header: true, child: Text(OnboardingCopy.exampleLabel, style: type.label.copyWith(color: colors.ink2))),
              const SizedBox(height: MmSpace.s8),
              Text(OnboardingCopy.exampleBody, style: type.body.copyWith(color: colors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  static const double _dash = 7;
  static const double _gap = 5;
  static const double _stroke = 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round;
    final outline = Path()
      ..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(_stroke / 2));
    for (final PathMetric metric in outline.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + _dash), paint);
        distance += _dash + _gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) => old.color != color || old.radius != radius;
}
