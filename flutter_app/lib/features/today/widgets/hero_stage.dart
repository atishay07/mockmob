// The stage every Today hero stands on (ui-blitz/today.md 2.2): a lamp-lit panel with the
// subject's light pooled behind its object, which bleeds off the upper-right corner as a large
// prop; warm grain; the screen's one lit edge along the top, which a single band of light
// crosses once when the stage opens. Everything a student reads sits on the calm, darker lower
// left (brief section 5: no art behind text that is read). The only raised panel on Today.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

/// Corner radius of the hero panel.
const double heroRadius = 28;
const BorderRadius heroBorderRadius = BorderRadius.all(Radius.circular(heroRadius));

/// Size of the art corner. The object is drawn this big and bleeds a little past the top and
/// right edges; content beside it keeps clear of [heroArtWidth] minus the bleed.
const double heroArtHeight = 172;
const double heroArtWidth = 172;

/// How far the art runs past the panel's top and right edges.
const double heroArtBleed = 14;

/// What content beside the art keeps clear of, from the panel's right edge.
const double heroArtClear = heroArtWidth - heroArtBleed - 8;

class HeroStage extends StatelessWidget {
  const HeroStage({super.key, required this.child, this.subjectId, this.art, this.artWidth = heroArtWidth, this.lit = true, this.lampStrength = 1});

  final Widget child;
  final String? subjectId;

  /// The upper-right corner: an object or Mobi. Drawn under the content layer.
  final Widget? art;

  /// Width of the art corner, from the right edge.
  final double artWidth;

  /// The volt top edge: true on the one focal element of the screen.
  final bool lit;
  final double lampStrength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final brightness = Theme.of(context).brightness;
    final subject = SubjectLight.forSubject(subjectId);
    final surface = colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.25)! : colors.raised;

    final pools = <LightPool>[
      if (subject != null)
        LightPool(color: subject.of(brightness), center: const Alignment(0.78, -0.78), radius: 0.78, strength: colors.isNight ? 1.15 : 0.95),
      LightPool(
        color: colors.lamp.withValues(alpha: (colors.isNight ? 0.2 : 0.13) * lampStrength),
        center: const Alignment(-1.05, -1.1),
        radius: 0.75,
        aspect: 1.3,
      ),
    ];

    final panel = MmClip(
      borderRadius: heroBorderRadius,
      child: Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: surface)),
          Positioned.fill(child: LightField(pools: pools)),
          Positioned.fill(child: Grain(opacity: colors.grain)),
          if (art != null)
            Positioned(top: -heroArtBleed, right: -heroArtBleed, width: artWidth, height: heroArtHeight, child: art!),
          child,
          if (lit) const Positioned(left: 0, right: 0, top: 0, height: 120, child: IgnorePointer(child: _Sweep())),
        ],
      ),
    );

    final framed = CustomPaint(
      foregroundPainter: EdgeLightPainter(
        borderRadius: heroBorderRadius,
        top: colors.edgeTop,
        bottom: colors.edgeBottom,
        lamp: colors.isNight ? colors.lamp : null,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(borderRadius: heroBorderRadius, boxShadow: colors.glassShadow),
        child: panel,
      ),
    );

    if (!lit) return framed;
    return LitEdge(glow: true, borderRadius: heroBorderRadius, child: framed);
  }
}

/// The room's one light catching the card: a soft band crosses the top of the stage once, 360 ms
/// after it opens, over 700 ms. Nothing under reduced motion, and never again until the stage is
/// built anew.
class _Sweep extends StatefulWidget {
  const _Sweep();

  @override
  State<_Sweep> createState() => _SweepState();
}

class _SweepState extends State<_Sweep> with SingleTickerProviderStateMixin {
  late final AnimationController _t;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _t = AnimationController(vsync: this, duration: const Duration(milliseconds: 1060));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _t.forward();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return const SizedBox.shrink();
    final night = context.mmColors.isNight;
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, _) {
          final v = _t.value;
          if (v <= 0.34 || v >= 1) return const SizedBox.shrink();
          final p = Motion.sweepCurve.transform((v - 0.34) / 0.66);
          return CustomPaint(painter: _SweepPainter(progress: p, night: night), size: Size.infinite);
        },
      ),
    );
  }
}

class _SweepPainter extends CustomPainter {
  const _SweepPainter({required this.progress, required this.night});

  final double progress;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final band = size.width * 0.42;
    final x = -band + (size.width + band * 2) * progress;
    // Brightest along the lit edge, fading down the stage in strips (no offscreen layer).
    const strips = 8;
    final h = size.height / strips;
    final peak = night ? const Color(0x24FFF4D6) : const Color(0x38FFFFFF);
    for (var i = 0; i < strips; i++) {
      final a = peak.a * (1 - i / strips) * (1 - i / strips);
      final c = peak.withValues(alpha: a);
      final rect = Rect.fromLTWH(x - band / 2, i * h, band, h + 0.5);
      canvas.drawRect(
        rect,
        Paint()
          ..shader = LinearGradient(colors: [c.withValues(alpha: 0), c, c.withValues(alpha: 0)]).createShader(rect),
      );
    }
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.progress != progress || old.night != night;
}

/// The hero's art corner: the subject's object in its lamp light, large and bleeding off the
/// corner. It glides in once from 24 dp to the right at 0.92 scale (600 ms emphasized, 120 ms
/// after the stage), then never moves. Reduced motion shows it in place.
/// Mobi is not drawn here: at a human moment Mobi stands in the card itself (see MoveHeroCard).
class HeroArtView extends StatefulWidget {
  const HeroArtView({super.key, required this.art});

  final HeroArt art;

  static MobiPose poseFor(MmArt art) => switch (art) {
        MmArt.mobiSleepy => MobiPose.sleepy,
        MmArt.mobiThink => MobiPose.think,
        MmArt.mobiRead => MobiPose.read,
        MmArt.mobiRest => MobiPose.rest,
        MmArt.mobiCheer => MobiPose.cheer,
        MmArt.mobiPoint => MobiPose.point,
        _ => MobiPose.greet,
      };

  @override
  State<HeroArtView> createState() => _HeroArtViewState();
}

class _HeroArtViewState extends State<HeroArtView> with SingleTickerProviderStateMixin {
  late final AnimationController _arrive = AnimationController(vsync: this, duration: const Duration(milliseconds: 720));
  static const Interval _window = Interval(120 / 720, 1, curve: Motion.emphasized);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _arrive.value = 1;
    } else {
      _arrive.forward();
    }
  }

  @override
  void dispose() {
    _arrive.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final art = widget.art;
    final Widget image = art.isMobi
        ? Align(alignment: const Alignment(0.3, 0.2), child: Mobi(pose: HeroArtView.poseFor(art.art), size: 112))
        : Padding(
            padding: const EdgeInsets.all(4),
            child: ArtImage(art.art, width: heroArtWidth - 8, height: heroArtHeight - 8),
          );
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _arrive,
        child: image,
        builder: (context, child) {
          final t = _window.transform(_arrive.value);
          if (t >= 1) return child!;
          return Opacity(
            opacity: t,
            child: Transform.translate(
              offset: Offset(24 * (1 - t), -6 * (1 - t)),
              child: Transform.scale(scale: 0.92 + 0.08 * t, child: child),
            ),
          );
        },
      ),
    );
  }
}
