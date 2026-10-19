// K4 Reveal (spec 5.3, 5.6 M9, T3 2000; F6). Live's parcel climb-out, earned only: the lamp narrows,
// the parcel pulls back and wobbles twice, a WARM LEAK grows from the seam (radial; no sunburst, no
// rays, no rarity colour), the square seal pops, four paper flaps fold back 60 ms apart, and the Fold
// climbs 90 dp out of the parcel with paper bits that stop above its name. Then the name engraves,
// the line rises and the keys rise.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_puppet.dart';
import 'moment_kit.dart';
import 'paper_particles.dart';
import 'parcel.dart';

class RevealMoment extends StatefulWidget {
  const RevealMoment({super.key, required this.mobName, required this.fold, required this.onPlayAs, required this.onShelf, required this.onClose, this.playing = false});

  final String mobName;
  final FoldKey fold;
  final VoidCallback onPlayAs;
  final VoidCallback onShelf;
  final VoidCallback onClose;

  /// True while "Play as" waits for the server.
  final bool playing;

  @override
  State<RevealMoment> createState() => RevealMomentState();
}

/// The reveal stage's geometry: the parcel's width and the headroom above it for the Fold.
///
/// With the final stills (20 Oct) the Fold climbs ALL the way out (owner, walk M6): it starts hidden
/// inside the open parcel, rises past the front rim and lands standing on it, boots on the rim, the
/// whole Fold in view. The front of the open still is drawn again over the Fold, clipped to
/// [frontRim], so the Fold is truly inside the box until it climbs out.
abstract final class RevealGeo {
  static const double parcel = 216;
  static const double headroom = 72;

  /// The figure's height (boots to top).
  static const double fold = 140;

  /// Where the boots stand at rest, as a fraction of the parcel still: on the front rim of the opening.
  static const double rimY = 0.47;

  /// The rise: from just below the front rim (the head hidden) to standing on it.
  static const double rise = fold + 0.08 * parcel;

  /// The Fold's top at rest, in stage coordinates.
  static double get foldRestTop => headroom + rimY * parcel - fold;
  static double get stageHeight => headroom + parcel;

  /// The open still's front rim and everything below it (fractions of the still): the front-left flap,
  /// the front corner and the right flap's edge. Measured on `parcel-open.webp` (512 px).
  static const List<Offset> frontRim = [
    Offset(0, 0.47),
    Offset(0.30, 0.43),
    Offset(0.57, 0.555),
    Offset(0.82, 0.34),
    Offset(1, 0.34),
    Offset(1, 1),
    Offset(0, 1),
  ];

  static Path frontPath(Size s) {
    final path = Path()..moveTo(frontRim.first.dx * s.width, frontRim.first.dy * s.height);
    for (final o in frontRim.skip(1)) {
      path.lineTo(o.dx * s.width, o.dy * s.height);
    }
    return path..close();
  }
}

/// Clips to the open still's front (below the rim).
class _FrontClipper extends CustomClipper<Path> {
  const _FrontClipper();
  @override
  Path getClip(Size size) => RevealGeo.frontPath(size);
  @override
  bool shouldReclip(_FrontClipper oldClipper) => false;
}

class RevealMomentState extends MomentStageState<RevealMoment> {
  final GlobalKey _stage = GlobalKey();
  final GlobalKey _parcel = GlobalKey();
  final GlobalKey _name = GlobalKey();

  @override
  double get totalMs => 2000;

  @override
  late final List<MomentCue> cues = [
    MomentCue(300, () => haptics?.light()),
    MomentCue(700, () => haptics?.medium()),
    MomentCue(900, () {
      final c = centreIn(_parcel, _stage, shift: Offset(0, ParcelGeo.centre.dy * RevealGeo.parcel - RevealGeo.parcel / 2));
      if (c == null) return;
      final floor = topIn(_name, _stage);
      particles.burst(PaperBurst(
        origin: c,
        count: 22,
        speed: 420,
        spread: math.pi * 0.75,
        glints: 6,
        glintRadius: 70,
        floorY: floor == null ? null : floor - 8,
        colours: const [Color(0xFFF4F0E6), Color(0xFFE6D5B2), Color(0xFFF2A93B)],
        seed: 9,
      ));
    }),
  ];

  /// The parcel's pose at [t] ms (public for the frame tests).
  static ParcelPose poseAt(double t) {
    final flaps = [
      for (var i = 0; i < 4; i++) seg(t, 760 + i * 60.0, MotionDurations.emphasized.inMilliseconds.toDouble(), MotionCurves.emphasized),
    ];
    final up = seg(t, 560, 200, MotionCurves.out);
    final down = seg(t, 760, 540, MotionCurves.glide);
    final leak = up * 0.9 - down * 0.4;
    return ParcelPose(flaps: flaps, sealPop: seg(t, 640, 200, MotionCurves.out), leak: leak.clamp(0.0, 1.0));
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(animation: clock, builder: (context, _) => reducedFade(_frame(context)));

  Widget _frame(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = ms;
    final parcelPose = poseAt(t);

    // Pull back 0.94 (300, 120), then two 3 degree wobbles (2 x 160) while it comes back to 1.
    final pull = seg(t, 300, 120, MotionCurves.out) * (1 - seg(t, 420, 200, MotionCurves.out));
    final parcelScale = 1 - 0.06 * pull;
    final wob = (t > 420 && t < 740) ? 3 * math.pi / 180 * math.sin((t - 420) / 160 * math.pi * 2) * (1 - (t - 420) / 640) : 0.0;
    // The Fold climbs 90 dp (celebrate) from 900; its shadow grows from 1000.
    final rise = springSeg(t, 900, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final foldOn = t >= 900;
    final shadow = seg(t, 1000, 300, MotionCurves.out);
    final eyebrowT = seg(t, 300, 300);
    final nameT = seg(t, 1400, MotionDurations.engrave.inMilliseconds.toDouble());
    final lineT = seg(t, 1620, 300, MotionCurves.out);
    final factT = seg(t, 1700, 300, MotionCurves.out);
    final keysT = seg(t, 1900, 100, MotionCurves.out);
    // 0-300 the lamp narrows onto the parcel.
    final narrow = seg(t, 0, 300, MotionCurves.emphasized);

    // The leak sits on the lid's seam (read from the last layout; it is 0 before the parcel is laid out).
    final leakAt = centreIn(_parcel, _stage, shift: Offset(0, (ParcelGeo.centre.dy - 0.5) * RevealGeo.parcel));
    final lamp = LampState(strength: lerpD(1, 0.8, narrow), width: lerpD(1, 0.62, narrow), centreY: 0.34, leak: parcelPose.leak, leakAt: leakAt);

    final stills = ParcelStills.available;
    const p = RevealGeo.parcel;
    final night = colors.isNight;
    // Climb out: the celebrate spring carries the Fold from hidden to standing on the rim (it overshoots
    // a little and settles); a small squash as the boots settle, and the cheer pose at its low point.
    final foldTop = RevealGeo.foldRestTop + RevealGeo.rise * (1 - rise);
    final squash = math.sin(math.pi * seg(t, 1240, 140));
    final foldPose = t >= 1310 ? FoldPose.cheer : FoldPose.idle;
    final openT = seg(t, 700, 60);
    // The open still settles in: 1.04 to 1 over the flaps' beat (760, emphasized 420).
    final openSettle = 1 + 0.04 * (1 - seg(t, 760, MotionDurations.emphasized.inMilliseconds.toDouble(), MotionCurves.emphasized)) * openT;

    Widget parcelLayer(Widget child) => Positioned(
          left: 40,
          top: RevealGeo.headroom,
          width: p,
          height: p,
          child: Transform.rotate(
            angle: wob,
            alignment: Alignment.bottomCenter,
            child: Transform.scale(scale: parcelScale * openSettle, alignment: Alignment.bottomCenter, child: child),
          ),
        );

    final figure = FoldPuppet(key: const ValueKey('k4-fold'), fold: widget.fold, size: RevealGeo.fold, pose: foldPose, large: true, shadow: false, blink: t >= 1500);
    final stage = SizedBox(
      width: p + 80,
      height: RevealGeo.stageHeight,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          parcelLayer(
            stills
                ? _StillParcel(t: t, pose: parcelPose, night: night, key: _parcel)
                : CustomPaint(key: _parcel, painter: ParcelBackPainter(parcelPose, night: night)),
          ),
          // The contact shadow on the rim, under the boots, grows as the Fold stands (1000).
          if (shadow > 0)
            Positioned(
              left: 40 + p / 2 - RevealGeo.fold * 0.3 * shadow,
              width: RevealGeo.fold * 0.6 * shadow,
              top: RevealGeo.headroom + RevealGeo.rimY * p - 7,
              height: 14,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(colors: [Colors.black.withValues(alpha: (night ? 0.34 : 0.22) * shadow), Colors.black.withValues(alpha: 0)]),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
          // Built from the first frame (hidden until 900) so the large still has decoded by the time
          // the Fold climbs: mounting it at 900 showed an empty parcel for the first frames. Clipped at
          // the parcel's floor, so nothing of the Fold shows below the box while it is inside.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: RevealGeo.headroom + 0.86 * p,
            child: Opacity(
              opacity: foldOn ? 1 : 0,
              child: ClipRect(
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      top: foldTop,
                      height: RevealGeo.fold,
                      child: Center(
                        child: Transform(
                          alignment: Alignment.bottomCenter,
                          transform: Matrix4.diagonal3Values(1 + 0.05 * squash, 1 - 0.06 * squash, 1),
                          child: figure,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // The front of the open parcel, over the Fold: it is inside the box until it climbs past the rim.
          if (stills && openT > 0)
            parcelLayer(
              IgnorePointer(
                child: ClipPath(
                  clipper: const _FrontClipper(),
                  child: Opacity(
                    opacity: openT,
                    child: Image.asset(ParcelStills.open, fit: BoxFit.contain, filterQuality: FilterQuality.medium, excludeFromSemantics: true, gaplessPlayback: true),
                  ),
                ),
              ),
            ),
          if (!stills) parcelLayer(IgnorePointer(child: CustomPaint(painter: ParcelFrontPainter(parcelPose, night: night)))),
        ],
      ),
    );

    final body = SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.momentGutter),
      child: Column(
        children: [
          Opacity(opacity: eyebrowT, child: Text(MobV3Copy.newOnShelf, style: type.label.copyWith(color: colors.ink2), textAlign: TextAlign.center)),
          const SizedBox(height: MmSpace.s16),
          Center(child: stage),
          const SizedBox(height: MmSpace.s16),
          KeyedSubtree(key: _name, child: EngraveText(MobV3Copy.foldName(widget.fold), style: type.moment.copyWith(color: colors.ink), t: nameT)),
          const SizedBox(height: MmSpace.s8),
          Opacity(
            opacity: lineT,
            child: Transform.translate(
              offset: Offset(0, (1 - lineT) * 8),
              child: Text(MobV3Copy.foldLine(widget.fold), style: type.lead.copyWith(color: colors.ink), textAlign: TextAlign.center),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          Opacity(
            opacity: factT,
            child: Transform.translate(
              offset: Offset(0, (1 - factT) * 8),
              child: Text(MobV3Copy.revealFact(widget.mobName, widget.fold), style: type.small.copyWith(color: colors.ink2), textAlign: TextAlign.center),
            ),
          ),
          const SizedBox(height: MmSpace.s16),
        ],
      ),
    );

    return MomentFrame(
      stageKey: _stage,
      title: null,
      lamp: lamp,
      playing: playing,
      onSkip: skip,
      onClose: widget.onClose,
      body: body,
      particles: particles,
      keysT: keysT,
      keys: [
        momentKey(MobV3Copy.seeShelf, widget.onShelf, primary: false, key: const ValueKey('k4-shelf')),
        momentKey(MobV3Copy.playAs(widget.fold), widget.onPlayAs, loading: widget.playing, key: const ValueKey('k4-play')),
      ],
    );
  }
}

/// The generated stills (sealed, pop, open), cross-faded on the spec's beats, under the painted flaps.
class _StillParcel extends StatelessWidget {
  const _StillParcel({super.key, required this.t, required this.pose, required this.night});
  final double t;
  final ParcelPose pose;
  final bool night;

  @override
  Widget build(BuildContext context) {
    final pop = seg(t, 640, 60);
    final open = seg(t, 700, 60);
    Widget still(String a, double o) => Opacity(opacity: o, child: Image.asset(a, fit: BoxFit.contain, filterQuality: FilterQuality.medium, gaplessPlayback: true, excludeFromSemantics: true));
    // The stills are the whole parcel (the generated pop still carries the lifting seal and the leak at
    // the seams; the open still its flaps), so nothing is painted under them.
    return Stack(
      fit: StackFit.expand,
      children: [
        if (open < 1) still(ParcelStills.sealed, 1 - pop),
        if (pop > 0 && open < 1) still(ParcelStills.pop, pop),
        if (open > 0) still(ParcelStills.open, open),
      ],
    );
  }
}
