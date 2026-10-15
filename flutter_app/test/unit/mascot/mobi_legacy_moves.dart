// ignore_for_file: unused_element, public_member_api_docs
import 'dart:math' as math;

import 'package:flutter/animation.dart';

import 'package:mockmob/core/mascot/mobi_acts.dart' show MobiAct, MobiStance;
import 'package:mockmob/core/mascot/mobi_rig.dart';

/// The choreography as it was hand-written before the v2 rig table (frozen 15 Oct 2026). The
/// equivalence test checks the table plays every one of these acts the same, frame by frame.
abstract final class LegacyMoves {
  /// The stance an act leaves Mobi in, or null when it returns to the current one.
  static MobiStance? stanceAfter(MobiAct act) => switch (act) {
        MobiAct.idle => MobiStance.stand,
        MobiAct.think => MobiStance.think,
        MobiAct.point || MobiAct.nudge => MobiStance.point,
        MobiAct.sleepy => MobiStance.sleepy,
        MobiAct.rest => MobiStance.rest,
        MobiAct.read => MobiStance.read,
        MobiAct.loading => MobiStance.loading,
        MobiAct.sleep => MobiStance.sleep,
        MobiAct.listen => MobiStance.listen,
        MobiAct.hello ||
        MobiAct.cheer ||
        MobiAct.celebrate ||
        MobiAct.oops ||
        MobiAct.appear ||
        MobiAct.correct ||
        MobiAct.encourage ||
        MobiAct.proud ||
        MobiAct.wake =>
          MobiStance.stand,
        MobiAct.wave || MobiAct.walk => MobiStance.stand,
        MobiAct.talk || MobiAct.nod || MobiAct.tilt || MobiAct.startle || MobiAct.brace || MobiAct.relief => null,
        _ => null,
      };

  static const Set<MobiAct> _celebrates = {MobiAct.cheer, MobiAct.celebrate, MobiAct.proud, MobiAct.hello};

  /// Acts that answer a moment and then give way: under reduced motion their still pose shows
  /// for the act's length, then the stance again.
  static const Set<MobiAct> reactions = {
    MobiAct.correct,
    MobiAct.encourage,
    MobiAct.wake,
    MobiAct.nod,
    MobiAct.tilt,
    MobiAct.wave,
    MobiAct.startle,
    MobiAct.brace,
    MobiAct.relief,
    MobiAct.walk,
  };

  /// Whether [act] is held: it changes how Mobi stands until the next act (the others play once).
  static bool isHeld(MobiAct act) => switch (act) {
        MobiAct.idle ||
        MobiAct.think ||
        MobiAct.point ||
        MobiAct.sleepy ||
        MobiAct.rest ||
        MobiAct.read ||
        MobiAct.loading ||
        MobiAct.sleep ||
        MobiAct.nudge ||
        MobiAct.listen =>
          true,
        _ => false,
      };

  /// Whether [act] shows a still key pose under reduced motion (a reaction or a celebration,
  /// held for the act's length, then the stance). Held acts simply give their stance.
  static bool showsStillPose(MobiAct act) => reactions.contains(act) || _celebrates.contains(act);

  /// How long an act runs, in seconds ([MobiAct.talk] runs as long as its line).
  static double duration(MobiAct act) => switch (act) {
        MobiAct.idle => 0.5,
        MobiAct.appear => 0.75,
        MobiAct.hello => 1.85,
        MobiAct.talk => 1.6,
        MobiAct.cheer => 1.2,
        MobiAct.celebrate => 2.0,
        MobiAct.think => 0.8,
        MobiAct.point => 0.6,
        MobiAct.sleepy => 2.2,
        MobiAct.oops => 1.3,
        MobiAct.rest => 0.9,
        MobiAct.read => 0.7,
        MobiAct.correct => 1.15,
        MobiAct.encourage => 1.45,
        MobiAct.loading => 0.6,
        MobiAct.sleep => 1.7,
        MobiAct.nudge => 1.05,
        MobiAct.proud => 2.2,
        MobiAct.listen => 0.55,
        MobiAct.wake => 1.2,
        MobiAct.nod => 0.8,
        MobiAct.tilt => 1.1,
        MobiAct.wave => 1.5,
        MobiAct.startle => 0.95,
        MobiAct.brace => 0.9,
        MobiAct.relief => 1.4,
        MobiAct.walk => 1.0,
        _ => 1.0,
      };

  /// How long, and with what curve, Mobi moves into [s].
  static (double, Curve) stanceBlend(MobiStance s) => switch (s) {
        MobiStance.point => (0.42, Curves.easeOutBack),
        MobiStance.rest => (0.7, Curves.easeOutBack),
        MobiStance.think || MobiStance.loading => (0.5, Curves.easeOutCubic),
        MobiStance.sleep => (1.2, Curves.easeInOutCubic),
        MobiStance.listen => (0.5, Curves.easeOutCubic),
        _ => (0.45, Curves.easeInOutCubic),
      };

  /// Mittens on hips, elbows out (proud, point's free arm).
  static const MobiArm hip = MobiArm(angle: 0.5, bend: -0.7, reach: 0.95);
  static const MobiArm akimbo = MobiArm(angle: 0.16, bend: 1.75, reach: 0.86, twist: 0.7);

  /// The pointing arm's reach, and the free arm's hip, kept tight so the finger stays inside the
  /// paint box (140 design units wide) even in the nudge's jab.
  static const double pointReach = 0.86;
  static const MobiArm pointHip = MobiArm(angle: 0.3, bend: -0.6, reach: 0.88);

  /// Fists up at the chest ("you've got this").
  static const MobiArm fist = MobiArm(angle: -0.72, bend: 1.2, front: 1, reach: 0.9, twist: -0.45);

  /// Mitten to chin.
  static const MobiArm chin = MobiArm(angle: -1.3, bend: 1.3, front: 1, reach: 1.04, twist: -0.55);

  /// The resting rig of a stance. [pointAngle] and [pointSide] aim the pointing arm.
  static MobiRig stance(MobiStance s, {double pointAngle = 1.5, double pointSide = 1}) {
    switch (s) {
      case MobiStance.stand:
        return const MobiRig();
      case MobiStance.point:
        final pointing = MobiArm(angle: pointAngle, bend: 0.06, point: 1, reach: pointReach);
        return MobiRig(
          armR: pointSide > 0 ? pointing : pointHip,
          armL: pointSide > 0 ? pointHip : pointing,
          // Weight shifted away from the finger, so the reach stays inside the paint box.
          x: pointSide > 0 ? -11 : 7.5,
          tilt: 0.035 * pointSide,
          lookX: 0.75 * pointSide,
          lookY: (math.cos(pointAngle) * 0.9).clamp(-1.0, 1.0),
        );
      case MobiStance.think:
        return const MobiRig(
          armL: chin,
          armR: MobiArm(angle: 0.55, bend: -0.75, reach: 0.95),
          eyeR: MobiEye(open: 0.42),
          lookX: 0.45,
          lookY: -0.7,
          tilt: -0.04,
          glow: 0.3,
        );
      case MobiStance.loading:
        return const MobiRig(
          armL: chin,
          armR: hip,
          eyeL: MobiEye(lid: 0.18),
          eyeR: MobiEye(lid: 0.18),
          lookY: -0.45,
          tilt: -0.02,
          glow: 0.45,
        );
      case MobiStance.sleepy:
        return const MobiRig(
          eyeL: MobiEye(open: 0.3),
          eyeR: MobiEye(open: 0.3),
          armL: MobiArm(angle: 0.14, bend: 0.12),
          armR: MobiArm(angle: 0.12, bend: 0.12),
          tilt: -0.035,
          squash: -0.015,
          y: 1,
          lookY: 0.35,
          antenna: 0.32,
        );
      case MobiStance.sleep:
        return const MobiRig(
          y: 13,
          squash: -0.035,
          tilt: -0.075,
          eyeL: MobiEye(open: 0.04),
          eyeR: MobiEye(open: 0.04),
          armL: MobiArm(angle: 0.32, bend: 0.05, reach: 0.95),
          armR: MobiArm(angle: 0.4, bend: 0.05, reach: 0.95),
          bootL: MobiBoot(dx: -7.5, dy: 1.5, rot: 0.26),
          bootR: MobiBoot(dx: 7, dy: 1.5, rot: 0.2),
          lookY: 0.5,
          antenna: 0.5,
        );
      case MobiStance.rest:
        return const MobiRig(
          y: 12,
          squash: -0.02,
          armL: MobiArm(angle: 0.55, bend: 0.1, reach: 0.95),
          armR: MobiArm(angle: 0.55, bend: 0.1, reach: 0.95),
          bootL: MobiBoot(dx: -9, dy: -1, rot: 0.28),
          bootR: MobiBoot(dx: 9, dy: -1, rot: 0.28),
          eyeL: MobiEye(open: 0.82),
          eyeR: MobiEye(open: 0.82),
          lookY: 0.15,
        );
      case MobiStance.read:
        return const MobiRig(
          sheet: 1,
          armL: MobiArm(angle: -0.82, bend: 0.5, front: 1, reach: 0.9),
          armR: MobiArm(angle: -0.82, bend: 0.5, front: 1, reach: 0.95),
          lookY: 0.75,
          lookX: -0.1,
          tilt: 0.02,
        );
      case MobiStance.listen:
        // A clear lean (0.12 rad) toward the cupped mitten at the side of the head, eyes wide:
        // unmistakably someone listening, not someone standing.
        return const MobiRig(
          tilt: -0.12,
          x: 5,
          y: 0.5,
          eyeL: MobiEye(open: 1.1, smile: 0.2),
          eyeR: MobiEye(open: 1.1, smile: 0.2),
          armL: MobiArm(angle: 2.3, bend: 0.2, reach: 0.94, front: 1, twist: -0.75),
          armR: MobiArm(angle: 0.2, bend: 0.3, reach: 0.98),
          lookX: -0.35,
          lookY: 0.15,
        );
    }
  }

  // ---- Envelopes ---------------------------------------------------------------------------

  /// How much shorter an arm reaches while it sweeps through the sideways swing (progress [w] 0 to
  /// 1, deepest halfway): a bent elbow, so a mitten raised from the hip never goes out wide.
  static double swingDip(double w, double depth) => depth * math.sin(math.pi * w.clamp(0.0, 1.0));

  /// Eased progress of [t] through [a] to [b].
  static double ease(double t, double a, double b, [Curve curve = Curves.easeInOutCubic]) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    return curve.transform((t - a) / (b - a));
  }

  /// A smooth hump from 0 at [a] to 1 at the middle and 0 at [b].
  static double bump(double t, double a, double b) {
    if (t <= a || t >= b) return 0;
    return math.sin(math.pi * (t - a) / (b - a));
  }

  /// A ballistic hop of [height] between [a] and [b] (negative is up).
  static double hop(double t, double a, double b, double height) {
    if (t <= a || t >= b) return 0;
    final p = (t - a) / (b - a);
    return -height * 4 * p * (1 - p);
  }

  /// Progress of an effect running from [a] to [b], or -1 outside it.
  static double span(double t, double a, double b) => (t < a || t > b) ? -1 : (t - a) / (b - a);

  /// Raised arms, both up and a little apart.
  static MobiRig _armsUp(MobiRig r, double w, {double wiggle = 0}) => r.copyWith(
        armL: MobiArm.lerp(r.armL, MobiArm(angle: 2.45 + wiggle, bend: -0.9, reach: 1.5, twist: 0.1), w),
        armR: MobiArm.lerp(r.armR, MobiArm(angle: 2.45 - wiggle, bend: -0.9, reach: 1.5, twist: 0.1), w),
      );

  static MobiRig _withBoots(MobiRig r, double lift, double tuck) => r.copyWith(
        bootL: r.bootL.copyWith(dy: r.bootL.dy + lift, dx: r.bootL.dx + 2 * tuck, rot: r.bootL.rot - 0.18 * tuck),
        bootR: r.bootR.copyWith(dy: r.bootR.dy + lift, dx: r.bootR.dx - 2 * tuck, rot: r.bootR.rot - 0.18 * tuck),
      );

  /// Boots spread a little on a landing squash.
  static MobiRig _spread(MobiRig r, double k) => r.copyWith(
        bootL: r.bootL.copyWith(dx: r.bootL.dx - 1.8 * k, rot: r.bootL.rot + 0.06 * k),
        bootR: r.bootR.copyWith(dx: r.bootR.dx + 1.8 * k, rot: r.bootR.rot + 0.06 * k),
      );

  static MobiEye _eye(MobiEye e, {double happy = 0, double smile = 0, double openK = 1}) =>
      e.copyWith(happy: math.max(e.happy, happy), smile: math.max(e.smile, smile), open: e.open * openK);

  // ---- Acts --------------------------------------------------------------------------------

  /// Mobi at time [t] (seconds) into [act], starting from and returning to [base].
  static MobiRig act(MobiAct act, double t, MobiRig base) => switch (act) {
        MobiAct.appear => _appear(t, base),
        MobiAct.hello => _hello(t, base),
        MobiAct.talk => talk(t, base, 1),
        MobiAct.cheer => _cheer(t, base),
        MobiAct.celebrate => _celebrate(t, base),
        MobiAct.oops => _oops(t, base),
        MobiAct.sleepy => _yawn(t, base),
        MobiAct.think => base.copyWith(tilt: base.tilt - 0.05 * bump(t, 0.1, 0.8)),
        MobiAct.point => base.copyWith(tilt: base.tilt + 0.06 * bump(t, 0.05, 0.55) * base.lookX.sign),
        MobiAct.rest => base.copyWith(squash: base.squash - 0.05 * bump(t, 0.45, 0.85)),
        MobiAct.read || MobiAct.idle => base,
        MobiAct.correct => _correct(t, base),
        MobiAct.encourage => _encourage(t, base),
        MobiAct.loading => base.copyWith(glow: base.glow + 0.5 * bump(t, 0, 0.6), y: base.y - 1.2 * bump(t, 0.05, 0.4)),
        MobiAct.sleep => _nodOff(t, base),
        MobiAct.nudge => _nudge(t, base),
        MobiAct.proud => _proud(t, base),
        MobiAct.listen => base.copyWith(y: base.y + 1.6 * bump(t, 0.1, 0.5), lookY: base.lookY + 0.25 * bump(t, 0.1, 0.5), tilt: base.tilt - 0.03 * bump(t, 0.05, 0.5)),
        MobiAct.wake => _wake(t, base),
        MobiAct.nod => _nod(t, base),
        MobiAct.tilt => _tilt(t, base),
        MobiAct.wave => _wave(t, base),
        MobiAct.startle => _startle(t, base),
        MobiAct.brace => _brace(t, base),
        MobiAct.relief => _relief(t, base),
        MobiAct.walk => walk(t, base, duration(MobiAct.walk)),
        _ => base,
      };

  static MobiRig _appear(double t, MobiRig b) {
    final e = ease(t, 0, 0.55, Curves.easeOutBack);
    final land = bump(t, 0.38, 0.62);
    // The eyes blink on: shut while rising, then open with a small widening overshoot.
    final eyesOn = Curves.easeOutBack.transform(ease(t, 0.14, 0.36, Curves.linear));
    final k = 0.04 + 0.96 * eyesOn;
    return b.copyWith(
      y: b.y + 10 * (1 - e) + 1.2 * land,
      squash: b.squash - 0.07 * (1 - ease(t, 0, 0.4)) + 0.05 * bump(t, 0.12, 0.4) - 0.05 * land,
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * k),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * k),
      glint: span(t, 0.3, 0.75),
    );
  }

  static MobiRig _hello(double t, MobiRig b) {
    // Anticipation: a small dip and a lean away before the arm comes up.
    final antic = bump(t, 0, 0.2);
    // The arm lifts and lowers in one smooth swing (no step in speed from frame to frame).
    final up = ease(t, 0.08, 0.56, Curves.easeInOutSine);
    final down = ease(t, 1.3, 1.85, Curves.easeInOutSine);
    final w = up * (1 - down);
    final waveEnv = ease(t, 0.34, 0.52) * (1 - ease(t, 1.12, 1.32));
    final osc = math.sin((t - 0.34) * math.pi * 2 * 2.4) * waveEnv;
    const wave = MobiArm(angle: 2.7, bend: -1.2, reach: 1.38);
    // The arm sweeps up short and only stretches to its full reach once it is overhead: swung
    // out sideways at full length the mitten would leave the paint box on the way up.
    final stretch = w.sign * math.pow(w.abs(), 2.6).toDouble();
    final arm = MobiArm.lerp(b.armL, wave, w).copyWith(reach: b.armL.reach + (wave.reach - b.armL.reach) * stretch - swingDip(w, 0.3));
    final happy = ease(t, 0.16, 0.36) * (1 - ease(t, 1.34, 1.7));
    final rise = math.max(0.0, w);
    return b.copyWith(
      armL: arm.copyWith(angle: arm.angle + 0.13 * osc, twist: arm.twist + 0.6 * osc),
      // The weight eases to the right as the left arm goes up and out, so the wave stays in the box.
      x: b.x + 6 * math.min(1.0, rise * 1.4),
      tilt: b.tilt + 0.06 * rise - 0.03 * antic + 0.018 * osc,
      y: b.y + 1.4 * antic - 1.6 * bump(t, 0.16, 0.56),
      squash: b.squash - 0.035 * antic + 0.02 * bump(t, 0.18, 0.5),
      eyeL: b.eyeL.copyWith(happy: happy),
      eyeR: b.eyeR.copyWith(happy: happy),
      lookX: b.lookX * (1 - rise),
      lookY: b.lookY * (1 - rise),
      bootR: b.bootR.copyWith(rot: b.bootR.rot - 0.05 * rise),
      glint: span(t, 0.22, 0.72),
    );
  }

  /// Talking at [t] with strength [w] (0 to 1, for fading in and out).
  static MobiRig talk(double t, MobiRig b, double w) {
    final beat = math.sin(t * math.pi * 3.4).abs();
    final syll = math.sin(t * math.pi * 1.7 + 0.6);
    final gesture = math.pow(math.max(0, math.sin(t * math.pi * 2 * 0.62 - 0.4)), 2).toDouble();
    final freeArm = b.armR.front < 0.5 && b.armR.point < 0.5;
    final eyeBeat = 1 - 0.1 * beat * w;
    return b.copyWith(
      y: b.y - 1.5 * beat * w,
      squash: b.squash + 0.016 * beat * w,
      tilt: b.tilt + 0.025 * syll * w,
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * eyeBeat),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * eyeBeat),
      armR: freeArm ? b.armR.copyWith(angle: b.armR.angle + 0.75 * gesture * w, bend: b.armR.bend - 0.4 * gesture * w, twist: b.armR.twist - 0.4 * gesture * w) : b.armR,
    );
  }

  static MobiRig _cheer(double t, MobiRig b) {
    final antic = ease(t, 0, 0.14, Curves.easeOut) * (1 - ease(t, 0.14, 0.22));
    final air = hop(t, 0.2, 0.64, 20);
    final land = bump(t, 0.62, 0.84);
    final up = ease(t, 0.1, 0.3, Curves.easeOutBack) * (1 - ease(t, 0.85, 1.2));
    final happy = ease(t, 0.06, 0.2) * (1 - ease(t, 1.0, 1.2));
    var r = _armsUp(b, up, wiggle: 0.12 * math.sin(t * math.pi * 6) * up);
    r = r.copyWith(
      y: b.y + 3.5 * antic + air + 2.5 * land,
      squash: b.squash - 0.09 * antic + 0.07 * bump(t, 0.18, 0.42) - 0.08 * land,
      eyeL: b.eyeL.copyWith(happy: happy),
      eyeR: b.eyeR.copyWith(happy: happy),
      lookX: b.lookX * (1 - up),
      lookY: b.lookY * (1 - up) - 0.2 * up,
      glow: b.glow + 0.8 * bump(t, 0.15, 0.9),
    );
    return _spread(_withBoots(r, air * 0.92, bump(t, 0.22, 0.62)), land);
  }

  static MobiRig _celebrate(double t, MobiRig b) {
    final antic = ease(t, 0, 0.16, Curves.easeOut) * (1 - ease(t, 0.16, 0.24));
    final air = hop(t, 0.22, 0.86, 34) + hop(t, 1.0, 1.28, 8);
    final land = bump(t, 0.84, 1.02) + 0.6 * bump(t, 1.26, 1.42);
    final up = ease(t, 0.12, 0.32, Curves.easeOutBack) * (1 - ease(t, 1.5, 1.95));
    final happy = ease(t, 0.06, 0.2) * (1 - ease(t, 1.75, 2.0));
    var r = _armsUp(b, up, wiggle: 0.18 * math.sin(t * math.pi * 7) * up);
    r = r.copyWith(
      y: b.y + 4 * antic + air + 3 * land,
      squash: b.squash - 0.1 * antic + 0.09 * bump(t, 0.2, 0.46) - 0.09 * land,
      tilt: b.tilt + 0.07 * math.sin(t * math.pi * 3) * bump(t, 0.3, 1.0),
      eyeL: b.eyeL.copyWith(happy: happy),
      eyeR: b.eyeR.copyWith(happy: happy),
      lookX: b.lookX * (1 - up),
      lookY: b.lookY * (1 - up) - 0.3 * up,
      burst: t < 0.26 || t > 1.7 ? -1 : (t - 0.26) / 1.44,
      glow: b.glow + bump(t, 0.2, 1.6),
      glint: span(t, 0.4, 0.9),
    );
    return _spread(_withBoots(r, air * 0.9, bump(t, 0.24, 0.84) + bump(t, 1.0, 1.28)), land);
  }

  static MobiRig _oops(double t, MobiRig b) {
    final s = ease(t, 0, 0.26, Curves.easeOutBack) * (1 - ease(t, 0.95, 1.3));
    final droop = ease(t, 0.15, 0.35) * (1 - ease(t, 0.8, 1.15));
    const shrug = MobiArm(angle: 0.72, bend: -0.55, reach: 0.96, twist: -1.3);
    return b.copyWith(
      armL: MobiArm.lerp(b.armL, shrug, s),
      armR: MobiArm.lerp(b.armR, shrug, s),
      squash: b.squash - 0.035 * s,
      y: b.y + 1.2 * s,
      tilt: b.tilt + 0.04 * s * math.sin(t * math.pi * 2 * 1.4),
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * (1 - 0.3 * droop)),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * (1 - 0.3 * droop)),
      lookX: b.lookX - 0.45 * s,
      lookY: b.lookY + 0.75 * droop,
    );
  }

  /// A lazy stretch: the mittens drift up and out (a wide, loose reach, never a cheer's fists),
  /// the eyes sink shut at the top of it, and the arms are already coming down, easing in step
  /// with the lids, by the time the head nods off.
  static const MobiArm _stretch = MobiArm(angle: 2.1, bend: -0.5, reach: 1.28, twist: 0.2);

  static MobiRig _yawn(double t, MobiRig b) {
    final s = ease(t, 0.05, 0.42) * (1 - ease(t, 0.5, 1.25));
    final shut = ease(t, 0.26, 0.5) * (1 - ease(t, 1.35, 1.8));
    MobiArm lift(MobiArm a) => MobiArm.lerp(a, _stretch, s * 0.85);
    return b.copyWith(
      armL: lift(b.armL),
      armR: lift(b.armR),
      squash: b.squash + 0.06 * s,
      y: b.y - 2.2 * s,
      tilt: b.tilt - 0.04 * s,
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * (1 - 0.9 * shut)),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * (1 - 0.9 * shut)),
      bootL: b.bootL.copyWith(rot: b.bootL.rot - 0.1 * s),
      bootR: b.bootR.copyWith(rot: b.bootR.rot - 0.1 * s),
    );
  }

  /// A right answer: crouch, a small hop with one mitten pumping up, a nod on landing, smiling
  /// eyes, and one answer bubble inking beside the head.
  static MobiRig _correct(double t, MobiRig b) {
    final crouch = bump(t, 0, 0.16);
    final air = hop(t, 0.12, 0.44, 12);
    final land = bump(t, 0.42, 0.6);
    final nod = bump(t, 0.6, 0.84);
    final pump = ease(t, 0.08, 0.34, Curves.easeOutBack) * (1 - ease(t, 0.72, 1.05));
    // The mitten goes up and over the shoulder (a bent elbow on the way, so it never swings out
    // wide past the paint box), then stretches overhead.
    const pumpTo = MobiArm(angle: 2.85, bend: -0.9, reach: 1.08, twist: 0.15);
    final lifted = MobiArm.lerp(b.armR, pumpTo, pump);
    final pumpArm = lifted.copyWith(reach: lifted.reach - swingDip(pump, 0.65));
    final happy = ease(t, 0.06, 0.18) * (1 - ease(t, 0.88, 1.12));
    final r = b.copyWith(
      y: b.y + 2.4 * crouch + air + 1.8 * land + 1.5 * nod,
      squash: b.squash - 0.07 * crouch + 0.06 * bump(t, 0.12, 0.3) - 0.06 * land - 0.02 * nod,
      tilt: b.tilt + 0.04 * pump,
      armR: pumpArm,
      eyeL: _eye(b.eyeL, happy: happy),
      eyeR: _eye(b.eyeR, happy: happy),
      lookX: b.lookX * (1 - happy),
      lookY: b.lookY * (1 - happy) + 0.35 * nod,
      glow: b.glow + 0.9 * bump(t, 0.08, 0.8),
      bubble: span(t, 0.12, 1.1),
    );
    return _spread(_withBoots(r, air * 0.9, bump(t, 0.14, 0.42)), land);
  }

  /// After a wrong answer: a breath in, a lean toward the student, one "come on" pump of the
  /// mitten, two small nods, warm smiling eyes.
  static MobiRig _encourage(double t, MobiRig b) {
    final inhale = bump(t, 0, 0.3);
    final lean = ease(t, 0.12, 0.42, Curves.easeOutBack) * (1 - ease(t, 1.1, 1.45));
    final raise = ease(t, 0.14, 0.4, Curves.easeOutBack) * (1 - ease(t, 1.0, 1.4));
    // Two short pumps of both fists, the second smaller.
    final pump = bump(t, 0.46, 0.64) + 0.7 * bump(t, 0.64, 0.82);
    final nods = bump(t, 0.5, 0.68) + 0.7 * bump(t, 0.68, 0.86);
    final warm = ease(t, 0.1, 0.3) * (1 - ease(t, 1.15, 1.45));
    MobiArm fisted(MobiArm from) {
      final a = MobiArm.lerp(from, fist, raise);
      return a.copyWith(angle: a.angle - 0.14 * pump, bend: a.bend + 0.12 * pump, reach: a.reach - 0.05 * pump);
    }

    return b.copyWith(
      squash: b.squash + 0.03 * inhale - 0.025 * nods,
      y: b.y - 1.2 * inhale + 1.0 * lean + 1.6 * nods,
      tilt: b.tilt + 0.03 * lean,
      armR: fisted(b.armR),
      armL: fisted(b.armL),
      eyeL: _eye(b.eyeL, smile: 0.62 * warm, openK: 1 + 0.06 * warm),
      eyeR: _eye(b.eyeR, smile: 0.62 * warm, openK: 1 + 0.06 * warm),
      lookX: b.lookX * (1 - warm),
      lookY: b.lookY * (1 - warm) + 0.1 * warm + 0.22 * nods,
      glow: b.glow + 0.4 * bump(t, 0.3, 1.2),
    );
  }

  /// Settling into sleep: a small yawn, then the head nods off as Mobi sits.
  static MobiRig _nodOff(double t, MobiRig b) {
    final yawn = bump(t, 0, 0.8);
    final dip = bump(t, 0.9, 1.5);
    var r = _armsUp(b, 0.45 * yawn);
    r = r.copyWith(
      squash: r.squash + 0.04 * yawn - 0.03 * dip,
      tilt: r.tilt - 0.04 * dip,
      y: r.y + 1.5 * dip,
    );
    return r;
  }

  /// Two short jabs at the target with a lean toward it, then the point holds.
  static MobiRig _nudge(double t, MobiRig b) {
    final side = b.lookX.sign == 0 ? 1.0 : b.lookX.sign;
    final pullBack = bump(t, 0.28, 0.4);
    final jab = bump(t, 0.38, 0.56) + 0.8 * bump(t, 0.6, 0.78);
    final smile = ease(t, 0.3, 0.45) * (1 - ease(t, 0.85, 1.05));
    // The jab is short (and the body gives way to it) so the finger never leaves the paint box.
    MobiArm push(MobiArm a) => a.point < 0.5 ? a : a.copyWith(reach: a.reach - 0.06 * pullBack + 0.05 * jab, bend: a.bend - 0.1 * jab);
    return b.copyWith(
      armL: push(b.armL),
      armR: push(b.armR),
      tilt: b.tilt + side * (0.045 * jab - 0.02 * pullBack),
      x: b.x - side * 0.6 * jab,
      eyeL: _eye(b.eyeL, smile: 0.75 * smile),
      eyeR: _eye(b.eyeR, smile: 0.75 * smile),
    );
  }

  /// A milestone: dip, stretch tall, mittens to hips, chin up, glints and a visor glint.
  static MobiRig _proud(double t, MobiRig b) {
    final dip = bump(t, 0, 0.22);
    final tall = ease(t, 0.16, 0.5, Curves.easeOutBack) * (1 - ease(t, 1.75, 2.2));
    final hips = ease(t, 0.12, 0.42, Curves.easeOutBack) * (1 - ease(t, 1.7, 2.15));
    final sway = math.sin((t - 0.5) * math.pi * 1.6) * ease(t, 0.5, 0.8) * (1 - ease(t, 1.5, 1.8));
    return b.copyWith(
      y: b.y + 2.2 * dip - 2.4 * tall,
      squash: b.squash - 0.06 * dip + 0.05 * tall,
      tilt: b.tilt - 0.02 * tall + 0.022 * sway,
      armL: MobiArm.lerp(b.armL, akimbo, hips),
      armR: MobiArm.lerp(b.armR, akimbo, hips),
      eyeL: _eye(b.eyeL, happy: ease(t, 0.3, 0.5) * (1 - ease(t, 1.7, 2.1))),
      eyeR: _eye(b.eyeR, happy: ease(t, 0.3, 0.5) * (1 - ease(t, 1.7, 2.1))),
      lookX: b.lookX * (1 - tall) + 0.12 * tall,
      lookY: b.lookY * (1 - tall) - 0.5 * tall,
      bootL: b.bootL.copyWith(rot: b.bootL.rot + 0.08 * tall, dx: b.bootL.dx - 1.5 * tall),
      bootR: b.bootR.copyWith(rot: b.bootR.rot + 0.08 * tall, dx: b.bootR.dx + 1.5 * tall),
      glow: b.glow + 0.7 * bump(t, 0.3, 1.9),
      sparkle: span(t, 0.36, 1.86),
      glint: span(t, 0.42, 0.95),
    );
  }

  /// Woken: the eyes snap open wide, a startled hop with the mittens flung out and the bulb
  /// flashing, a landing squash, a quick look left and right, then a happy blink.
  static MobiRig _wake(double t, MobiRig b) {
    final startle = ease(t, 0, 0.07, Curves.easeOut) * (1 - ease(t, 0.42, 0.7));
    final air = hop(t, 0.05, 0.34, 9);
    final land = bump(t, 0.32, 0.5);
    final fling = ease(t, 0.02, 0.12, Curves.easeOut) * (1 - ease(t, 0.36, 0.66, Curves.easeOutBack));
    final round = bump(t, 0.5, 0.74) - bump(t, 0.74, 0.98);
    final happy = ease(t, 0.98, 1.06) * (1 - ease(t, 1.1, 1.2));
    // The eyes do not wait for the stance blend: they are open the moment Mobi wakes.
    MobiEye eye(MobiEye e) {
      final open = e.open + (1.24 - e.open) * startle;
      final settled = math.max(open, ease(t, 0, 0.08));
      return e.copyWith(open: settled, happy: math.max(e.happy, happy), lid: e.lid * (1 - startle));
    }

    const flung = MobiArm(angle: 1.2, bend: -0.6, reach: 1.15, twist: -0.6);
    final r = b.copyWith(
      y: b.y + air + 2.2 * land,
      squash: b.squash + 0.08 * bump(t, 0.02, 0.18) - 0.07 * land,
      tilt: b.tilt - 0.04 * bump(t, 0.02, 0.22) + 0.015 * round,
      armL: MobiArm.lerp(b.armL, flung, fling),
      armR: MobiArm.lerp(b.armR, flung, fling),
      eyeL: eye(b.eyeL),
      eyeR: eye(b.eyeR),
      lookX: b.lookX + 0.62 * round,
      lookY: b.lookY * (1 - startle) - 0.12 * startle,
      glow: b.glow + 0.85 * bump(t, 0, 0.5),
    );
    return _spread(_withBoots(r, air * 0.85, bump(t, 0.06, 0.34)), land);
  }

  // ---- Emotions (15 Oct 2026) --------------------------------------------------------------

  /// Two small dips of the head, the second smaller, eyes smiling: "got it".
  static MobiRig _nod(double t, MobiRig b) {
    final nods = bump(t, 0.04, 0.34) + 0.6 * bump(t, 0.34, 0.62);
    final warm = ease(t, 0, 0.16) * (1 - ease(t, 0.55, 0.8));
    return b.copyWith(
      y: b.y + 2.4 * nods,
      squash: b.squash - 0.03 * nods,
      tilt: b.tilt + 0.012 * nods,
      lookY: b.lookY * (1 - warm) + 0.38 * nods,
      lookX: b.lookX * (1 - warm),
      eyeL: _eye(b.eyeL, smile: 0.7 * warm),
      eyeR: _eye(b.eyeR, smile: 0.7 * warm),
      antenna: b.antenna - 0.08 * nods,
    );
  }

  /// A curious tilt: the lean comes in on an overshoot, holds, and eases back.
  static MobiRig _tilt(double t, MobiRig b) {
    final side = b.lookX < -0.1 ? -1.0 : 1.0;
    final lean = ease(t, 0, 0.32, Curves.easeOutBack) * (1 - ease(t, 0.78, 1.1));
    final wide = ease(t, 0.04, 0.2) * (1 - ease(t, 0.8, 1.05));
    return b.copyWith(
      tilt: b.tilt + 0.15 * side * lean,
      x: b.x + 2.5 * side * lean,
      y: b.y - 0.8 * lean,
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * (1 + 0.1 * wide), lid: b.eyeL.lid * (1 - wide)),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * (1 + 0.16 * wide), lid: b.eyeR.lid * (1 - wide)),
      lookX: b.lookX + 0.25 * side * lean,
      lookY: b.lookY - 0.3 * lean,
      antenna: b.antenna - 0.12 * side * lean,
      armL: b.armL.copyWith(angle: b.armL.angle + 0.08 * lean),
      armR: b.armR.copyWith(angle: b.armR.angle + 0.08 * lean),
    );
  }

  /// Goodbye: the right mitten is up in 320 ms, three easy waves, a small bow, and down.
  static MobiRig _wave(double t, MobiRig b) {
    final up = ease(t, 0, 0.32, Curves.easeOutCubic);
    final down = ease(t, 1.12, 1.5, Curves.easeInOutSine);
    final w = up * (1 - down);
    final waveEnv = ease(t, 0.26, 0.4) * (1 - ease(t, 0.98, 1.16));
    final osc = math.sin((t - 0.26) * math.pi * 2 * 2.6) * waveEnv;
    const wave = MobiArm(angle: 2.7, bend: -1.2, reach: 1.34);
    final stretch = math.pow(w, 2.6).toDouble();
    final arm = MobiArm.lerp(b.armR, wave, w).copyWith(reach: b.armR.reach + (wave.reach - b.armR.reach) * stretch - swingDip(w, 0.3));
    final bow = bump(t, 0.95, 1.4);
    final warm = ease(t, 0.1, 0.3) * (1 - ease(t, 1.2, 1.5));
    return b.copyWith(
      armR: arm.copyWith(angle: arm.angle - 0.14 * osc, twist: arm.twist - 0.6 * osc),
      // The weight eases left as the right arm goes up, so the wave stays inside the paint box.
      x: b.x - 6 * math.min(1.0, w * 1.4),
      tilt: b.tilt - 0.06 * w - 0.018 * osc,
      y: b.y + 2.2 * bow,
      squash: b.squash - 0.02 * bow,
      lookX: b.lookX * (1 - w),
      lookY: b.lookY * (1 - w) + 0.3 * bow,
      eyeL: _eye(b.eyeL, smile: 0.75 * warm),
      eyeR: _eye(b.eyeR, smile: 0.75 * warm),
    );
  }

  /// Ticklish: a jolt with wide eyes and flung mittens, then a giggling wiggle, happy eyes.
  static MobiRig _startle(double t, MobiRig b) {
    final jolt = ease(t, 0, 0.06, Curves.easeOut) * (1 - ease(t, 0.2, 0.38));
    final air = hop(t, 0.02, 0.26, 7);
    final land = bump(t, 0.24, 0.38);
    final fling = ease(t, 0, 0.08, Curves.easeOut) * (1 - ease(t, 0.24, 0.5, Curves.easeOutBack));
    final giggle = math.sin((t - 0.34) * math.pi * 2 * 4.2) * ease(t, 0.34, 0.42) * (1 - ease(t, 0.72, 0.92));
    final happy = ease(t, 0.3, 0.4) * (1 - ease(t, 0.76, 0.95));
    MobiEye eye(MobiEye e) {
      final wide = e.copyWith(open: e.open + (1.26 - e.open) * jolt, lid: e.lid * (1 - jolt));
      return _eye(wide, happy: happy);
    }

    const flung = MobiArm(angle: 1.05, bend: -0.5, reach: 1.1, twist: -0.6);
    final r = b.copyWith(
      y: b.y + air + 1.8 * land,
      squash: b.squash + 0.07 * bump(t, 0, 0.16) - 0.06 * land - 0.015 * giggle.abs(),
      tilt: b.tilt + 0.05 * giggle,
      x: b.x + 1.2 * giggle,
      armL: MobiArm.lerp(b.armL, flung, fling),
      armR: MobiArm.lerp(b.armR, flung, fling),
      eyeL: eye(b.eyeL),
      eyeR: eye(b.eyeR),
      lookY: b.lookY * (1 - jolt) - 0.2 * jolt,
      glow: b.glow + 0.7 * bump(t, 0, 0.4),
    );
    return _spread(_withBoots(r, air * 0.85, bump(t, 0.02, 0.26)), land);
  }

  /// Anticipation: a dip with fists drawn in and wide eyes, held, then a small rise back.
  static MobiRig _brace(double t, MobiRig b) {
    final dip = ease(t, 0, 0.22, Curves.easeOutCubic) * (1 - ease(t, 0.66, 0.9));
    final shiver = math.sin(t * math.pi * 2 * 7) * bump(t, 0.24, 0.66);
    const tucked = MobiArm(angle: -0.4, bend: 1.1, front: 1, reach: 0.86, twist: -0.4);
    return b.copyWith(
      y: b.y + 3.2 * dip,
      squash: b.squash - 0.06 * dip,
      tilt: b.tilt + 0.006 * shiver,
      armL: MobiArm.lerp(b.armL, tucked, dip),
      armR: MobiArm.lerp(b.armR, tucked, dip),
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * (1 + 0.18 * dip), lid: b.eyeL.lid * (1 - dip)),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * (1 + 0.18 * dip), lid: b.eyeR.lid * (1 - dip)),
      lookX: b.lookX * (1 - dip),
      lookY: b.lookY * (1 - dip) - 0.15 * dip,
      antenna: b.antenna + 0.05 * shiver,
      glow: b.glow + 0.25 * dip,
    );
  }

  /// An exhale: a breath in (taller), then the shoulders drop, the eyes close softly, and they
  /// open warm.
  static MobiRig _relief(double t, MobiRig b) {
    final inhale = bump(t, 0, 0.42);
    final sag = ease(t, 0.36, 0.62, Curves.easeOutCubic) * (1 - ease(t, 0.95, 1.4));
    final soft = ease(t, 0.38, 0.58) * (1 - ease(t, 0.86, 1.1));
    final warm = ease(t, 0.86, 1.04) * (1 - ease(t, 1.2, 1.4));
    MobiArm loose(MobiArm a) => a.copyWith(angle: a.angle - 0.12 * sag + 0.12 * inhale, bend: a.bend - 0.1 * sag);
    MobiEye eye(MobiEye e) => _eye(e.copyWith(open: e.open * (1 - 0.82 * soft)), smile: 0.8 * warm);
    return b.copyWith(
      y: b.y - 1.6 * inhale + 2.4 * sag,
      squash: b.squash + 0.04 * inhale - 0.05 * sag,
      tilt: b.tilt - 0.02 * sag,
      armL: loose(b.armL),
      armR: loose(b.armR),
      eyeL: eye(b.eyeL),
      eyeR: eye(b.eyeR),
      lookY: b.lookY - 0.3 * inhale + 0.3 * sag,
      antenna: b.antenna + 0.22 * sag,
    );
  }

  /// One step of the walk, in seconds.
  static const double stepLength = 0.36;

  /// Walking at [t] of a trip lasting [length] seconds: a bob on every step, the boots lifting in
  /// turn, the mittens swinging against them. It eases in and out, so it starts and ends standing.
  static MobiRig walk(double t, MobiRig b, double length) {
    final w = ease(t, 0, 0.18) * (1 - ease(t, math.max(0.2, length - 0.2), math.max(0.21, length)));
    final step = math.sin(t * math.pi / stepLength);
    final bob = step.abs();
    final liftL = math.max(0.0, step) * w;
    final liftR = math.max(0.0, -step) * w;
    return b.copyWith(
      y: b.y - 2.6 * bob * w,
      squash: b.squash + 0.02 * bob * w - 0.015 * (1 - bob) * w,
      tilt: b.tilt + 0.03 * step * w,
      bootL: b.bootL.copyWith(dy: b.bootL.dy - 4.0 * liftL, rot: b.bootL.rot + 0.22 * liftL),
      bootR: b.bootR.copyWith(dy: b.bootR.dy - 4.0 * liftR, rot: b.bootR.rot + 0.22 * liftR),
      armL: b.armL.copyWith(angle: b.armL.angle + 0.32 * step * w),
      armR: b.armR.copyWith(angle: b.armR.angle - 0.32 * step * w),
      antenna: b.antenna - 0.1 * step * w,
    );
  }

  /// How long a micro-fidget lasts, in seconds.
  static const double microLength = 0.8;

  /// A small idle beat between the longer fidgets: 0 a quick glance aside and back, 1 an antenna
  /// twitch with a flick of the bulb.
  static MobiRig micro(int kind, double t, MobiRig b) {
    if (kind == 0) {
      final w = ease(t, 0, 0.1, Curves.easeOut) * (1 - ease(t, 0.55, 0.7, Curves.easeOut));
      return b.copyWith(lookX: b.lookX + (0.6 - b.lookX) * w, lookY: b.lookY + (-0.1 - b.lookY) * w, tilt: b.tilt + 0.012 * w);
    }
    return b.copyWith(
      antenna: b.antenna + 0.3 * bump(t, 0, 0.22) - 0.16 * bump(t, 0.22, 0.46) + 0.06 * bump(t, 0.46, 0.66),
      glow: b.glow + 0.35 * bump(t, 0.04, 0.5),
    );
  }

  // ---- Held stance motion ------------------------------------------------------------------

  /// The loading scan at [t] seconds into the stance with strength [w] (0 to 1): eyes sweep
  /// left and right, the bulb pulses, a slow sway.
  static MobiRig loadingLoop(double t, MobiRig b, double w) {
    final scan = math.sin(t * math.pi * 2 / 1.7);
    final pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / 0.85);
    return b.copyWith(
      lookX: b.lookX + 0.62 * scan * w,
      lookY: b.lookY + 0.12 * (1 - scan.abs()) * w,
      glow: b.glow + 0.45 * pulse * w,
      tilt: b.tilt + 0.018 * math.sin(t * math.pi * 2 / 3.4) * w,
      y: b.y - 0.8 * math.sin(t * math.pi * 2 / 1.7).abs() * w,
    );
  }

  /// How long a fidget lasts, in seconds.
  static const double fidgetLength = 1.3;

  /// A small idle beat at [t] seconds: 0 smiles at the student (eyes come to the middle, warm,
  /// a small nod), 1 shifts its weight with a toe tap, 2 flicks the antenna with a dip and a
  /// flash of the bulb.
  static MobiRig fidget(int kind, double t, MobiRig b) {
    switch (kind) {
      case 0:
        // A visible nod at the student: eyes come round, warm, and the whole body dips twice.
        final w = ease(t, 0, 0.22, Curves.easeOut) * (1 - ease(t, 1.0, 1.3));
        final nod = bump(t, 0.2, 0.6) + 0.55 * bump(t, 0.6, 0.95);
        return b.copyWith(
          lookX: b.lookX * (1 - w),
          lookY: b.lookY * (1 - w) + 0.3 * nod,
          eyeL: _eye(b.eyeL, smile: 0.8 * w),
          eyeR: _eye(b.eyeR, smile: 0.8 * w),
          y: b.y + 2.8 * nod,
          squash: b.squash - 0.03 * nod,
          tilt: b.tilt + 0.04 * bump(t, 0.1, 1.2),
        );
      case 1:
        // A weight shift: the body leans over one leg, the other boot lifts clear and taps.
        final shift = ease(t, 0, 0.4) * (1 - ease(t, 0.85, 1.3));
        final tap = bump(t, 0.38, 0.62) + 0.8 * bump(t, 0.62, 0.84);
        return b.copyWith(
          x: b.x + 3 * shift,
          tilt: b.tilt + 0.06 * shift,
          squash: b.squash - 0.02 * shift,
          bootL: b.bootL.copyWith(rot: b.bootL.rot + 0.5 * tap, dy: b.bootL.dy - 4.2 * tap, dx: b.bootL.dx + 1.5 * tap),
          lookX: b.lookX - 0.4 * shift,
          lookY: b.lookY + 0.25 * shift,
        );
      default:
        // An antenna flick: a quick dip, then the antenna whips right, snaps back past rest and
        // settles, the bulb flashing.
        final dip = bump(t, 0, 0.16);
        return b.copyWith(
          y: b.y + 1.8 * dip - 1.0 * bump(t, 0.16, 0.4),
          squash: b.squash - 0.03 * dip + 0.015 * bump(t, 0.16, 0.4),
          antenna: b.antenna + 0.6 * bump(t, 0.06, 0.38) - 0.42 * bump(t, 0.38, 0.72) + 0.2 * bump(t, 0.72, 1.0),
          glow: b.glow + 0.7 * bump(t, 0.1, 0.9),
          lookX: b.lookX + 0.45 * bump(t, 0.12, 1.1),
          lookY: b.lookY - 0.85 * bump(t, 0.12, 1.1),
        );
    }
  }

  /// One listening nod (0.7 s) at [t].
  static MobiRig listenNod(double t, MobiRig b) => b.copyWith(
        y: b.y + 1.6 * bump(t, 0, 0.32) + 0.9 * bump(t, 0.32, 0.6),
        lookY: b.lookY + 0.24 * bump(t, 0, 0.32) + 0.12 * bump(t, 0.32, 0.6),
        tilt: b.tilt - 0.015 * bump(t, 0, 0.6),
      );

  /// A tap on Mobi ("boop", 0.45 s): squashes away from the touch, blinks happily, springs back.
  static MobiRig boop(double t, MobiRig b, double side) {
    final hit = bump(t, 0, 0.18);
    final back = bump(t, 0.14, 0.42);
    final happy = bump(t, 0.02, 0.4);
    return b.copyWith(
      squash: b.squash - 0.085 * hit + 0.04 * back,
      y: b.y + 2 * hit - 0.8 * back,
      tilt: b.tilt - side * 0.05 * hit + side * 0.02 * back,
      eyeL: _eye(b.eyeL, happy: happy),
      eyeR: _eye(b.eyeR, happy: happy),
    );
  }

  /// A representative still frame of [act] for reduced motion and previews.
  static MobiRig keyPose(MobiAct act, {double pointAngle = 1.5, double pointSide = 1, MobiStance from = MobiStance.stand}) {
    final after = stanceAfter(act) ?? from;
    final base = stance(after, pointAngle: pointAngle, pointSide: pointSide);
    return switch (act) {
      MobiAct.hello => _hello(0.62, base).copyWith(tilt: 0.05, y: 0, squash: 0, glint: -1),
      MobiAct.cheer => _cheer(0.4, base).copyWith(y: -8, bootL: const MobiBoot(dy: -7), bootR: const MobiBoot(dy: -7)),
      MobiAct.celebrate => _celebrate(0.55, base).copyWith(glint: -1),
      MobiAct.oops => _oops(0.5, base),
      MobiAct.talk => talk(0.3, base, 1),
      MobiAct.correct => _correct(0.3, base).copyWith(y: -6, bubble: 0.5),
      MobiAct.encourage => _encourage(0.62, base),
      MobiAct.loading => loadingLoop(0.2125, base, 1),
      MobiAct.sleep => base.copyWith(zzz: 0.45),
      MobiAct.nudge => _nudge(0.47, base),
      MobiAct.proud => _proud(1.0, base).copyWith(glint: -1),
      MobiAct.wake => _wake(0.2, base).copyWith(y: -5),
      MobiAct.nod => _nod(0.19, base),
      MobiAct.tilt => _tilt(0.55, base),
      MobiAct.wave => _wave(0.5, base),
      MobiAct.startle => _startle(0.1, base),
      MobiAct.brace => _brace(0.45, base),
      MobiAct.relief => _relief(0.95, base),
      MobiAct.walk => walk(stepLength / 2, base, 10),
      _ => base,
    };
  }

  /// The still pose for [act] under reduced motion, played from stance [from]: the act's key pose
  /// with no travel (no hop, no step off its spot, no effects in flight), so the information is
  /// there without movement. A held act gives its stance.
  static MobiRig settledPose(MobiAct act, {MobiStance from = MobiStance.stand, double pointAngle = 1.5, double pointSide = 1}) {
    final k = keyPose(act, pointAngle: pointAngle, pointSide: pointSide, from: from);
    if (!showsStillPose(act)) return k;
    final base = stance(stanceAfter(act) ?? from, pointAngle: pointAngle, pointSide: pointSide);
    return k.copyWith(
      x: base.x,
      y: base.y,
      squash: base.squash,
      bootL: base.bootL,
      bootR: base.bootR,
      burst: -1,
      sparkle: -1,
      glint: -1,
    );
  }
}
