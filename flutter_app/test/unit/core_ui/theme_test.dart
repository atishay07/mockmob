
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';

void main() {
  group('MmColors', () {
    test('Daylight roles match the brief, section 3', () {
      const c = MmColors.light;
      expect(c.ground, const Color(0xFFF3EFE6));
      expect(c.raised, const Color(0xFFFFFDF8));
      expect(c.raised2, const Color(0xFFE9E4D8));
      expect(c.line, const Color(0xFFD8D1C2));
      expect(c.ink, const Color(0xFF17150F));
      expect(c.ink2, const Color(0xFF454036));
      expect(c.ink3, const Color(0xFF655F53));
      expect(c.volt, const Color(0xFFD2F000));
      expect(c.voltInk, const Color(0xFF0B1000));
      expect(c.accentText, const Color(0xFF526700));
      expect(c.wrongSurface, const Color(0xFFFBE9E7));
      expect(c.wrongBorder, const Color(0xFFB93225));
      expect(c.lamp, const Color(0xFFF2A93B));
      expect(c.isNight, isFalse);
    });

    test('Night roles match the brief, section 3', () {
      const c = MmColors.dark;
      expect(c.ground, const Color(0xFF12110E));
      expect(c.raised, const Color(0xFF1B1A16));
      expect(c.raised2, const Color(0xFF25231E));
      expect(c.line, const Color(0xFF312E27));
      expect(c.ink, const Color(0xFFF4F0E6));
      expect(c.ink2, const Color(0xFFBDB6A6));
      expect(c.ink3, const Color(0xFFA09989));
      expect(c.volt, const Color(0xFFD2F000));
      expect(c.voltInk, const Color(0xFF0B1000));
      expect(c.accentText, const Color(0xFFD2F000));
      expect(c.wrongSurface, const Color(0xFF2A1614));
      expect(c.wrongBorder, const Color(0xFF7D3128));
      expect(c.wrongText, const Color(0xFFFFC9C2));
      expect(c.lamp, const Color(0xFFF2A93B));
      expect(c.glassTint.a, closeTo(0.62, 0.01));
      expect(c.isNight, isTrue);
    });

    test('text roles keep 4.5:1 on the grounds they are used on', () {
      double ratio(Color a, Color b) {
        final la = a.computeLuminance(), lb = b.computeLuminance();
        return (la > lb ? la + 0.05 : lb + 0.05) / (la > lb ? lb + 0.05 : la + 0.05);
      }

      for (final c in [MmColors.light, MmColors.dark]) {
        for (final ground in [c.ground, c.raised, c.raised2]) {
          expect(ratio(c.ink3, ground), greaterThanOrEqualTo(4.5));
          expect(ratio(c.ink2, ground), greaterThanOrEqualTo(4.5));
          expect(ratio(c.accentText, ground), greaterThanOrEqualTo(4.5));
        }
        expect(ratio(c.voltInk, c.volt), greaterThanOrEqualTo(4.5));
        expect(ratio(c.wrongText, c.wrongSurface), greaterThanOrEqualTo(4.5));
      }
    });

    test('every wash is opaque except the scrim', () {
      for (final c in [MmColors.light, MmColors.dark]) {
        for (final color in [
          c.ground, c.raised, c.raised2, c.sunken, c.line, c.lineStrong, c.ink, c.ink2, c.ink3, c.ink4,
          c.volt, c.voltInk, c.voltEdge, c.accentText, c.focusRing, c.badText, c.warnText, c.goodText,
          c.wrongSurface, c.wrongBorder, c.wrongText, c.optionLip, c.lamp,
        ]) {
          expect(color.a, 1.0);
        }
      }
    });

    test('lerp and copyWith keep every role', () {
      final mid = MmColors.light.lerp(MmColors.dark, 1);
      expect(mid.ground, MmColors.dark.ground);
      expect(MmColors.light.copyWith(ink: Colors.red).ink, Colors.red);
      expect(MmColors.light.copyWith(ink: Colors.red).ground, MmColors.light.ground);
    });
  });

  group('MmType', () {
    final type = MmType.light;

    test('roles match the brief, section 4', () {
      void check(TextStyle s, String family, double size, double lineHeight) {
        expect(s.fontFamily, family);
        expect(s.fontSize, size);
        expect(s.height! * size, closeTo(lineHeight, 0.01));
      }

      check(type.hero, MmFonts.condensed, 112, 96);
      check(type.figureHero, MmFonts.condensed, 96, 86);
      check(type.moment, MmFonts.headline, 36, 38);
      check(type.display, MmFonts.headline, 36, 38);
      check(type.screenTitle, MmFonts.title, 26, 30);
      check(type.body, MmFonts.hanken, 16, 24);
      check(type.question, MmFonts.hanken, 17, 26);
      check(type.labelLarge, MmFonts.hanken, 15, 20);
      check(type.caption, MmFonts.hanken, 13, 18);
      check(type.cardTitle, MmFonts.hanken, 17, 22);
      expect(type.labelLarge.fontWeight, FontWeight.w600);
      expect(type.caption.fontWeight, FontWeight.w500);
      expect(type.figure.fontSize, inInclusiveRange(40, 56));
      expect(type.figureCompact.fontSize, 40);
      for (final s in type.all) {
        expect(s.fontFamily, isNot('Gabarito'), reason: 'Gabarito is retired from the UI');
      }
    });

    test('every role asks for tabular figures', () {
      for (final s in type.all) {
        expect(s.fontFeatures, contains(const FontFeature.tabularFigures()));
      }
    });

    test('text colour is the ink of its theme', () {
      expect(MmType.light.body.color, MmColors.light.ink);
      expect(MmType.dark.body.color, MmColors.dark.ink);
    });
  });

  group('buildTheme', () {
    test('carries the extensions and no ripples', () {
      for (final brightness in Brightness.values) {
        final theme = buildTheme(brightness);
        expect(theme.extension<MmColors>(), MmColors.forBrightness(brightness));
        expect(theme.extension<MmType>(), isNotNull);
        expect(theme.splashFactory, NoSplash.splashFactory);
        expect(theme.scaffoldBackgroundColor, MmColors.forBrightness(brightness).ground);
        final colors = MmColors.forBrightness(brightness);
        // Framework widgets paint cursors and small states in primary: ink. The MockMob controls
        // choose volt themselves where it is the light.
        expect(theme.colorScheme.primary, colors.ink);
        expect(theme.colorScheme.onPrimary, colors.ground);
        expect(theme.textSelectionTheme.selectionColor!.a, 1.0);
        final selected = <WidgetState>{WidgetState.selected};
        expect(theme.switchTheme.trackColor!.resolve(selected), colors.volt);
        expect(theme.checkboxTheme.fillColor!.resolve(selected), colors.volt);
        expect(theme.radioTheme.fillColor!.resolve(selected), colors.accentText);
        expect(theme.colorScheme.brightness, brightness);
      }
    });

    test('sheet tops are 32 dp', () {
      final shape = buildTheme(Brightness.light).bottomSheetTheme.shape! as RoundedRectangleBorder;
      expect(shape.borderRadius, MmRadius.sheetTopOnly);
    });
  });
}
