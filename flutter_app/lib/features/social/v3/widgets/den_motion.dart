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
