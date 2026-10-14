import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'motion_harness.dart';

int _shownCount(WidgetTester tester) => int.parse(tester.widget<Text>(find.descendant(of: find.byType(MmCountUp), matching: find.byType(Text))).data!);

void main() {
  group('MmCountUp', () {
    testWidgets('a change counts on from the value shown, never from zero', (tester) async {
      Widget at(int v) => motionApp(Center(child: MmCountUp(value: v)));
      await tester.pumpWidget(at(40));
      await tester.pumpAndSettle();
      expect(_shownCount(tester), 40);

      await tester.pumpWidget(at(55));
      final seen = <int>[];
      await pumpFrames(tester, const Duration(milliseconds: 800), each: () => seen.add(_shownCount(tester)));
      expect(seen.every((v) => v >= 40 && v <= 55), isTrue, reason: 'from 40 to 55: $seen');
      expect(seen.any((v) => v > 40 && v < 55), isTrue, reason: 'it rolled through the values between');
      expect(seen.last, 55);
      for (var i = 1; i < seen.length; i++) {
        expect(seen[i], greaterThanOrEqualTo(seen[i - 1]), reason: 'monotonic');
      }
    });

    testWidgets('a change mid-count carries on from where it is', (tester) async {
      Widget at(int v) => motionApp(Center(child: MmCountUp(value: v)));
      await tester.pumpWidget(at(0));
      await tester.pumpAndSettle();
      await tester.pumpWidget(at(100));
      await tester.pump(const Duration(milliseconds: 120));
      final mid = _shownCount(tester);
      expect(mid, inExclusiveRange(0, 100));
      await tester.pumpWidget(at(10));
      await tester.pump(const Duration(milliseconds: 16));
      final next = _shownCount(tester);
      expect((next - mid).abs(), lessThan(20), reason: 'no jump back to 0 or to 100');
      await tester.pumpAndSettle();
      expect(_shownCount(tester), 10);
    });

    testWidgets('fromZeroOnFirstBuild false shows the first value at once', (tester) async {
      await tester.pumpWidget(motionApp(const Center(child: MmCountUp(value: 73, fromZeroOnFirstBuild: false))));
      expect(_shownCount(tester), 73);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('roll false and reduced motion show the value at once', (tester) async {
      await tester.pumpWidget(motionApp(const Center(child: MmCountUp(value: 12, roll: false))));
      expect(_shownCount(tester), 12);
      await tester.pumpWidget(motionApp(const Center(child: MmCountUp(value: 30)), reduced: true));
      expect(_shownCount(tester), 30);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('tabular figures, so the width never jitters', (tester) async {
      await tester.pumpWidget(motionApp(const Center(child: MmCountUp(value: 5))));
      final text = tester.widget<Text>(find.descendant(of: find.byType(MmCountUp), matching: find.byType(Text)));
      expect(text.style!.fontFeatures, contains(const FontFeature.tabularFigures()));
    });
  });

  group('MonumentalNumber', () {
    testWidgets('rolls from zero on first build by default', (tester) async {
      await tester.pumpWidget(motionApp(const Center(child: MonumentalNumber(value: '183'))));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
    });

    testWidgets('fromZeroOnFirstBuild false is still at first, then rolls on a change', (tester) async {
      Widget at(String v) => motionApp(Center(child: MonumentalNumber(value: v, fromZeroOnFirstBuild: false)));
      await tester.pumpWidget(at('171'));
      expect(tester.hasRunningAnimations, isFalse, reason: 'shown as it is');
      await tester.pumpWidget(at('183'));
      expect(tester.hasRunningAnimations, isTrue, reason: 'a change rolls');
      await tester.pumpAndSettle();
    });

    testWidgets('a change rolls each slot on from the digit it showed', (tester) async {
      Widget at(String v) => motionApp(Center(child: MonumentalNumber(value: v)));
      await tester.pumpWidget(at('171'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(at('183'));
      await tester.pump(const Duration(milliseconds: 16));
      // The hundreds slot is unchanged: a single 1, not a column from 0.
      final digits = tester.widgetList<Text>(find.descendant(of: find.byType(MonumentalNumber), matching: find.byType(Text))).map((t) => t.data).toList();
      expect(digits.first, '1');
      expect(digits.where((d) => d == '0'), isEmpty, reason: 'no slot starts from 0: $digits');
      await tester.pumpAndSettle();
    });
  });
}
