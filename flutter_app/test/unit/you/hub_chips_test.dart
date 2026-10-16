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

  testWidgets('five chips in order: Week, Badges, Bests, Mocks, Subjects, each a 48 dp target', (tester) async {
    await pump(tester);
    for (final label in ['Week', 'Badges', 'Bests', 'Mocks', 'Subjects']) {
      final chip = find.widgetWithText(MmChip, label);
      expect(chip, findsOneWidget, reason: label);
    }
    final week = tester.getTopLeft(find.widgetWithText(MmChip, 'Week')).dx;
    final badges = tester.getTopLeft(find.widgetWithText(MmChip, 'Badges')).dx;
    final bests = tester.getTopLeft(find.widgetWithText(MmChip, 'Bests')).dx;
    expect(week, lessThan(badges));
    expect(badges, lessThan(bests));
    expect(tester.getSize(find.widgetWithText(MmChip, 'Week')).height, greaterThanOrEqualTo(40));
  });

  testWidgets('a chip scrolls its section to just under the row, and the row stays pinned', (tester) async {
    await pump(tester);
    final bests = find.text('Personal bests');
    expect(tester.getTopLeft(bests).dy, greaterThan(853), reason: 'Personal bests starts below the first screen');
    await tester.tap(find.widgetWithText(MmChip, 'Bests'));
    await tester.pumpAndSettle();
    final y = tester.getTopLeft(bests).dy;
    final rowBottom = tester.getBottomLeft(find.widgetWithText(MmChip, 'Bests')).dy;
    expect(y, greaterThan(rowBottom - 8), reason: 'the title is under the pinned row, not behind it');
    expect(y, lessThan(300), reason: 'and near the top of the screen');
    expect(tester.widget<MmChip>(find.widgetWithText(MmChip, 'Bests')).selected, isTrue);
  });

  testWidgets('with motion on, the scroll glides and still lands on the section', (tester) async {
    await pump(tester, disableAnimations: false);
    // The rail scrolls sideways: flick it to bring the last chip in reach.
    await tester.drag(find.widgetWithText(MmChip, 'Badges'), const Offset(-300, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(MmChip, 'Subjects'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();
    expect(find.text('My subjects'), findsOneWidget);
    expect(tester.getTopLeft(find.text('My subjects')).dy, lessThan(300));
  });
}
