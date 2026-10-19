// M3, the countdown (MOB-BUILD-SPEC-V3 5.6, F7): Arena's brass stopwatch with Live's stamped paper
// numerals. Beats at 0, 600 and 1200 ms; "Go" at 1800; the stage leaves at 2400 while the question
// rises 14 dp (glide 300).
//
// Layers, back to front, each its own child of one Stack ('cd-layers'):
//   1. 'cd-art'      the stopwatch art (its brass pivot is part of it) and the volt arc, tilting
//                    plus or minus 1.5 degrees per beat (inOut 600);
//   2. 'cd-numerals' ONE paper numeral tile at a time, stamped over the dial: in 0-180 (scale 1.25 to 1,
//                    out), hold, leave 460-600 (scale 0.92 and fade, leave). The next one starts only
//                    after the previous one is gone, so numerals never overlap, and the tile covers
//                    the pivot (judge F7: the mangled "3", the double numerals, the pivot on the digit);
//   3. 'cd-go'       the volt paper "Go" tile (1.4 to 1, celebrate), one ring burst 0.6 to 1.6 (420)
//                    and 4 glints.
// Everything is a pure function of the time [ms], so a frame golden is just `CountdownStage(ms: 450)`.
// Reduced motion: numerals cross-fade in place over 120 ms, the beats stay (the time is information),
// no tilt, ring, glints or bob, and the arc fills a third per beat.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';
import 'paper_particles.dart' show drawGlint;
import 'run_paper.dart';

const String stopwatchArt = 'assets/art/hybrid-stopwatch.webp';

/// The countdown's clock, in ms from the first beat.
abstract final class CountdownTimeline {
  static const double beat = 600;
  static const double go = 1800;
  static const double exit = 2400;
  static const double end = 2700;
  static const double reducedEnd = 2520;

  static const double stampIn = 180;
  static const double leaveAt = 460;
  static const double reducedFade = 120;

  static double endFor({required bool reduced}) => reduced ? reducedEnd : end;

  /// The numeral at [t]: 3, 2 or 1 with its opacity and scale; null when none shows.
  static ({int n, double opacity, double scale})? numeral(double t, {required bool reduced}) {
    if (t < 0 || t >= go) return null;
    final i = (t / beat).floor();
    final local = t - i * beat;
    final n = 3 - i;
    if (reduced) {
      final inOp = (local / reducedFade).clamp(0.0, 1.0);
      final outOp = (1 - (local - (beat - reducedFade)) / reducedFade).clamp(0.0, 1.0);
      return (n: n, opacity: math.min(inOp, outOp), scale: 1);
    }
    if (local < stampIn) {
      final p = Motion.out.transform((local / stampIn).clamp(0.0, 1.0));
      // A stamp: the paper is there from the first frame (no blank dial between beats, the judge's
      // "dead tile"), inking from 70% to full in 60 ms while the scale settles over the 180.
      return (n: n, opacity: (0.7 + 0.3 * local / 60).clamp(0.0, 1.0), scale: 1.25 - 0.25 * p);
    }
    if (local < leaveAt) return (n: n, opacity: 1, scale: 1);
    final c = Motion.leave.transform(((local - leaveAt) / (beat - leaveAt)).clamp(0.0, 1.0));
    return (n: n, opacity: 1 - c, scale: 1 - 0.08 * c);
  }

  static final SpringSimulation _goLand = SpringSimulation(Springs.celebrate, 1.4, 1, 0);

  /// The Go tile: (opacity, scale), or null before 1800.
  static ({double opacity, double scale})? goTile(double t, {required bool reduced}) {
    if (t < go) return null;
    final local = t - go;
    if (reduced) return (opacity: (local / reducedFade).clamp(0.0, 1.0), scale: 1);
    return (opacity: (0.7 + 0.3 * local / 60).clamp(0.0, 1.0), scale: _goLand.x(local / 1000));
  }

  /// The ring burst at Go: (scale of the dial radius, opacity), or null.
  static ({double scale, double opacity})? ring(double t, {required bool reduced}) {
    if (reduced || t < go || t > go + 420) return null;
    final p = (t - go) / 420;
    return (scale: 0.6 + 1.0 * Motion.out.transform(p), opacity: 0.85 * (1 - p));
  }

  /// The stopwatch tilt in degrees: +1.5, -1.5, +1.5 on the beats, back to 0 at Go (inOut 600).
  static double tiltDeg(double t, {required bool reduced}) {
    if (reduced || t <= 0) return 0;
    const targets = [0.0, 1.5, -1.5, 1.5, 0.0];
    final i = (t / beat).floor().clamp(0, 3);
    final p = Motion.inOut.transform(((t - i * beat) / beat).clamp(0.0, 1.0));
    return targets[i] + (targets[i + 1] - targets[i]) * p;
  }

  /// The volt arc, 0 to 1 of the dial: linear over the three beats (a third per beat).
  static double arc(double t, {required bool reduced}) {
    if (t <= 0) return reduced ? 1 / 3 : 0;
    if (t >= go) return 1;
    if (reduced) return ((t / beat).floor() + 1) / 3;
    return t / go;
  }

  /// The scrim, 0 to 0.45 across the beats (glide), then clearing with the stage.
  static double scrim(double t) => 0.45 * Motion.glide.transform((t / go).clamp(0.0, 1.0));

  /// The heads bob 3 dp on each beat (and on Go).
  static double headBob(double t, {required bool reduced}) {
    if (reduced || t < 0 || t > go + 300) return 0;
    final local = t - (t / beat).floor() * beat;
    if (local > 300) return 0;
    return 3 * math.sin(math.pi * local / 300);
  }

  /// The stage's opacity: 1, then fading out from 2400 (glide 300; reduced 120).
  static double stage(double t, {required bool reduced}) {
    if (t <= exit) return 1;
    final len = reduced ? reducedFade : 300;
    return 1 - Motion.glide.transform(((t - exit) / len).clamp(0.0, 1.0));
  }

  /// The question under the stage: 0 hidden, 1 risen into place (14 dp, glide 300).
  static double body(double t, {required bool reduced}) {
    if (t <= exit) return 0;
    final len = reduced ? reducedFade : 300;
    return Motion.glide.transform(((t - exit) / len).clamp(0.0, 1.0));
  }
}

/// One head over the countdown: a racer's head disc with a ring in their colour (dashed for a ghost).
class CountdownHead {
  const CountdownHead({required this.name, this.fold, this.colour = 0, this.ghost = false, this.you = false});

  final String name;
  final FoldKey? fold;
  final int colour;
  final bool ghost;
  final bool you;
}

/// The whole countdown stage under the run header: the lamp, the scrim, the stopwatch, the heads,
/// the line about question 1, and a visible Skip (every show moment has one; any tap skips).
class CountdownStage extends StatelessWidget {
  const CountdownStage({super.key, required this.ms, required this.count, this.heads = const [], this.onSkip, this.reduced = false});

  /// The countdown clock in ms.
  final Animation<double> ms;
  final int count;
  final List<CountdownHead> heads;
  final VoidCallback? onSkip;
  final bool reduced;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onSkip,
      child: LayoutBuilder(
        builder: (context, box) {
          // The stopwatch takes what the column leaves: heads 64, the line about 44, Skip 48, gaps.
          final room = box.maxHeight - 64 - 48 - 48 - 72;
          final width = math.min(math.min(box.maxWidth * 0.72, 280.0), math.max(120.0, room * 596 / 768));
          return AnimatedBuilder(
            animation: ms,
            builder: (context, _) {
              final t = ms.value;
              return Opacity(
                opacity: CountdownTimeline.stage(t, reduced: reduced),
                child: CustomPaint(
                  painter: _StagePainter(
                    ground: colors.ground,
                    lamp: RunPaper.of(context).lampPool,
                    scrim: colors.isNight ? const Color(0xFF080705) : const Color(0xFF3B2A12),
                    scrimAlpha: CountdownTimeline.scrim(t) * (colors.isNight ? 1 : 0.32),
                    focusY: 0.40,
                  ),
                  child: Column(
                    children: [
                      const Spacer(flex: 2),
                      CountdownStopwatch(t: t, width: width, reduced: reduced),
                      const SizedBox(height: MmSpace.s24),
                      Transform.translate(
                        offset: Offset(0, -CountdownTimeline.headBob(t, reduced: reduced)),
                        child: _Heads(heads: heads),
                      ),
                      const SizedBox(height: MmSpace.s16),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24),
                        child: Text(
                          MobV3Copy.countdownNextN(count),
                          textAlign: TextAlign.center,
                          style: type.body.copyWith(color: colors.ink2),
                        ),
                      ),
                      const Spacer(flex: 3),
                      if (onSkip != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: MmSpace.s16),
                          child: _SkipPill(onTap: onSkip!),
                        ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _SkipPill extends StatelessWidget {
  const _SkipPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      label: MobV3Copy.skipShow,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 48, minWidth: 96),
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24, vertical: 13),
          decoration: ShapeDecoration(
            color: colors.raised.withValues(alpha: 0.9),
            shape: StadiumBorder(side: BorderSide(color: colors.line)),
          ),
          child: Text(MobV3Copy.skipShow, style: context.mmType.labelLarge.copyWith(color: colors.ink)),
        ),
      ),
    );
  }
}

class _Heads extends StatelessWidget {
  const _Heads({required this.heads});

  final List<CountdownHead> heads;

  @override
  Widget build(BuildContext context) {
    if (heads.isEmpty) return const SizedBox(height: 64);
    final type = context.mmType;
    final colors = context.mmColors;
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: MmSpace.s16,
      runSpacing: MmSpace.s8,
      children: [
        for (final h in heads)
          SizedBox(
            width: 64,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                RunHeadDisc(fold: h.fold, colour: h.colour, name: h.name, ghost: h.ghost, size: 40),
                const SizedBox(height: MmSpace.s4),
                Text(
                  h.you ? MobV3Copy.tabYou : h.name,
                  textAlign: TextAlign.center,
                  style: type.label.copyWith(color: h.ghost ? colors.ink2 : colors.ink, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A head disc in a member colour ring: the Fold's head still, or the initial when there is none.
/// A ghost's ring is dashed (the same "recorded run" mark as the dashed shadow on the ruler).
class RunHeadDisc extends StatelessWidget {
  const RunHeadDisc({super.key, required this.fold, required this.colour, required this.name, this.ghost = false, this.size = 40});

  final FoldKey? fold;
  final int colour;
  final String name;
  final bool ghost;
  final double size;

  @override
  Widget build(BuildContext context) {
    final ring = MobColours.of(context, colour);
    final head = FoldManifest.cached?[fold]?.head;
    final initial = name.trim().isEmpty ? '?' : String.fromCharCode(name.trim().runes.first).toUpperCase();
    final inner = head == null
        ? ColoredBox(
            color: ring,
            child: Center(
              child: Text(initial, style: context.mmType.label.copyWith(color: MobColours.inkOn(context), fontWeight: FontWeight.w800)),
            ),
          )
        : ColoredBox(
            color: context.mmColors.raised2,
            child: Image.asset(head, fit: BoxFit.cover, gaplessPlayback: true, errorBuilder: (_, _, _) => const SizedBox.shrink()),
          );
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          foregroundPainter: _RingPainter(colour: ring, dashed: ghost),
          child: Padding(padding: const EdgeInsets.all(3), child: ClipOval(child: inner)),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({required this.colour, required this.dashed});

  final Color colour;
  final bool dashed;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = colour;
    final r = Rect.fromLTWH(1, 1, size.width - 2, size.height - 2);
    if (!dashed) {
      canvas.drawOval(r, p);
      return;
    }
    drawDashedPath(canvas, Path()..addOval(r), p, dash: 4, gap: 3);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.colour != colour || old.dashed != dashed;
}

class _StagePainter extends CustomPainter {
  const _StagePainter({required this.ground, required this.lamp, required this.scrim, required this.scrimAlpha, required this.focusY});

  final Color ground;
  final Color lamp;
  final Color scrim;
  final double scrimAlpha;
  final double focusY;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..color = ground);
    final focus = Offset(size.width / 2, size.height * focusY);
    final r = math.max(size.width, size.height) * 0.62;
    // Light first: the lamp pool on the stopwatch.
    canvas.drawRect(
      rect,
      Paint()..shader = RadialGradient(colors: [lamp, lamp.withValues(alpha: 0)], stops: const [0, 1]).createShader(Rect.fromCircle(center: focus, radius: r * 0.75)),
    );
    // The scrim narrows the room toward the stopwatch: clear in the middle, dim at the edges.
    if (scrimAlpha > 0) {
      canvas.drawRect(
        rect,
        Paint()
          ..shader = RadialGradient(
            colors: [scrim.withValues(alpha: 0), scrim.withValues(alpha: scrimAlpha * 0.7), scrim.withValues(alpha: scrimAlpha)],
            stops: const [0.25, 0.7, 1],
          ).createShader(Rect.fromCircle(center: focus, radius: r)),
      );
    }
  }

  @override
  bool shouldRepaint(_StagePainter old) => old.scrimAlpha != scrimAlpha || old.ground != ground || old.lamp != lamp || old.scrim != scrim;
}

/// The stopwatch with its three layers at time [t] (ms). [width] is the art's width.
class CountdownStopwatch extends StatelessWidget {
  const CountdownStopwatch({super.key, required this.t, required this.width, this.reduced = false});

  final double t;
  final double width;
  final bool reduced;

  /// The dial's centre and radius in the art (measured on hybrid-stopwatch.webp, 596 by 768).
  static const Offset dialCentre = Offset(281 / 596, 465 / 768);
  static const double dialRadius = 205 / 596;

  @override
  Widget build(BuildContext context) {
    final h = width * 768 / 596;
    final centre = Offset(dialCentre.dx * width, dialCentre.dy * h);
    final dialR = dialRadius * width;
    final tilt = CountdownTimeline.tiltDeg(t, reduced: reduced) * math.pi / 180;
    final numeral = CountdownTimeline.numeral(t, reduced: reduced);
    final go = CountdownTimeline.goTile(t, reduced: reduced);
    final ring = CountdownTimeline.ring(t, reduced: reduced);
    final colors = context.mmColors;
    final paper = RunPaper.of(context);
    final k = (width / 233).clamp(0.6, 1.0);

    // The tile that carries the numeral; it covers the pivot, which stays in the art layer beneath.
    final tileW = 92.0 * k;
    final tileH = 110.0 * k;
    final goW = 132.0 * k;

    Widget tile({required Color face, required Color lip, required String text, required Color ink, required double w}) {
      return SizedBox(
        width: w,
        height: tileH,
        child: CustomPaint(
          painter: _TilePainter(face: face, lip: lip),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Center(
              child: Text(
                text,
                textHeightBehavior: MmType.figureHeightBehavior,
                style: context.mmType.figureHero.copyWith(color: ink, fontSize: 96 * k, height: 86 / 96),
              ),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      width: width,
      height: h,
      child: Stack(
        key: const ValueKey('cd-layers'),
        clipBehavior: Clip.none,
        children: [
          // 1. The art and the arc (the pivot is part of the art: it is always beneath the numeral).
          Positioned.fill(
            key: const ValueKey('cd-art'),
            child: RepaintBoundary(
              child: Transform.rotate(
                angle: tilt,
                origin: centre - Offset(width / 2, h / 2),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(stopwatchArt, fit: BoxFit.fill, gaplessPlayback: true, filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                    CustomPaint(painter: _ArcPainter(centre: centre, radius: dialR * 0.97, sweep: CountdownTimeline.arc(t, reduced: reduced), colour: colors.volt)),
                  ],
                ),
              ),
            ),
          ),
          // 2. One numeral at a time.
          Positioned(
            key: const ValueKey('cd-numerals'),
            left: centre.dx - tileW / 2,
            top: centre.dy - tileH / 2,
            width: tileW,
            height: tileH,
            child: numeral == null || numeral.opacity <= 0
                ? const SizedBox.shrink()
                : Opacity(
                    key: ValueKey('cd-numeral-${numeral.n}'),
                    opacity: numeral.opacity,
                    child: Transform.rotate(
                      angle: (numeral.n == 2 ? 1.5 : -2.0) * math.pi / 180,
                      child: Transform.scale(
                        scale: numeral.scale,
                        child: tile(face: paper.paper, lip: paper.paperEdge, text: '${numeral.n}', ink: paper.paperInk, w: tileW),
                      ),
                    ),
                  ),
          ),
          // 3. Go: the volt paper tile, one ring burst and four glints.
          Positioned(
            key: const ValueKey('cd-go'),
            left: centre.dx - goW / 2 - 40,
            top: centre.dy - tileH / 2 - 40,
            width: goW + 80,
            height: tileH + 80,
            child: go == null
                ? const SizedBox.shrink()
                : CustomPaint(
                    painter: _GoFxPainter(t: t - CountdownTimeline.go, ring: ring, dialR: dialR, colour: colors.volt, reduced: reduced),
                    child: Center(
                      child: Opacity(
                        opacity: go.opacity,
                        child: Transform.scale(
                          scale: go.scale,
                          child: tile(face: colors.volt, lip: colors.voltEdge, text: MobV3Copy.go, ink: colors.voltInk, w: goW),
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _TilePainter extends CustomPainter {
  const _TilePainter({required this.face, required this.lip});

  final Color face;
  final Color lip;

  @override
  void paint(Canvas canvas, Size size) {
    const r = Radius.circular(14);
    final body = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, size.width, size.height - 4), r);
    final lipR = RRect.fromRectAndRadius(Rect.fromLTWH(0, 4, size.width, size.height - 4), r);
    canvas.drawShadow(Path()..addRRect(lipR), const Color(0xFF000000), 6, false);
    canvas.drawRRect(lipR, Paint()..color = lip);
    canvas.drawRRect(body, Paint()..color = face);
    // A lamp-lit top edge, nothing else (BRAND-MOTION-KIT 4).
    canvas.drawRRect(
      body.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [const Color(0x66FFFFFF), const Color(0x00FFFFFF)],
          stops: const [0, 0.25],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_TilePainter old) => old.face != face || old.lip != lip;
}

class _ArcPainter extends CustomPainter {
  const _ArcPainter({required this.centre, required this.radius, required this.sweep, required this.colour});

  final Offset centre;
  final double radius;
  final double sweep;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    if (sweep <= 0) return;
    canvas.drawArc(
      Rect.fromCircle(center: centre, radius: radius),
      -math.pi / 2,
      2 * math.pi * sweep.clamp(0.0, 1.0),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..color = colour,
    );
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.sweep != sweep || old.colour != colour || old.radius != radius || old.centre != centre;
}

class _GoFxPainter extends CustomPainter {
  const _GoFxPainter({required this.t, required this.ring, required this.dialR, required this.colour, required this.reduced});

  /// ms since Go.
  final double t;
  final ({double scale, double opacity})? ring;
  final double dialR;
  final Color colour;
  final bool reduced;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = ring;
    if (r != null && r.opacity > 0) {
      canvas.drawCircle(
        c,
        dialR * r.scale,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = colour.withValues(alpha: r.opacity),
      );
    }
    if (reduced) return;
    // Four glints at the tile's corners, each twinkling once in the first 640 ms.
    final spots = [Offset(-0.36, -0.36), Offset(0.4, -0.3), Offset(0.38, 0.36), Offset(-0.34, 0.32)];
    for (var i = 0; i < spots.length; i++) {
      final local = (t - 60 - i * 70) / 420;
      if (local <= 0 || local >= 1) continue;
      final k = math.sin(local * math.pi);
      drawGlint(canvas, c + Offset(spots[i].dx * size.width, spots[i].dy * size.height), 7 * k, const Color(0xFFFFF4D6).withValues(alpha: 0.95 * k));
    }
  }

  @override
  bool shouldRepaint(_GoFxPainter old) => old.t != t || old.ring != ring || old.colour != colour;
}
