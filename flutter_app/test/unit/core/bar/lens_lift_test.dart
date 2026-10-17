// The lens's lift, its magnification, the touch light and the Start key's gel (GLASS-1017 5.4 to
// 5.6, packet G3; NAV-1017 6.5): a finger on the capsule lifts the lens within 80 ms, icons near
// it magnify, the lift sinks back once the finger lets go and nothing ticks after 600 ms; under
// reduced motion nothing lifts.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../../helpers/golden_harness.dart';

Widget _bar({int branch = 0}) => Align(
  alignment: Alignment.bottomCenter,
  child: MmBottomBar(currentBranch: branch, onTab: (_) {}, onStart: (_) {}),
);

BarLensPainter _lens(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((w) => w.painter).whereType<BarLensPainter>().first;

double _iconScale(WidgetTester tester, BarIconKind kind) {
  final icon = find.byWidgetPredicate((w) => w is CustomPaint && w.painter is BarIconPainter && (w.painter! as BarIconPainter).glyph == kind.glyph);
  return tester.widget<Transform>(find.ancestor(of: icon, matching: find.byType(Transform)).first).transform.entry(0, 0);
}

Future<void> _pumpFor(WidgetTester tester, Duration d) async {
  for (var t = 0; t < d.inMilliseconds; t += 10) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

void main() {
  testWidgets('a held tab lifts the lens within 80 ms; release sinks it by 600 ms and nothing ticks after (C1, C2)', (tester) async {
    await pumpMockmob(tester, _bar(), size: const Size(390, 780));
    expect(_lens(tester).lift.value, 0);
    final gesture = await tester.startGesture(tester.getCenter(find.text('Practice')));
    await _pumpFor(tester, const Duration(milliseconds: 80));
    expect(_lens(tester).lift.value, greaterThan(0.6), reason: 'lifted within 80 ms');
    await gesture.up();
    await _pumpFor(tester, const Duration(milliseconds: 600));
    final lens = _lens(tester);
    final (l, r) = BarGeometry(390).lensEdges(1);
    expect(lens.lift.value.abs(), lessThan(0.01), reason: 'sunk back by 600 ms');
    expect(lens.left.value, closeTo(l, 0.5), reason: 'landed on Practice');
    expect(lens.right.value, closeTo(r, 0.5));
    // The springs stop within a fraction of a pixel and snap home; then nothing runs.
    await _pumpFor(tester, const Duration(milliseconds: 150));
    expect(tester.hasRunningAnimations, isFalse, reason: 'no ticker left running');
  });

  testWidgets('a scrub keeps the lens lifted and magnifies the icon under it, never the labels (C3)', (tester) async {
    await pumpMockmob(tester, _bar(), size: const Size(390, 780));
    final from = tester.getCenter(find.text('Today'));
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 20));
    await gesture.moveBy(const Offset(30, 0));
    await tester.pump(const Duration(milliseconds: 16));
    final review = tester.getCenter(find.text('Review'));
    await gesture.moveTo(Offset(review.dx, from.dy));
    await _pumpFor(tester, const Duration(milliseconds: 200));
    expect(_lens(tester).lift.value, greaterThan(0.9));
    expect(_iconScale(tester, BarIconKind.review), greaterThan(1.05), reason: 'magnified under the lens');
    expect(_iconScale(tester, BarIconKind.you), closeTo(1, 0.001), reason: 'two slots away: untouched');
    await gesture.up();
    await tester.pumpAndSettle();
    expect(_lens(tester).lift.value.abs(), lessThan(0.01));
    expect(_iconScale(tester, BarIconKind.review), closeTo(1, 0.001));
  });

  testWidgets('a scrub past You resists like a rubber band and lands on You', (tester) async {
    await pumpMockmob(tester, _bar(branch: 3), size: const Size(390, 780));
    final geo = BarGeometry(390);
    final colleges = tester.getCenter(find.text('Colleges'));
    final gesture = await tester.startGesture(colleges);
    await tester.pump(const Duration(milliseconds: 20));
    for (var i = 0; i < 10; i++) {
      await gesture.moveBy(const Offset(15, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }
    final lens = _lens(tester);
    final centre = (lens.left.value + lens.right.value) / 2;
    final youCentre = geo.slotCenter(4);
    expect(centre, greaterThan(youCentre), reason: 'it gives past the end');
    expect(centre - youCentre, lessThan(0.55 * 1.2 * geo.slot), reason: 'but never as far as the finger');
    await gesture.up();
    await tester.pumpAndSettle();
    final rest = _lens(tester);
    expect((rest.left.value + rest.right.value) / 2, closeTo(youCentre, 0.5));
  });

  testWidgets('under reduced motion a finger never lifts the lens (C6)', (tester) async {
    await pumpMockmob(tester, _bar(), size: const Size(390, 780), disableAnimations: true);
    final gesture = await tester.startGesture(tester.getCenter(find.text('Practice')));
    await _pumpFor(tester, const Duration(milliseconds: 100));
    expect(_lens(tester).lift.value, 0);
    expect(_iconScale(tester, BarIconKind.practice), 1);
    await gesture.up();
    await tester.pumpAndSettle();
  });

  testWidgets('the Start key looks the same whatever the page shows (NAV 6.8)', (tester) async {
    await pumpMockmob(tester, _bar(), size: const Size(390, 780));
    final first = tester.widget<StartKeyFace>(find.byType(StartKeyFace));
    for (final branch in [1, 2, 3, 4]) {
      await pumpMockmob(tester, _bar(branch: branch), size: const Size(390, 780));
      await tester.pumpAndSettle();
      final face = tester.widget<StartKeyFace>(find.byType(StartKeyFace));
      expect(face.style, first.style);
      expect(face.pressed, 0);
    }
  });
}
