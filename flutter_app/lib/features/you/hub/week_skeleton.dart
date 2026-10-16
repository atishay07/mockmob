import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'sheet_fields.dart' show WeekField;

/// What "This week" shows while the rhythm loads: the ring as an open four-segment arc, the
/// caption and headline lines beside it, a hairline and the seven weekday columns, all at the
/// heights of the loaded field, so nothing jumps when the data lands. One soft light crosses it.
class WeekSkeleton extends StatelessWidget {
  const WeekSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SkeletonGroup(
      label: 'Loading this week',
      shimmer: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // The "This week" line, then the ring with its headline and caption beside it.
          const Skeleton.line(width: 72, height: 14),
          const SizedBox(height: MmSpace.s12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Skeleton(width: WeekField.dialSize, height: WeekField.dialSize, shape: const ArcRingBorder(segments: 4, thickness: 0.085)),
              const SizedBox(width: MmSpace.s16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Skeleton.line(height: 20),
                    SizedBox(height: MmSpace.s8),
                    Skeleton.line(width: 96, height: 12),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          SizedBox(height: 1, child: ColoredBox(color: colors.line)),
          const SizedBox(height: MmSpace.s12),
          // The weekday strip: letter, then the 34 dp box of the bubble, 8 dp above and below.
          Row(
            children: [
              for (var i = 0; i < 7; i++)
                const Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: MmSpace.s8),
                    child: Column(
                      children: [
                        SizedBox(height: 16, child: Center(child: Skeleton.line(width: 8, height: 10))),
                        SizedBox(height: MmSpace.s6),
                        SizedBox(height: 34, child: Center(child: Skeleton.circle(size: 22))),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// An open ring: [segments] arcs of the same thickness as the week dial, with a gap between
/// them. Used as the shape of a [Skeleton] so the placeholder is the ring's silhouette, not a disc.
class ArcRingBorder extends ShapeBorder {
  const ArcRingBorder({required this.segments, required this.thickness});

  final int segments;

  /// Stroke as a fraction of the diameter (the dial uses 0.085).
  final double thickness;

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => getOuterPath(rect, textDirection: textDirection);

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) {
    final c = rect.center;
    final stroke = rect.width * thickness;
    // The dial draws its stroke centred 3 dp inside the box, so the outer edge sits 3 dp in.
    final outer = rect.width / 2 - 3;
    final inner = outer - stroke;
    final gap = (stroke * 1.25 / (outer - stroke / 2)).clamp(0.05, 0.32);
    final sweep = (2 * math.pi - gap * segments) / segments;
    final start0 = -math.pi / 2 + gap / 2;
    final path = Path();
    for (var i = 0; i < segments; i++) {
      final a0 = start0 + i * (sweep + gap);
      path
        ..arcTo(Rect.fromCircle(center: c, radius: outer), a0, sweep, true)
        ..arcTo(Rect.fromCircle(center: c, radius: inner), a0 + sweep, -sweep, false)
        ..close();
    }
    return path;
  }

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {}

  @override
  ShapeBorder scale(double t) => this;
}
