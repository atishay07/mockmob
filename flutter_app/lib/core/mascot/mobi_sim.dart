import 'dart:math' as math;

import 'package:flutter/animation.dart';

import 'mobi_acts.dart';
import 'mobi_rig.dart';

/// Mobi's body in time: the stance, the act playing, idle beats (a breath, a blink) and two
/// springs (the antenna and the eyes). Pure Dart and deterministic for a given seed, so the
/// widget ticks it and the goldens step it the same way.
///
/// Idle life comes in beats with rests between them: when nothing is moving the ticker can stop
/// until [idleWait] has passed, which keeps budget phones cool and lets tests settle.
class MobiSim {
  MobiSim({int seed = 7, MobiStance stance = MobiStance.stand})
      : _rand = math.Random(seed),
        _stance = stance {
    _stanceRig = MobiMoves.stance(stance);
    _rig = _stanceRig;
    _lookX = _rig.lookX;
    _lookY = _rig.lookY;
    _ant = _antTarget = _rig.antenna;
    _lookGoal = Offset(_lookX, _lookY);
    _px = _rig.x;
    _py = _rig.y;
    _pt = _rig.tilt;
    _breathWait = 1.2 + _rand.nextDouble() * 0.8;
    _blinkWait = 1.6 + _rand.nextDouble() * 2.0;
  }

  final math.Random _rand;

  MobiStance _stance;
  late MobiRig _stanceRig;
  MobiRig? _stanceFrom;
  double _stanceT = 0;
  double _pointAngle = 1.5;
  double _pointSide = 1;

  MobiAct? _act;
  double _actT = 0;
  double _actDur = 0;

  MobiRig? _carry;
  double _carryT = 0;
  static const double _carryDur = 0.16;

  double _talkLeft = 0;
  double _talkT = 0;
  double _talkW = 0;

  double _breathT = -1;
  double _breathDur = 3;
  double _breathWait = 0;
  double _blinkT = -1;
  double _blinkWait = 0;
  bool _doubleBlink = false;

  Offset? _lookTarget;
  double _lookX = 0, _lookY = 0, _lookVX = 0, _lookVY = 0;
  double _ant = 0, _antV = 0;
  double _px = 0, _py = 0, _vx = 0, _vy = 0, _vt = 0, _pt = 0;

  late MobiRig _rig;

  /// The current frame.
  MobiRig get rig => _rig;
  MobiStance get stance => _stance;
  MobiAct? get act => _act;

  /// Whether anything is moving. When false, nothing changes until [idleWait] has passed.
  bool get busy =>
      _act != null ||
      _talkLeft > 0 ||
      _talkW > 0.001 ||
      _breathT >= 0 ||
      _blinkT >= 0 ||
      _stanceFrom != null ||
      _carry != null ||
      _springMoving;

  bool get _springMoving =>
      _antV.abs() > 0.004 ||
      (_ant - _antTarget).abs() > 0.002 ||
      _lookVX.abs() > 0.004 ||
      _lookVY.abs() > 0.004 ||
      (_lookX - _lookGoal.dx).abs() > 0.002 ||
      (_lookY - _lookGoal.dy).abs() > 0.002;

  double _antTarget = 0;
  Offset _lookGoal = Offset.zero;

  /// Seconds until the next idle beat.
  double get idleWait => math.max(0, math.min(_breathWait, _blinkWait));

  /// Lets [seconds] pass while nothing is moving.
  void elapse(double seconds) {
    _breathWait -= seconds;
    _blinkWait -= seconds;
  }

  /// Plays [act]. Held acts change the stance.
  void play(MobiAct act, {double? seconds}) {
    if (act == MobiAct.talk) {
      talk(seconds ?? MobiMoves.duration(act));
      return;
    }
    _carry = _rig;
    _carryT = 0;
    final next = MobiMoves.stanceAfter(act);
    if (next != null) _setStance(next);
    _act = act;
    _actT = 0;
    _actDur = seconds ?? MobiMoves.duration(act);
    _breathT = -1;
  }

  /// Talks for [seconds] on top of whatever Mobi is doing.
  void talk(double seconds) {
    _talkLeft = seconds;
    if (_talkW < 0.01) _talkT = 0;
  }

  /// Aims the pointing arm: [angle] from straight down toward [side] (-1 left, 1 right).
  void aim(double angle, double side) {
    _pointAngle = angle.clamp(0.35, 2.9);
    _pointSide = side < 0 ? -1 : 1;
    if (_stance == MobiStance.point) _setStance(MobiStance.point, force: true);
  }

  /// Looks toward [target] (each axis -1 to 1), or back to the stance's gaze when null.
  void lookAt(Offset? target) {
    _lookTarget = target == null ? null : Offset(target.dx.clamp(-1.0, 1.0), target.dy.clamp(-1.0, 1.0));
  }

  void _setStance(MobiStance s, {bool force = false}) {
    if (s == _stance && !force) return;
    _stanceFrom = _currentStanceRig();
    _stanceT = 0;
    _stance = s;
    _stanceRig = MobiMoves.stance(s, pointAngle: _pointAngle, pointSide: _pointSide);
  }

  MobiRig _currentStanceRig() {
    final from = _stanceFrom;
    if (from == null) return _stanceRig;
    final (dur, curve) = MobiMoves.stanceBlend(_stance);
    return MobiRig.lerp(from, _stanceRig, curve.transform((_stanceT / dur).clamp(0.0, 1.0)));
  }

  /// Runs [seconds] in frames of 1/[fps] s, as a screen would, and returns the last frame.
  MobiRig run(double seconds, {double fps = 60}) {
    var left = seconds;
    while (left > 1e-9) {
      final dt = math.min(left, 1 / fps);
      step(dt);
      left -= dt;
    }
    return _rig;
  }

  /// Advances by [dt] seconds and returns the new frame.
  MobiRig step(double dt) {
    var left = dt.clamp(0.0, 0.25);
    while (left > 1e-9) {
      final h = math.min(left, 1 / 120);
      _advance(h);
      left -= h;
    }
    return _rig;
  }

  void _advance(double h) {
    // Stance blend.
    if (_stanceFrom != null) {
      _stanceT += h;
      if (_stanceT >= MobiMoves.stanceBlend(_stance).$1) _stanceFrom = null;
    }
    var r = _currentStanceRig();

    // Act.
    final act = _act;
    if (act != null) {
      _actT += h;
      r = MobiMoves.act(act, math.min(_actT, _actDur), r);
      if (_actT >= _actDur) _act = null;
    }

    // Talk overlay, faded in and out.
    if (_talkLeft > 0) _talkLeft -= h;
    final talkGoal = _talkLeft > 0 ? 1.0 : 0.0;
    _talkW += (talkGoal - _talkW) * math.min(1, h * 9);
    if (_talkW < 0.001 && talkGoal == 0) _talkW = 0;
    if (_talkW > 0) {
      _talkT += h;
      r = MobiMoves.talk(_talkT, r, _talkW);
    }

    r = _idle(h, r, quiet: act != null && act != MobiAct.think && act != MobiAct.read);

    // Hand-off from an interrupted act.
    final carry = _carry;
    if (carry != null) {
      _carryT += h;
      final k = Curves.easeOut.transform((_carryT / _carryDur).clamp(0.0, 1.0));
      r = MobiRig.lerp(carry, r, k);
      if (_carryT >= _carryDur) _carry = null;
    }

    _rig = _springs(h, r);
  }

  MobiRig _idle(double h, MobiRig r, {required bool quiet}) {
    // Breath.
    if (_breathT < 0) {
      _breathWait -= h;
      if (_breathWait <= 0 && !quiet && _talkW == 0) {
        _breathT = 0;
        _breathDur = switch (_stance) {
          MobiStance.sleepy => 4.2,
          MobiStance.rest => 3.8,
          _ => 3.0 + _rand.nextDouble() * 0.6,
        };
      }
    }
    if (_breathT >= 0) {
      _breathT += h;
      final p = (_breathT / _breathDur).clamp(0.0, 1.0);
      final b = (1 - math.cos(p * 2 * math.pi)) / 2;
      final deep = _stance == MobiStance.sleepy ? 1.6 : 1.0;
      r = r.copyWith(
        squash: r.squash + 0.014 * b * deep,
        y: r.y - 0.9 * b * deep,
        armL: r.armL.copyWith(angle: r.armL.angle + 0.035 * b),
        armR: r.armR.copyWith(angle: r.armR.angle + 0.035 * b),
        zzz: _stance == MobiStance.sleepy ? p : r.zzz,
      );
      if (p >= 1) {
        _breathT = -1;
        _breathWait = switch (_stance) {
          MobiStance.sleepy => 0.3 + _rand.nextDouble() * 0.5,
          _ => 0.5 + _rand.nextDouble() * 1.4,
        };
      }
    }

    // Blink.
    if (_blinkT < 0) {
      _blinkWait -= h;
      if (_blinkWait <= 0) {
        _blinkT = 0;
        _doubleBlink = _rand.nextDouble() < 0.22;
        _blinkWait = 3 + _rand.nextDouble() * 3;
      }
    }
    if (_blinkT >= 0) {
      _blinkT += h;
      final len = _doubleBlink ? 0.42 : 0.16;
      final p = _blinkT / 0.16;
      final shut = _blinkT >= len ? 0.0 : math.sin(math.pi * (p % 1)).abs();
      final k = 1 - 0.92 * shut;
      r = r.copyWith(eyeL: r.eyeL.copyWith(open: r.eyeL.open * k), eyeR: r.eyeR.copyWith(open: r.eyeR.open * k));
      if (_blinkT >= len) _blinkT = -1;
    }
    return r;
  }

  MobiRig _springs(double h, MobiRig r) {
    // Body motion drives the antenna like a weight on a whip.
    final vx = (r.x - _px) / h;
    final vy = (r.y - _py) / h;
    final vt = (r.tilt - _pt) / h;
    final ax = (vx - _vx) / h;
    final ay = (vy - _vy) / h;
    final at = (vt - _vt) / h;
    _px = r.x;
    _py = r.y;
    _pt = r.tilt;
    _vx = vx;
    _vy = vy;
    _vt = vt;

    _antTarget = r.antenna;
    const k = 190.0;
    const c = 5.2;
    final torque = -ax * 0.0016 + ay * 0.00075 - at * 0.05;
    final acc = -k * (_ant - _antTarget) - c * _antV + torque.clamp(-400.0, 400.0);
    _antV += acc * h;
    _ant = (_ant + _antV * h).clamp(-0.75, 0.75);

    // Eyes glide to where they look.
    final target = _lookTarget;
    _lookGoal = target ?? Offset(r.lookX, r.lookY);
    const lk = 520.0;
    const lc = 34.0;
    _lookVX += (-lk * (_lookX - _lookGoal.dx) - lc * _lookVX) * h;
    _lookVY += (-lk * (_lookY - _lookGoal.dy) - lc * _lookVY) * h;
    _lookX += _lookVX * h;
    _lookY += _lookVY * h;

    final lean = target == null ? 0.0 : target.dx * 0.03;
    return r.copyWith(antenna: _ant, lookX: _lookX, lookY: _lookY, tilt: r.tilt + lean);
  }
}
