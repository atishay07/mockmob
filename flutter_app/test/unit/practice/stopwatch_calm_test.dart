// Owner, 19 Oct 3:05 pm: "in the [Start sheet], on Full mock, that card animation with the clock,
// the two arrows of the clocks"; 3:25 pm: "You can keep the clock animation from the full mockup
// card. Just fix it." (H4); 20 Oct: "In this card, the clock animation is still broken." (I3). The
// full turn read as a twitch on his phone, so the start is one calm ease onto 12. Before, these
// locked what made the turn look wrong: a spin of about
// 935 degrees a second, a hand that started while the dial was a ghost over the stub's "50",
// volt hands on the white enamel on Night (about 1.1:1), and a 12 that missed the lime marker.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart';
import 'package:mockmob/core/motion/motion_tokens.g.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/practice_composer.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  group('the start is one calm motion, never a turn (20 Oct, I3)', () {
    // Sampled at 60 Hz (a phone's frames) across the whole hold.
    List<double> samples() {
      final sim = StopwatchSim()..lap(0);
      final hold = PracticeComposerKeys.clockHold.inMicroseconds / 1e6;
      return [for (var i = 0; i <= (hold * 60).ceil(); i++) sim.longAt(i / 60)];
    }

    test('the long hand travels 60 degrees in all, far short of a turn (it was 360: a twitch)', () {
      final a = samples();
      final travel = a.reduce(math.max) - a.reduce(math.min);
      expect(travel * 180 / math.pi, closeTo(60, 1e-6));
      expect(travel, lessThan(StopwatchSim.turn / 4));
      final sim = StopwatchSim()..lap(0);
      final small = sim.shortAt(StopwatchSim.lapLanded) - sim.shortAt(0);
      expect(small * 180 / math.pi, closeTo(30, 1e-6));
    });

    test('it moves for 400 to 600 ms on the motion system ease-out, never a Curves.ease', () {
      expect(StopwatchSim.lapDuration * 1000, inInclusiveRange(400, 600));
      expect(StopwatchSim.lapCurve, same(MotionCurves.glide));
    });

    test('it never moves more than 8 degrees in a 60 Hz frame (the turn peaked at 11)', () {
      final a = samples();
      var peak = 0.0;
      for (var i = 1; i < a.length; i++) {
        peak = math.max(peak, (a[i] - a[i - 1]).abs());
      }
      expect(peak * 180 / math.pi, lessThan(8));
      expect(peak, greaterThan(0));
    });

    test('it only goes forward and never passes 12 (no overshoot or bounce)', () {
      final a = samples();
      for (var i = 1; i < a.length; i++) {
        expect(a[i], greaterThanOrEqualTo(a[i - 1] - 1e-9));
        expect(a[i], lessThanOrEqualTo(1e-9));
      }
      expect(a.last, closeTo(0, 1e-9));
    });

    test('the hands wait until the 220 ms tear is over and the dial is fully in', () {
      expect(StopwatchSim.lapLead * 1000, greaterThanOrEqualTo(220));
      final sim = StopwatchSim()..lap(0);
      expect(sim.longAt(0.22), closeTo(StopwatchSim.lapLong, 1e-9));
      expect(sim.shortAt(0.22), closeTo(StopwatchSim.lapShort, 1e-9));
    });

    test('the hands are still on 12 for at least 200 ms before the sheet lets go', () {
      final rest = PracticeComposerKeys.clockHold.inMilliseconds - (StopwatchSim.lapLanded * 1000).round();
      expect(rest, greaterThanOrEqualTo(200));
      expect(PracticeComposerKeys.clockHold.inMilliseconds, lessThanOrEqualTo(1200));
    });

    test('done settles on 12 without a bounce (the Getting ready dial bounced past and back)', () {
      final sim = StopwatchSim()..advance(2, 0);
      sim.done(1);
      var last = sim.longAt(1);
      for (var i = 1; i <= 120; i++) {
        final a = sim.longAt(1 + i / 60);
        expect(a, lessThanOrEqualTo(StopwatchSim.turn + 1e-6));
        expect(a, greaterThanOrEqualTo(last - 1e-9));
        last = a;
      }
    });
  });

  testWidgets('under reduced motion the hands do not move: 12 at once, no clock runs', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: const MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: Center(child: HybridStopwatch(height: 80, mode: StopwatchMode.lap)),
        ),
      ),
    );
    expect(tester.hasRunningAnimations, isFalse);
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.hasRunningAnimations, isFalse);
    expect(tester.takeException(), isNull);
  });

  test('12 is the lime marker: the hands turn about the measured 12 tick (6.5 degrees)', () {
    // Measured on assets/art/hybrid-stopwatch.webp: the 12 tick at (301.5, 282.5) px, the pin at
    // the spec pivot. 4.4 degrees left the hand at rest about 2 degrees short of the marker.
    const spec = HybridSpec.stopwatch;
    final pin = Offset(spec.pivot.dx * spec.width, spec.pivot.dy * spec.height);
    final twelve = math.atan2(301.5 - pin.dx, pin.dy - 282.5);
    expect(spec.faceTilt, closeTo(twelve, 0.3 * math.pi / 180));
  });

  group('the hands read on the white enamel in both themes', () {
    const enamel = Color(0xFFEFEDE7);

    testWidgets('Night and Day ink the hands the same readable olive, at least 4.5:1', (tester) async {
      final inks = <Brightness, HybridInk>{};
      for (final b in Brightness.values) {
        await tester.pumpWidget(
          MaterialApp(
            theme: buildTheme(b),
            home: Builder(
              builder: (context) {
                inks[b] = HybridInk.onEnamel(context);
                return const SizedBox();
              },
            ),
          ),
        );
      }
      expect(inks[Brightness.dark]!.fill, inks[Brightness.light]!.fill);
      expect(_contrast(inks[Brightness.dark]!.fill, enamel), greaterThanOrEqualTo(4.5));
      // The page's volt, which they used on Night, all but vanished on that face.
      expect(_contrast(MmColors.dark.volt, enamel), lessThan(1.5));
    });
  });
}
