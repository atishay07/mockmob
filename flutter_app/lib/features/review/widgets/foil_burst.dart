import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The one celebratory flourish of a finished repair, restrained: two thin rings and small foil flecks
/// (volt, lamp amber, paper) ease out from a point over 900 ms and fade, once, while a soft volt
/// bloom rises under the number and settles at a faint level. No confetti, no loop, nothing that
/// covers text: it is drawn behind the number and never intercepts a touch.
///
/// It plays when [play] first becomes true. Mount it only when the celebration is on and motion
/// is not reduced; it draws nothing before it plays.
class FoilBurst extends StatefulWidget {
  const FoilBurst({super.key, required this.play, this.origin = const Alignment(-0.34, 0), this.seed = 11});

  final bool play;

  /// Where the burst starts inside the box it fills.
  final Alignment origin;

  /// Particle layout: the same seed always draws the same burst (goldens, tests).
  final int seed;

  static const Duration duration = Duration(milliseconds: 900);

  @override
  State<FoilBurst> createState() => _FoilBurstState();
}

class _FoilBurstState extends State<FoilBurst> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: FoilBurst.duration);
  late final List<_Fleck> _flecks = _layout(widget.seed);

  @override
  void initState() {
    super.initState();
    if (widget.play) _c.forward();
  }

  @override
  void didUpdateWidget(FoilBurst old) {
    super.didUpdateWidget(old);
    if (widget.play && !old.play && !_c.isAnimating && _c.value == 0) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  static List<_Fleck> _layout(int seed) {
    final r = math.Random(seed);
    return [
      for (var i = 0; i < 14; i++)
        _Fleck(
          angle: (i / 14) * 2 * math.pi + r.nextDouble() * 0.3,
          distance: 36 + r.nextDouble() * 34,
          size: 1.6 + r.nextDouble() * 2.2,
          kind: i % 3,
          delay: r.nextDouble() * 0.12,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return IgnorePointer(
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: CustomPaint(
            painter: _BurstPainter(
              t: _c,
              flecks: _flecks,
              origin: widget.origin,
              volt: colors.isNight ? colors.volt : colors.voltEdge,
              lamp: colors.lamp,
              paper: colors.isNight ? colors.ink : colors.ink2,
              bloom: colors.volt,
              night: colors.isNight,
            ),
            size: Size.infinite,
          ),
        ),
      ),
    );
  }
}

class _Fleck {
  const _Fleck({required this.angle, required this.distance, required this.size, required this.kind, required this.delay});

  final double angle;
  final double distance;
  final double size;
  final int kind;
  final double delay;
}

class _BurstPainter extends CustomPainter {
  _BurstPainter({
    required this.t,
    required this.flecks,
    required this.origin,
    required this.volt,
    required this.lamp,
    required this.paper,
    required this.bloom,
    required this.night,
  }) : super(repaint: t);

  final Animation<double> t;
  final List<_Fleck> flecks;
  final Alignment origin;
  final Color volt;
  final Color lamp;
  final Color paper;
  final Color bloom;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final v = t.value;
    if (v <= 0 || size.isEmpty) return;
    final c = origin.withinRect(Offset.zero & size);

    // The bloom: environment light that rises over the first 40% and then rests, faint.
    final rise = Curves.easeOut.transform((v / 0.4).clamp(0.0, 1.0));
    final level = (night ? 0.2 : 0.3) * rise;
    canvas.drawCircle(
      c,
      120,
      Paint()
        ..shader = RadialGradient(
          colors: [bloom.withValues(alpha: level), bloom.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: 120)),
    );

    // Two thin shock rings, volt then lamp, widening and fading: the stamp of a seal landing.
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;
    for (var i = 0; i < 2; i++) {
      final local = ((v - i * 0.12) / (1 - i * 0.12)).clamp(0.0, 1.0);
      if (local <= 0) continue;
      final e = Motion.emphasized.transform(local);
      ring.color = (i == 0 ? volt : lamp).withValues(alpha: 0.7 * (1 - Curves.easeIn.transform(local)));
      canvas.drawCircle(c, 26 + (i == 0 ? 58 : 40) * e, ring);
    }

    // Fourteen flecks of foil, easing out and settling a little downward.
    final fleck = Paint();
    for (final f in flecks) {
      final local = ((v - f.delay) / (1 - f.delay)).clamp(0.0, 1.0);
      if (local <= 0) continue;
      final e = Motion.emphasized.transform(local);
      final p = c + Offset(math.cos(f.angle), math.sin(f.angle)) * (30 + f.distance * e) + Offset(0, 14 * local * local);
      final base = f.kind == 0 ? volt : (f.kind == 1 ? lamp : paper);
      fleck.color = base.withValues(alpha: (1 - Curves.easeIn.transform(local)) * 0.9);
      canvas.drawCircle(p, f.kind == 2 ? f.size * 0.7 : f.size, fleck);
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) =>
      old.t != t || old.origin != origin || old.volt != volt || old.lamp != lamp || old.paper != paper || old.bloom != bloom || old.night != night;
}
