import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/sheet/light_sweep.dart';

// APP-PASS AP2-05 (M10): the result sheet's one light sweep reads on Night and on Day. The frame
// is the sweep at its brightest (mid-way) over the raised surface of each theme.
void main() {
  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    testWidgets('the light sweep mid-way reads on $tag', (tester) async {
      tester.view.physicalSize = const Size(360, 240);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(b),
          home: Builder(
            builder: (context) => ColoredBox(
              color: context.mmColors.raised,
              child: const Padding(
                padding: EdgeInsets.all(20),
                child: LightSweep(progress: AlwaysStoppedAnimation(0.5)),
              ),
            ),
          ),
        ),
      );
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/light_sweep_mid_$tag.png'));
    });
  }
}
