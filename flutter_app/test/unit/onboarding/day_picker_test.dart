import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/widgets/day_picker.dart';

import '../../helpers/fonts.dart';

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the week fits a 360 dp phone at 1.3x text, every day a full-height target', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final toggled = <int>[];
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(360, 800), textScaler: TextScaler.linear(1.3)),
          child: Scaffold(
            body: Padding(
              // The onboarding gutter: 360 minus 2 x 16 leaves 328 dp.
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: Column(children: [DayPicker(days: const {0, 1, 3, 5}, onToggle: toggled.add)]),
            ),
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.takeException(), isNull, reason: 'no overflow');

    final targets = find.byType(MmPressable);
    expect(targets, findsNWidgets(7));
    final first = tester.getRect(targets.first);
    final last = tester.getRect(targets.last);
    expect(first.left, greaterThanOrEqualTo(MmSpace.gutter));
    expect(last.right, lessThanOrEqualTo(360 - MmSpace.gutter), reason: 'Sunday stays out of the gutter');
    for (var i = 0; i < 7; i++) {
      final r = tester.getRect(targets.at(i));
      expect(r.height, greaterThanOrEqualTo(48));
      expect(r.width, greaterThanOrEqualTo(44));
    }

    await tester.tapAt(last.center);
    await tester.pump(const Duration(milliseconds: 300));
    expect(toggled, [6]);
  });
}
