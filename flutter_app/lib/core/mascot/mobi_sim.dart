import 'dart:math' as math;

import 'package:flutter/animation.dart';

import 'mobi_acts.dart';
import 'mobi_rig.dart';

/// Mobi's body in time: the stance, the act playing, idle beats (a breath, a blink, a glance, a
/// listening nod) and two springs (the antenna and the eyes). Pure Dart and deterministic for a
/// given seed, so the widget ticks it and the goldens step it the same way.
///
/// Idle life comes in beats with rests between them: when nothing is moving the ticker can stop
/// until [idleWait] has passed, which keeps budget phones cool and lets tests settle. The one
/// continuous motion is the [MobiStance.loading] scan, which settles into quiet beats after
/// [loadingScanFor] seconds.
class MobiSim {
  MobiSim({int seed = 7, MobiStance stance = MobiStance.stand})
      : _rand = math.Random(seed),
        _fidgetRand = math.Random(seed * 31 + 5),
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
    _glanceWait = 4.5 + _rand.nextDouble() * 4.0;
    _beatWait = 2.4 + _rand.nextDouble() * 1.6;
    _fidgetWait = 9 + _fidgetRand.nextDouble() * 6;
  }

  /// How long the loading scan runs before it settles into quiet thinking beats.
  static const double loadingScanFor = 12;

  final math.Random _rand;

  /// A separate stream for fidgets, so adding them left every other beat's timing unchanged.
  final math.Random _fidgetRand;

  MobiStance _stance;
  late MobiRig _stanceRig;
  MobiRig? _stanceFrom;
  double _stanceT = 0;
  double _holdT = 0;
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

  // Idle glances: the eyes flick to a point, hold, and come back.
  double _glanceT = -1;
  double _glanceDur = 1;
  double _glanceWait = 0;
  Offset _glance = Offset.zero;
  double _glanceLean = 0;

  // Stance beats (a listening nod).
  double _beatT = -1;
  double _beatWait = 0;

  // Fidgets: now and then, standing at ease, a small beat of personality (a smile at the
  // student, a weight shift with a toe tap, an antenna flick).
  double _fidgetT = -1;
  double _fidgetWait = 0;
  int _fidget = 0;

  // A tap on Mobi.
  double _boopT = -1;
  double _boopSide = 1;

  // Attention: a short look at something (a tap on screen, new content).
  Offset? _attend;
  double _attendLeft = 0;

  Offset? _lookTarget;
  double _lookX = 0, _lookY = 0, _lookVX = 0, _lookVY = 0;
  double _ant = 0, _antV = 0;
  double _px = 0, _py = 0, _vx = 0, _vy = 0, _vt = 0, _pt = 0;

  late MobiRig _rig;

  /// The current frame.
  MobiRig get rig => _rig;
  MobiStance get stance => _stance;
  MobiAct? get act => _act;

  bool get _scanning => _stance == MobiStance.loading && _holdT < loadingScanFor + 0.6;

  /// Whether anything is moving. When false, nothing changes until [idleWait] has passed.
  bool get busy =>
      _act != null ||
      _talkLeft > 0 ||
      _talkW > 0.001 ||
      _breathT >= 0 ||
      _blinkT >= 0 ||
      _glanceT >= 0 ||
      _beatT >= 0 ||
      _fidgetT >= 0 ||
      _boopT >= 0 ||
      _attendLeft > 0 ||
      _scanning ||
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

  bool get _asleep => _stance == MobiStance.sleep;
  bool get _glances => switch (_stance) {
        MobiStance.stand || MobiStance.think || MobiStance.rest || MobiStance.sleepy || MobiStance.listen => true,
        MobiStance.point || MobiStance.read || MobiStance.loading || MobiStance.sleep => false,
      };
  bool get _beats => _stance == MobiStance.listen;
  bool get _fidgets => _stance == MobiStance.stand;

  /// Seconds until the next idle beat.
  double get idleWait {
    var w = math.min(_breathWait, _blinkWait);
    if (_glances) w = math.min(w, _glanceWait);
    if (_beats) w = math.min(w, _beatWait);
    if (_fidgets) w = math.min(w, _fidgetWait);
    return math.max(0, w);
  }

  /// Lets [seconds] pass while nothing is moving.
  void elapse(double seconds) {
    _breathWait -= seconds;
    _blinkWait -= seconds;
    _glanceWait -= seconds;
    _beatWait -= seconds;
    _fidgetWait -= seconds;
    _holdT += seconds;
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
    _glanceT = -1;
    _beatT = -1;
    _fidgetT = -1;
  }

  /// Talks for [seconds] on top of whatever Mobi is doing.
  void talk(double seconds) {
    _talkLeft = seconds;
    if (_talkW < 0.01) _talkT = 0;
  }

  /// The pointing arm's aim (see [aim]); reduced motion draws its still pose from them.
  double get pointAngle => _pointAngle;
  double get pointSide => _pointSide;

  /// Aims the pointing arm: [angle] from straight down toward [side] (-1 left, 1 right).
  void aim(double angle, double side) {
    _pointAngle = angle.clamp(0.35, 2.9);
    _pointSide = side < 0 ? -1 : 1;
    if (_stance == MobiStance.point) _setStance(MobiStance.point, force: true);
  }

  /// Looks toward [target] (each axis -1 to 1), or back to the stance's gaze when null.
  void lookAt(Offset? target) {
    final next = target == null ? null : Offset(target.dx.clamp(-1.0, 1.0), target.dy.clamp(-1.0, 1.0));
    _saccade(next);
    _lookTarget = next;
  }

  /// Looks at [target] (each axis -1 to 1) for [seconds], then back to whatever it was doing.
  void glance(Offset target, {double seconds = 1.1}) {
    if (_asleep) return;
    final next = Offset(target.dx.clamp(-1.0, 1.0), target.dy.clamp(-1.0, 1.0));
    _saccade(next);
    _attend = next;
    _attendLeft = seconds;
    _glanceT = -1;
  }

  /// A tap on Mobi from [side] (-1 left, 1 right of its middle): a quick squash and a happy blink.
  void boop({double side = 0}) {
    _boopT = 0;
    _boopSide = side.clamp(-1.0, 1.0);
    _blinkT = -1;
  }

  /// A big eye movement brings a blink with it, as real eyes do.
  void _saccade(Offset? next) {
    final from = Offset(_lookX, _lookY);
    final to = next ?? Offset(_stanceRig.lookX, _stanceRig.lookY);
    if ((to - from).distance > 0.75 && _blinkT < 0 && !_asleep) {
      _blinkT = 0;
      _doubleBlink = false;
    }
  }

  void _setStance(MobiStance s, {bool force = false}) {
    if (s == _stance && !force) return;
    _stanceFrom = _currentStanceRig();
    _stanceT = 0;
    if (s != _stance) _holdT = 0;
    _stance = s;
    _stanceRig = MobiMoves.stance(s, pointAngle: _pointAngle, pointSide: _pointSide);
  }

  MobiRig _currentStanceRig() {
    final from = _stanceFrom;
    if (from == null) return _stanceRig;
    final (dur, curve) = MobiMoves.stanceBlend(_stance);
    final f = (_stanceT / dur).clamp(0.0, 1.0);
    final r = MobiRig.lerp(from, _stanceRig, curve.transform(f));
    // An arm that swings a long way (hanging to beside the head, say) bends at the elbow on the
    // way: its reach dips halfway, so the mitten never flies out wide past the paint box.
    MobiArm bent(MobiArm a, MobiArm start, MobiArm end) {
      final sweep = (end.angle - start.angle).abs();
      if (sweep < 1.2) return a;
      final depth = 0.4 * math.min(1.0, (sweep - 1.2) / 0.8);
      return a.copyWith(reach: a.reach - depth * math.sin(math.pi * f));
    }

    return r.copyWith(armL: bent(r.armL, from.armL, _stanceRig.armL), armR: bent(r.armR, from.armR, _stanceRig.armR));
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
    _holdT += h;
    // Stance blend.
    if (_stanceFrom != null) {
      _stanceT += h;
      if (_stanceT >= MobiMoves.stanceBlend(_stance).$1) _stanceFrom = null;
    }
    var r = _currentStanceRig();

    // Held stance motion: the loading scan fades in, runs, then settles.
    if (_stance == MobiStance.loading) {
      final w = MobiMoves.ease(_holdT, 0.1, 0.6) * (1 - MobiMoves.ease(_holdT, loadingScanFor, loadingScanFor + 0.6));
      if (w > 0) r = MobiMoves.loadingLoop(_holdT, r, w);
    }

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

    final quiet = act != null && act != MobiAct.think && act != MobiAct.read && act != MobiAct.listen && act != MobiAct.loading;
    r = _idle(h, r, quiet: quiet);

    // A tap.
    if (_boopT >= 0) {
      _boopT += h;
      r = MobiMoves.boop(_boopT, r, _boopSide);
      if (_boopT >= 0.45) _boopT = -1;
    }

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
          MobiStance.sleep => 4.8 + _rand.nextDouble() * 0.6,
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
      final deep = switch (_stance) {
        MobiStance.sleep => 2.1,
        MobiStance.sleepy => 1.6,
        _ => 1.0,
      };
      final dozing = _stance == MobiStance.sleepy || _asleep;
      r = r.copyWith(
        squash: r.squash + 0.014 * b * deep,
        y: r.y - 0.9 * b * deep,
        armL: r.armL.copyWith(angle: r.armL.angle + 0.035 * b),
        armR: r.armR.copyWith(angle: r.armR.angle + 0.035 * b),
        antenna: _asleep ? r.antenna - 0.08 * b : r.antenna,
        zzz: dozing ? p : r.zzz,
      );
      if (p >= 1) {
        _breathT = -1;
        _breathWait = switch (_stance) {
          MobiStance.sleepy || MobiStance.sleep => 0.3 + _rand.nextDouble() * 0.5,
          _ => 0.5 + _rand.nextDouble() * 1.4,
        };
      }
    }

    // Glance: the eyes flick somewhere, hold, flick back; sometimes the weight shifts with them.
    if (_glances) {
      if (_glanceT < 0) {
        _glanceWait -= h;
        if (_glanceWait <= 0 && !quiet && _attendLeft <= 0 && _lookTarget == null && _talkW == 0 && _fidgetT < 0) {
          _glanceT = 0;
          _glanceDur = 0.7 + _rand.nextDouble() * 0.9;
          final side = _rand.nextBool() ? 1.0 : -1.0;
          _glance = Offset(side * (0.45 + _rand.nextDouble() * 0.45), -0.45 + _rand.nextDouble() * 0.8);
          _glanceLean = _rand.nextDouble() < 0.45 ? side * 0.022 : 0;
          if (_rand.nextDouble() < 0.4 && _blinkT < 0) {
            _blinkT = 0;
            _doubleBlink = false;
          }
          _glanceWait = 4 + _rand.nextDouble() * 5;
        }
      }
      if (_glanceT >= 0) {
        _glanceT += h;
        final w = MobiMoves.ease(_glanceT, 0, 0.12, Curves.easeOut) * (1 - MobiMoves.ease(_glanceT, _glanceDur, _glanceDur + 0.14, Curves.easeOut));
        final lean = MobiMoves.ease(_glanceT, 0, 0.45) * (1 - MobiMoves.ease(_glanceT, _glanceDur, _glanceDur + 0.5));
        r = r.copyWith(
          lookX: r.lookX + (_glance.dx - r.lookX) * w,
          lookY: r.lookY + (_glance.dy - r.lookY) * w,
          tilt: r.tilt + _glanceLean * lean,
        );
        if (_glanceT >= _glanceDur + 0.5) _glanceT = -1;
      }
    } else {
      _glanceT = -1;
    }

    // Stance beats: a slow nod while listening.
    if (_beats) {
      if (_beatT < 0) {
        _beatWait -= h;
        if (_beatWait <= 0 && !quiet && _talkW == 0) _beatT = 0;
      }
      if (_beatT >= 0) {
        _beatT += h;
        r = MobiMoves.listenNod(_beatT, r);
        if (_beatT >= 0.7) {
          _beatT = -1;
          _beatWait = 2.6 + _rand.nextDouble() * 2.2;
        }
      }
    } else {
      _beatT = -1;
    }

    // Fidgets, standing at ease only, never over an act, a line, a look or a glance.
    if (_fidgets) {
      if (_fidgetT < 0) {
        _fidgetWait -= h;
        if (_fidgetWait <= 0) {
          if (!quiet && _talkW == 0 && _attendLeft <= 0 && _lookTarget == null && _glanceT < 0) {
            _fidgetT = 0;
            _fidget = _fidgetRand.nextInt(3);
            _fidgetWait = 12 + _fidgetRand.nextDouble() * 10;
          } else {
            _fidgetWait = 1.5;
          }
        }
      }
      if (_fidgetT >= 0) {
        _fidgetT += h;
        r = MobiMoves.fidget(_fidget, _fidgetT, r);
        if (_fidgetT >= MobiMoves.fidgetLength) _fidgetT = -1;
      }
    } else {
      _fidgetT = -1;
    }

    // Blink: a fast close, a short hold and a slower open; sometimes two. Never while asleep.
    if (_asleep) {
      _blinkT = -1;
    } else {
      if (_blinkT < 0) {
        _blinkWait -= h;
        if (_blinkWait <= 0) {
          _blinkT = 0;
          _doubleBlink = _rand.nextDouble() < 0.2;
          // Mostly 2.5 to 4.5 s apart, now and then a longer stare.
          final u = _rand.nextDouble();
          _blinkWait = 2.4 + 2.2 * u * u + (_rand.nextDouble() < 0.15 ? 2.5 : 0);
        }
      }
      if (_blinkT >= 0) {
        _blinkT += h;
        const one = 0.2;
        final len = _doubleBlink ? 2 * one + 0.06 : one;
        final local = _blinkT < one + 0.06 ? _blinkT : _blinkT - one - 0.06;
        final shut = _blinkT >= len ? 0.0 : _blinkShut(local);
        final k = 1 - 0.94 * shut;
        r = r.copyWith(eyeL: r.eyeL.copyWith(open: r.eyeL.open * k), eyeR: r.eyeR.copyWith(open: r.eyeR.open * k));
        if (_blinkT >= len) _blinkT = -1;
      }
    }

    // Attention.
    if (_attendLeft > 0) {
      _attendLeft -= h;
      if (_attendLeft <= 0) {
        _attend = null;
        _saccade(_lookTarget);
      }
    }
    return r;
  }

  /// Lid closure over one blink: 55 ms closing, 30 ms shut, 115 ms opening.
  static double _blinkShut(double t) {
    if (t <= 0) return 0;
    if (t < 0.055) return Curves.easeIn.transform(t / 0.055);
    if (t < 0.085) return 1;
    if (t < 0.2) return 1 - Curves.easeOut.transform((t - 0.085) / 0.115);
    return 0;
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

    // Eyes glide to where they look: a short attention look first, then a held target, then
    // the pose's own gaze.
    final target = _attend ?? _lookTarget;
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
