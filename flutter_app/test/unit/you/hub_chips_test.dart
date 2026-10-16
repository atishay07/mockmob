import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmChip;
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

/// The sticky row of section chips on You (critic 16 Oct, finding 27).
void main() {
  Future<void> pump(WidgetTester tester, {bool disableAnimations = true}) async {
    await pumpMockmob(
      tester,
      const YouHubScreen(),
      wrapInScaffold: false,
      disableAnimations: disableAnimations,
      size: const Size(384, 853),
      overrides: youOverrides(target: ashaTarget),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('five chips in order: Plan, Look, Study, Alerts, Colleges, each a 48 dp target', (tester) async {
    await pump(tester);
    for (final label in ['Plan', 'Look', 'Study', 'Alerts', 'Colleges']) {
      final chip = find.widgetWithText(MmChip, label);
      expect(chip, findsOneWidget, reason: label);
    }
    final plan = tester.getTopLeft(find.widgetWithText(MmChip, 'Plan')).dx;
    final look = tester.getTopLeft(find.widgetWithText(MmChip, 'Look')).dx;
    final study = tester.getTopLeft(find.widgetWithText(MmChip, 'Study')).dx;
    expect(plan, lessThan(look));
    expect(look, lessThan(study));
    expect(tester.getSize(find.widgetWithText(MmChip, 'Plan')).height, greaterThanOrEqualTo(40));
  });

  testWidgets('a chip scrolls its section to just under the row, and the row stays pinned', (tester) async {
    await pump(tester);
    final study = find.text('Study days');
    expect(tester.getTopLeft(study).dy, greaterThan(853), reason: 'Study days starts below the first screen');
    await tester.tap(find.widgetWithText(MmChip, 'Study'));
    await tester.pumpAndSettle();
    final y = tester.getTopLeft(study).dy;
    final rowBottom = tester.getBottomLeft(find.widgetWithText(MmChip, 'Study')).dy;
    expect(y, greaterThan(rowBottom - 8), reason: 'the title is under the pinned row, not behind it');
    expect(y, lessThan(300), reason: 'and near the top of the screen');
    // The chip row is still on screen, and the chip of this section is the chosen one.
    expect(tester.widget<MmChip>(find.widgetWithText(MmChip, 'Study')).selected, isTrue);
  });

  testWidgets('with motion on, the scroll glides and still lands on the section', (tester) async {
    await pump(tester, disableAnimations: false);
    // The rail scrolls sideways: flick it to bring the last chip in reach.
    await tester.drag(find.widgetWithText(MmChip, 'Look'), const Offset(-300, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(MmChip, 'Colleges'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();
    expect(find.text('My subjects and colleges'), findsOneWidget);
    expect(tester.getTopLeft(find.text('My subjects and colleges')).dy, lessThan(300));
  });
}
