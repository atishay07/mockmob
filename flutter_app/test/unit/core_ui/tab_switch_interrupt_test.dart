// AP1-02 (M09): a tab switch during a switch starts from what is on screen. No branch but the
// incoming one ever gains opacity between frames, and a third branch fades instead of vanishing.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/transitions.dart';

Widget _app(int i) => MaterialApp(
  home: FadingBranchContainer(
    currentIndex: i,
    children: const [Center(child: Text('a')), Center(child: Text('b')), Center(child: Text('c'))],
  ),
);

Map<String, double> _opacities(WidgetTester tester) {
  final out = <String, double>{};
  for (final label in ['a', 'b', 'c']) {
    final found = find.ancestor(of: find.text(label, skipOffstage: false), matching: find.byType(FadeTransition));
    final fades = tester.widgetList<FadeTransition>(find.descendant(of: find.byType(FadingBranchContainer), matching: find.byType(FadeTransition)));
    final mine = tester.widgetList<FadeTransition>(found).where(fades.contains).toList();
    final offstage = tester.widgetList<Offstage>(find.ancestor(of: find.text(label, skipOffstage: false), matching: find.byType(Offstage))).any((o) => o.offstage);
    out[label] = offstage ? 0 : mine.first.opacity.value;
  }
  return out;
}

void main() {
  testWidgets('a switch 120 ms into a switch: only the incoming branch rises', (tester) async {
    await tester.pumpWidget(_app(0));
    await tester.pumpWidget(_app(1));
    await tester.pump(const Duration(milliseconds: 120));
    var last = _opacities(tester);
    await tester.pumpWidget(_app(2));
    for (var ms = 0; ms <= 320; ms += 8) {
      final now = _opacities(tester);
      for (final label in ['a', 'b']) {
        expect(now[label]!, lessThanOrEqualTo(last[label]! + 1e-6), reason: '$label rose at $ms ms: $last -> $now');
      }
      expect(now.values.reduce((x, y) => x > y ? x : y), greaterThan(0.05), reason: 'no blank frame at $ms ms: $now');
      last = now;
      await tester.pump(const Duration(milliseconds: 8));
    }
    await tester.pumpAndSettle();
    expect(_opacities(tester), {'a': 0, 'b': 0, 'c': 1});
  });

  testWidgets('a branch called back mid-fade starts from its current opacity', (tester) async {
    await tester.pumpWidget(_app(0));
    await tester.pumpWidget(_app(1));
    await tester.pump(const Duration(milliseconds: 40));
    final aBefore = _opacities(tester)['a']!;
    expect(aBefore, greaterThan(0), reason: 'a is still fading out');
    await tester.pumpWidget(_app(0));
    final aAfter = _opacities(tester)['a']!;
    expect((aAfter - aBefore).abs(), lessThan(0.02), reason: 'no jump: it continues from $aBefore');
    await tester.pumpAndSettle();
    expect(_opacities(tester), {'a': 1, 'b': 0, 'c': 0});
  });
}
