import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'motion_harness.dart';

void main() {
  group('MmShake', () {
    test('4 dp, three cycles, lands exactly where it started', () {
      var peak = 0.0;
      var crossings = 0;
      var last = 0.0;
      for (var i = 1; i < 1000; i++) {
        final v = MmShake.offsetAt(i / 1000);
        peak = v.abs() > peak ? v.abs() : peak;
        if (last != 0 && v.sign != last.sign) crossings++;
        last = v;
      }
      expect(peak, lessThanOrEqualTo(MmShake.amplitude));
      expect(peak, greaterThan(MmShake.amplitude * 0.7));
      expect(crossings, 5, reason: 'three cycles cross zero five times inside the run');
      expect(MmShake.offsetAt(0), 0);
      expect(MmShake.offsetAt(1), 0);
    });

    testWidgets('a pulse shakes once with the warn haptic; reduced motion does not move', (tester) async {
      final haptics = RecordingHaptics();
      final pulse = ValueNotifier(0);
      addTearDown(pulse.dispose);
      const box = ValueKey('box');
      Future<void> pump({bool reduced = false}) => tester.pumpWidget(motionApp(
            Center(child: MmShake(pulse: pulse, child: const SizedBox(key: box, width: 40, height: 40))),
            haptics: haptics,
            reduced: reduced,
          ));
      await pump();
      final rest = tester.getTopLeft(find.byKey(box));
      pulse.value++;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 20));
      expect(tester.getTopLeft(find.byKey(box)).dx, isNot(rest.dx));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byKey(box)), rest);
      expect(haptics.count('light'), 2, reason: 'warn: two light impacts');

      await pump(reduced: true);
      pulse.value++;
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpAndSettle();
    });
  });

  group('MmObjectReact', () {
    test('gives to 0.94, rises to 1.04, settles at 1, twisting at most 2 degrees', () {
      expect(MmObjectReact.scaleAt(0), 1);
      expect(MmObjectReact.scaleAt(0.22), closeTo(0.94, 1e-6));
      expect(MmObjectReact.scaleAt(0.58), closeTo(1.04, 1e-6));
      expect(MmObjectReact.scaleAt(1), 1);
      expect(MmObjectReact.scaleAt(0.22, amplitude: 0.5), closeTo(0.97, 1e-6));
      for (var i = 0; i <= 100; i++) {
        expect(MmObjectReact.turnAt(i / 100).abs(), lessThanOrEqualTo(2 * 3.14159 / 180 + 1e-9));
      }
    });

    testWidgets('a pulse plays once with a light haptic and rests at identity', (tester) async {
      final haptics = RecordingHaptics();
      final pulse = ValueNotifier(0);
      addTearDown(pulse.dispose);
      await tester.pumpWidget(motionApp(Center(child: MmObjectReact(pulse: pulse, child: const SizedBox(width: 60, height: 60))), haptics: haptics));
      pulse.value++;
      await tester.pump();
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
      expect(haptics.count('light'), 1);
    });
  });

  group('MmLiftSimulation', () {
    test('a released key rises to about 1.03 and settles at 1', () {
      expect(MmPressSpring.overshootFor(0.96), closeTo(1.03, 1e-9));
      expect(MmPressSpring.overshootFor(0.976), closeTo(1.018, 1e-9));
      final sim = MmLiftSimulation(from: 0.96, peak: MmPressSpring.overshootFor(0.96));
      var peak = 0.0;
      var t = 0.0;
      while (!sim.isDone(t) && t < 3) {
        peak = sim.x(t) > peak ? sim.x(t) : peak;
        t += 0.002;
      }
      expect(peak, inInclusiveRange(1.02, 1.04));
      expect(sim.x(t), closeTo(1, 0.002));
      expect(t, lessThan(1.0), reason: 'it settles quickly');
    });
  });

  group('MmFoldExit', () {
    testWidgets('folds the height away, then restores it for an Undo', (tester) async {
      var folded = 0;
      var restored = 0;
      Widget at(bool f) => motionApp(Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              MmFoldExit(
                folded: f,
                onFolded: () => folded++,
                onRestored: () => restored++,
                child: const SizedBox(key: ValueKey('row'), height: 60, width: 200),
              ),
              const SizedBox(key: ValueKey('below'), height: 20, width: 200),
            ],
          ));
      await tester.pumpWidget(at(false));
      final start = tester.getTopLeft(find.byKey(const ValueKey('below'))).dy;
      await tester.pumpWidget(at(true));
      await tester.pump(MmFoldExit.slide);
      expect(tester.getTopLeft(find.byKey(const ValueKey('below'))).dy, closeTo(start, 1), reason: 'the slide comes first');
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byKey(const ValueKey('below'))).dy, closeTo(start - 60, 0.5), reason: 'neighbours glided up');
      expect(folded, 1);
      await tester.pumpWidget(at(false));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byKey(const ValueKey('below'))).dy, closeTo(start, 0.5));
      expect(restored, 1);
    });
  });

  group('stroke draw', () {
    test('mmPathPrefix takes a share of the length across contours', () {
      final path = Path()
        ..moveTo(0, 0)
        ..lineTo(100, 0)
        ..moveTo(0, 10)
        ..lineTo(100, 10);
      double length(Path p) => p.computeMetrics().fold(0.0, (s, m) => s + m.length);
      expect(length(mmPathPrefix(path, 0.25)), closeTo(50, 0.01));
      expect(length(mmPathPrefix(path, 0.75)), closeTo(150, 0.01));
      expect(length(mmPathPrefix(path, 0)), 0);
      expect(length(mmPathPrefix(path, 1)), closeTo(200, 0.01));
    });

    testWidgets('draws in, then rests; reduced motion is simply drawn', (tester) async {
      var drawn = 0;
      await tester.pumpWidget(motionApp(Center(
        child: MmStrokeDraw(size: const Size.square(24), path: MmPaths.checkFor, color: const Color(0xFFFFFFFF), onDrawn: () => drawn++),
      )));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
      expect(drawn, 1);
      await tester.pumpWidget(motionApp(
        Center(child: MmStrokeDraw(key: const ValueKey('r'), size: const Size.square(24), path: MmPaths.checkFor, color: const Color(0xFFFFFFFF))),
        reduced: true,
      ));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('MmPressable', () {
    testWidgets('a tap sinks, lifts past rest, and settles at 1', (tester) async {
      await tester.pumpWidget(motionApp(Center(
        child: MmPressable(onTap: () {}, pressedScale: 0.96, builder: (context, pressed, focused) => const SizedBox(width: 48, height: 48)),
      )));
      double scale() => tester.widget<Transform>(find.descendant(of: find.byType(MmPressable), matching: find.byType(Transform)).first).transform.storage[0];
      final gesture = await tester.startGesture(tester.getCenter(find.byType(MmPressable)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(scale(), closeTo(0.96, 0.005));
      await gesture.up();
      var peak = 0.0;
      await pumpFrames(tester, const Duration(milliseconds: 500), each: () {
        if (scale() > peak) peak = scale();
      });
      expect(peak, greaterThan(1.015));
      expect(peak, lessThanOrEqualTo(1.035));
      await tester.pumpAndSettle();
      expect(scale(), closeTo(1, 0.001));
    });

    testWidgets('a hold past the threshold fires once with a selection tick', (tester) async {
      final haptics = RecordingHaptics();
      var held = 0;
      await tester.pumpWidget(motionApp(
        Center(
          child: MmPressable(
            onTap: () {},
            onLongPressThreshold: () => held++,
            builder: (context, pressed, focused) => const SizedBox(width: 48, height: 48),
          ),
        ),
        haptics: haptics,
      ));
      final gesture = await tester.startGesture(tester.getCenter(find.byType(MmPressable)));
      await tester.pump(const Duration(milliseconds: 300));
      expect(held, 0);
      await tester.pump(const Duration(milliseconds: 300));
      expect(held, 1);
      expect(haptics.count('selection'), 1);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(held, 1);
    });
  });
}
