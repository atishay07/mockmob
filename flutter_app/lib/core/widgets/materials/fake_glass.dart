import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'edge_light.dart';
import 'grain.dart';
import 'shape.dart';

/// Smoked glass without a live blur (brief section 5): for cards over our own art and light,
/// where we know the pixels. A translucent warm tint, the edge light and a static grain tile.
/// Pass [backdrop] (a pre-blurred slice of the art, already positioned) to show it through the
/// tint. Cheap enough for scrolling content: no saveLayer, no backdrop read.
class FakeGlass extends StatelessWidget {
  const FakeGlass({
    super.key,
    required this.child,
    this.borderRadius = MmRadius.panelAll,
    this.backdrop,
    this.pressed = false,
    this.grain = true,
    this.opacity,
  });

  final Widget child;
  final BorderRadius borderRadius;

  /// Shown under the tint, clipped to the shape.
  final Widget? backdrop;
  final bool pressed;
  final bool grain;

  /// Tint opacity override (default 0.56 Night, 0.7 Daylight; 0.88 / 0.92 without a backdrop is
  /// not needed because the ground under a card is already opaque).
  final double? opacity;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final tintAlpha = opacity ?? (colors.isNight ? 0.56 : 0.7);
    final tint = (colors.isNight ? colors.raised2 : colors.raised).withValues(alpha: tintAlpha);

    final face = CustomPaint(
      painter: _TintPainter(tint: tint, radius: borderRadius),
      foregroundPainter: EdgeLightPainter(
        borderRadius: borderRadius,
        top: colors.edgeTop,
        bottom: colors.edgeBottom,
        lamp: colors.isNight ? colors.lamp : null,
        boost: pressed ? MmElevation.pressedEdgeBoost : 1,
      ),
      child: child,
    );

    return MmClip(
      borderRadius: borderRadius,
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          if (backdrop != null) Positioned.fill(child: backdrop!),
          if (grain) Positioned.fill(child: Grain(opacity: colors.grain * 0.8)),
          face,
        ],
      ),
    );
  }
}

class _TintPainter extends CustomPainter {
  const _TintPainter({required this.tint, required this.radius});

  final Color tint;
  final BorderRadius radius;

  @override
  void paint(Canvas canvas, Size size) => drawMmShape(canvas, radius, Offset.zero & size, Paint()..color = tint);

  @override
  bool shouldRepaint(_TintPainter old) => old.tint != tint || old.radius != radius;
}
