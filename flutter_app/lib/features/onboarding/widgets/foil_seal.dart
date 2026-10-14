import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// The lime-and-gold foil seal, drawn in code: a scalloped rosette of foil with a pressed rim
/// and an embossed tick. It sits inside the sheet's bottom-right corner (never clipped by the
/// card or the screen), turned -8 degrees with a soft shadow under it. When [sealed] turns true
/// it is stamped on: a quick press down to 0.92 and back over 280 ms.
class FoilSeal extends StatelessWidget {
  const FoilSeal({super.key, required this.sealed, this.size = 64, this.animate = true});

  final bool sealed;
  final double size;
  final bool animate;

  static const double _turn = -8 * math.pi / 180;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final seal = Semantics(
      label: OnboardingCopy.sealed,
      image: true,
      child: Transform.rotate(
        angle: _turn,
        child: RepaintBoundary(
          child: CustomPaint(
            size: Size.square(size),
            painter: FoilSealPainter(volt: colors.volt, edge: colors.voltEdge, ink: colors.voltInk, lamp: colors.lamp),
          ),
        ),
      ),
    );
    if (!animate) return SizedBox.square(dimension: size, child: sealed ? seal : null);
    return SizedBox.square(
      dimension: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: sealed ? 1 : 0),
        duration: Motion.of(context, Motion.ink),
        curve: Curves.linear,
        builder: (context, t, child) {
          if (t == 0) return const SizedBox.shrink();
          // 1.0 down to 0.92 at the midpoint and back: the press of a stamp.
          final scale = 1 - 0.08 * (1 - (2 * t - 1).abs());
          return Opacity(opacity: (t * 3).clamp(0.0, 1.0), child: Transform.scale(scale: scale, child: child));
        },
        child: seal,
      ),
    );
  }
}

/// Paints the seal: shadow, scalloped foil, pressed rim, inner disc, embossed tick, and one
/// lamp glint. Gradients only, no blur filters, so it is cheap at any size.
class FoilSealPainter extends CustomPainter {
  const FoilSealPainter({required this.volt, required this.edge, required this.ink, required this.lamp});

  final Color volt;
  final Color edge;
  final Color ink;
  final Color lamp;

  static const int _lobes = 18;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2 * 0.94;
    // Foil is an object, not a surface: its pigments (pale highlight #FFFDE8, white glints, black
    // 33% contact shadow) are the same in Night and Day. Lime foil reads on
    // both grounds; it is checked in the Day golden.
    final pale = Color.lerp(volt, const Color(0xFFFFFDE8), 0.55)!;
    final gold = Color.lerp(volt, lamp, 0.55)!;

    // Contact shadow, offset toward the bottom like the lamp's other shadows.
    canvas.drawCircle(
      c + Offset(0, r * 0.10),
      r * 1.02,
      Paint()
        ..shader = RadialGradient(colors: [const Color(0x55000000), const Color(0x00000000)], stops: const [0.78, 1])
            .createShader(Rect.fromCircle(center: c + Offset(0, r * 0.10), radius: r * 1.02)),
    );

    // Scalloped foil: a sweep of lime, pale, gold and edge, so it catches light as it turns.
    final rosette = _rosette(c, r, r * 0.9);
    final foil = SweepGradient(
      transform: const GradientRotation(-math.pi / 3),
      colors: [volt, pale, gold, edge, volt, pale, gold, volt],
    ).createShader(Rect.fromCircle(center: c, radius: r));
    canvas.drawPath(rosette, Paint()..shader = foil);
    canvas.drawPath(
      rosette,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.025
        ..color = edge.withValues(alpha: 0.8),
    );

    // Pressed rim and the inner disc, lit from the top left.
    final inner = r * 0.70;
    canvas.drawCircle(c, inner + r * 0.06, Paint()..color = edge.withValues(alpha: 0.55));
    canvas.drawCircle(
      c,
      inner,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [pale, volt, Color.lerp(volt, edge, 0.6)!],
        ).createShader(Rect.fromCircle(center: c, radius: inner)),
    );
    canvas.drawCircle(
      c,
      inner * 0.84,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.02
        ..color = ink.withValues(alpha: 0.22),
    );

    // The embossed tick: a light edge offset up-left, then the ink.
    final tick = Path()
      ..moveTo(c.dx - inner * 0.42, c.dy + inner * 0.02)
      ..lineTo(c.dx - inner * 0.10, c.dy + inner * 0.34)
      ..lineTo(c.dx + inner * 0.46, c.dy - inner * 0.30);
    final w = r * 0.14;
    canvas.drawPath(
      tick.shift(Offset(-r * 0.02, -r * 0.025)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = const Color(0xFFFFFFFF).withValues(alpha: 0.55),
    );
    canvas.drawPath(
      tick,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = ink.withValues(alpha: 0.82),
    );

    // One lamp glint across the upper left of the foil.
    final glint = Rect.fromCircle(center: c, radius: r * 0.86);
    canvas.drawArc(
      glint,
      math.pi * 1.08,
      math.pi * 0.34,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.07
        ..strokeCap = StrokeCap.round
        ..color = const Color(0xFFFFFFFF).withValues(alpha: 0.45),
    );
  }

  /// A rosette of [_lobes] round scallops between [inner] and [outer].
  Path _rosette(Offset c, double outer, double inner) {
    final path = Path();
    const steps = _lobes * 12;
    for (var i = 0; i <= steps; i++) {
      final a = i / steps * 2 * math.pi;
      final wave = (math.cos(a * _lobes) + 1) / 2;
      final rr = inner + (outer - inner) * math.sqrt(wave);
      final p = c + Offset(math.cos(a) * rr, math.sin(a) * rr);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    return path..close();
  }

  @override
  bool shouldRepaint(FoilSealPainter old) => old.volt != volt || old.edge != edge || old.ink != ink || old.lamp != lamp;
}
