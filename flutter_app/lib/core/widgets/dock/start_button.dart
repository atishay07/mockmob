import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/glass_surface.dart';
import '../pressable.dart';

/// The Start half of the split dock: a 60 dp glass circle holding a volt disc and a play glyph,
/// the one-tap way into the core loop from anywhere. It morphs into the quick-start sheet.
class StartButton extends StatelessWidget {
  const StartButton({super.key, required this.onPressed, this.pressed = false});

  final VoidCallback? onPressed;

  /// Draws the pressed state without a finger (goldens).
  final bool pressed;

  static const String semanticsLabel = 'Start, opens quick start';

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      semanticsLabel: semanticsLabel,
      pressedScale: Springs.pressedScale,
      onTap: onPressed,
      builder: (context, down, _) => StartFace(pressed: pressed || down),
    );
  }
}

/// The visual of [StartButton], shared with the morph into the sheet: a glass ring holding a
/// volt disc (an inked answer bubble) with a dark play glyph, and a soft volt glow pooled below
/// it on Night. The disc is the light of the dock; the ring keeps it part of the glass.
class StartFace extends StatelessWidget {
  const StartFace({super.key, this.pressed = false});

  final bool pressed;

  static const double disc = 46;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox.square(
      dimension: MmDock.startSize,
      child: CustomPaint(
        painter: colors.isNight ? _GlowBelow(colors.voltGlow) : null,
        child: GlassSurface(
          role: GlassRole.dock,
          borderRadius: MmRadius.pillAll,
          pressed: pressed,
          // The press scale is MmPressable's alone (0.96 on the shared spring); pressed only
          // deepens the ink, like the volt key.
          child: Center(
            child: CustomPaint(
              size: const Size.square(disc),
              painter: _StartDisc(
                fill: pressed ? Color.lerp(colors.volt, colors.voltEdge, 0.16)! : colors.volt,
                glyph: colors.voltInk,
                rim: colors.voltEdge,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A 14% volt glow pooled under the button, outside its glass, never behind text.
class _GlowBelow extends CustomPainter {
  const _GlowBelow(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height * 0.78);
    final r = size.width * 0.62;
    canvas.drawCircle(
      c,
      r,
      Paint()..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  @override
  bool shouldRepaint(_GlowBelow old) => old.color != color;
}

class _StartDisc extends CustomPainter {
  const _StartDisc({required this.fill, required this.glyph, required this.rim});

  final Color fill;
  final Color glyph;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    canvas.drawCircle(c, r, Paint()..color = fill);
    // A hairline rim, a shade deeper, so the disc reads as ink pressed into the sheet.
    canvas.drawCircle(
      c,
      r - 0.5,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = rim.withValues(alpha: 0.6),
    );
    // The play glyph, optically centred (nudged right of the geometric centre), corners rounded.
    final h = r * 0.5;
    final path = Path()
      ..moveTo(c.dx - h * 0.36, c.dy - h * 0.6)
      ..lineTo(c.dx + h * 0.62, c.dy)
      ..lineTo(c.dx - h * 0.36, c.dy + h * 0.6)
      ..close();
    canvas.drawPath(path, Paint()..color = glyph);
    canvas.drawPath(
      path,
      Paint()
        ..color = glyph
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_StartDisc old) => old.fill != fill || old.glyph != glyph || old.rim != rim;
}
