import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../helpers/golden_harness.dart';
import 'zz_pressable.dart';

void main() {
  testWidgets('dbg', (tester) async {
    await pumpMockmob(tester, Align(alignment: Alignment.topCenter, child: ZPressable(onTap: () {}, builder: (c, p, f) => const SizedBox.square(dimension: 48, child: ColoredBox(color: Colors.red)))), brightness: Brightness.dark);
    final press = await tester.startGesture(tester.getCenter(find.byType(ZPressable)));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 16));
      debugPrint('frame $i ${(find.descendant(of: find.byType(ZPressable), matching: find.byType(Transform)).evaluate().first.widget as Transform).transform.getMaxScaleOnAxis()}');
    }
    await press.up();
  });
}
