// The stage every Today hero stands on (ui-blitz/today.md 2.2): a lamp-lit panel with the
// subject's light pooled behind its object, which bleeds off the upper-right corner as a large
// prop; warm grain; the screen's one lit edge along the top, which a single band of light
// crosses once when the stage opens. Everything a student reads sits on the calm, darker lower
// left (brief section 5: no art behind text that is read). The only raised panel on Today.
import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';
import 'today_tones.dart';

/// Corner radius of the hero panel.
const double heroRadius = 28;
const BorderRadius heroBorderRadius = BorderRadius.all(Radius.circular(heroRadius));

/// The art box on the card's header band (SPACING.md 4.1, audit T1): 156 x 156, the emblem drawn
/// at [heroEmblemSize] in its centre. It belongs to the band (overline, title and number), not to
/// the card's corner, so it is never cropped by the top edge and never floats away from the
/// number it explains.
const double heroArtHeight = 156;
const double heroArtWidth = 156;

/// The box's top, on the card's padding line: its centre then sits within 8 dp of the band's
/// centre (title top to number baseline, about 42 to 170 dp), so the object stands beside the
/// subject and the number instead of hanging above "to repair tonight" with air around it.
const double heroArtTop = MmSpace.cardPadding;

/// The box runs 10 dp past the right edge only; the emblem centred in it ends on the edge itself.
const double heroArtBleedRight = 10;

/// The subject emblem's side inside the art box: the hero size of the one emblem scale.
const double heroEmblemSize = EmblemSizes.hero;

/// How far the emblem lags the scroll, as a share of the box's height: about 8 dp over the whole
/// viewport, so it never leaves its place beside the band.
const double heroParallax = 0.05;

/// What the overline, title and (while its label is beside it) the number keep clear of, from the
/// panel's right edge: the box's visible part plus 12 dp of air (156 - 10 + 12).
const double heroArtClear = heroArtWidth - heroArtBleedRight + MmSpace.s12;

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
            Positioned(top: heroArtTop, right: -heroArtBleedRight, width: artWidth, height: heroArtHeight, child: art!),
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

/// The room's one light catching the card: a soft band crosses the top of the stage once, after
/// the number has landed (it starts 700 ms after the stage opens and takes 700 ms). Once per app
/// run, not per visit (MOTION.md 1.1): a return to Today, a refresh or a rebuilt stage shows the
/// card still. Nothing under reduced motion. On Daylight the band is a 14% volt (MOTION.md 1.4).
/// Lets a test see the once-per-run hero sweep again.
@visibleForTesting
void debugResetHeroSweep() => _SweepState._played = false;

class _Sweep extends StatefulWidget {
  const _Sweep();

  @override
  State<_Sweep> createState() => _SweepState();
}

class _SweepState extends State<_Sweep> with SingleTickerProviderStateMixin {
  late final AnimationController _t;
  bool _started = false;

  /// The sweep has played in this app run.
  static bool _played = false;

  /// The wait before the band starts, as a share of the controller: 700 of 1400 ms.
  static const double _lead = 0.5;

  @override
  void initState() {
    super.initState();
    _t = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (_played || Motion.reduced(context)) return;
    _played = true;
    _t.forward();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return const SizedBox.shrink();
    final peakColor = context.mmColors.sweepPeak;
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, _) {
          final v = _t.value;
          if (v <= _lead || v >= 1) return const SizedBox.shrink();
          final p = Motion.sweepCurve.transform((v - _lead) / (1 - _lead));
          return CustomPaint(painter: _SweepPainter(progress: p, peak: peakColor), size: Size.infinite);
        },
      ),
    );
  }
}

class _SweepPainter extends CustomPainter {
  const _SweepPainter({required this.progress, required this.peak});

  final double progress;

  /// The band's peak colour (see TodayTones.sweepPeak).
  final Color peak;

  @override
  void paint(Canvas canvas, Size size) {
    final band = size.width * 0.42;
    final x = -band + (size.width + band * 2) * progress;
    // Brightest along the lit edge, fading down the stage in strips (no offscreen layer).
    const strips = 8;
    final h = size.height / strips;
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
  bool shouldRepaint(_SweepPainter old) => old.progress != progress || old.peak != peak;
}

/// The hero's art: the subject's object in its lamp light, on the card's header band. It arrives
/// where it rests (MOTION.md 4.3, P0-9): it scales from 0.94 about its own centre and rises 8 dp,
/// over 420 ms on emphasized, 160 ms after the card, with no sideways travel ([EmblemArrive]).
/// After that it never moves except for a slight parallax. Reduced motion shows it in place.
/// Mobi is not drawn here: at a human moment Mobi stands in the card itself (see MoveHeroCard).
class HeroArtView extends StatelessWidget {
  const HeroArtView({super.key, required this.art});

  final HeroArt art;

  static MobiPose poseFor(MmArt? art) => switch (art) {
        MmArt.mobiSleepy => MobiPose.sleepy,
        MmArt.mobiThink => MobiPose.think,
        MmArt.mobiRead => MobiPose.read,
        MmArt.mobiRest => MobiPose.rest,
        MmArt.mobiCheer => MobiPose.cheer,
        MmArt.mobiPoint => MobiPose.point,
        _ => MobiPose.greet,
      };

  @override
  Widget build(BuildContext context) {
    final art = this.art;
    final Widget image = art.isMobi
        ? Center(child: Mobi(pose: HeroArtView.poseFor(art.art), size: 112))
        // The subject's code-drawn emblem, unframed on its own light, drifting slowly and lagging
        // the scroll a little (a prop standing deeper in the room than the card's words).
        : MmParallax(
            factor: heroParallax,
            child: Center(
              child: SubjectEmblem(subject: art.subject, size: heroEmblemSize, framed: false, animate: true),
            ),
          );
    return RepaintBoundary(child: EmblemArrive(child: image));
  }
}
