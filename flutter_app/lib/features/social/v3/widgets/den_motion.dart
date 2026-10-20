// Small motion helpers for the den (spec 5.6 M1, M12, M13): a spring as a 0..1 curve (so a spring
// token can ride an interval of one timeline controller), and a timeline value that reads a window of
// a controller in milliseconds.

import 'package:flutter/animation.dart';
import 'package:flutter/physics.dart';

/// A spring token (Springs.iconPop, Springs.celebrate) as a Curve: 0 to 1 with the spring's own
/// overshoot, settled at t = 1. The interval it rides should be the spring's token duration.
class SpringCurve extends Curve {
  const SpringCurve(this.spring, {this.settle = const Duration(milliseconds: 420)});

  final SpringDescription spring;

  /// The token duration the curve's t = 1 maps to.
  final Duration settle;

  @override
  double transformInternal(double t) {
    if (t >= 1) return 1;
    final sim = SpringSimulation(spring, 0, 1, 0);
    return sim.x(t * settle.inMicroseconds / 1e6);
  }
}

/// The share (0..1, unclamped curve output) of a window [startMs, startMs + lengthMs] at [ms].
double windowOf(double ms, double startMs, double lengthMs, [Curve curve = Curves.linear]) {
  if (lengthMs <= 0) return ms >= startMs ? 1 : 0;
  final p = ((ms - startMs) / lengthMs).clamp(0.0, 1.0);
  return curve.transform(p);
}

/// The den's idle life (pass-1020 MOB-MINIMAL 4.2), in one place for the den and the Fold rig (A12 reads
/// these: fold_puppet.dart owns the loops themselves). Characters move; chrome confirms. Every loop is off
/// under reduced motion, stops 12 s after the last touch, under an open sheet and in a hidden tab.
abstract final class DenLife {
  /// Enter the den: light 0 to 420 ms, then each Fold rises 14 dp with about 6% overshoot, 90 ms apart,
  /// 360 ms each, from 200 ms. Reduced motion: a 120 ms cross-fade, still Folds.
  static const Duration lightIn = Duration(milliseconds: 420);
  static const Duration foldsFrom = Duration(milliseconds: 200);
  static const Duration foldStep = Duration(milliseconds: 90);
  static const Duration foldRise = Duration(milliseconds: 360);
  static const double riseDp = 14;
  static const double overshoot = 0.06;

  /// Breathe: scaleY 1 to 1.028 from the boots, a 3600 ms cosine, offset 600 ms per member.
  static const Duration breathe = Duration(milliseconds: 3600);
  static const Duration breatheOffset = Duration(milliseconds: 600);
  static const double breatheScale = 1.028;

  /// Blink: the real eye squashes to 8% for 150 ms, every 4 to 7 s, never in sync.
  static const Duration blink = Duration(milliseconds: 150);
  static const Duration blinkEveryMin = Duration(seconds: 4);
  static const Duration blinkEveryMax = Duration(seconds: 7);
  static const double blinkTo = 0.08;

  /// Glance: one Fold looks at a neighbour and back: 160 ms out, a 0.7 to 1.2 s hold, 160 ms back; every
  /// 8 to 14 s, one at a time.
  static const Duration glanceTurn = Duration(milliseconds: 160);
  static const Duration glanceHoldMin = Duration(milliseconds: 700);
  static const Duration glanceHoldMax = Duration(milliseconds: 1200);
  static const Duration glanceEveryMin = Duration(seconds: 8);
  static const Duration glanceEveryMax = Duration(seconds: 14);

  /// Micro-act: one Fold at a time: a 3 degree nod, a 1.6 s think, or a 2 degree prop fidget, every 10 to
  /// 16 s.
  static const Duration microEveryMin = Duration(seconds: 10);
  static const Duration microEveryMax = Duration(seconds: 16);
  static const Duration think = Duration(milliseconds: 1600);
  static const double nodDegrees = 3;
  static const double fidgetDegrees = 2;

  /// All idle stops this long after the last touch.
  static const Duration idleStopAfter = Duration(seconds: 12);

  /// Studying now: bulb 150 ms, beam 300 ms, two 500 ms hops to the desk (0.85 scale for depth), the
  /// think pose; when study stops the lamp dims over 600 ms and the Fold hops back.
  static const Duration deskBulb = Duration(milliseconds: 150);
  static const Duration deskBeam = Duration(milliseconds: 300);
  static const Duration deskHop = Duration(milliseconds: 500);
  static const Duration deskDim = Duration(milliseconds: 600);
  static const double deskScale = 0.85;

  /// A seeded wait in [min, max] for member [i] on beat [n], so no two Folds share a beat.
  static Duration seeded(Duration min, Duration max, int i, int n) {
    final span = max.inMilliseconds - min.inMilliseconds;
    final h = ((i + 1) * 2654435761 + n * 40503) & 0x7fffffff;
    return Duration(milliseconds: min.inMilliseconds + h % (span + 1));
  }
}
