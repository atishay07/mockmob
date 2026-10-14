import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';

import 'motion_harness.dart';

void main() {
  test('mmScrubIndex spreads points edge to edge and clamps', () {
    expect(mmScrubIndex(0, 300, 7), 0);
    expect(mmScrubIndex(300, 300, 7), 6);
    expect(mmScrubIndex(150, 300, 7), 3);
    expect(mmScrubIndex(26, 300, 7), 1, reason: 'nearest point, 50 dp apart');
    expect(mmScrubIndex(-40, 300, 7), 0);
    expect(mmScrubIndex(999, 300, 7), 6);
    expect(mmScrubIndex(100, 300, 1), 0);
    expect(mmScrubIndex(100, 300, 0), -1);
    for (var i = 0; i < 7; i++) {
      expect(mmScrubIndex(mmScrubX(i, 300, 7), 300, 7), i);
    }
  });

  testWidgets('a hold and slide reports x and index, ticking once per index change', (tester) async {
    final haptics = RecordingHaptics();
    final value = ValueNotifier<MmScrubValue?>(null);
    addTearDown(value.dispose);
    final seen = <int>[];
    var repaints = 0;
    value.addListener(() => repaints++);
    await tester.pumpWidget(motionApp(
      Align(
        alignment: Alignment.topLeft,
        child: MmScrub(
          count: 7,
          value: value,
          onIndex: seen.add,
          child: const SizedBox(width: 300, height: 80),
        ),
      ),
      haptics: haptics,
    ));
    final origin = tester.getTopLeft(find.byType(MmScrub));
    final gesture = await tester.startGesture(origin + const Offset(2, 40));
    await tester.pump(const Duration(milliseconds: 600));
    expect(value.value?.index, 0, reason: 'the long press started the scrub');
    expect(haptics.count('selection'), 1);

    // Slide in 5 dp steps to the right edge: 6 index changes.
    for (var x = 7.0; x <= 300; x += 5) {
      await gesture.moveTo(origin + Offset(x, 40));
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(value.value?.index, 6);
    expect(value.value!.x, closeTo(297, 0.5));
    expect(seen, [0, 1, 2, 3, 4, 5, 6]);
    expect(haptics.count('selection'), 7, reason: 'one tick per index, none for moves inside one');
    expect(repaints, greaterThan(7), reason: 'x is continuous: every move notifies');

    await gesture.up();
    await tester.pump();
    expect(value.value, isNull, reason: 'released, the cursor goes');
  });

  testWidgets('a plain tap does not scrub', (tester) async {
    final value = ValueNotifier<MmScrubValue?>(null);
    addTearDown(value.dispose);
    await tester.pumpWidget(motionApp(Center(child: MmScrub(count: 5, value: value, child: const SizedBox(width: 200, height: 60)))));
    await tester.tap(find.byType(MmScrub));
    await tester.pump();
    expect(value.value, isNull);
  });
}
