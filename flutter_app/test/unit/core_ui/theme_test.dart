
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';

void main() {
  group('MmColors', () {
    test('light roles match spec 2.1', () {
      const c = MmColors.light;
      expect(c.ground, const Color(0xFFF4F5F0));
      expect(c.raised, const Color(0xFFFFFFFF));
      expect(c.raised2, const Color(0xFFF8F9F4));
      expect(c.sunken, const Color(0xFFEEF0E8));
      expect(c.line, const Color(0xFFDCE1D4));
      expect(c.lineStrong, const Color(0xFFBCC5B0));
      expect(c.ink, const Color(0xFF172016));
      expect(c.ink2, const Color(0xFF3D4A39));
      expect(c.ink3, const Color(0xFF56624F));
      expect(c.ink4, const Color(0xFF646F5D));
      expect(c.volt, const Color(0xFFD2F000));
      expect(c.voltInk, const Color(0xFF0B1000));
      expect(c.voltEdge, const Color(0xFF9DB400));
      expect(c.accentText, const Color(0xFF4F6400));
      expect(c.focusRing, const Color(0xFF4F6400));
      expect(c.badText, const Color(0xFFB0291F));
      expect(c.warnText, const Color(0xFF845400));
      expect(c.goodText, const Color(0xFF3D6600));
      expect(c.wrongSurface, const Color(0xFFFBE9E7));
      expect(c.wrongBorder, const Color(0xFFB93225));
      expect(c.wrongText, const Color(0xFFB0291F));
      expect(c.scrim, const Color(0x66000000));
      expect(c.cardShadow, hasLength(2));
    });

    test('dark roles match spec 2.1', () {
      const c = MmColors.dark;
      expect(c.ground, const Color(0xFF0B100E));
      expect(c.raised, const Color(0xFF131A16));
      expect(c.raised2, const Color(0xFF18211B));
      expect(c.sunken, const Color(0xFF0F1512));
      expect(c.line, const Color(0xFF253026));
      expect(c.lineStrong, const Color(0xFF384736));
      expect(c.ink, const Color(0xFFF2F4EC));
      expect(c.ink2, const Color(0xFFBCC5B9));
      expect(c.ink3, const Color(0xFF93A08F));
      expect(c.ink4, const Color(0xFF7F8B7B));
      expect(c.volt, const Color(0xFFD2F000));
      expect(c.voltInk, const Color(0xFF0B1000));
      expect(c.voltEdge, const Color(0xFF9DB400));
      expect(c.accentText, const Color(0xFFD2F000));
      expect(c.focusRing, const Color(0xFFD2F000));
      expect(c.badText, const Color(0xFFFF9D92));
      expect(c.warnText, const Color(0xFFE0B93F));
      expect(c.goodText, const Color(0xFFB6E36E));
      expect(c.wrongSurface, const Color(0xFF2A1614));
      expect(c.wrongBorder, const Color(0xFF7D3128));
      expect(c.wrongText, const Color(0xFFFFC9C2));
      expect(c.scrim, const Color(0x66000000));
      expect(c.optionLip, const Color(0xFF0A0D09));
      expect(c.cardShadow, isEmpty);
    });

    test('every wash is opaque except the scrim', () {
      for (final c in [MmColors.light, MmColors.dark]) {
        for (final color in [
          c.ground, c.raised, c.raised2, c.sunken, c.line, c.lineStrong, c.ink, c.ink2, c.ink3, c.ink4,
          c.volt, c.voltInk, c.voltEdge, c.accentText, c.focusRing, c.badText, c.warnText, c.goodText,
          c.wrongSurface, c.wrongBorder, c.wrongText, c.optionLip,
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

    test('roles match spec 2.2', () {
      void check(TextStyle s, String family, double size, double height, FontWeight weight, double tracking) {
        expect(s.fontFamily, family);
        expect(s.fontSize, size);
        expect(s.height, height);
        expect(s.fontWeight, weight);
        expect(s.letterSpacing ?? 0, closeTo(size * tracking / 100, 1e-9));
      }

      check(type.figureHero, 'Gabarito', 96, 1.0, FontWeight.w800, -3.5);
      check(type.display, 'Gabarito', 36, 1.05, FontWeight.w800, -3.5);
      check(type.headline, 'Gabarito', 28, 1.1, FontWeight.w800, -3);
      check(type.title, 'Gabarito', 22, 1.2, FontWeight.w700, -2);
      check(type.subhead, 'Gabarito', 17, 1.3, FontWeight.w700, -1);
      check(type.timer, 'Gabarito', 20, 1.0, FontWeight.w700, 0);
      check(type.button, 'Gabarito', 17, 1.0, FontWeight.w700, 0);
      check(type.label, 'Gabarito', 13, 1.3, FontWeight.w600, 0);
      check(type.navLabel, 'Gabarito', 12, 1.3, FontWeight.w600, 0);
      check(type.lead, 'HankenGrotesk', 18, 1.45, FontWeight.w400, 0);
      check(type.question, 'HankenGrotesk', 18, 1.5, FontWeight.w500, 0);
      check(type.body, 'HankenGrotesk', 16, 1.55, FontWeight.w400, 0);
      check(type.small, 'HankenGrotesk', 14, 1.5, FontWeight.w400, 0);
      expect(type.figure.fontSize, inInclusiveRange(40, 56));
      expect(type.figureCompact.fontSize, 40);
    });

    test('every role asks for tabular figures', () {
      for (final s in [
        type.figureHero, type.display, type.headline, type.title, type.subhead, type.figure, type.figureCompact,
        type.timer, type.button, type.label, type.navLabel, type.lead, type.question, type.body, type.small,
      ]) {
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
        // Volt is only the primary key fill and the active-tab pill, so framework widgets get ink.
        expect(theme.colorScheme.primary, colors.ink);
        expect(theme.colorScheme.onPrimary, colors.ground);
        expect(theme.textSelectionTheme.selectionColor!.a, 1.0);
        final selected = <WidgetState>{WidgetState.selected};
        expect(theme.switchTheme.trackColor!.resolve(selected), colors.ink);
        expect(theme.checkboxTheme.fillColor!.resolve(selected), colors.ink);
        expect(theme.radioTheme.fillColor!.resolve(selected), colors.ink);
        expect(theme.colorScheme.brightness, brightness);
      }
    });

    test('sheet tops are 28 dp', () {
      final shape = buildTheme(Brightness.light).bottomSheetTheme.shape! as RoundedRectangleBorder;
      expect(shape.borderRadius, MmRadius.sheetTopOnly);
    });
  });
}
