import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart';

void main() {
  group('NeedleSim (compass)', () {
    test('settles on its heading with an overshoot, then holds still', () {
      final needle = NeedleSim(angle: -1.1)..settle(0, 0);
      var most = -10.0;
      for (var t = 0.0; t < 3; t += 1 / 120) {
        most = math.max(most, needle.angleAt(t));
      }
      expect(most, greaterThan(0.05), reason: 'it swings past the lubber line once');
      expect(needle.settledAt(3), isTrue);
      expect(needle.angleAt(3), closeTo(0, 1e-9));
      expect(needle.target, 0);
    });

    test('a new heading mid-swing starts from where the needle is, with no jump', () {
      final needle = NeedleSim(angle: -1)..settle(0, 0);
      final before = needle.angleAt(0.2);
      needle.settle(0.8, 0.2);
      expect(needle.angleAt(0.2), closeTo(before, 1e-9));
      expect(needle.angleAt(4), closeTo(0.8, 1e-9));
    });

    test('a kick knocks it off the same heading and it comes back', () {
      final needle = NeedleSim()..jump(0);
      needle.settle(0, 1, kick: 9);
      expect(needle.settledAt(1.1), isFalse);
      expect(needle.angleAt(1.1).abs(), greaterThan(0.1));
      expect(needle.angleAt(5), closeTo(0, 1e-9));
    });

    test('searching wanders near where it began and never settles', () {
      final needle = NeedleSim(angle: 0.3)..search(0);
      for (var t = 0.0; t < 10; t += 0.05) {
        expect((needle.angleAt(t) - 0.3).abs(), lessThan(NeedleSim.wanderAmplitude * 1.5));
      }
      expect(needle.settledAt(100), isFalse);
      needle.settle(0, 10);
      expect(needle.angleAt(14), closeTo(0, 1e-9));
    });

    test('jump is the reduced-motion pose: the heading at once, nothing to travel', () {
      final needle = NeedleSim(angle: 2)..jump(0.4);
      expect(needle.angleAt(0), 0.4);
      expect(needle.settledAt(0), isTrue);
    });
  });

  group('MetronomeSim', () {
    test('ticks exactly as many times as it is asked, then stands upright', () {
      final arm = MetronomeSim()..run(4, 0);
      expect(arm.ticksBy(arm.tickTime(1)), 2);
      expect(arm.ticksBy(arm.duration), 4);
      expect(arm.ticksBy(100), 4);
      expect(arm.angleAt(arm.duration), closeTo(0, 1e-9));
      expect(arm.settledAt(arm.duration), isTrue);
    });

    test('each tick lands at the end of a swing, alternating sides, 0.6 s apart', () {
      final arm = MetronomeSim()..run(3, 0);
      expect(arm.tickTime(1) - arm.tickTime(0), closeTo(MetronomeSim.swing, 1e-9));
      expect(arm.angleAt(arm.tickTime(0)), closeTo(MetronomeSim.amplitude, 1e-6));
      expect(arm.angleAt(arm.tickTime(1)), closeTo(-MetronomeSim.amplitude, 1e-6));
      expect(arm.angleAt(arm.tickTime(2)), closeTo(MetronomeSim.amplitude, 1e-6));
    });

    test('a week has at most seven days to tick', () {
      final arm = MetronomeSim()..run(12, 0);
      expect(arm.ticks, 7);
      expect(arm.ticksBy(100), 7);
    });

    test('paused, it leans on the slot and stays; at once under reduced motion', () {
      final eased = MetronomeSim()..pause(0);
      expect(eased.angleAt(0), closeTo(0, 1e-9));
      expect(eased.angleAt(1), closeTo(MetronomeSim.lean, 1e-9));
      expect(eased.ticksBy(10), 0);
      final still = MetronomeSim()..pause(null);
      expect(still.angleAt(0), MetronomeSim.lean);
      expect(still.settledAt(0), isTrue);
    });

    test('nothing counted is an upright, still arm', () {
      final arm = MetronomeSim()..run(0, 0);
      expect(arm.angleAt(0.5), 0);
      expect(arm.settledAt(0), isTrue);
    });

    test('the weight rides out a touch while it swings and is back at rest', () {
      final arm = MetronomeSim()..run(2, 0);
      expect(arm.weightAt(0.6), greaterThan(arm.weightAt(0.3)));
      expect(arm.weightAt(arm.duration + 1), closeTo(0.62, 1e-9));
    });
  });

  group('StopwatchSim', () {
    test('each stage has its own stop, the last short of 12', () {
      final sim = StopwatchSim();
      expect(sim.stageAngle(0), closeTo(math.pi / 2, 1e-9));
      expect(sim.stageAngle(1), closeTo(math.pi, 1e-9));
      expect(sim.stageAngle(2), closeTo(3 * math.pi / 2, 1e-9));
    });

    test('advance sweeps the long hand to the stage and holds it there', () {
      final sim = StopwatchSim()..jump(long: 0, short: 0);
      sim.advance(0, 0);
      expect(sim.longAt(0), 0);
      expect(sim.longAt(StopwatchSim.sweep), closeTo(sim.stageAngle(0), 1e-9));
      expect(sim.settledAt(StopwatchSim.sweep), isTrue);
      sim.advance(1, 1);
      expect(sim.longAt(1), closeTo(sim.stageAngle(0), 1e-9));
      expect(sim.longAt(2), closeTo(sim.stageAngle(1), 1e-9));
      expect(sim.shortAt(2), closeTo(sim.shortStageAngle(1), 1e-9));
    });

    test('the hand never runs backwards: an earlier stop goes on round the dial', () {
      final sim = StopwatchSim()..jump(long: 3 * math.pi / 2, short: 0);
      sim.advance(0, 0);
      expect(sim.longAt(1), closeTo(2 * math.pi + math.pi / 2, 1e-9));
    });

    test('done snaps both hands to 12 with a small bounce', () {
      final sim = StopwatchSim()..jump(long: 3 * math.pi / 2, short: math.pi / 6);
      sim.done(0);
      var most = 0.0;
      for (var t = 0.0; t < 2; t += 1 / 240) {
        most = math.max(most, sim.longAt(t));
      }
      expect(most, greaterThan(2 * math.pi), reason: 'it bounces past 12');
      expect(sim.settledAt(3), isTrue);
      expect(sim.longAt(3), closeTo(2 * math.pi, 1e-9));
      expect(sim.shortAt(3), closeTo(0, 1e-9));
    });

    test('running sweeps on and never settles', () {
      final sim = StopwatchSim()..jump(long: 0, short: 0);
      sim.run(0);
      expect(sim.longAt(1), greaterThan(sim.longAt(0.5)));
      expect(sim.longAt(4), greaterThan(sim.longAt(1)));
      expect(sim.settledAt(100), isFalse);
    });
  });

  group('BellSim', () {
    test('one ring rocks three times and sends two rings, then the bell is still', () {
      final bell = BellSim()..ring(0);
      var crossings = 0;
      var last = bell.angleAt(0.001);
      for (var t = 0.002; t < BellSim.wobble; t += 0.001) {
        final a = bell.angleAt(t);
        if (a.sign != last.sign && a != 0 && last != 0) crossings++;
        last = a;
      }
      expect(crossings, inInclusiveRange(4, 6), reason: 'three swings: there and back three times');
      expect(bell.angleAt(BellSim.wobble), 0);
      expect(bell.ringAt(0, 0.1), isNotNull);
      expect(bell.ringAt(1, 0.1), isNull, reason: 'the second ring leaves later');
      expect(bell.ringAt(1, 0.3), isNotNull);
      expect(bell.ringAt(0, BellSim.ringLife + 0.01), isNull);
      expect(bell.settledAt(bell.duration), isTrue);
    });

    test('a bell never rung is still', () {
      final bell = BellSim();
      expect(bell.angleAt(1), 0);
      expect(bell.ringAt(0, 1), isNull);
      expect(bell.settledAt(0), isTrue);
    });
  });

  group('HybridSpec', () {
    test('the four renders keep their measured sizes and pins inside the picture', () {
      for (final spec in [HybridSpec.compass, HybridSpec.metronome, HybridSpec.stopwatch, HybridSpec.deskbell]) {
        expect(spec.asset, 'assets/art/hybrid-${spec.name}.webp');
        expect(spec.pivot.dx, inExclusiveRange(0, 1));
        expect(spec.pivot.dy, inExclusiveRange(0, 1));
      }
      expect(HybridSpec.compass.aspect, closeTo(751 / 768, 1e-9));
    });
  });
}
