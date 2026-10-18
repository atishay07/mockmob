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

  // D8: the active icon is the accent stroke (volt on Night, the olive text colour on Day). A
  // stroke is a graphic, so 3:1 against the glass over the ground (WCAG 1.4.11).
  for (final brightness in [Brightness.dark, Brightness.light]) {
    test('the active icon stroke clears 3:1 on the glass over the ground, ${brightness == Brightness.dark ? 'night' : 'day'}', () {
      final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
      final spec = BarGlassSpec.of(colors, GlassQuality.full);
      final glass = Color.alphaBlend(spec.tint, colors.ground);
      double ratio(Color a, Color b) {
        final la = a.computeLuminance(), lb = b.computeLuminance();
        return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
      }

      expect(ratio(BarIconColors.of(colors).active, glass), greaterThanOrEqualTo(3), reason: 'active icon');
      expect(ratio(BarIconColors.of(colors).idle, glass), greaterThanOrEqualTo(3), reason: 'idle icon');
    });
  }

  // v14 (L33): the glass is thinner so the page shows through, so the labels are judged over the
  // worst page there is: a solid volt key (or paper white, or black) right under the label, behind
  // the bar's scrim at its top edge, through the backdrop's colour step and the tint. The blur
  // only ever averages that toward the ground, which helps.
  for (final brightness in [Brightness.dark, Brightness.light]) {
    test('the labels hold 4.5:1 over a solid volt, white or black page under the glass, ${brightness == Brightness.dark ? 'night' : 'day'}', () {
      final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
      final spec = BarGlassSpec.of(colors, GlassQuality.full);
      final m = BarGlass.backdropMatrix(night: colors.isNight);
      Color through(Color page) {
        final behind = Color.alphaBlend(colors.ground.withValues(alpha: BarScrim.atBarTop), page);
        final rgb = [behind.r * 255, behind.g * 255, behind.b * 255];
        double row(int i) => (m[i * 5] * rgb[0] + m[i * 5 + 1] * rgb[1] + m[i * 5 + 2] * rgb[2] + m[i * 5 + 4]).clamp(0, 255) / 255;
        final stepped = Color.from(alpha: 1, red: row(0), green: row(1), blue: row(2));
        return Color.alphaBlend(spec.tint, stepped);
      }

      double ratio(Color a, Color b) {
        final la = a.computeLuminance(), lb = b.computeLuminance();
        return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
      }

      for (final page in [colors.volt, const Color(0xFFFFFDF8), const Color(0xFF000000)]) {
        expect(ratio(colors.ink2, through(page)), greaterThanOrEqualTo(4.5), reason: 'idle label over $page');
        expect(ratio(colors.ink, through(page)), greaterThanOrEqualTo(4.5), reason: 'active label over $page');
      }
    });
  }

  // D57: the bar's lens (GLASS-1017 5.1): its tint is legible only through the shader's
  // luminosity clamp. Labels and the active icon are judged over the worst pages through the
  // scrim, the clamp and the lens tint.
  for (final brightness in [Brightness.dark, Brightness.light]) {
    test('through the lens, labels hold 4.5:1 and icons 3:1 over volt, white or black, ${brightness == Brightness.dark ? 'night' : 'day'}', () {
      final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
      final spec = BarGlassSpec.of(colors, GlassQuality.full, lens: true);
      double ratio(Color a, Color b) {
        final la = a.computeLuminance(), lb = b.computeLuminance();
        return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
      }

      for (final page in [colors.volt, const Color(0xFFFFFDF8), const Color(0xFF000000)]) {
        final behind = Color.alphaBlend(colors.ground.withValues(alpha: BarScrim.atBarTop), page);
        final surface = Color.alphaBlend(spec.tint, BarGlassSpec.lensed(colors, behind));
        expect(ratio(colors.ink2, surface), greaterThanOrEqualTo(4.5), reason: 'idle label over $page');
        expect(ratio(colors.ink, surface), greaterThanOrEqualTo(4.5), reason: 'active label over $page');
        expect(ratio(BarIconColors.of(colors).active, surface), greaterThanOrEqualTo(3), reason: 'active icon over $page');
      }
    });
  }

  // D57: every live tier carries GLASS-1017's light (a fine rim and a top sheen); Off has none.
  test('the rim and the sheen: on Full and Lite in both themes, Night subtle, none on Off', () {
    for (final colors in [MmColors.dark, MmColors.light]) {
      for (final q in [GlassQuality.full, GlassQuality.lite]) {
        final spec = BarGlassSpec.of(colors, q);
        expect(spec.sheen.a, greaterThan(0), reason: '$q sheen');
        expect(spec.edgeTop.a, greaterThan(spec.edgeMid.a), reason: 'bright along the top');
        expect(spec.edgeBottom.a, greaterThan(0), reason: 'a faint return along the bottom');
      }
      expect(BarGlassSpec.of(colors, GlassQuality.off).sheen.a, 0);
    }
    expect(BarGlassSpec.of(MmColors.dark, GlassQuality.full).sheen.a, lessThan(0.1), reason: 'Night stays subtle');
    expect(BarGlassSpec.of(MmColors.dark, GlassQuality.full, lens: true).tint.a, closeTo(0.52, 0.003));
    expect(BarGlassSpec.of(MmColors.light, GlassQuality.full, lens: true).tint.a, closeTo(0.40, 0.003));
  });
}
