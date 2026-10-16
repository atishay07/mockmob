// AP1-13 (M18): a sheet let go on its way down closes with the finger's speed; a slow release
// above half stays; a key inside the sheet closes it the usual way.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

Widget _opener() => Builder(
  builder: (context) => Center(
    child: TextButton(
      onPressed: () => showMmSheet<void>(
        context: context,
        title: 'This week',
        builder: (context) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 240, child: Text('Sheet body')),
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
          ],
        ),
      ),
      child: const Text('Open'),
    ),
  ),
);

void main() {
  test('the close takes the release speed; an upward release closes calmly', () {
    final fast = MmSheetRoute.closeAfterRelease(from: 0.8, velocity: -6, reduced: false)!;
    final slow = MmSheetRoute.closeAfterRelease(from: 0.8, velocity: -0.5, reduced: false)!;
    expect(fast.dx(0), -6);
    expect(fast.x(0.08), lessThan(slow.x(0.08)), reason: 'a flick leaves faster');
    expect(MmSheetRoute.closeAfterRelease(from: 0.8, velocity: 2, reduced: false)!.dx(0), 0);
    expect(MmSheetRoute.closeAfterRelease(from: 0.8, velocity: -6, reduced: true), isNull);
    expect(MmSheetRoute.closeAfterRelease(from: 0.8, velocity: null, reduced: false), isNull);
  });

  testWidgets('a fast flick from near the top closes the sheet', (tester) async {
    await pumpMockmob(tester, _opener());
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Sheet body'), findsOneWidget);
    await tester.fling(find.text('Sheet body'), const Offset(0, 120), 2400);
    await tester.pumpAndSettle();
    expect(find.text('Sheet body'), findsNothing);
  });

  testWidgets('a slow short drag returns; a key still closes it', (tester) async {
    await pumpMockmob(tester, _opener());
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    final gesture = await tester.startGesture(tester.getCenter(find.text('Sheet body')));
    for (var i = 0; i < 10; i++) {
      await gesture.moveBy(const Offset(0, 4));
      await tester.pump(const Duration(milliseconds: 50));
    }
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('Sheet body'), findsOneWidget, reason: 'a slow 40 dp drag settles back');
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(find.text('Sheet body'), findsNothing);
  });
}
