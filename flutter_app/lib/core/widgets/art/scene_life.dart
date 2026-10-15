import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'scene_art.dart';

/// Where the living parts of a painted room are, as fractions of its image (`shared/scene-anchors.json`
/// holds the same numbers for the website, and a test keeps the two equal).
@immutable
class SceneLifeSpec {
  const SceneLifeSpec({
    required this.lampX,
    required this.lampY,
    required this.coneFootY,
    required this.ellipseX,
    required this.ellipseY,
    required this.ellipseW,
    required this.stars,
  });

  /// The lamp's bulb, inside the shade.
  final double lampX;
  final double lampY;

  /// Where the lamp's cone meets the floor (the motes start there and rise to the shade).
  final double coneFootY;

  /// The lit ellipse on the floor, where Mobi sits: its centre and its width.
  final double ellipseX;
  final double ellipseY;
  final double ellipseW;

  /// Three spots in the window's sky (Night only), clear of the moon, the bars and the hills:
  /// the twinkles sit there.
  final List<Offset> stars;

  /// The floor-lamp room (every scene but the offline desk).
  static const SceneLifeSpec floorLamp = SceneLifeSpec(
    lampX: 0.408,
    lampY: 0.222,
    coneFootY: 0.70,
    ellipseX: 0.514,
    ellipseY: 0.785,
    ellipseW: 0.55,
    stars: [Offset(0.225, 0.07), Offset(0.235, 0.21), Offset(0.10, 0.21)],
  );

  /// The unplugged desk lamp room.
  static const SceneLifeSpec deskLamp = SceneLifeSpec(
    lampX: 0.393,
    lampY: 0.356,
    coneFootY: 0.70,
    ellipseX: 0.50,
    ellipseY: 0.766,
    ellipseW: 0.484,
    stars: [Offset(0.19, 0.08), Offset(0.215, 0.17), Offset(0.09, 0.20)],
  );

  static SceneLifeSpec of(StateScene scene, {required bool night}) => scene == StateScene.offline ? deskLamp : floorLamp;
}

/// A painted quiet room, alive and quiet: at night the lamp breathes (its glow swells and eases
/// over 8 s), a few dust motes drift up through its cone and two or three stars in the window
/// twinkle; by day the sunlit ellipse on the floor breathes a little. Nothing else moves.
///
/// It is decoration, so it asks little of the phone. It draws one extra layer over the painting
/// (the painting itself is never redrawn), only inside the picture's own pixels (never over
/// text), runs for [cycles] breaths (24 s) and then fades out over 1.5 s and
/// rests, so a phone left on the screen is not kept drawing, and a test that waits for the screen
/// to settle can. It never runs under reduced motion or on the Lite and Off glass tiers, and it
/// pauses with its route (the ticker is muted offstage).
class SceneLife extends StatefulWidget {
  const SceneLife({super.key, required this.scene, required this.night, required this.child, this.cycles = 3});

  final StateScene scene;
  final bool night;
  final Widget child;
  final int cycles;

  /// One breath.
  static const Duration breath = Duration(seconds: 8);

  /// How long the room takes to ease in and out at the ends of its span.
  static const Duration fadeEnds = Duration(milliseconds: 1500);

  /// The motes: a few specks, never a snowfall.
  static const int motes = 9;

  @override
  State<SceneLife> createState() => _SceneLifeState();
}

class _SceneLifeState extends State<SceneLife> with SingleTickerProviderStateMixin {
  /// Made only when the room runs at all (not under reduced motion, not on the Lite and Off glass
  /// tiers): a still room owns no ticker.
  AnimationController? _loop;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context) || GlassScope.of(context) != GlassQuality.full) return;
    _loop = AnimationController(vsync: this, duration: SceneLife.breath * widget.cycles)..forward();
  }

  @override
  void dispose() {
    _loop?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loop = _loop;
    // Not running (reduced motion or a low tier): just the painting.
    if (loop == null) return widget.child;
    final lamp = context.mmColors.lamp;
    return AnimatedBuilder(
      animation: loop,
      child: widget.child,
      builder: (context, child) {
        // The span is over: the room rests, and the painting stands alone.
        if (loop.isCompleted) return child!;
        return RepaintBoundary(
          child: CustomPaint(
            foregroundPainter: _LifePainter(
              progress: loop,
              spec: SceneLifeSpec.of(widget.scene, night: widget.night),
              night: widget.night,
              lamp: lamp,
              cycles: widget.cycles,
              spanMs: (SceneLife.breath * widget.cycles).inMilliseconds,
            ),
            child: child,
          ),
        );
      },
    );
  }
}

class _LifePainter extends CustomPainter {
  _LifePainter({required this.progress, required this.spec, required this.night, required this.lamp, required this.cycles, required this.spanMs}) : super(repaint: progress);

  final Animation<double> progress;
  final SceneLifeSpec spec;
  final bool night;
  final Color lamp;
  final int cycles;
  final int spanMs;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final elapsed = progress.value * spanMs;
    final endMs = SceneLife.fadeEnds.inMilliseconds;
    // Eases in as the room comes alive and out as it goes to rest: nothing pops at either end.
    final env = math.min(1.0, math.min(elapsed / endMs, (spanMs - elapsed) / endMs)).clamp(0.0, 1.0);
    if (env <= 0) return;
    final t = (progress.value * cycles) % 1.0;
    final breath = 0.5 + 0.5 * math.sin(2 * math.pi * t - math.pi / 2);

    // The pool on the floor warms and eases (Mobi sits in it), by day and by night.
    final pool = Offset(spec.ellipseX * w, spec.ellipseY * h);
    final poolW = spec.ellipseW * w;
    canvas.save();
    canvas.translate(pool.dx, pool.dy);
    canvas.scale(1, 0.3);
    final poolA = (night ? 0.05 : 0.04) * (0.4 + 0.6 * breath) * env;
    canvas.drawCircle(
      Offset.zero,
      poolW / 2,
      Paint()..shader = RadialGradient(colors: [lamp.withValues(alpha: poolA), lamp.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: Offset.zero, radius: poolW / 2)),
    );
    canvas.restore();
    if (!night) return;

    // The lamp breathes: a soft swell of glow under the shade.
    final lampAt = Offset(spec.lampX * w, spec.lampY * h);
    final glowR = w * 0.2;
    canvas.drawCircle(
      lampAt,
      glowR,
      Paint()..shader = RadialGradient(colors: [lamp.withValues(alpha: (0.06 + 0.07 * breath) * env), lamp.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: lampAt, radius: glowR)),
    );

    // The motes: each rises through the cone on its own phase, swaying a little, fading in and
    // out so none pops. Positions are arithmetic on the index, so every run is the same.
    final top = (spec.lampY + 0.04) * h;
    final foot = spec.coneFootY * h;
    final paint = Paint();
    for (var i = 0; i < SceneLife.motes; i++) {
      final p = (t + i / SceneLife.motes) % 1.0;
      final y = foot + (top - foot) * p;
      final spread = ((y - top) / (foot - top)) * 0.11 * w + 0.02 * w;
      final r = ((i * 37) % 17) / 16;
      final x = lampAt.dx + (r * 2 - 1) * spread * 0.8 + math.sin(2 * math.pi * (p * 1.5 + i * 0.37)) * w * 0.004;
      final a = math.sin(math.pi * p) * (0.22 + 0.4 * ((i * 11) % 7) / 6) * env;
      paint.color = const Color(0xFFFFE7A8).withValues(alpha: a);
      canvas.drawCircle(Offset(x, y), (0.7 + 0.9 * (((i * 5) % 4) / 3)) * (w / 380).clamp(0.6, 1.4), paint);
    }

    // The stars: two or three sparkles in the window's sky, each on its own slow pulse.
    for (var i = 0; i < spec.stars.length; i++) {
      final phase = (t * 2 + i * 0.31) % 1.0;
      final pulse = math.pow(math.sin(math.pi * phase), 3).toDouble();
      final c = Offset(spec.stars[i].dx * w, spec.stars[i].dy * h);
      final r = (1.4 + 1.6 * pulse) * (w / 380).clamp(0.6, 1.4);
      final star = Paint()..color = const Color(0xFFF4F0E6).withValues(alpha: (0.15 + 0.7 * pulse) * env);
      canvas.drawCircle(c, r * 0.55, star);
      final ray = Paint()
        ..color = const Color(0xFFF4F0E6).withValues(alpha: 0.5 * pulse * env)
        ..strokeWidth = 0.7
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(c.translate(-r * 1.8, 0), c.translate(r * 1.8, 0), ray);
      canvas.drawLine(c.translate(0, -r * 1.8), c.translate(0, r * 1.8), ray);
    }
  }

  @override
  bool shouldRepaint(_LifePainter old) => old.spec != spec || old.night != night || old.lamp != lamp;
}
