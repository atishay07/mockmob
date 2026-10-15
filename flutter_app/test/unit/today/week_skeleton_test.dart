// Today's week strip holds its height with a skeleton while the rhythm loads, so nothing below it
// jumps when the week lands (audit finding 24).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/widgets/week_ledger.dart';
import 'package:mockmob/features/today/widgets/week_ledger_skeleton.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';


void main() {
  setUpAll(loadAppFonts);

  test('the builder carries the loading flag only while there is no week', () {
    expect(buildHeader(ashaInputs()).weekLoading, isFalse);
    final loading = TodayInputs(now: ashaInputs().now, weekLoading: true);
    expect(buildHeader(loading).weekLoading, isTrue);
    expect(buildHeader(loading).week, isNull);
  });

  testWidgets('the skeleton is exactly as tall as the loaded strip, at 1x and 1.3x', (tester) async {
    for (final scale in [1.0, 1.3]) {
      await pumpMockmob(
        tester,
        PhoneFrame(child: SingleChildScrollView(child: WeekLedger(week: buildHeader(ashaInputs()).week!, bleed: 8))),
        size: const Size(360, 800),
        textScale: scale,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await tester.pump();
      final loaded = tester.getSize(find.byType(WeekLedger)).height;
      await pumpMockmob(
        tester,
        PhoneFrame(child: SingleChildScrollView(child: const WeekLedgerSkeleton(bleed: 8))),
        size: const Size(360, 800),
        textScale: scale,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await tester.pump();
      final skeleton = tester.getSize(find.byType(WeekLedgerSkeleton)).height;
      expect((skeleton - loaded).abs(), lessThan(1), reason: 'scale $scale: loaded $loaded, skeleton $skeleton');
    }
  });
}
