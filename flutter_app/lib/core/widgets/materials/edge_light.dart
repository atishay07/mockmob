import 'package:flutter/material.dart';

bool _isPill(BorderRadius r, Rect rect) => r.topLeft.x >= rect.shortestSide / 2 - 0.5;

/// Draws a rounded shape: continuous (superellipse) corners for panels, a true stadium for
/// pills (a superellipse with a full radius would pinch).
void drawMmShape(Canvas canvas, BorderRadius radius, Rect rect, Paint paint) {
  if (_isPill(radius, rect)) {
    canvas.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(rect.shortestSide / 2)), paint);
  } else {
    canvas.drawRSuperellipse(radius.toRSuperellipse(rect), paint);
  }
}

/// Clips to the same shape as [drawMmShape].
void clipMmShape(Canvas canvas, BorderRadius radius, Rect rect) {
  if (_isPill(radius, rect)) {
    canvas.clipRRect(RRect.fromRectAndRadius(rect, Radius.circular(rect.shortestSide / 2)));
  } else {
    canvas.clipRSuperellipse(radius.toRSuperellipse(rect));
  }
}

/// The light that lands on a pane of glass in a lamp-lit room: a 1 dp stroke that is bright
/// along the top and fades down the sides, a whisper of sheen pooled under the top edge, and on
/// Night (glass only) a warm lamp catch along the left half of the straight top edge.
///
/// Static and cheap: two strokes and two gradients, no layers.
class EdgeLightPainter extends CustomPainter {
  const EdgeLightPainter({
    required this.borderRadius,
    required this.top,
    required this.bottom,
    this.lamp,
    this.boost = 1,
    this.sheen = true,
  });

  final BorderRadius borderRadius;
  final Color top;
  final Color bottom;

  /// The warm catch along the top edge from the left. Null on Daylight, where the paper is warm.
  final Color? lamp;

  /// Brightens the light while pressed.
  final double boost;
  final bool sheen;

  Color _scale(Color c) => c.withValues(alpha: (c.a * boost).clamp(0.0, 1.0));

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;

    drawMmShape(
      canvas,
      borderRadius,
      rect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_scale(top), _scale(Color.lerp(top, bottom, 0.7)!), _scale(bottom)],
          stops: const [0, 0.35, 1],
        ).createShader(rect),
    );

    final lampColor = lamp;
    if (lampColor != null) {
      // The lamp sits up and to the left: its warmth runs along the straight top edge from the
      // left and is gone before the middle. Never on the corner arc, where it read as a glitch.
      final r = borderRadius.topLeft.x.clamp(0.0, size.width / 2);
      final from = Offset(r, 0.5);
      final to = Offset(size.width * 0.45, 0.5);
      if (to.dx > from.dx) {
        canvas.drawLine(
          from,
          to,
          Paint()
            ..strokeWidth = 1
            ..shader = LinearGradient(
              colors: [lampColor.withValues(alpha: 0.3 * boost.clamp(0, 1.4)), lampColor.withValues(alpha: 0)],
            ).createShader(Rect.fromPoints(Offset.zero, Offset(size.width * 0.45, 1))),
        );
      }
    }

    if (sheen) {
      final h = (size.height * 0.45).clamp(0.0, 64.0);
      final sheenRect = Rect.fromLTWH(0, 0, size.width, h);
      canvas.save();
      clipMmShape(canvas, borderRadius, rect);
      canvas.drawRect(
        sheenRect,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_scale(top.withValues(alpha: top.a * 0.28)), top.withValues(alpha: 0)],
          ).createShader(sheenRect),
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(EdgeLightPainter old) =>
      old.borderRadius != borderRadius ||
      old.top != top ||
      old.bottom != bottom ||
      old.lamp != lamp ||
      old.boost != boost ||
      old.sheen != sheen;
}
