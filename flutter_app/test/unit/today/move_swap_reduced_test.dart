// Verifier L3: a swap under reduced motion disposes the controllers of children still leaving. Their completion
// callbacks then ran and disposed them a second time. A controller is now disposed once.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';

Widget _host(Widget child, {required bool reduced}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduced),
    child: Scaffold(body: MoveSwap(child: child)),
  ),
);

void main() {
  testWidgets('a reduced-motion swap while a child is still leaving does not dispose a controller twice', (tester) async {
    await tester.pumpWidget(_host(const Text('one', key: ValueKey('one')), reduced: false));
    await tester.pumpWidget(_host(const Text('two', key: ValueKey('two')), reduced: false));
    await tester.pump(const Duration(milliseconds: 30));
    // "one" is mid-exit. Reduced motion turns on, and the next swap replaces everything at once.
    await tester.pumpWidget(_host(const Text('three', key: ValueKey('three')), reduced: true));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 400));
    expect(tester.takeException(), isNull);
    expect(find.text('three'), findsOneWidget);
    expect(find.text('one'), findsNothing);
    expect(find.text('two'), findsNothing);
  });

  testWidgets('swaps with animation still settle on the newest child', (tester) async {
    await tester.pumpWidget(_host(const Text('one', key: ValueKey('one')), reduced: false));
    await tester.pumpWidget(_host(const Text('two', key: ValueKey('two')), reduced: false));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('two'), findsOneWidget);
    expect(find.text('one'), findsNothing);
  });
}
