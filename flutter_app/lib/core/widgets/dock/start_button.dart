import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/glass_surface.dart';
import '../pressable.dart';

/// The Start half of the split dock: a 60 dp glass circle holding a volt ring and a play glyph,
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

/// The visual of [StartButton], shared with the morph into the sheet.
class StartFace extends StatelessWidget {
  const StartFace({super.key, this.pressed = false});

  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final light = colors.isNight ? colors.volt : colors.accentText;
    return SizedBox.square(
      dimension: MmDock.startSize,
      child: GlassSurface(
        role: GlassRole.dock,
        borderRadius: MmRadius.pillAll,
        pressed: pressed,
        child: Center(
          child: CustomPaint(
            size: const Size.square(40),
            painter: _StartGlyph(light: light, glow: colors.isNight ? colors.voltGlow : Colors.transparent, pressed: pressed),
          ),
        ),
      ),
    );
  }
}

class _StartGlyph extends CustomPainter {
  const _StartGlyph({required this.light, required this.glow, required this.pressed});

  final Color light;
  final Color glow;
  final bool pressed;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    // A soft inner glow so the ring reads as light, not a stroke.
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          colors: [glow.withValues(alpha: glow.a * (pressed ? 1.6 : 1)), glow.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    canvas.drawCircle(
      c,
      r - 1.5,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = light,
    );
    // The play glyph, optically centred (nudged right of the geometric centre).
    final h = r * 0.62;
    final path = Path()
      ..moveTo(c.dx - h * 0.38, c.dy - h * 0.55)
      ..lineTo(c.dx + h * 0.58, c.dy)
      ..lineTo(c.dx - h * 0.38, c.dy + h * 0.55)
      ..close();
    canvas.drawPath(
      path,
      Paint()
        ..color = light
        ..style = PaintingStyle.fill
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = light
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_StartGlyph old) => old.light != light || old.glow != glow || old.pressed != pressed;
}
