import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';

void main() {
  testWidgets('a Mobi that never ticked (reduced motion) disposes without a ticker lookup error', (tester) async {
    await tester.pumpWidget(
      const MediaQuery(
        data: MediaQueryData(disableAnimations: true),
        child: Directionality(textDirection: TextDirection.ltr, child: Center(child: MobiCharacter(size: 80))),
      ),
    );
    await tester.pumpWidget(const SizedBox());
    expect(tester.takeException(), isNull);
  });

  testWidgets('a Mobi watching taps ignores pointer events once it has left the tree', (tester) async {
    await tester.pumpWidget(
      const Directionality(textDirection: TextDirection.ltr, child: Center(child: MobiCharacter(size: 80))),
    );
    await tester.pumpWidget(const SizedBox());
    final gesture = await tester.startGesture(const Offset(20, 20));
    await gesture.up();
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull);
  });
}
