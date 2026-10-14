// The tab switch hands over with an overlap: at no frame are both branches invisible.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/transitions.dart';

Widget _app(int i) => MaterialApp(
  home: FadingBranchContainer(
    currentIndex: i,
    children: const [Center(child: Text('a')), Center(child: Text('b')), Center(child: Text('c'))],
  ),
);

double _visible(WidgetTester tester) {
  var best = 0.0;
  for (final f in tester.widgetList<FadeTransition>(find.byType(FadeTransition))) {
    if (f.opacity.value > best) best = f.opacity.value;
  }
  return best;
}

void main() {
  testWidgets('no blank frame while a tab hands over to the next', (tester) async {
    await tester.pumpWidget(_app(0));
    await tester.pumpWidget(_app(2));
    for (var ms = 0; ms <= 300; ms += 8) {
      await tester.pump(const Duration(milliseconds: 8));
      // Pages in a Material route may also fade; the container's own two are what counts.
      final both = tester
          .widgetList<FadeTransition>(find.descendant(of: find.byType(FadingBranchContainer), matching: find.byType(FadeTransition)))
          .map((f) => f.opacity.value)
          .toList();
      expect(both.reduce((a, b) => a > b ? a : b), greaterThan(0.05), reason: 'frame at $ms ms: $both');
    }
    await tester.pumpAndSettle();
    expect(find.text('c'), findsOneWidget);
    expect(_visible(tester), 1);
  });

  testWidgets('a switch to a tab on the right slides in from the right, and back from the left', (tester) async {
    await tester.pumpWidget(_app(0));
    await tester.pumpWidget(_app(1));
    await tester.pump(const Duration(milliseconds: 60));
    final right = tester.getTopLeft(find.text('b')).dx;
    await tester.pumpAndSettle();
    expect(right, greaterThan(tester.getTopLeft(find.text('b')).dx), reason: 'it arrived from the right');
    await tester.pumpWidget(_app(0));
    await tester.pump(const Duration(milliseconds: 60));
    final left = tester.getTopLeft(find.text('a')).dx;
    await tester.pumpAndSettle();
    expect(left, lessThan(tester.getTopLeft(find.text('a')).dx), reason: 'it arrived from the left');
  });
}
