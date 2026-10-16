import 'dart:math' as math;

import 'package:flutter/animation.dart';

import 'mobi_acts.dart';
import 'mobi_mood.dart';
import 'mobi_rig.dart';
import 'mobi_rig_eval.dart';

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
        _microRand = math.Random(seed * 53 + 11),
        _saccRand = math.Random(seed * 71 + 3),
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
    _breathWait = _draw(_rand, _breathFirst);
    _blinkWait = _draw(_rand, _blinkFirst);
    _glanceWait = _draw(_rand, _glanceFirst);
    _beatWait = _draw(_rand, _listenFirst);
    _fidgetWait = _draw(_fidgetRand, _fidgetFirst);
    _microWait = _draw(_microRand, _microFirst);
    _saccWait = _saccFirst[0] + _saccRand.nextDouble() * _saccFirst[1];
    _armPrevL = _rig.armL.angle;
    _armPrevR = _rig.armR.angle;
  }

  // ---- Numbers from the rig table (idle and springs) --------------------------------------

  static Map<String, Object?> get _idleSpec => MobiBook.instance.section('idle');
  static Map<String, Object?> _springSpec(String k) => MobiBook.instance.section('springs')[k]! as Map<String, Object?>;
  static double _n(Map<String, Object?> m, String k) => (m[k]! as num).toDouble();
  static List<double> _pair(Object? v) => [for (final x in v! as List<Object?>) (x! as num).toDouble()];

  /// base + u * spread, for a [base, spread] pair from the table.
  static double _draw(math.Random r, List<double> p) => p[0] + r.nextDouble() * p[1];

  static final Map<String, Object?> _breathSpec = _idleSpec['breath']! as Map<String, Object?>;
  static final List<double> _breathFirst = _pair(_breathSpec['firstWait']);
  static Map<String, Object?> _breathPart(String k) => _breathSpec[k]! as Map<String, Object?>;
  static final List<double> _breathSleep = _pair(_breathPart('seconds')['sleep']);
  static final List<double> _breathSleepy = _pair(_breathPart('seconds')['sleepy']);
  static final List<double> _breathRest = _pair(_breathPart('seconds')['rest']);
  static final List<double> _breathOther = _pair(_breathPart('seconds')['other']);
  static final double _deepSleep = _n(_breathPart('deep'), 'sleep');
  static final double _deepSleepy = _n(_breathPart('deep'), 'sleepy');
  static final double _deepOther = _n(_breathPart('deep'), 'other');
  static final List<double> _breathPauseDozing = _pair(_breathPart('rest')['sleep']);
  static final List<double> _breathPauseOther = _pair(_breathPart('rest')['other']);
  static final double _swellSquash = _n(_breathPart('swell'), 'squash');
  static final double _swellY = _n(_breathPart('swell'), 'y');
  static final double _swellArm = _n(_breathPart('swell'), 'armAngle');
  static final double _swellAntenna = _n(_breathPart('swell'), 'antennaAsleep');

  static final List<double> _blinkFirst = _pair((_idleSpec['blink']! as Map<String, Object?>)['firstWait']);
  static final Map<String, Object?> _blinkGapSpec = (_idleSpec['blink']! as Map<String, Object?>)['gap']! as Map<String, Object?>;
  static final double _blinkDouble = _n(_idleSpec['blink']! as Map<String, Object?>, 'doubleChance');
  static final double _blinkBase = _n(_blinkGapSpec, 'base');
  static final double _blinkSpread = _n(_blinkGapSpec, 'squaredSpread');
  static final double _blinkStareChance = _n(_blinkGapSpec, 'longStareChance');
  static final double _blinkStare = _n(_blinkGapSpec, 'longStare');

  static final Map<String, Object?> _glanceSpec = _idleSpec['glance']! as Map<String, Object?>;
  static final List<double> _glanceFirst = _pair(_glanceSpec['firstWait']);
  static final List<double> _glanceHold = _pair(_glanceSpec['hold']);
  static final List<double> _glanceX = _pair(_glanceSpec['x']);
  static final List<double> _glanceY = _pair(_glanceSpec['y']);
  static final List<double> _glanceGap = _pair(_glanceSpec['gap']);
  static final double _glanceLeanChance = _n(_glanceSpec, 'leanChance');
  static final double _glanceLeanBy = _n(_glanceSpec, 'lean');
  static final double _glanceBlinkChance = _n(_glanceSpec, 'blinkChance');
  static final double _glanceIn = _n(_glanceSpec, 'in'), _glanceOut = _n(_glanceSpec, 'out');
  static final double _glanceLeanIn = _n(_glanceSpec, 'leanIn'), _glanceLeanOut = _n(_glanceSpec, 'leanOut');

  static final List<double> _listenFirst = _pair(_idleSpec['listenFirstWait']);
  static final List<double> _listenGap = _pair(_idleSpec['listenNodGap']);
  static final double _listenNodLength = _n(_idleSpec, 'listenNodSeconds');
  static final List<double> _fidgetFirst = _pair(_idleSpec['fidgetFirstWait']);
  static final List<double> _fidgetGap = _pair(_idleSpec['fidgetGap']);
  static final double _fidgetRetry = _n(_idleSpec, 'fidgetRetry');
  static final List<double> _microFirst = _pair(_idleSpec['microFirstWait']);
  static final List<double> _microGap = _pair(_idleSpec['microGap']);
  static final double _boopLength = _n(_idleSpec, 'boopSeconds');

  static final Map<String, Object?> _saccSpec = _idleSpec['saccade']! as Map<String, Object?>;
  static final List<double> _saccFirst = _pair(_saccSpec['firstWait']);
  static final List<double> _saccGap = _pair(_saccSpec['gap']);
  static final double _saccX = _n(_saccSpec, 'x');
  static final double _saccY = _n(_saccSpec, 'y');
  static final double _saccHome = _n(_saccSpec, 'homeChance');

  static final Map<String, Object?> _blinkSpec = _idleSpec['blink']! as Map<String, Object?>;
  static final double _blinkClose = _n(_blinkSpec, 'close');
  static final double _blinkHold = _n(_blinkSpec, 'shut');
  static final double _blinkOpen = _n(_blinkSpec, 'open');
  static final double _blinkGapDouble = _n(_blinkSpec, 'gapBetweenDouble');
  static final double _blinkTrail = _n(_blinkSpec, 'trail');
  static final double _blinkShutTo = _n(_blinkSpec, 'shutTo');

  static final Map<String, Object?> _antSpec = _springSpec('antenna');
  static final Map<String, Object?> _eyeSpec = _springSpec('eyes');
  static final Map<String, Object?> _armSpec = _springSpec('arms');
  static final Map<String, Object?> _jigSpec = _springSpec('jiggle');
  static final double _armK = _n(_armSpec, 'k'), _armC = _n(_armSpec, 'c'), _armGain = _n(_armSpec, 'gain');
  static final double _armTwistGain = _n(_armSpec, 'twistGain'), _armAccel = _n(_armSpec, 'accelClamp');
  static final double _armClamp = _n(_armSpec, 'clamp'), _armTwistClamp = _n(_armSpec, 'twistClamp');
  static final double _jigK = _n(_jigSpec, 'k'), _jigC = _n(_jigSpec, 'c'), _jigGain = _n(_jigSpec, 'gain');
  static final double _jigAccel = _n(_jigSpec, 'accelClamp'), _jigClamp = _n(_jigSpec, 'clamp');
  static final double _antK = _n(_antSpec, 'k'), _antC = _n(_antSpec, 'c'), _antTorque = _n(_antSpec, 'torqueClamp');
  static final double _antAx = _n(_antSpec, 'fromAx'), _antAy = _n(_antSpec, 'fromAy'), _antAt = _n(_antSpec, 'fromTilt');
  static final double _antClamp = _n(_antSpec, 'clamp');
  static final double _eyeK = _n(_eyeSpec, 'k'), _eyeC = _n(_eyeSpec, 'c'), _eyeLean = _n(_eyeSpec, 'leanToTarget');

  /// How long the loading scan runs before it settles into quiet thinking beats.
  static const double loadingScanFor = 12;

  final math.Random _rand;

  /// A separate stream for fidgets, so adding them left every other beat's timing unchanged.
  final math.Random _fidgetRand;

  /// A third stream for micro-fidgets (15 Oct), for the same reason.
  final math.Random _microRand;

  /// A fourth stream for micro-saccades (rig v2), for the same reason.
  final math.Random _saccRand;

  // Micro-saccades: small fixational darts of the eyes while standing at ease.
  double _saccWait = 0;
  double _saccDX = 0, _saccDY = 0;

  // Follow-through: each arm's angle overshoots and settles after a swing; the mitten flops.
  double _armPrevL = 0, _armPrevR = 0, _armVelL = 0, _armVelR = 0;
  double _armOffL = 0, _armOffR = 0, _armOffVL = 0, _armOffVR = 0;
  double _twOffL = 0, _twOffR = 0, _twOffVL = 0, _twOffVR = 0;

  // The paper body's jiggle after a landing.
  double _jig = 0, _jigV = 0;

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
  static final double _carryDur = _n(_idleSpec, 'carrySeconds');

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

  // Micro-fidgets: every 6 to 9 s standing at ease, a quick glance aside or an antenna twitch,
  // so a Mobi left on screen never looks frozen between the longer fidgets.
  double _microT = -1;
  double _microWait = 0;
  int _micro = 0;

  // The mood: a persistent face under every act, blended over MobiMoods.blend.
  MobiMood _mood = MobiMood.calm;
  MobiMood _moodFrom = MobiMood.calm;
  double _moodT = 1;

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
      _microT >= 0 ||
      _moodT < 1 ||
      _boopT >= 0 ||
      _attendLeft > 0 ||
      _scanning ||
      _stanceFrom != null ||
      _carry != null ||
      _springMoving ||
      _secondaryMoving;

  bool get _secondaryMoving =>
      _armOffL.abs() > 0.002 ||
      _armOffR.abs() > 0.002 ||
      _armOffVL.abs() > 0.01 ||
      _armOffVR.abs() > 0.01 ||
      _twOffL.abs() > 0.003 ||
      _twOffR.abs() > 0.003 ||
      _twOffVL.abs() > 0.015 ||
      _twOffVR.abs() > 0.015 ||
      _jig.abs() > 0.0008 ||
      _jigV.abs() > 0.004;

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
  bool get _saccades => _glances || _stance == MobiStance.read;

  /// Seconds until the next idle beat.
  double get idleWait {
    var w = math.min(_breathWait, _blinkWait);
    if (_glances) w = math.min(w, _glanceWait);
    if (_beats) w = math.min(w, _beatWait);
    if (_fidgets) w = math.min(w, math.min(_fidgetWait, _microWait));
    if (_saccades) w = math.min(w, _saccWait);
    return math.max(0, w);
  }

  /// Lets [seconds] pass while nothing is moving.
  void elapse(double seconds) {
    _breathWait -= seconds;
    _blinkWait -= seconds;
    _glanceWait -= seconds;
    _beatWait -= seconds;
    _fidgetWait -= seconds;
    _microWait -= seconds;
    _saccWait -= seconds;
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
    _microT = -1;
    _saccDX = 0;
    _saccDY = 0;
  }

  /// The face under every act.
  MobiMood get mood => _mood;

  /// Changes the face to [mood], blending over [MobiMoods.blend].
  void setMood(MobiMood mood) {
    if (mood == _mood && _moodT >= 1) return;
    // Mid-blend, the new blend starts from the nearer of the two faces.
    _moodFrom = _moodT >= 0.5 ? _mood : _moodFrom;
    _mood = mood;
    _moodT = 0;
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

    // The mood, under everything that follows.
    if (_moodT < 1) _moodT = math.min(1, _moodT + h / (MobiMoods.blend.inMicroseconds / 1e6));
    r = MobiMoods.between(_moodFrom, _mood, r, Curves.easeInOutCubic.transform(_moodT));

    // Held stance motion: the loading scan fades in, runs, then settles.
    if (_stance == MobiStance.loading) {
      final w = MobiMoves.ease(_holdT, 0.1, 0.6) * (1 - MobiMoves.ease(_holdT, loadingScanFor, loadingScanFor + 0.6));
      if (w > 0) r = MobiMoves.loadingLoop(_holdT, r, w);
    }

    // Act.
    final act = _act;
    if (act != null) {
      _actT += h;
      final at = math.min(_actT, _actDur);
      // The walk lasts as long as its trip, and eases out at the trip's end, not a fixed length.
      r = act == MobiAct.walk ? MobiMoves.walk(at, r, _actDur) : MobiMoves.act(act, at, r);
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
      if (_boopT >= _boopLength) _boopT = -1;
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
          MobiStance.sleep => _draw(_rand, _breathSleep),
          MobiStance.sleepy => _breathSleepy[0],
          MobiStance.rest => _breathRest[0],
          _ => _draw(_rand, _breathOther),
        };
      }
    }
    if (_breathT >= 0) {
      _breathT += h;
      final p = (_breathT / _breathDur).clamp(0.0, 1.0);
      final b = (1 - math.cos(p * 2 * math.pi)) / 2;
      final deep = switch (_stance) {
        MobiStance.sleep => _deepSleep,
        MobiStance.sleepy => _deepSleepy,
        _ => _deepOther,
      };
      final dozing = _stance == MobiStance.sleepy || _asleep;
      r = r.copyWith(
        squash: r.squash + _swellSquash * b * deep,
        y: r.y + _swellY * b * deep,
        armL: r.armL.copyWith(angle: r.armL.angle + _swellArm * b),
        armR: r.armR.copyWith(angle: r.armR.angle + _swellArm * b),
        antenna: _asleep ? r.antenna + _swellAntenna * b : r.antenna,
        zzz: dozing ? p : r.zzz,
      );
      if (p >= 1) {
        _breathT = -1;
        _breathWait = switch (_stance) {
          MobiStance.sleepy || MobiStance.sleep => _draw(_rand, _breathPauseDozing),
          _ => _draw(_rand, _breathPauseOther),
        };
      }
    }

    // Glance: the eyes flick somewhere, hold, flick back; sometimes the weight shifts with them.
    if (_glances) {
      if (_glanceT < 0) {
        _glanceWait -= h;
        if (_glanceWait <= 0 && !quiet && _attendLeft <= 0 && _lookTarget == null && _talkW == 0 && _fidgetT < 0) {
          _glanceT = 0;
          _glanceDur = _draw(_rand, _glanceHold);
          final side = _rand.nextBool() ? 1.0 : -1.0;
          _glance = Offset(side * _draw(_rand, _glanceX), _draw(_rand, _glanceY));
          _glanceLean = _rand.nextDouble() < _glanceLeanChance ? side * _glanceLeanBy : 0;
          if (_rand.nextDouble() < _glanceBlinkChance && _blinkT < 0) {
            _blinkT = 0;
            _doubleBlink = false;
          }
          _glanceWait = _draw(_rand, _glanceGap);
        }
      }
      if (_glanceT >= 0) {
        _glanceT += h;
        final w = MobiMoves.ease(_glanceT, 0, _glanceIn, Curves.easeOut) * (1 - MobiMoves.ease(_glanceT, _glanceDur, _glanceDur + _glanceOut, Curves.easeOut));
        final lean = MobiMoves.ease(_glanceT, 0, _glanceLeanIn) * (1 - MobiMoves.ease(_glanceT, _glanceDur, _glanceDur + _glanceLeanOut));
        r = r.copyWith(
          lookX: r.lookX + (_glance.dx - r.lookX) * w,
          lookY: r.lookY + (_glance.dy - r.lookY) * w,
          tilt: r.tilt + _glanceLean * lean,
        );
        if (_glanceT >= _glanceDur + _glanceLeanOut) _glanceT = -1;
      }
    } else {
      _glanceT = -1;
    }

    // Micro-saccades: now and then the eyes dart a hair aside (or back home), so a Mobi that is
    // only looking at the student still reads as looking, not as painted on.
    if (_saccades && !_asleep) {
      _saccWait -= h;
      if (_saccWait <= 0) {
        _saccWait = _saccGap[0] + _saccRand.nextDouble() * _saccGap[1];
        final home = _saccRand.nextDouble() < _saccHome;
        final dx = (_saccRand.nextDouble() * 2 - 1) * _saccX;
        final dy = (_saccRand.nextDouble() * 2 - 1) * _saccY;
        final free = !quiet && _attendLeft <= 0 && _lookTarget == null && _glanceT < 0 && _talkW == 0;
        _saccDX = free && !home ? dx : 0;
        _saccDY = free && !home ? dy : 0;
      }
    } else {
      _saccDX = 0;
      _saccDY = 0;
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
        if (_beatT >= _listenNodLength) {
          _beatT = -1;
          _beatWait = _draw(_rand, _listenGap);
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
            _fidgetWait = _draw(_fidgetRand, _fidgetGap);
          } else {
            _fidgetWait = _fidgetRetry;
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

    // Micro-fidgets, under the same rules as fidgets, never over one.
    if (_fidgets) {
      if (_microT < 0) {
        _microWait -= h;
        if (_microWait <= 0) {
          if (!quiet && _talkW == 0 && _attendLeft <= 0 && _lookTarget == null && _glanceT < 0 && _fidgetT < 0) {
            _microT = 0;
            _micro = _microRand.nextInt(2);
          }
          _microWait = _draw(_microRand, _microGap);
        }
      }
      if (_microT >= 0) {
        _microT += h;
        r = MobiMoves.micro(_micro, _microT, r);
        if (_microT >= MobiMoves.microLength) _microT = -1;
      }
    } else {
      _microT = -1;
    }

    // Blink: a fast close, a short hold and a slower open; sometimes two. Never while asleep.
    if (_asleep) {
      _blinkT = -1;
    } else {
      if (_blinkT < 0) {
        _blinkWait -= h;
        if (_blinkWait <= 0) {
          _blinkT = 0;
          _doubleBlink = _rand.nextDouble() < _blinkDouble;
          // Mostly 2.5 to 4.5 s apart, now and then a longer stare.
          final u = _rand.nextDouble();
          _blinkWait = _blinkBase + _blinkSpread * u * u + (_rand.nextDouble() < _blinkStareChance ? _blinkStare : 0);
        }
      }
      if (_blinkT >= 0) {
        _blinkT += h;
        final one = _blinkClose + _blinkHold + _blinkOpen;
        final len = _doubleBlink ? 2 * one + _blinkGapDouble : one;
        double shutAt(double bt) {
          if (bt <= 0 || bt >= len) return 0;
          return _blinkShut(bt < one + _blinkGapDouble ? bt : bt - one - _blinkGapDouble);
        }

        // The right eye trails the left by a few milliseconds: two eyes never move as one.
        final kL = 1 - (1 - _blinkShutTo) * shutAt(_blinkT);
        final kR = 1 - (1 - _blinkShutTo) * shutAt(_blinkT - _blinkTrail);
        r = r.copyWith(eyeL: r.eyeL.copyWith(open: r.eyeL.open * kL), eyeR: r.eyeR.copyWith(open: r.eyeR.open * kR));
        if (_blinkT >= len + _blinkTrail) _blinkT = -1;
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

  /// Lid closure over one blink: 55 ms closing, 30 ms shut, 115 ms opening (the table's
  /// `idle.blink`).
  static double _blinkShut(double t) {
    if (t <= 0) return 0;
    if (t < _blinkClose) return Curves.easeIn.transform(t / _blinkClose);
    if (t < _blinkClose + _blinkHold) return 1;
    if (t < _blinkClose + _blinkHold + _blinkOpen) return 1 - Curves.easeOut.transform((t - _blinkClose - _blinkHold) / _blinkOpen);
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
    final torque = ax * _antAx + ay * _antAy + at * _antAt;
    final acc = -_antK * (_ant - _antTarget) - _antC * _antV + torque.clamp(-_antTorque, _antTorque);
    _antV += acc * h;
    _ant = (_ant + _antV * h).clamp(-_antClamp, _antClamp);

    // Eyes glide to where they look: a short attention look first, then a held target, then
    // the pose's own gaze (with its micro-saccade).
    final target = _attend ?? _lookTarget;
    _lookGoal = target ?? Offset(r.lookX + _saccDX, r.lookY + _saccDY);
    _lookVX += (-_eyeK * (_lookX - _lookGoal.dx) - _eyeC * _lookVX) * h;
    _lookVY += (-_eyeK * (_lookY - _lookGoal.dy) - _eyeC * _lookVY) * h;
    _lookX += _lookVX * h;
    _lookY += _lookVY * h;

    // Follow-through: an arm that swings and stops overshoots a little and settles, and the
    // mitten flops behind the swing. Driven by each arm's angular acceleration.
    final aL = r.armL.angle, aR = r.armR.angle;
    final vL = (aL - _armPrevL) / h, vR = (aR - _armPrevR) / h;
    final accL = ((vL - _armVelL) / h).clamp(-_armAccel, _armAccel);
    final accR = ((vR - _armVelR) / h).clamp(-_armAccel, _armAccel);
    _armPrevL = aL;
    _armPrevR = aR;
    _armVelL = vL;
    _armVelR = vR;
    _armOffVL += (-_armK * _armOffL - _armC * _armOffVL - _armGain * accL) * h;
    _armOffVR += (-_armK * _armOffR - _armC * _armOffVR - _armGain * accR) * h;
    _armOffL = (_armOffL + _armOffVL * h).clamp(-_armClamp, _armClamp);
    _armOffR = (_armOffR + _armOffVR * h).clamp(-_armClamp, _armClamp);
    _twOffVL += (-_armK * _twOffL - _armC * _twOffVL + _armTwistGain * accL) * h;
    _twOffVR += (-_armK * _twOffR - _armC * _twOffVR + _armTwistGain * accR) * h;
    _twOffL = (_twOffL + _twOffVL * h).clamp(-_armTwistClamp, _armTwistClamp);
    _twOffR = (_twOffR + _twOffVR * h).clamp(-_armTwistClamp, _armTwistClamp);

    // The paper body jiggles after a push or a landing (vertical acceleration, down positive).
    _jigV += (-_jigK * _jig - _jigC * _jigV + _jigGain * ay.clamp(-_jigAccel, _jigAccel)) * h;
    _jig = (_jig + _jigV * h).clamp(-_jigClamp, _jigClamp);

    final lean = target == null ? 0.0 : target.dx * _eyeLean;
    return r.copyWith(
      antenna: _ant,
      lookX: _lookX,
      lookY: _lookY,
      tilt: r.tilt + lean,
      squash: r.squash + _jig,
      armL: r.armL.copyWith(angle: aL + _armOffL, twist: r.armL.twist + _twOffL),
      armR: r.armR.copyWith(angle: aR + _armOffR, twist: r.armR.twist + _twOffR),
    );
  }
}
