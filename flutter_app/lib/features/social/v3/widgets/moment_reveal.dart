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
abstract final class RevealGeo {
  static const double parcel = 216;
  static const double headroom = 120;
  static const double fold = 168;
  static const double rise = 90;

  /// The Fold's top at rest, in stage coordinates: about 30% of it stays inside the parcel.
  static double get foldRestTop => headroom + ParcelGeo.wallT * parcel + 0.3 * fold - fold;
  static double get stageHeight => headroom + parcel;
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
    final pose = poseAt(t);

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
    final lamp = LampState(strength: lerpD(1, 0.8, narrow), width: lerpD(1, 0.62, narrow), centreY: 0.34, leak: pose.leak, leakAt: leakAt);

    final stills = ParcelStills.available;
    const p = RevealGeo.parcel;
    final night = colors.isNight;
    final foldTop = RevealGeo.foldRestTop + RevealGeo.rise * (1 - rise);
    final stage = SizedBox(
      width: p + 80,
      height: RevealGeo.stageHeight,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 40,
            top: RevealGeo.headroom,
            width: p,
            height: p,
            child: Transform.rotate(
              angle: wob,
              alignment: Alignment.bottomCenter,
              child: Transform.scale(
                scale: parcelScale,
                alignment: Alignment.bottomCenter,
                child: stills
                    ? _StillParcel(t: t, pose: pose, night: night, key: _parcel)
                    : CustomPaint(key: _parcel, painter: ParcelBackPainter(pose, night: night)),
              ),
            ),
          ),
          // The Fold's shadow on the inside of the box.
          if (shadow > 0)
            Positioned(
              left: 40 + p / 2 - p * 0.26 * shadow,
              width: p * 0.52 * shadow,
              top: RevealGeo.headroom + ParcelGeo.wallT * p - 10,
              height: 16,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(colors: [Colors.black.withValues(alpha: 0.35 * shadow), Colors.black.withValues(alpha: 0)]),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
          if (foldOn)
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              height: RevealGeo.headroom + ParcelGeo.wallB * p,
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
                        child: FoldPuppet(key: const ValueKey('k4-fold'), fold: widget.fold, size: RevealGeo.fold, large: true, shadow: false, blink: false),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Positioned(
            left: 40,
            top: RevealGeo.headroom,
            width: p,
            height: p,
            child: IgnorePointer(
              child: Transform.rotate(
                angle: wob,
                alignment: Alignment.bottomCenter,
                child: Transform.scale(
                  scale: parcelScale,
                  alignment: Alignment.bottomCenter,
                  child: CustomPaint(painter: ParcelFrontPainter(pose, night: night, drawWall: !stills)),
                ),
              ),
            ),
          ),
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
    Widget still(String a, double o) => Opacity(opacity: o, child: Image.asset(a, fit: BoxFit.contain, excludeFromSemantics: true));
    return Stack(
      fit: StackFit.expand,
      children: [
        CustomPaint(painter: ParcelBackPainter(pose, night: night)),
        if (open < 1) still(ParcelStills.sealed, 1 - pop),
        if (pop > 0 && open < 1) still(ParcelStills.pop, pop),
        if (open > 0) still(ParcelStills.open, open),
      ],
    );
  }
}
