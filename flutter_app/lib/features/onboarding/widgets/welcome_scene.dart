import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The welcome room, drawn in code: a desk lamp in the top corner that clicks on as the room
/// opens (a catch of the filament, then full light in 360 ms) and pours a cone of warm light onto
/// a desk. Mobi stands on the desk, large, and is the picture (placed by the welcome screen);
/// nothing else is on it, so the screen has one thing to look at and one key. Nothing here is a
/// picture, so it is sharp at any size, follows the theme, and costs one paint.
class WelcomeScene extends StatefulWidget {
  const WelcomeScene({super.key, required this.deskAt, this.animate = true});

  /// Where the desk's front edge sits, as a fraction of the scene's height.
  final double deskAt;
  final bool animate;

  @override
  State<WelcomeScene> createState() => _WelcomeSceneState();
}

class _WelcomeSceneState extends State<WelcomeScene> with SingleTickerProviderStateMixin {
  /// The scene's one clock: the lamp comes on over its first 360 ms.
  late final AnimationController _ink = AnimationController(vsync: this, duration: WelcomeScenePainter.length);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_ink.isAnimating || _ink.value > 0) return;
    if (!widget.animate || Motion.reduced(context)) {
      _ink.value = 1;
    } else {
      _ink.forward();
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = ScenePalette.of(context.mmColors);
    return RepaintBoundary(
      child: CustomPaint(
        painter: WelcomeScenePainter(palette: palette, clock: _ink, deskAt: widget.deskAt),
        child: const SizedBox.expand(),
      ),
    );
  }
}

/// The scene's colours, from the theme: lamp amber stays environment light, volt only on the
/// inked bubbles.
@immutable
class ScenePalette {
  const ScenePalette({
    required this.ground,
    required this.lamp,
    required this.desk,
    required this.shade,
    required this.paper,
    required this.ring,
    required this.ink,
    required this.night,
  });

  /// Scene art, so its own pigments (SPACING.md 8.4: each raw colour names its Day twin):
  /// desk walnut #7A5634 blended into the ground (30% Night, 20% Day); lamp shade #26221C Night,
  /// #3B352C Day; paper #E6DDC9 Night (lamp-warm, never white on charcoal), #FFFCF4 Day; ring
  /// binding #8E8676 in both (a mid grey that reads on either ground).
  factory ScenePalette.of(MmColors c) => ScenePalette(
        ground: c.ground,
        lamp: c.lamp,
        desk: Color.lerp(c.ground, const Color(0xFF7A5634), c.isNight ? 0.30 : 0.20)!,
        shade: c.isNight ? const Color(0xFF26221C) : const Color(0xFF3B352C),
        paper: c.isNight ? const Color(0xFFE6DDC9) : const Color(0xFFFFFCF4),
        ring: const Color(0xFF8E8676),
        ink: c.volt,
        night: c.isNight,
      );

  final Color ground;
  final Color lamp;
  final Color desk;
  final Color shade;
  final Color paper;
  final Color ring;
  final Color ink;
  final bool night;

  @override
  bool operator ==(Object other) =>
      other is ScenePalette && other.ground == ground && other.desk == desk && other.paper == paper && other.night == night;

  @override
  int get hashCode => Object.hash(ground, desk, paper, night);
}

class WelcomeScenePainter extends CustomPainter {
  WelcomeScenePainter({required this.palette, required this.clock, required this.deskAt}) : super(repaint: clock);

  final ScenePalette palette;

  /// 0 to 1 over [length]; at 1 (reduced motion, goldens) the room is lit.
  final Animation<double> clock;
  final double deskAt;

  static const Duration length = Duration(milliseconds: 2000);

  /// The lamp's first 360 ms of the clock.
  static const double _lampOn = 0.18;

  /// How lit the lamp is at clock [t]: the filament catches (to 0.6 in 54 ms), dips once, then
  /// the light rises to full on the emphasized curve. Never more than one flicker.
  static double lampAt(double t) {
    if (t >= _lampOn) return 1;
    final x = (t / _lampOn).clamp(0.0, 1.0);
    if (x < 0.15) return 0.6 * (x / 0.15);
    if (x < 0.3) return 0.6 - 0.3 * ((x - 0.15) / 0.15);
    return 0.3 + 0.7 * Motion.emphasized.transform((x - 0.3) / 0.7);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final w = size.width, h = size.height;
    final deskY = h * deskAt;
    final p = palette;
    final glow = (p.night ? 1.0 : 0.7) * lampAt(clock.value);

    // The wall, lit from the lamp's corner.
    final bulb = Offset(w * 0.80, h * 0.17);
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = RadialGradient(
          colors: [p.lamp.withValues(alpha: 0.24 * glow), p.lamp.withValues(alpha: 0.07 * glow), p.lamp.withValues(alpha: 0)],
          stops: const [0, 0.45, 1],
        ).createShader(Rect.fromCircle(center: bulb, radius: w * 1.05)),
    );

    // The cone of light from the shade down to the desk.
    final coneTop = bulb.dy + h * 0.005;
    final cone = Path()
      ..moveTo(bulb.dx - w * 0.13, coneTop)
      ..lineTo(bulb.dx + w * 0.13, coneTop)
      ..lineTo(w * 1.2, deskY)
      ..lineTo(w * 0.12, deskY)
      ..close();
    canvas.drawPath(
      cone,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [p.lamp.withValues(alpha: 0.16 * glow), p.lamp.withValues(alpha: 0.04 * glow)],
        ).createShader(Rect.fromLTRB(0, coneTop, w, deskY)),
    );

    _lamp(canvas, w, h, bulb, glow);
    _desk(canvas, size, deskY, glow);
  }

  void _lamp(Canvas canvas, double w, double h, Offset bulb, double glow) {
    final lit = glow / (palette.night ? 1.0 : 0.7);
    final p = palette;
    // The arm, coming in from off the top edge.
    canvas.drawPath(
      Path()
        ..moveTo(w * 1.04, -h * 0.02)
        ..quadraticBezierTo(w * 0.94, h * 0.01, bulb.dx + w * 0.02, bulb.dy - h * 0.11),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round
        ..color = p.shade,
    );
    final top = bulb.dy - h * 0.115;
    final shade = Path()
      ..moveTo(bulb.dx - w * 0.045, top)
      ..quadraticBezierTo(bulb.dx, top - h * 0.012, bulb.dx + w * 0.045, top)
      ..lineTo(bulb.dx + w * 0.15, bulb.dy - h * 0.004)
      ..quadraticBezierTo(bulb.dx, bulb.dy + h * 0.016, bulb.dx - w * 0.15, bulb.dy - h * 0.004)
      ..close();
    canvas.drawPath(
      shade,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [Color.lerp(p.shade, p.lamp, 0.10)!, p.shade, Color.lerp(p.shade, Colors.black, 0.3)!],
          stops: const [0, 0.45, 1],
        ).createShader(shade.getBounds()),
    );
    // The lit rim and the bulb under it.
    canvas.drawPath(
      Path()
        ..moveTo(bulb.dx - w * 0.15, bulb.dy - h * 0.004)
        ..quadraticBezierTo(bulb.dx, bulb.dy + h * 0.016, bulb.dx + w * 0.15, bulb.dy - h * 0.004),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = p.lamp.withValues(alpha: 0.8 * lit),
    );
    final bulbRect = Rect.fromCenter(center: bulb.translate(0, h * 0.002), width: w * 0.2, height: h * 0.02);
    if (lit <= 0) return;
    canvas.drawOval(
      bulbRect,
      Paint()
        ..shader = RadialGradient(
          colors: [const Color(0xFFFFF4DA).withValues(alpha: lit), p.lamp.withValues(alpha: lit), p.lamp.withValues(alpha: 0)],
          stops: const [0, 0.45, 1],
        ).createShader(bulbRect),
    );
  }

  void _desk(Canvas canvas, Size size, double deskY, double glow) {
    final p = palette;
    final w = size.width, h = size.height;
    final top = Rect.fromLTRB(0, deskY, w, h);
    canvas.drawRect(
      top,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [p.desk, Color.lerp(p.desk, p.ground, 0.55)!, p.ground],
          stops: const [0, 0.55, 1],
        ).createShader(top),
    );
    // The pool of lamp light on the desk.
    final pool = Rect.fromCenter(center: Offset(w * 0.62, deskY + h * 0.05), width: w * 1.1, height: h * 0.2);
    canvas.drawOval(
      pool,
      Paint()
        ..shader = RadialGradient(colors: [p.lamp.withValues(alpha: 0.26 * glow), p.lamp.withValues(alpha: 0)]).createShader(pool),
    );
    // The desk's back edge catching the light.
    canvas.drawRect(
      Rect.fromLTWH(0, deskY - 0.75, w, 1.5),
      Paint()
        ..shader = LinearGradient(colors: [
          p.lamp.withValues(alpha: 0.12 * glow),
          p.lamp.withValues(alpha: 0.6 * glow),
          p.lamp.withValues(alpha: 0.3 * glow),
        ], stops: const [0, 0.65, 1])
            .createShader(Rect.fromLTWH(0, deskY, w, 1)),
    );
  }

  @override
  bool shouldRepaint(WelcomeScenePainter old) => old.palette != palette || old.deskAt != deskAt || old.clock != clock;
}
