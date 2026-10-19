// Owner, 19 Oct 3:05 pm: "in the [Start sheet], on Full mock, that card animation with the clock,
// the two arrows of the clocks"; 3:25 pm: "You can keep the clock animation from the full mockup
// card. Just fix it." (H4). The turn stays; these lock what made it look wrong: a spin of about
// 935 degrees a second, a hand that started while the dial was a ghost over the stub's "50",
// volt hands on the white enamel on Night (about 1.1:1), and a 12 that missed the lime marker.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/practice_composer.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  group('the lap is one calm sweep', () {
    // Sampled at 60 Hz (a phone's frames) across the whole hold.
    List<double> samples() {
      final sim = StopwatchSim()..lap(0);
      final hold = PracticeComposerKeys.clockHold.inMicroseconds / 1e6;
      return [for (var i = 0; i <= (hold * 60).ceil(); i++) sim.longAt(i / 60)];
    }

    test('it never moves more than 12 degrees in a 60 Hz frame (it was 16: a spin)', () {
      final a = samples();
      var peak = 0.0;
      for (var i = 1; i < a.length; i++) {
        peak = math.max(peak, a[i] - a[i - 1]);
      }
      expect(peak * 180 / math.pi, lessThan(12));
      // Still a whole turn inside the hold, not a crawl.
      expect(peak * 180 / math.pi, greaterThan(7.5));
    });

    test('it only goes forward and never passes 12 (no overshoot or bounce)', () {
      final a = samples();
      for (var i = 1; i < a.length; i++) {
        expect(a[i], greaterThanOrEqualTo(a[i - 1] - 1e-9));
        expect(a[i], lessThanOrEqualTo(StopwatchSim.turn + 1e-9));
      }
    });

    test('it settles onto 12: the last 100 ms of the turn move it less than 20 degrees', () {
      final sim = StopwatchSim()..lap(0);
      final before = sim.longAt(StopwatchSim.lapLanded - 0.1);
      expect((StopwatchSim.turn - before) * 180 / math.pi, lessThan(20));
      expect(sim.longAt(StopwatchSim.lapLanded), closeTo(StopwatchSim.turn, 1e-9));
    });

    test('the hand waits until the 220 ms tear is over and the dial is fully in', () {
      expect(StopwatchSim.lapLead * 1000, greaterThanOrEqualTo(220));
      final sim = StopwatchSim()..lap(0);
      expect(sim.longAt(0.22), closeTo(0, 1e-9));
      expect(sim.shortAt(StopwatchSim.lapLanded), closeTo(0, 1e-9));
    });

    test('the hands rest on 12 for at least 100 ms before the sheet lets go', () {
      final rest = PracticeComposerKeys.clockHold.inMilliseconds - (StopwatchSim.lapLanded * 1000).round();
      expect(rest, greaterThanOrEqualTo(100));
      expect(PracticeComposerKeys.clockHold.inMilliseconds, lessThanOrEqualTo(1200));
    });
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
