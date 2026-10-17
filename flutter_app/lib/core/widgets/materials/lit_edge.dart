import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';

/// The lit edge (signature motif): exactly one focal element per screen carries a thin volt
/// line along its top, as if the room's one light caught it. Brightest in the middle, fading
/// toward the corners. No glow: the owner banned halos (17 Oct), the line alone carries the light.
///
/// Wrap the focal card; give the same [borderRadius] as the card.
class LitEdge extends StatelessWidget {
  const LitEdge({
    super.key,
    required this.child,
    this.borderRadius = MmRadius.panelAll,
    this.width = 1.5,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final double width;

  /// Day's highlight: white light catching the top edge, brightest in the middle.
  static const Color dayHighlight = Color(0xCCFFFFFF);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final radius = borderRadius.topLeft.x;
    // Light on paper is white, not olive (v13 critique: the 2 dp olive line with its 6 dp olive
    // band read as a dirty smear across the top of every Day hero). Day draws a 1 dp hairline in
    // the line colour on the edge and a 1 dp white highlight just inside it, both fading to
    // nothing at the corners. Night keeps its single volt line.
    return colors.isNight
        ? CustomPaint(
            foregroundPainter: LitEdgePainter(color: colors.volt, radius: radius, width: width),
            child: child,
          )
        : CustomPaint(
            foregroundPainter: LitEdgePainter(color: colors.line, radius: radius, width: 1),
            child: CustomPaint(
              foregroundPainter: LitEdgePainter(color: dayHighlight, radius: radius, width: 1, inset: 1),
              child: child,
            ),
          );
  }
}

class LitEdgePainter extends CustomPainter {
  const LitEdgePainter({required this.color, required this.radius, this.width = 1.5, this.wrap = 0.9, this.inset = 0});

  final Color color;
  final double radius;
  final double width;

  /// How far down the corner arcs the light wraps, as a fraction of the radius.
  final double wrap;

  /// How far inside the edge the line runs, in dp (Day's highlight sits 1 dp inside the hairline).
  final double inset;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final r = radius.clamp(0.0, size.shortestSide / 2);
    final inset = width / 2 + this.inset;
    final w = wrap.clamp(0.0, 1.0);
    // The straight top edge plus the upper part of both corner arcs, so the light follows the
    // shape and wraps the shoulders by [wrap] of a quarter turn.
    final path = Path();
    if (r <= inset) {
      path
        ..moveTo(inset, inset)
        ..lineTo(size.width - inset, inset);
    } else {
      final left = Rect.fromCircle(center: Offset(r, r), radius: r - inset);
      final right = Rect.fromCircle(center: Offset(size.width - r, r), radius: r - inset);
      const quarter = math.pi / 2;
      path
        ..arcTo(left, math.pi + quarter * (1 - w), quarter * w, true)
        ..lineTo(size.width - r, inset)
        ..arcTo(right, -quarter, quarter * w, false);
    }
    final shader = LinearGradient(
      colors: [color.withValues(alpha: 0), color.withValues(alpha: 0.95), color, color.withValues(alpha: 0.95), color.withValues(alpha: 0)],
      stops: const [0, 0.18, 0.5, 0.82, 1],
    ).createShader(Rect.fromLTWH(0, 0, size.width, r + width));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round
        ..shader = shader,
    );
  }

  @override
  bool shouldRepaint(LitEdgePainter old) =>
      old.color != color || old.radius != radius || old.width != width || old.wrap != wrap || old.inset != inset;
}
