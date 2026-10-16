// The motion of each hybrid object's moving part as a pure function of time, so the poses are
// tested without a screen and the widgets only read them. Time is in seconds on the widget's own
// clock; angles are radians, clockwise from 12 o'clock.
import 'dart:math' as math;

import 'package:flutter/animation.dart' show Cubic;
import 'package:flutter/physics.dart';

double _deg(double d) => d * math.pi / 180;

double _smooth(double x) {
  final t = x.clamp(0.0, 1.0);
  return t * t * (3 - 2 * t);
}

double _easeInOutSine(double x) => -(math.cos(math.pi * x.clamp(0.0, 1.0)) - 1) / 2;

/// A compass needle: it wanders while it searches, and swings to a heading on a spring that
/// overshoots and settles in two damped swings. A new heading while it swings starts from where
/// the needle is, at the speed it has.
class NeedleSim {
  NeedleSim({double angle = 0}) : _base = angle, _target = angle;

  /// Underdamped (damping ratio about 0.24): one overshoot and two visible swings, done to the
  /// eye in about 1.4 s.
  static const SpringDescription spring = SpringDescription(mass: 1, stiffness: 130, damping: 5.5);

  /// How far the needle strays while searching.
  static final double wanderAmplitude = _deg(26);

  double _base;
  double _target;
  double _start = 0;
  bool _searching = false;
  SpringSimulation? _spring;

  bool get searching => _searching;

  /// The heading it is settling on (or last settled on).
  double get target => _target;

  /// Starts the gentle wander from wherever the needle is at [now].
  void search(double now) {
    if (_searching) return;
    _base = angleAt(now);
    _start = now;
    _spring = null;
    _searching = true;
  }

  /// Swings to [target] from wherever the needle is at [now], keeping its speed. A [kick] (radians
  /// per second) knocks it on its way first: a heading that holds but whose ground changed.
  void settle(double target, double now, {double kick = 0}) {
    final from = angleAt(now);
    final v = velocityAt(now) + kick;
    _target = target;
    _base = from;
    _start = now;
    _searching = false;
    _spring = SpringSimulation(spring, from, target, v, tolerance: const Tolerance(distance: 0.002, velocity: 0.01));
  }

  /// Holds [angle] at once (reduced motion, or a first frame with nothing to travel).
  void jump(double angle) {
    _target = angle;
    _base = angle;
    _searching = false;
    _spring = null;
  }

  double angleAt(double t) {
    final dt = math.max(0.0, t - _start);
    if (_searching) {
      final ramp = _smooth(dt / 0.45);
      return _base + ramp * (wanderAmplitude * math.sin(1.7 * dt) + wanderAmplitude * 0.42 * math.sin(4.3 * dt + 0.6));
    }
    final s = _spring;
    if (s == null) return _target;
    return s.isDone(dt) ? _target : s.x(dt);
  }

  double velocityAt(double t) {
    final dt = math.max(0.0, t - _start);
    if (_searching) {
      const h = 1 / 240;
      return (angleAt(t + h) - angleAt(t)) / h;
    }
    final s = _spring;
    if (s == null || s.isDone(dt)) return 0;
    return s.dx(dt);
  }

  /// Nothing more will move until the next call (a searching needle never settles).
  bool settledAt(double t) {
    if (_searching) return false;
    final s = _spring;
    return s == null || s.isDone(math.max(0.0, t - _start));
  }
}

/// A metronome arm: it ticks a number of times (one swing from side to side every 0.6 s, a tick
/// at each end of a swing), then comes back upright with a small sway. Paused, it leans on the
/// side of the slot and stays there.
class MetronomeSim {
  /// One swing, side to side.
  static const double swing = 0.6;

  /// The swing's reach either side of upright (the slot allows about 12 degrees).
  static final double amplitude = _deg(11.5);

  /// The lean of a paused arm resting on the slot's left side.
  static final double lean = -_deg(10.5);

  /// The return to upright after the last tick.
  static const double rest = 0.55;

  int _ticks = 0;
  double _start = 0;
  bool _paused = false;
  double _from = 0;
  double _leanTime = 0.45;

  int get ticks => _ticks;
  bool get paused => _paused;

  /// Ticks [count] times (at most 7) from [now].
  void run(int count, double now) {
    _from = angleAt(now);
    _ticks = count.clamp(0, 7);
    _paused = false;
    _start = now;
  }

  /// Leans against the slot from [now] (or at once when [now] is null).
  void pause(double? now) {
    _from = now == null ? lean : angleAt(now);
    _leanTime = now == null ? 0 : 0.45;
    _paused = true;
    _ticks = 0;
    _start = now ?? 0;
  }

  /// Upright and still at once.
  void still() {
    _from = 0;
    _paused = false;
    _ticks = 0;
    _start = 0;
  }

  /// When the [k]th tick (from 0) lands: the arm at the end of its swing.
  double tickTime(int k) => swing / 2 + swing * k;

  /// How long the whole run takes, ticks and return.
  double get duration => _paused ? _leanTime : (_ticks == 0 ? 0.0 : tickTime(_ticks - 1) + rest);

  /// How many ticks have landed by [t].
  int ticksBy(double t) {
    if (_paused || _ticks == 0) return 0;
    final dt = t - _start;
    var n = 0;
    for (var k = 0; k < _ticks; k++) {
      if (dt + 1e-9 >= tickTime(k)) n++;
    }
    return n;
  }

  double angleAt(double t) {
    final dt = math.max(0.0, t - _start);
    if (_paused) return _leanTime == 0 ? lean : _from + (lean - _from) * _easeInOutSine(dt / _leanTime);
    if (_ticks == 0) return 0;
    final last = tickTime(_ticks - 1);
    if (dt <= last) {
      // A pendulum from upright: the first swing reaches the right end at 0.3 s, then each 0.6 s
      // swing goes end to end. The start blends from wherever the arm was.
      final pendulum = amplitude * math.sin(math.pi * dt / swing);
      final blend = _smooth(dt / (swing / 2));
      return _from * (1 - blend) + pendulum;
    }
    // Back to upright from the last end, a small sway past the middle and still.
    final end = amplitude * math.sin(math.pi * last / swing);
    final x = ((dt - last) / rest).clamp(0.0, 1.0);
    return end * ((1 - _easeInOutSine(x)) - 0.12 * math.sin(math.pi * x));
  }

  /// Where the sliding weight rides on the arm, as a share of the arm from the pin: it slides out
  /// a touch as the arm passes the middle at speed, and back as it slows at each end.
  double weightAt(double t) {
    final a = angleAt(t).abs() / amplitude;
    final moving = !_paused && _ticks > 0 && (t - _start) < duration;
    return 0.62 + (moving ? 0.03 * (1 - math.min(1.0, a * a)) : 0);
  }

  bool settledAt(double t) => (t - _start) >= duration;
}

/// How a stopwatch's hands move.
enum StopwatchMode {
  /// The long hand stands at the stage it was last sent to.
  stages,

  /// The long hand sweeps on, one turn every 3 s.
  running,

  /// Both hands go to 12 with a small bounce.
  done,

  /// The start of a timed paper: the long hand runs one full turn round the dial and lands on
  /// the 12 it left from while the small hand holds ([StopwatchSim.lap]).
  lap,
}

/// Two stopwatch hands: the long one steps round to one position per stage with an eased sweep,
/// sweeps on in running mode, and with the small one snaps to 12 with a small bounce when done.
class StopwatchSim {
  StopwatchSim({this.stageCount = 3});

  /// How many stages share the dial; stage `i` stands at `(i + 1) / (stageCount + 1)` of a turn,
  /// so the last stage is short of 12 and done closes the turn.
  final int stageCount;

  static const double sweep = 0.55;
  static const double turn = 2 * math.pi;

  /// One turn of the long hand in running mode.
  static const double runPeriod = 3.0;

  /// Slightly underdamped: a small bounce at 12.
  static const SpringDescription snap = SpringDescription(mass: 1, stiffness: 260, damping: 20);

  StopwatchMode _mode = StopwatchMode.stages;
  double _start = 0;
  double _longFrom = 0;
  double _longTo = 0;
  double _shortFrom = 0;
  double _shortTo = 0;
  double _runVelocity = 0;
  SpringSimulation? _longSpring;
  SpringSimulation? _shortSpring;

  StopwatchMode get mode => _mode;

  /// The long hand's place for [stage] (clamped to the dial's stages).
  double stageAngle(int stage) => turn * (stage.clamp(-1, stageCount - 1) + 1) / (stageCount + 1);

  /// The small hand counts stages: a twelfth of a turn each.
  double shortStageAngle(int stage) => turn / 12 * (stage.clamp(-1, stageCount - 1) + 1);

  /// Sweeps the long hand on to [stage]'s place (never backwards) from [now].
  void advance(int stage, double now) {
    _longFrom = longAt(now);
    _shortFrom = shortAt(now);
    var to = stageAngle(stage);
    while (to < _longFrom - 1e-6) {
      to += turn;
    }
    _longTo = to;
    _shortTo = shortStageAngle(stage);
    _mode = StopwatchMode.stages;
    _start = now;
    _longSpring = null;
    _shortSpring = null;
  }

  /// The long hand sweeps on from where it is.
  void run(double now) {
    _longFrom = longAt(now);
    _shortFrom = shortAt(now);
    _mode = StopwatchMode.running;
    _runVelocity = turn / runPeriod;
    _start = now;
  }

  /// Both hands to 12: the long one on round to the next 12, the small one to the nearest.
  void done(double now) {
    final long = longAt(now);
    final short = shortAt(now);
    final longTo = (long / turn - 1e-9).ceil() * turn;
    final shortTo = (short / turn).round() * turn;
    _longSpring = SpringSimulation(snap, long, longTo, _mode == StopwatchMode.running ? _runVelocity : 0);
    _shortSpring = SpringSimulation(snap, short, shortTo, 0);
    _longTo = longTo;
    _shortTo = shortTo;
    _mode = StopwatchMode.done;
    _start = now;
  }

  /// One full turn of the long hand from where it stands: it holds for [lapLead] while the dial
  /// fades in where the stub was, then turns over [lapDuration] on the sweep curve (slow away,
  /// even through the bottom, soft onto 12), so the whole turn is seen and lands on the same place
  /// one turn on. The small hand holds: the paper starts from zero.
  void lap(double now) {
    _longFrom = longAt(now);
    _shortFrom = shortAt(now);
    _longTo = _longFrom + turn;
    _shortTo = _shortFrom;
    _mode = StopwatchMode.lap;
    _start = now;
    _longSpring = null;
    _shortSpring = null;
  }

  /// The hold before a [lap] turns, in seconds: the dial fades in (0.9 to 1) over it, so the turn
  /// starts where the eye can already see it (APP-PASS AP2-01, M02; owner 15 Oct, "the clock
  /// doing a 360").
  static const double lapLead = 0.16;

  /// How long a [lap]'s turn takes, in seconds: the motion system's sweep (700 ms). The ticket's
  /// hold is lead + turn + a 60 ms rest (PracticeComposerKeys.clockHold, 920 ms, under the T2 cap
  /// of 1200 ms). The paper's clock reads the server's end time, so the hold costs no time.
  static const double lapDuration = 0.70;

  /// When the long hand reaches 12 again, in seconds after [lap] was called.
  static const double lapLanded = lapLead + lapDuration;

  /// MotionCurves.sweep, (0.45, 0, 0.55, 1).
  static const Cubic lapCurve = Cubic(0.45, 0, 0.55, 1);

  double _lapEased(double t) {
    final p = (t - _start - lapLead) / lapDuration;
    // Lands exactly on 12, whatever the rounding of lead + turn.
    return p >= 1 - 1e-9 ? 1.0 : lapCurve.transform(p.clamp(0.0, 1.0));
  }

  /// Puts the hands at a pose at once (reduced motion, first frame).
  void jump({required double long, required double short, StopwatchMode mode = StopwatchMode.stages}) {
    _longFrom = _longTo = long;
    _shortFrom = _shortTo = short;
    _mode = mode;
    _longSpring = null;
    _shortSpring = null;
    _start = 0;
  }

  double _eased(double t) => const Cubic(0.16, 1, 0.3, 1).transform(((t - _start) / sweep).clamp(0.0, 1.0));

  double longAt(double t) {
    final dt = math.max(0.0, t - _start);
    switch (_mode) {
      case StopwatchMode.stages:
        return _longFrom + (_longTo - _longFrom) * _eased(t);
      case StopwatchMode.running:
        // Eases up to speed over the first 0.4 s.
        const ramp = 0.4;
        final travelled = dt < ramp ? _runVelocity * dt * dt / (2 * ramp) : _runVelocity * (ramp / 2 + dt - ramp);
        return _longFrom + travelled;
      case StopwatchMode.done:
        final s = _longSpring;
        return s == null || s.isDone(dt) ? _longTo : s.x(dt);
      case StopwatchMode.lap:
        return _longFrom + (_longTo - _longFrom) * _lapEased(t);
    }
  }

  double shortAt(double t) {
    final dt = math.max(0.0, t - _start);
    switch (_mode) {
      case StopwatchMode.stages:
        return _shortFrom + (_shortTo - _shortFrom) * _eased(t);
      case StopwatchMode.running:
        return _shortFrom + (longAt(t) - _longFrom) / 12;
      case StopwatchMode.done:
        final s = _shortSpring;
        return s == null || s.isDone(dt) ? _shortTo : s.x(dt);
      case StopwatchMode.lap:
        return _shortFrom + (_shortTo - _shortFrom) * _lapEased(t);
    }
  }

  bool settledAt(double t) {
    final dt = t - _start;
    return switch (_mode) {
      StopwatchMode.stages => dt >= sweep,
      StopwatchMode.running => false,
      StopwatchMode.done => (_longSpring?.isDone(dt) ?? true) && (_shortSpring?.isDone(dt) ?? true),
      StopwatchMode.lap => dt >= lapLanded - 1e-9,
    };
  }
}

/// A desk bell: one ring rocks the dome on its base (three damped swings) and sends two rings out
/// from the knob, one after the other.
class BellSim {
  /// One swing of the rock.
  static const double period = 0.3;

  /// Three swings.
  static const double wobble = period * 3;

  /// How long each ring takes to spread and fade.
  static const double ringLife = 0.75;

  /// The second ring leaves this long after the first.
  static const double ringGap = 0.16;

  static final double amplitude = _deg(6.5);

  double? _start;

  /// Rings from [now].
  void ring(double now) => _start = now;

  /// Stops any ring at once.
  void still() => _start = null;

  double get duration => math.max(wobble, ringGap + ringLife);

  /// The rock about the base, radians.
  double angleAt(double t) {
    final s = _start;
    if (s == null) return 0;
    final dt = t - s;
    if (dt <= 0 || dt >= wobble) return 0;
    final envelope = math.exp(-dt / 0.32) * (1 - _smooth((dt - wobble + 0.15) / 0.15));
    return amplitude * envelope * math.sin(2 * math.pi * dt / period);
  }

  /// Ring [i] (0 or 1): how far it has spread (0 to 1), or null when it is not showing.
  double? ringAt(int i, double t) {
    final s = _start;
    if (s == null) return null;
    final dt = t - s - i * ringGap;
    if (dt <= 0 || dt >= ringLife) return null;
    return dt / ringLife;
  }

  bool settledAt(double t) {
    final s = _start;
    return s == null || t - s >= duration;
  }
}
