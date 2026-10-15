import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';

import '../core/motion/motion_harness.dart';

Widget _label(String text) => SizedBox(key: ValueKey(text), width: 120, height: 40, child: Text(text));

void main() {
  Future<Offset> restOf(WidgetTester tester, Widget Function(Widget child) build, String text) async {
    await tester.pumpWidget(motionApp(Center(child: build(_label(text)))));
    await tester.pumpAndSettle();
    return tester.getTopLeft(find.text(text));
  }

  testWidgets('fade (the default) carries no transform', (tester) async {
    await tester.pumpWidget(motionApp(Center(child: MmOverlapSwitcher(child: _label('A')))));
    await tester.pumpWidget(motionApp(Center(child: MmOverlapSwitcher(child: _label('B')))));
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.descendant(of: find.byType(MmOverlapSwitcher), matching: find.byType(Transform)), findsNothing);
    await tester.pumpAndSettle();
  });

  testWidgets('rise: the new content comes up into place while it fades in', (tester) async {
    Widget build(Widget child) => MmOverlapSwitcher.rise(child: child);
    final rest = await restOf(tester, build, 'A');
    await tester.pumpWidget(motionApp(Center(child: build(_label('B')))));
    await tester.pump(const Duration(milliseconds: 60));
    final mid = tester.getTopLeft(find.text('B'));
    expect(mid.dy, greaterThan(rest.dy));
    expect(mid.dy - rest.dy, lessThanOrEqualTo(Motion.enterRise + 0.5));
    // The old content does not move.
    expect(tester.getTopLeft(find.text('A')), rest);
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.text('B')), rest);
    expect(find.text('A'), findsNothing);
  });

  testWidgets('axis forward: in from the trailing side, the old content drifts the other way', (tester) async {
    Widget build(Widget child) => MmOverlapSwitcher.axis(direction: 1, child: child);
    final rest = await restOf(tester, build, 'A');
    await tester.pumpWidget(motionApp(Center(child: build(_label('B')))));
    await tester.pump(const Duration(milliseconds: 80));
    expect(tester.getTopLeft(find.text('B')).dx, greaterThan(rest.dx));
    expect(tester.getTopLeft(find.text('A')).dx, lessThan(rest.dx));
    expect(rest.dx - tester.getTopLeft(find.text('A')).dx, lessThanOrEqualTo(Motion.axisTravel * Motion.recedeShare + 0.5));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.text('B')), rest);
  });

  testWidgets('axis back: in from the leading side', (tester) async {
    Widget build(Widget child) => MmOverlapSwitcher.axis(direction: -1, travel: 24, child: child);
    final rest = await restOf(tester, build, 'A');
    await tester.pumpWidget(motionApp(Center(child: build(_label('B')))));
    await tester.pump(const Duration(milliseconds: 80));
    expect(tester.getTopLeft(find.text('B')).dx, lessThan(rest.dx));
    expect(rest.dx - tester.getTopLeft(find.text('B')).dx, lessThanOrEqualTo(24.5));
    expect(tester.getTopLeft(find.text('A')).dx, greaterThan(rest.dx));
    await tester.pumpAndSettle();
  });

  testWidgets('a swap in the middle of a swap leaves from where it is, with no jump', (tester) async {
    Widget build(Widget child) => MmOverlapSwitcher.axis(child: child);
    await restOf(tester, build, 'A');
    await tester.pumpWidget(motionApp(Center(child: build(_label('B')))));
    await tester.pump(const Duration(milliseconds: 80));
    final before = tester.getTopLeft(find.text('B'));
    await tester.pumpWidget(motionApp(Center(child: build(_label('C')))));
    final after = tester.getTopLeft(find.text('B'));
    expect((after - before).distance, lessThan(0.5));
    await tester.pumpAndSettle();
    expect(find.text('C'), findsOneWidget);
    expect(find.text('B'), findsNothing);
  });

  testWidgets('reduced motion: nothing travels, the swap is the short fade', (tester) async {
    Widget build(Widget child) => MmOverlapSwitcher.axis(child: child);
    await tester.pumpWidget(motionApp(Center(child: build(_label('A'))), reduced: true));
    final rest = tester.getTopLeft(find.text('A'));
    await tester.pumpWidget(motionApp(Center(child: build(_label('B'))), reduced: true));
    await tester.pump(const Duration(milliseconds: 40));
    expect(tester.getTopLeft(find.text('B')), rest);
    expect(tester.getTopLeft(find.text('A')), rest);
    await tester.pump(Motion.reducedFade);
    await tester.pumpAndSettle();
    expect(find.text('A'), findsNothing);
  });

  test('the variants compare by value', () {
    expect(const MmSwap.axis(direction: -3), const MmSwap.axis(direction: -1));
    expect(const MmSwap.axis(), isNot(MmSwap.rise));
    expect(MmSwap.fade.moves, isFalse);
    expect(MmSwap.rise.moves, isTrue);
  });
}
