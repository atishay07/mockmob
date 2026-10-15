// The stage every Today hero stands on (ui-blitz/today.md 2.2): a lamp-lit panel with the
// subject's light pooled behind its object, which bleeds off the upper-right corner as a large
// prop; warm grain; the screen's one lit edge along the top, which a single band of light
// crosses once when the stage opens. Everything a student reads sits on the calm, darker lower
// left (brief section 5: no art behind text that is read). The only raised panel on Today.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/motion/mm_light.dart';
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

/// How far the stage's light pools lag the scroll: the lamp sits deeper in the room than the
/// object, so the two separate a little as the page moves (M2).
const double heroLampParallax = 0.12;

/// What the overline, title and (while its label is beside it) the number keep clear of, from the
/// panel's right edge: the box's visible part plus 12 dp of air (156 - 10 + 12).
const double heroArtClear = heroArtWidth - heroArtBleedRight + MmSpace.s12;

/// How the hero's object and the stage's light answer a touch or a changed duration chip. The
/// object itself moves through [MmObjectReact] (full amplitude on a tap, 60% on a chip change,
/// timed with the number's roll); the stage's subject light swells up to 20% of its strength
/// with it and eases back. [fire] takes the amplitude: 1 for a tap on the object, below 1 for a
/// chip. A transform and a painter's strength only; nothing here lays out again.
class HeroReact extends ChangeNotifier {
  HeroReact({required TickerProvider vsync}) : _c = AnimationController(vsync: vsync, duration: length) {
    _c.addListener(notifyListeners);
  }

  static const Duration length = Duration(milliseconds: 620);

  /// Amplitude of the object's reaction to a chip change.
  static const double chipAmplitude = 0.6;

  final AnimationController _c;
  double _amp = 1;

  /// Each change plays the object's full reaction once (a tap on it).
  final ValueNotifier<int> tapPulse = ValueNotifier(0);

  /// Each change plays the object's 60% reaction once (a chip changed).
  final ValueNotifier<int> chipPulse = ValueNotifier(0);

  /// Plays one reaction at [amplitude] (1 is full): the object's, and the light's with it.
  void fire(double amplitude, {bool animate = true}) {
    _amp = amplitude;
    if (animate) _c.forward(from: 0);
    if (amplitude >= 1) {
      tapPulse.value++;
    } else {
      chipPulse.value++;
    }
  }

  /// How much the stage's subject light is stronger than at rest: up to 0.2 at full amplitude.
  double get light => 0.2 * math.sin(math.pi * _c.value.clamp(0.0, 1.0)) * _amp;

  @override
  void dispose() {
    _c.dispose();
    tapPulse.dispose();
    chipPulse.dispose();
    super.dispose();
  }
}

class HeroStage extends StatelessWidget {
  const HeroStage({super.key, required this.child, this.subjectId, this.art, this.artWidth = heroArtWidth, this.lit = true, this.lampStrength = 1, this.react});

  final Widget child;
  final String? subjectId;

  /// The upper-right corner: an object or Mobi. Drawn under the content layer.
  final Widget? art;

  /// Width of the art corner, from the right edge.
  final double artWidth;

  /// The volt top edge: true on the one focal element of the screen.
  final bool lit;
  final double lampStrength;

  /// Swells the subject light with the hero object's reaction (see [HeroReact]).
  final HeroReact? react;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final brightness = Theme.of(context).brightness;
    final subject = SubjectLight.forSubject(subjectId);
    final surface = colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.25)! : colors.raised;

    List<LightPool> poolsAt(double swell) => <LightPool>[
          if (subject != null)
            LightPool(
              color: subject.of(brightness),
              center: const Alignment(0.78, -0.78),
              radius: 0.78,
              strength: (colors.isNight ? 1.15 : 0.95) * (1 + swell),
            ),
          LightPool(
            color: colors.lamp.withValues(alpha: (colors.isNight ? 0.2 : 0.13) * lampStrength),
            center: const Alignment(-1.05, -1.1),
            radius: 0.75,
            aspect: 1.3,
          ),
        ];
    final reaction = react;

    final panel = MmClip(
      borderRadius: heroBorderRadius,
      child: Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: surface)),
          Positioned.fill(
            child: MmParallax(
              factor: heroLampParallax,
              child: reaction == null
                  ? LightField(pools: poolsAt(0))
                  : ListenableBuilder(listenable: reaction, builder: (context, _) => LightField(pools: poolsAt(reaction.light))),
            ),
          ),
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
    // The volt glow under the lit edge is a Night thing: on paper a glow is a grey smudge, and the
    // olive edge alone carries the light (MOTION.md 1.4).
    return LitEdge(glow: MmLight.glows(context), borderRadius: heroBorderRadius, child: framed);
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
  const HeroArtView({super.key, required this.art, this.react, this.onTap});

  final HeroArt art;

  /// The reaction that moves the object (see [HeroReact]); none leaves it still.
  final HeroReact? react;

  /// A touch on the object. It is a decoration, not a control, so it has no semantics of its own.
  final VoidCallback? onTap;

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
    final reaction = react;
    final Widget image = art.isMobi
        ? Center(child: Mobi(pose: HeroArtView.poseFor(art.art), size: 112))
        // The subject's object, unframed on its own light, floating, lagging the scroll a little
        // (a prop standing deeper in the room than the card's words) and leaning with it. A tap
        // springs it at full amplitude with its sparkle (the emblem's own reaction, about its foot).
        : MmParallax(
            factor: heroParallax,
            lean: true,
            child: Center(
              child: SubjectEmblem(
                subject: art.subject,
                size: heroEmblemSize,
                framed: false,
                animate: true,
                reaction: reaction?.tapPulse,
              ),
            ),
          );
    Widget out = RepaintBoundary(child: EmblemArrive(child: image));
    if (reaction != null && !art.isMobi) {
      // A chip change moves it at 60%, timed with the number's roll, with no haptic of its own.
      out = MmObjectReact(pulse: reaction.chipPulse, amplitude: HeroReact.chipAmplitude, haptic: false, child: out);
    }
    final tap = onTap;
    if (tap != null && !art.isMobi) out = GestureDetector(behavior: HitTestBehavior.translucent, onTap: tap, child: out);
    return out;
  }
}
