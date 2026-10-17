// The app's one scroll behaviour (GLASS-1017 5.9, G1; NAV-1017 6.7): the iOS bounce on Android
// with no stretch or glow, a short page still gives under the finger, and a view that clamps on
// purpose keeps its clamp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/mm_scroll_behavior.dart';

Widget _app(Widget child) => MaterialApp(
  scrollBehavior: const MmScrollBehavior(),
  theme: ThemeData(platform: TargetPlatform.android),
  home: Scaffold(body: child),
);

/// Whether [physics] or anything it is applied to is the bounce.
bool _bounces(ScrollPhysics? physics) {
  for (var p = physics; p != null; p = p.parent) {
    if (p is BouncingScrollPhysics) return true;
  }
  return false;
}

// flutter_test runs as Android unless told otherwise, so these are Android's physics.
ScrollPosition _position(WidgetTester tester) => tester.state<ScrollableState>(find.byType(Scrollable).first).position;

void main() {
  testWidgets('on Android a page bounces and shows no stretch or glow', (tester) async {
    await tester.pumpWidget(_app(ListView(children: [for (var i = 0; i < 40; i++) SizedBox(height: 60, child: Text('Row $i'))])));
    expect(_bounces(_position(tester).physics), isTrue);
    expect(find.byType(StretchingOverscrollIndicator), findsNothing);
    expect(find.byType(GlowingOverscrollIndicator), findsNothing);

    // Pulled past the top, the content moves with the finger (negative pixels) and springs back.
    final gesture = await tester.startGesture(tester.getCenter(find.text('Row 2')));
    await gesture.moveBy(const Offset(0, 120));
    await tester.pump();
    expect(_position(tester).pixels, lessThan(0));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(_position(tester).pixels, 0);
  });

  testWidgets('a page shorter than the screen still bounces (check B4)', (tester) async {
    await tester.pumpWidget(_app(ListView(children: const [SizedBox(height: 60, child: Text('Only row'))])));
    final gesture = await tester.startGesture(tester.getCenter(find.text('Only row')));
    await gesture.moveBy(const Offset(0, 80));
    await tester.pump();
    expect(_position(tester).pixels, lessThan(0));
    await gesture.up();
    await tester.pumpAndSettle();
  });

  testWidgets('a horizontal rail bounces only when it has something to scroll', (tester) async {
    await tester.pumpWidget(_app(SizedBox(
      height: 60,
      child: ListView(scrollDirection: Axis.horizontal, children: [for (var i = 0; i < 20; i++) SizedBox(width: 80, child: Text('Chip $i'))]),
    )));
    var physics = _position(tester).physics;
    expect(_bounces(physics), isTrue);
    while (physics is! BouncingScrollPhysics) {
      physics = physics.parent!;
    }
    expect(physics.parent, isA<RangeMaintainingScrollPhysics>(), reason: 'a rail that fits does not scroll');
  });

  testWidgets('a view that clamps on purpose keeps its clamp, with no stretch either', (tester) async {
    await tester.pumpWidget(_app(ListView(
      physics: const ClampingScrollPhysics(),
      children: [for (var i = 0; i < 40; i++) SizedBox(height: 60, child: Text('Row $i'))],
    )));
    final gesture = await tester.startGesture(tester.getCenter(find.text('Row 2')));
    await gesture.moveBy(const Offset(0, 120));
    await tester.pump();
    expect(_position(tester).pixels, 0);
    expect(find.byType(StretchingOverscrollIndicator), findsNothing);
    await gesture.up();
    await tester.pumpAndSettle();
  });
}
