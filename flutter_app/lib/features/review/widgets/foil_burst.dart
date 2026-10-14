import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The one celebratory flourish of a finished repair, restrained: two thin rings and fourteen small
/// foil flecks ease out from the centre of the number's digits over 600 ms and fade, once. There
/// is no bloom and no sweep with it (MOTION.md 1.2: one light event per moment). The flecks sit on
/// fixed rays, evenly spaced, so the burst reads as drawn rather than scattered. No confetti, no
/// loop, nothing that covers text: it is drawn behind the number and never intercepts a touch.
/// In Day the foil is volt with a 1 dp olive rim, so it reads on paper.
///
/// It plays when [play] first becomes true. Mount it only when the celebration is on and motion
/// is not reduced; it draws nothing before it plays.
class FoilBurst extends StatefulWidget {
  const FoilBurst({super.key, required this.play, this.origin = Alignment.center, this.seed = 11});

  final bool play;

  /// Where the burst starts inside the box it fills.
  final Alignment origin;

  /// Kept for callers that pass one; the layout is fixed rays now, so every seed draws the same burst.
  final int seed;

  static const Duration duration = Duration(milliseconds: 600);

  /// How many flecks.
  static const int flecks = 14;

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

  /// Fourteen flecks on fourteen even rays, alternating a near and a far ring of travel.
  static List<_Fleck> _layout(int seed) => [
    for (var i = 0; i < FoilBurst.flecks; i++)
      _Fleck(
        angle: (i / FoilBurst.flecks) * 2 * math.pi - math.pi / 2,
        distance: i.isEven ? 30 : 46,
        size: i.isEven ? 2.6 : 1.8,
        kind: i % 3,
        delay: (i % 4) * 0.025,
      ),
  ];

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
              volt: colors.volt,
              lamp: colors.isNight ? colors.lamp : colors.voltEdge,
              paper: colors.isNight ? colors.ink : colors.ink2,
              rim: colors.isNight ? null : colors.accentText,
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
    required this.rim,
  }) : super(repaint: t);

  final Animation<double> t;
  final List<_Fleck> flecks;
  final Alignment origin;
  final Color volt;
  final Color lamp;
  final Color paper;

  /// The olive rim of Day's foil, or null on Night.
  final Color? rim;

  @override
  void paint(Canvas canvas, Size size) {
    final v = t.value;
    if (v <= 0 || size.isEmpty) return;
    final c = origin.withinRect(Offset.zero & size);

    // Two thin shock rings, volt then lamp, widening and fading: the stamp of a seal landing.
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;
    for (var i = 0; i < 2; i++) {
      final local = ((v - i * 0.12) / (1 - i * 0.12)).clamp(0.0, 1.0);
      if (local <= 0) continue;
      final e = Motion.emphasized.transform(local);
      // Night: volt then lamp. Day: olive then the paler volt edge, since a volt ring is invisible on paper.
      final base = rim == null ? (i == 0 ? volt : lamp) : (i == 0 ? rim! : lamp);
      ring.color = base.withValues(alpha: 0.7 * (1 - Curves.easeIn.transform(local)));
      canvas.drawCircle(c, 24 + (i == 0 ? 46 : 30) * e, ring);
    }

    // Fourteen flecks of foil on even rays, easing out and settling a little downward.
    final fleck = Paint();
    final rimPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final f in flecks) {
      final local = ((v - f.delay) / (1 - f.delay)).clamp(0.0, 1.0);
      if (local <= 0) continue;
      final e = Motion.emphasized.transform(local);
      final p = c + Offset(math.cos(f.angle), math.sin(f.angle)) * (26 + f.distance * e) + Offset(0, 10 * local * local);
      final base = f.kind == 0 ? volt : (f.kind == 1 ? lamp : paper);
      final fade = (1 - Curves.easeIn.transform(local)) * 0.9;
      fleck.color = base.withValues(alpha: fade);
      final radius = f.kind == 2 ? f.size * 0.7 : f.size;
      canvas.drawCircle(p, radius, fleck);
      if (rim != null) {
        rimPaint.color = rim!.withValues(alpha: fade);
        canvas.drawCircle(p, radius, rimPaint);
      }
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) =>
      old.t != t || old.origin != origin || old.volt != volt || old.lamp != lamp || old.paper != paper || old.rim != rim;
}
