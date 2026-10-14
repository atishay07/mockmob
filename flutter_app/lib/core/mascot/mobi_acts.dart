import 'dart:math' as math;

import 'package:flutter/animation.dart';

import 'mobi_rig.dart';

/// Something Mobi does. Held acts ([think], [point], [sleepy], [rest], [read], [idle]) change
/// how Mobi stands until the next one; the others play once and return to the stance.
enum MobiAct {
  /// Stand at ease: breathing, blinking, the antenna swaying.
  idle,

  /// Rises into place (a soft settle when Mobi first appears).
  appear,

  /// Waves hello with the left mitten, eyes smiling.
  hello,

  /// Bobs and beats its eyes while a line types in. Usually started by `MobiController.say`.
  talk,

  /// A happy hop with both arms up.
  cheer,

  /// A big jump with lime answer bubbles popping around it.
  celebrate,

  /// Mitten to chin, one eye squinting, looking up. Held.
  think,

  /// Points with a finger (to the right by default, or at a target). Held.
  point,

  /// Yawns and stretches, then stands with half-closed eyes. Held.
  sleepy,

  /// A small shrug, eyes drooping for a moment. Never sad, never at the student.
  oops,

  /// Sits down. Held.
  rest,

  /// Holds a little answer sheet and reads it. Held.
  read,
}

/// How Mobi stands between acts.
enum MobiStance { stand, point, think, sleepy, rest, read }

/// The choreography: stance rigs and each act as a function of time.
abstract final class MobiMoves {
  /// The stance an act leaves Mobi in, or null when it returns to the current one.
  static MobiStance? stanceAfter(MobiAct act) => switch (act) {
        MobiAct.idle => MobiStance.stand,
        MobiAct.think => MobiStance.think,
        MobiAct.point => MobiStance.point,
        MobiAct.sleepy => MobiStance.sleepy,
        MobiAct.rest => MobiStance.rest,
        MobiAct.read => MobiStance.read,
        MobiAct.hello || MobiAct.cheer || MobiAct.celebrate || MobiAct.oops || MobiAct.appear => MobiStance.stand,
        MobiAct.talk => null,
      };

  /// How long an act runs, in seconds ([MobiAct.talk] runs as long as its line).
  static double duration(MobiAct act) => switch (act) {
        MobiAct.idle => 0.5,
        MobiAct.appear => 0.6,
        MobiAct.hello => 1.75,
        MobiAct.talk => 1.6,
        MobiAct.cheer => 1.2,
        MobiAct.celebrate => 2.0,
        MobiAct.think => 0.8,
        MobiAct.point => 0.6,
        MobiAct.sleepy => 2.2,
        MobiAct.oops => 1.3,
        MobiAct.rest => 0.9,
        MobiAct.read => 0.7,
      };

  /// How long, and with what curve, Mobi moves into [s].
  static (double, Curve) stanceBlend(MobiStance s) => switch (s) {
        MobiStance.point => (0.42, Curves.easeOutBack),
        MobiStance.rest => (0.7, Curves.easeOutBack),
        MobiStance.think => (0.5, Curves.easeOutCubic),
        _ => (0.45, Curves.easeInOutCubic),
      };

  /// The resting rig of a stance. [pointAngle] and [pointSide] aim the pointing arm.
  static MobiRig stance(MobiStance s, {double pointAngle = 1.5, double pointSide = 1}) {
    switch (s) {
      case MobiStance.stand:
        return const MobiRig();
      case MobiStance.point:
        final pointing = MobiArm(angle: pointAngle, bend: 0.06, point: 1, reach: 1.3);
        const hip = MobiArm(angle: 0.5, bend: -0.7, reach: 0.95);
        return MobiRig(
          armR: pointSide > 0 ? pointing : hip,
          armL: pointSide > 0 ? hip : pointing,
          tilt: 0.05 * pointSide,
          lookX: 0.75 * pointSide,
          lookY: (math.cos(pointAngle) * 0.9).clamp(-1.0, 1.0),
        );
      case MobiStance.think:
        return const MobiRig(
          armL: MobiArm(angle: -0.8, bend: 1.1, front: 1, reach: 1.0, twist: -0.35),
          armR: MobiArm(angle: 0.55, bend: -0.75, reach: 0.95),
          eyeR: MobiEye(open: 0.42),
          lookX: 0.45,
          lookY: -0.7,
          tilt: -0.04,
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
    }
  }

  // ---- Envelopes ---------------------------------------------------------------------------

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

  /// Raised arms, both up and a little apart.
  static MobiRig _armsUp(MobiRig r, double w, {double wiggle = 0}) => r.copyWith(
        armL: MobiArm.lerp(r.armL, MobiArm(angle: 2.45 + wiggle, bend: -0.9, reach: 1.5, twist: 0.1), w),
        armR: MobiArm.lerp(r.armR, MobiArm(angle: 2.45 - wiggle, bend: -0.9, reach: 1.5, twist: 0.1), w),
      );

  static MobiRig _withBoots(MobiRig r, double lift, double tuck) => r.copyWith(
        bootL: r.bootL.copyWith(dy: r.bootL.dy + lift, dx: r.bootL.dx + 2 * tuck, rot: r.bootL.rot - 0.18 * tuck),
        bootR: r.bootR.copyWith(dy: r.bootR.dy + lift, dx: r.bootR.dx - 2 * tuck, rot: r.bootR.rot - 0.18 * tuck),
      );

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
      };

  static MobiRig _appear(double t, MobiRig b) {
    final e = ease(t, 0, 0.6, Curves.easeOutBack);
    return b.copyWith(y: b.y + 10 * (1 - e), squash: b.squash - 0.07 * (1 - ease(t, 0, 0.45)));
  }

  static MobiRig _hello(double t, MobiRig b) {
    final w = ease(t, 0, 0.3, Curves.easeOutBack) * (1 - ease(t, 1.35, 1.75));
    final waveEnv = ease(t, 0.22, 0.36) * (1 - ease(t, 1.2, 1.4));
    final osc = math.sin((t - 0.22) * math.pi * 2 * 2.4) * waveEnv;
    final arm = MobiArm.lerp(b.armL, const MobiArm(angle: 2.4, bend: -1.25, reach: 1.55), w);
    final happy = ease(t, 0.12, 0.32) * (1 - ease(t, 1.3, 1.65));
    return b.copyWith(
      armL: arm.copyWith(angle: arm.angle + 0.16 * osc, twist: arm.twist + 0.6 * osc),
      tilt: b.tilt + 0.06 * w + 0.015 * osc,
      y: b.y - 1.6 * bump(t, 0.05, 0.5),
      eyeL: b.eyeL.copyWith(happy: happy),
      eyeR: b.eyeR.copyWith(happy: happy),
      lookX: b.lookX * (1 - w),
      lookY: b.lookY * (1 - w),
      bootR: b.bootR.copyWith(rot: b.bootR.rot - 0.05 * w),
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
    );
    return _withBoots(r, air * 0.92, bump(t, 0.22, 0.62));
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
    );
    return _withBoots(r, air * 0.9, bump(t, 0.24, 0.84) + bump(t, 1.0, 1.28));
  }

  static MobiRig _oops(double t, MobiRig b) {
    final s = ease(t, 0, 0.26, Curves.easeOutBack) * (1 - ease(t, 0.95, 1.3));
    final droop = ease(t, 0.15, 0.35) * (1 - ease(t, 0.8, 1.15));
    const shrug = MobiArm(angle: 1.0, bend: -0.55, reach: 1.05, twist: -1.3);
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

  static MobiRig _yawn(double t, MobiRig b) {
    final s = ease(t, 0.05, 0.55) * (1 - ease(t, 1.25, 1.9));
    final shut = ease(t, 0.2, 0.4) * (1 - ease(t, 1.3, 1.6));
    var r = _armsUp(b, s * 0.85);
    r = r.copyWith(
      squash: b.squash + 0.07 * s,
      y: b.y - 2.5 * s,
      tilt: b.tilt - 0.04 * s,
      eyeL: b.eyeL.copyWith(open: b.eyeL.open * (1 - 0.9 * shut)),
      eyeR: b.eyeR.copyWith(open: b.eyeR.open * (1 - 0.9 * shut)),
    );
    return _withBoots(r, 0, 0).copyWith(
      bootL: b.bootL.copyWith(rot: b.bootL.rot - 0.12 * s),
      bootR: b.bootR.copyWith(rot: b.bootR.rot - 0.12 * s),
    );
  }

  /// A representative still frame of [act] for reduced motion and previews.
  static MobiRig keyPose(MobiAct act, {double pointAngle = 1.5, double pointSide = 1}) {
    final after = stanceAfter(act) ?? MobiStance.stand;
    final base = stance(after, pointAngle: pointAngle, pointSide: pointSide);
    return switch (act) {
      MobiAct.hello => _hello(0.55, base).copyWith(tilt: 0.05, y: 0),
      MobiAct.cheer => _cheer(0.4, base).copyWith(y: -8, bootL: const MobiBoot(dy: -7), bootR: const MobiBoot(dy: -7)),
      MobiAct.celebrate => _celebrate(0.55, base),
      MobiAct.oops => _oops(0.5, base),
      MobiAct.talk => talk(0.3, base, 1),
      _ => base,
    };
  }
}
