// AP1-04 (M13): one lead rises, its meaning follows, the rest settle as one group.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/entrance.dart';

Widget _group({double? rise}) => MaterialApp(
  home: MmStagger(
    rise: rise,
    child: Column(children: [
      for (var i = 0; i < 6; i++) MmStaggerItem(index: i, child: SizedBox(key: ValueKey('i$i'), height: 40, width: 40)),
    ]),
  ),
);

double _opacity(WidgetTester tester, int i) =>
    tester.widget<FadeTransition>(find.ancestor(of: find.byKey(ValueKey('i$i')), matching: find.byType(FadeTransition)).first).opacity.value;

double _y(WidgetTester tester, int i) => tester.getTopLeft(find.byKey(ValueKey('i$i'))).dy;

void main() {
  test('rise by place: lead 14, then 6, then none', () {
    expect(MmStaggerItem.riseFor(0), 14);
    expect(MmStaggerItem.riseFor(1), 6);
    expect(MmStaggerItem.riseFor(2), 6);
    expect(MmStaggerItem.riseFor(3), 0);
    expect(MmStaggerItem.riseFor(9), 0);
    expect(MmStaggerItem.riseFor(0, leadRise: 8), 8);
  });

  testWidgets('timeline at 0, 60, 120, 160 and 360 ms', (tester) async {
    await tester.pumpWidget(_group());
    final rest = [for (var i = 0; i < 6; i++) i * 40.0];
    // 0 ms: everything is clear; the lead sits 14 dp low, items 1-2 6 dp low, the group in place.
    expect(_opacity(tester, 0), 0);
    expect(_y(tester, 0) - rest[0], closeTo(14 + 0.6, 0.1), reason: '14 dp low, plus the 0.97 scale about its centre');
    expect(_y(tester, 1) - rest[1], closeTo(6, 0.5));
    expect(_y(tester, 4) - rest[4], closeTo(0, 0.01));
    await tester.pump(const Duration(milliseconds: 60));
    expect(_opacity(tester, 0), greaterThan(0.3), reason: 'the lead leads');
    expect(_opacity(tester, 1), lessThan(0.05), reason: 'item 1 starts at 60 ms');
    await tester.pump(const Duration(milliseconds: 60));
    expect(_opacity(tester, 1), greaterThan(0));
    expect(_opacity(tester, 2), lessThan(0.05), reason: 'item 2 starts at 120 ms');
    await tester.pump(const Duration(milliseconds: 40));
    expect(_opacity(tester, 3), lessThan(0.05), reason: 'the group starts at 160 ms');
    expect(_opacity(tester, 3), _opacity(tester, 5), reason: 'one group');
    await tester.pump(const Duration(milliseconds: 200));
    expect(_opacity(tester, 0), 1);
    expect(_opacity(tester, 3), 1, reason: 'the group has landed by 360 ms');
    expect(_opacity(tester, 5), 1);
    await tester.pumpAndSettle();
    for (var i = 0; i < 6; i++) {
      expect(_y(tester, i), rest[i]);
    }
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('a group can set its lead rise (Practice: 8 dp)', (tester) async {
    await tester.pumpWidget(_group(rise: 8));
    expect(_y(tester, 0), closeTo(8 + 0.6, 0.1));
    await tester.pumpAndSettle();
  });
}
