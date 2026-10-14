import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/features/insights/widgets/motion_bits.dart';
import '../../helpers/golden_harness.dart';

void main() {
  testWidgets('dbg', (tester) async {
    var t = -1.0;
    await pumpMockmob(
      tester,
      SizedBox(height: 300, child: ListView(children: [
        const SizedBox(height: 450),
        GrowIn(builder: (context, v) { t = v; return const SizedBox(height: 40); }),
        const SizedBox(height: 600),
      ])),
      size: const Size(384, 300),
    );
    await tester.pump(const Duration(seconds: 1));
    debugPrint('t0=$t');
    final g = tester.getTopLeft(find.byType(GrowIn));
    debugPrint('pos $g');
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pump();
    debugPrint('after drag pos ${tester.getTopLeft(find.byType(GrowIn))} t=$t');
    await tester.pump(const Duration(milliseconds: 100));
    debugPrint('t=$t');
    await tester.pump(const Duration(milliseconds: 600));
    debugPrint('t=$t');
  });
}
