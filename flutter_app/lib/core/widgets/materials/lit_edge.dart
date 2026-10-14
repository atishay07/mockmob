import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';

/// The lit edge (signature motif): exactly one focal element per screen carries a thin volt
/// line along its top, as if the room's one light caught it. Brightest in the middle, fading
/// toward the corners. Optionally a soft 14% volt glow sits beneath the element (never behind
/// text: the element itself is opaque or glass over it).
///
/// Wrap the focal card; give the same [borderRadius] as the card.
class LitEdge extends StatelessWidget {
  const LitEdge({
    super.key,
    required this.child,
    this.borderRadius = MmRadius.panelAll,
    this.glow = false,
    this.width = 1.5,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final bool glow;
  final double width;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget lit = CustomPaint(
      foregroundPainter: LitEdgePainter(
        color: colors.isNight ? colors.volt : colors.accentText,
        radius: borderRadius.topLeft.x,
        width: width,
      ),
      child: child,
    );
    if (glow) {
      lit = CustomPaint(painter: _GlowPainter(color: colors.voltGlow, borderRadius: borderRadius), child: lit);
    }
    return lit;
  }
}

/// The soft volt glow beneath a lit element, painted only outside the element's shape so it
/// never shows through glass and never sits behind text.
class _GlowPainter extends CustomPainter {
  const _GlowPainter({required this.color, required this.borderRadius});

  final Color color;
  final BorderRadius borderRadius;

  @override
  void paint(Canvas canvas, Size size) {
    final shape = borderRadius.toRRect(Offset.zero & size);
    canvas.save();
    canvas.clipPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect((Offset.zero & size).inflate(64))
        ..addRRect(shape),
    );
    canvas.drawRRect(
      borderRadius.toRRect(Rect.fromLTWH(10, 10, size.width - 20, size.height - 4)),
      Paint()
        ..color = color
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.color != color || old.borderRadius != borderRadius;
}

class LitEdgePainter extends CustomPainter {
  const LitEdgePainter({required this.color, required this.radius, this.width = 1.5, this.wrap = 0.9});

  final Color color;
  final double radius;
  final double width;

  /// How far down the corner arcs the light wraps, as a fraction of the radius.
  final double wrap;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final r = radius.clamp(0.0, size.shortestSide / 2);
    final inset = width / 2;
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
      old.color != color || old.radius != radius || old.width != width || old.wrap != wrap;
}
