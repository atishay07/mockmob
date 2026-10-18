// 15 Oct polish: the tonight capsule stands in for the hero key only when the key is wholly out of
// view (never while it, or the length selector, can still be seen), and each day of the week rail
// is a 48 dp column at 360 dp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/core/widgets/widgets.dart' show BarMove, LiveCapsule, MmPressable;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/widgets/today_week.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../golden/today/today_golden_support.dart' show PhoneFrame, todayOverrides;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

Finder _capsule() => find.byWidgetPredicate((w) => w is LiveCapsule && w.live is BarMove);

Future<void> _pump(WidgetTester tester, {required Size size, ScrollController? controller, bool dock = true, double scale = 1}) async {
  await pumpMockmob(
    tester,
    PhoneFrame(
      dock: dock,
      child: TodayBody(
        view: buildToday(ashaInputs(now: tuesdayLate)),
        skeletonDelay: Duration.zero,
        controller: controller,
        callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
      ),
    ),
    size: size,
    textScale: scale,
    disableAnimations: true,
    overrides: todayOverrides,
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a key that is partly in view, above the bar, keeps the capsule away', (tester) async {
    // 360 x 800: the key's top 14 dp are above the bar; the rest is under it. Still a key to see.
    await _pump(tester, size: const Size(360, 800));
    expect(_capsule(), findsNothing);
  });

  testWidgets('scrolled wholly past the top, the move stands in as the capsule', (tester) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await _pump(tester, size: const Size(360, 800), controller: controller);
    expect(_capsule(), findsNothing);
    controller.jumpTo(controller.position.maxScrollExtent);
    await tester.pump();
    await tester.pump();
    expect(_capsule(), findsOneWidget);
    controller.jumpTo(0);
    await tester.pump();
    await tester.pump();
    expect(_capsule(), findsNothing);
  });

  testWidgets('This week spans the width at 360 dp, and each day is its own 44 dp target (TODAY-1018 6.3)', (tester) async {
    await _pump(tester, size: const Size(360, 800), dock: false);
    // The Suggested stack (D51) sits between the card and the week: scroll the week into view.
    await tester.dragUntilVisible(find.byType(TodayWeekRow), find.byType(Scrollable).first, const Offset(0, -200));
    await tester.pumpAndSettle();
    final row = tester.getSize(find.byType(TodayWeekRow));
    expect(row.height, greaterThanOrEqualTo(48));
    expect(row.width, greaterThanOrEqualTo(300));
    // Today is named Today; the other six keep their short names.
    final today = DateTime.utc(2026, 10, 13, 15, 10).weekday - 1;
    for (var i = 0; i < 7; i++) {
      final label = i == today ? GlanceCopy.todayWord : TodayCopy.weekdayShort[i];
      final day = find.descendant(of: find.byType(TodayWeekRow), matching: find.text(label));
      expect(day, findsOneWidget, reason: label);
      final target = find.ancestor(of: day, matching: find.byType(MmPressable)).first;
      expect(tester.getSize(target).height, greaterThanOrEqualTo(44), reason: label);
    }
  });
}
