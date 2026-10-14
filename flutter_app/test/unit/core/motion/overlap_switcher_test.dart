import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';

import 'motion_harness.dart';

const _a = ValueKey('a');
const _b = ValueKey('b');
const _c = ValueKey('c');

Widget _box(Key key) => SizedBox(key: key, width: 100, height: 40);

/// The opacity a layer shows: every [Opacity] above its child, multiplied.
double _shown(WidgetTester tester, Key key) {
  final finder = find.byKey(key);
  if (finder.evaluate().isEmpty) return 0;
  var o = 1.0;
  for (final w in tester.widgetList<Opacity>(find.ancestor(of: finder, matching: find.byType(Opacity)))) {
    o *= w.opacity;
  }
  return o;
}

void main() {
  test('the outgoing layer never lets the sum fall under the floor, nor rises above where it held', () {
    for (var own = 0.0; own <= 1; own += 0.05) {
      for (var incoming = 0.0; incoming <= 1; incoming += 0.05) {
        final out = MmOverlapSwitcher.outgoingOpacity(own, incoming);
        expect(out + incoming, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-9));
      }
    }
    expect(MmOverlapSwitcher.outgoingOpacity(0.2, 0, heldFrom: 0.3), 0.3, reason: 'capped where it held');
  });

  testWidgets('a swap never shows a blank frame: summed opacity stays at or over 0.7', (tester) async {
    Widget at(Key key) => motionApp(Center(child: MmOverlapSwitcher(child: _box(key))));
    await tester.pumpWidget(at(_a));
    expect(_shown(tester, _a), 1, reason: 'the first child is simply there');

    await tester.pumpWidget(at(_b));
    var least = 2.0;
    var outgoingHeldUntilHalf = true;
    for (var i = 0; i < 40; i++) {
      final a = _shown(tester, _a);
      final b = _shown(tester, _b);
      if (b < MmOverlapSwitcher.releaseAt - 0.05 && a < 0.999) outgoingHeldUntilHalf = false;
      if (a + b < least) least = a + b;
      await tester.pump(const Duration(milliseconds: 8));
    }
    expect(least, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-6));
    expect(outgoingHeldUntilHalf, isTrue, reason: 'the old layer holds until the new one is half in');
    await tester.pumpAndSettle();
    expect(find.byKey(_a), findsNothing, reason: 'the outgoing layer is dropped');
    expect(_shown(tester, _b), 1);
  });

  testWidgets('a swap during a swap holds what shows and still never dips', (tester) async {
    Widget at(Key key) => motionApp(Center(child: MmOverlapSwitcher(child: _box(key))));
    await tester.pumpWidget(at(_a));
    await tester.pumpWidget(at(_b));
    await tester.pump(const Duration(milliseconds: 40));
    await tester.pumpWidget(at(_c));
    var least = 3.0;
    for (var i = 0; i < 50; i++) {
      final sum = _shown(tester, _a) + _shown(tester, _b) + _shown(tester, _c);
      if (sum < least) least = sum;
      await tester.pump(const Duration(milliseconds: 8));
    }
    expect(least, greaterThanOrEqualTo(MmOverlapSwitcher.floor - 1e-6));
    await tester.pumpAndSettle();
    expect(find.byKey(_a), findsNothing);
    expect(find.byKey(_b), findsNothing);
    expect(_shown(tester, _c), 1);
  });

  testWidgets('the same key updates in place with no transition', (tester) async {
    await tester.pumpWidget(motionApp(const Center(child: MmOverlapSwitcher(child: SizedBox(key: _a, width: 10)))));
    await tester.pumpWidget(motionApp(const Center(child: MmOverlapSwitcher(child: SizedBox(key: _a, width: 20)))));
    expect(tester.hasRunningAnimations, isFalse);
    expect(tester.getSize(find.byKey(_a)).width, 20);
  });
}
