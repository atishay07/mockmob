// The bar and its live capsule as a student meets them: 48 dp targets, a label on each, and text
// contrast as rendered, in both themes (bar review leftover). The Material icon font is loaded so
// the tab glyphs are really drawn.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
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

  // Critic E measured the Today dock in Day at 1.75:1. The labels and icons are ink2 (idle) and ink
  // (active) on the glass; this holds their contrast, composited over the Day ground, above 4.5:1.
  for (final brightness in [Brightness.dark, Brightness.light]) {
    test('the dock labels clear 4.5:1 on the glass over the ground, ${brightness == Brightness.dark ? 'night' : 'day'}', () {
      final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
      final spec = BarGlassSpec.of(colors, GlassQuality.full);
      final glass = Color.alphaBlend(spec.tint, colors.ground);
      double ratio(Color a, Color b) {
        final la = a.computeLuminance(), lb = b.computeLuminance();
        return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
      }

      expect(ratio(colors.ink2, glass), greaterThanOrEqualTo(4.5), reason: 'idle tab label');
      expect(ratio(colors.ink, glass), greaterThanOrEqualTo(4.5), reason: 'active tab label');
    });
  }
}
