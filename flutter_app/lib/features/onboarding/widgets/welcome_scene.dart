import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The welcome room, drawn in code: a desk lamp in the top corner pouring a cone of warm light
/// onto a desk, and one row of answer bubbles on the desk's edge that ink in turn. Mobi stands on
/// the desk, large, and is the picture (placed by the welcome screen). Nothing here is a picture, so it
/// is sharp at any size, follows the theme, and costs one paint.
class WelcomeScene extends StatefulWidget {
  const WelcomeScene({super.key, required this.deskAt, this.animate = true});

  /// Where the desk's front edge sits, as a fraction of the scene's height.
  final double deskAt;
  final bool animate;

  @override
  State<WelcomeScene> createState() => _WelcomeSceneState();
}

class _WelcomeSceneState extends State<WelcomeScene> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000));

  /// The sheet starts inking once Mobi has landed and begun his hello.
  late final Animation<double> _inking = CurvedAnimation(parent: _ink, curve: const Interval(0.25, 1));

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
        painter: WelcomeScenePainter(palette: palette, ink: _inking, deskAt: widget.deskAt),
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
  WelcomeScenePainter({required this.palette, required this.ink, required this.deskAt}) : super(repaint: ink);

  final ScenePalette palette;
  final Animation<double> ink;
  final double deskAt;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final w = size.width, h = size.height;
    final deskY = h * deskAt;
    final p = palette;
    final glow = p.night ? 1.0 : 0.7;

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

    _lamp(canvas, w, h, bulb);
    _desk(canvas, size, deskY, glow);
    _sheet(canvas, w, h, deskY);
  }

  void _lamp(Canvas canvas, double w, double h, Offset bulb) {
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
        ..color = p.lamp.withValues(alpha: 0.8),
    );
    final bulbRect = Rect.fromCenter(center: bulb.translate(0, h * 0.002), width: w * 0.2, height: h * 0.02);
    canvas.drawOval(
      bulbRect,
      Paint()
        ..shader = RadialGradient(colors: [const Color(0xFFFFF4DA), p.lamp, p.lamp.withValues(alpha: 0)], stops: const [0, 0.45, 1])
            .createShader(bulbRect),
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

  /// A row of answer bubbles along the desk's front edge, inking one at a time while Mobi waves:
  /// the only prop left on the desk, so Mobi is the picture and the sheet is only hinted at.
  void _sheet(Canvas canvas, double w, double h, double deskY) {
    final p = palette;
    const count = 5;
    final y = deskY + h * 0.115;
    final progress = ink.value;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = p.ring.withValues(alpha: 0.8);
    for (var i = 0; i < count; i++) {
      final c = Offset(w * 0.09 + i * w * 0.075, y);
      final rect = Rect.fromCenter(center: c, width: 15, height: 9);
      final inked = ((progress * count) - i).clamp(0.0, 1.0);
      if (i == 2 && inked > 0) {
        final t = Motion.emphasized.transform(inked);
        canvas.drawOval(
          Rect.fromCenter(center: c, width: rect.width * (0.4 + 0.6 * t), height: rect.height * (0.4 + 0.6 * t)),
          Paint()..color = p.ink.withValues(alpha: 0.35 + 0.65 * t),
        );
      } else {
        canvas.drawOval(rect, ring);
      }
    }
  }

  @override
  bool shouldRepaint(WelcomeScenePainter old) => old.palette != palette || old.deskAt != deskAt || old.ink != ink;
}
