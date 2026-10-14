// The bar and its live capsule as a student meets them: 48 dp targets, a label on each, and text
// contrast as rendered, in both themes (bar review leftover). The Material icon font is loaded so
// the tab glyphs are really drawn.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIconFont();
  });

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    for (final withCapsule in [false, true]) {
      testWidgets('the bar ${withCapsule ? 'with its capsule ' : ''}meets the guidelines, $tag', (tester) async {
        await pumpMockmob(
          tester,
          PhoneFrame(
            child: Builder(
              builder: (context) {
                final slot = MmBarInsets.maybeOf(context)?.tonightMove;
                if (withCapsule) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    slot?.value ??= BarMove(title: 'Accountancy repair', detail: '15 min', label: 'Start repair, 15 min', onStart: () {});
                  });
                }
                return ColoredBox(color: Theme.of(context).scaffoldBackgroundColor);
              },
            ),
          ),
          brightness: brightness,
          size: kTodaySize,
          disableAnimations: true,
          overrides: todayOverrides,
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 400));
        if (withCapsule) expect(find.textContaining('Accountancy repair'), findsWidgets);

        final handle = tester.ensureSemantics();
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });
    }
  }
}
