import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

void main() {
  test('the quick-start title is one short line that follows the clock', () {
    expect(QuickStartSheet.titleFor(DateTime(2026, 10, 14, 21, 10)), "Pick tonight's work");
    expect(QuickStartSheet.titleFor(DateTime(2026, 10, 14, 10, 0)), "Pick today's work");
  });

  test('the sheet scrim is lighter than the page scrim, and warm in Day', () {
    for (final colors in [MmColors.dark, MmColors.light]) {
      expect(colors.sheetScrim.a, lessThan(colors.scrim.a), reason: 'night: ${colors.isNight}');
    }
    // Day: a warm sepia (red above blue), not the old near-black ink.
    final day = MmColors.light.sheetScrim;
    expect(day.r, greaterThan(day.b));
    expect(day.r, greaterThan(0.25), reason: 'not the near-black ink of the old scrim');
  });

  testWidgets('a bubble row in a narrow slot scales down to fit instead of overrunning', (tester) async {
    await pumpMockmob(
      tester,
      Align(
        alignment: Alignment.topLeft,
        child: SizedBox(width: 120, child: BubbleRow(states: List.filled(16, BubbleState.filled))),
      ),
    );
    final box = tester.getRect(find.byType(BubbleRow));
    expect(box.width, lessThanOrEqualTo(120));
    expect(tester.takeException(), isNull);
    // In a roomy slot it keeps its own size: 16 bubbles of 12 dp and 15 gaps of 4 dp.
    await pumpMockmob(
      tester,
      Align(alignment: Alignment.topLeft, child: BubbleRow(states: List.filled(16, BubbleState.filled))),
    );
    expect(tester.getSize(find.byType(BubbleRow)).width, 16 * 12 + 15 * 4);
  });
}
