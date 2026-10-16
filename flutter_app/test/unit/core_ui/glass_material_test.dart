import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/platform/device_corner.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/materials/glass_shader.dart';
import 'package:mockmob/core/widgets/widgets.dart';

void main() {
  const night = MmColors.dark;
  const day = MmColors.light;
  GlassMaterialSpec spec(MmColors c, GlassKind k, GlassTier t, {bool hc = false}) => GlassMaterialSpec.of(c, k, t, highContrast: hc);

  group('GlassTier.resolve', () {
    test('Full runs the lens only when the shader is ready', () {
      expect(GlassTier.resolve(GlassQuality.full, shaderReady: true), GlassTier.full);
      expect(GlassTier.resolve(GlassQuality.full, shaderReady: false), GlassTier.fullBasic);
      expect(GlassTier.resolve(GlassQuality.lite, shaderReady: true), GlassTier.lite);
      expect(GlassTier.resolve(GlassQuality.off, shaderReady: true), GlassTier.off);
    });

    test('high-contrast text forces Off whatever was chosen', () {
      for (final q in GlassQuality.values) {
        expect(GlassTier.resolve(q, shaderReady: true, highContrast: true), GlassTier.off);
      }
    });

    test('the lens is off by default until it is proven on a device (build decision 1)', () {
      GlassShader.debugReset();
      expect(GlassShader.enabled, isFalse);
      expect(GlassShader.ready, isFalse);
    });
  });

  group('GlassMaterialSpec (section 5.1)', () {
    test('bar tints per tier', () {
      expect(spec(night, GlassKind.bar, GlassTier.full).tint.a, closeTo(0.52, 0.002));
      expect(spec(day, GlassKind.bar, GlassTier.full).tint.a, closeTo(0.40, 0.002));
      expect(spec(night, GlassKind.bar, GlassTier.fullBasic).tint.a, closeTo(0.82, 0.002));
      expect(spec(day, GlassKind.bar, GlassTier.fullBasic).tint.a, closeTo(0.84, 0.002));
      expect(spec(night, GlassKind.bar, GlassTier.lite).tint.a, closeTo(0.96, 0.002));
      expect(spec(day, GlassKind.bar, GlassTier.lite).tint.a, closeTo(0.97, 0.002));
      expect(spec(night, GlassKind.bar, GlassTier.lite).noise, 0.03);
      expect(spec(night, GlassKind.bar, GlassTier.off).tint, night.raised);
    });

    test('blur: about sigma 12 on the bar, 30 on sheets; none on Lite and Off', () {
      expect(spec(night, GlassKind.bar, GlassTier.fullBasic).blur, 12);
      expect(spec(night, GlassKind.bar, GlassTier.full).blur + spec(night, GlassKind.bar, GlassTier.full).core, 16);
      expect(spec(night, GlassKind.sheet, GlassTier.fullBasic).blur, 30);
      expect(spec(night, GlassKind.bar, GlassTier.lite).blur, 0);
      expect(spec(night, GlassKind.sheet, GlassTier.off).live, isFalse);
    });

    test('a sheet keeps a dense reading core and a thinner rim', () {
      final basic = spec(night, GlassKind.sheet, GlassTier.fullBasic);
      expect(basic.tint.a, closeTo(0.985, 0.002));
      expect(basic.rimTint!.a, closeTo(0.72, 0.002));
      final full = spec(day, GlassKind.sheet, GlassTier.full);
      expect(full.tint.a, closeTo(0.88, 0.002));
      expect(full.rimTint!.a, closeTo(0.50, 0.002));
      expect(spec(night, GlassKind.sheet, GlassTier.lite).tint.a, closeTo(0.985, 0.002));
    });

    test('high contrast: solid, stronger hairline, no sheen', () {
      final s = spec(night, GlassKind.bar, GlassTier.full, hc: true);
      expect(s.opaque, isTrue);
      expect(s.hairline, night.lineStrong);
      expect(s.sheen.a, 0);
    });
  });

  group('legibility (section 5.3): labels keep 4.5:1 over black, paper and volt', () {
    for (final (name, c) in [('Night', night), ('Day', day)]) {
      for (final tier in GlassTier.values) {
        test('$name bar and control, ${tier.name}: ink2', () {
          for (final kind in [GlassKind.bar, GlassKind.control]) {
            expect(GlassContrast.worst(c.ink2, spec(c, kind, tier)), greaterThanOrEqualTo(4.5), reason: kind.name);
          }
        });
        test('$name sheet and bubble core, ${tier.name}: ink3', () {
          for (final kind in [GlassKind.sheet, GlassKind.bubble]) {
            expect(GlassContrast.worst(c.ink3, spec(c, kind, tier)), greaterThanOrEqualTo(4.5), reason: kind.name);
          }
        });
      }
    }

    test('the old Night bar (0.60, no clamp) fails over paper, which is why it changed', () {
      const old = GlassMaterialSpec(
        tier: GlassTier.fullBasic,
        tint: Color(0x991B1A16),
        rimLightTop: Color(0x00000000),
        rimLightMid: Color(0x00000000),
        rimLightBottom: Color(0x00000000),
        sheen: Color(0x00000000),
        shadow: [],
      );
      expect(GlassContrast.worst(night.ink2, old), lessThan(4.5));
    });

    test('the clamp dims volt to olive under Night glass and keeps its hue', () {
      final seen = GlassContrast.lensed(const Color(0xFFD2F000), lumMax: 0.14);
      expect(seen.computeLuminance(), lessThan(0.16));
      expect(seen.g, greaterThan(seen.b));
    });
  });

  group('sheets (section 5.7)', () {
    tearDown(() => DeviceCorner.debugRadius = null);

    test('bottom corner is the phone corner minus 8, at least 20, falling back to 28', () {
      expect(DeviceCorner.sheetRadiusFor(null), 28);
      expect(DeviceCorner.sheetRadiusFor(36), 28);
      expect(DeviceCorner.sheetRadiusFor(50), 42);
      expect(DeviceCorner.sheetRadiusFor(16), 20);
      DeviceCorner.debugRadius = 44;
      expect(DeviceCorner.sheetRadius, 36);
    });

    test('fills over the last 15% of the screen and materialises over 60% of the rise', () {
      expect(MmSheetGlass.fillFor(null), 0);
      expect(MmSheetGlass.fillFor(0.7), 0);
      expect(MmSheetGlass.fillFor(0.85), 0);
      expect(MmSheetGlass.fillFor(1), 1);
      expect(MmSheetGlass.materializeAt(0), 0);
      expect(MmSheetGlass.materializeAt(0.3), closeTo(0.5, 1e-9));
      expect(MmSheetGlass.materializeAt(0.6), 1);
    });
  });

  group('floating control and settings', () {
    test('glass follows the scroll, not a clock', () {
      expect(MmGlassControl.glassFor(0, 24), 0);
      expect(MmGlassControl.glassFor(12, 24), 0.5);
      expect(MmGlassControl.glassFor(120, 24), 1);
    });

    test('the picker says what each choice does, and Full only promises the bend with the lens', () {
      expect(GlassQualityPicker.describe(GlassQuality.full, lens: true), "Glass that bends what's behind it.");
      expect(GlassQualityPicker.describe(GlassQuality.full, lens: false), 'Glass the page shows through.');
      expect(GlassQualityPicker.describe(GlassQuality.lite), 'Frosted look, lighter on battery.');
      expect(GlassQualityPicker.describe(GlassQuality.off), 'Solid surfaces.');
    });
  });

  group('MmGlass in the tree', () {
    Future<void> pump(WidgetTester tester, Widget child, {bool highContrast = false}) => tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(extensions: const [night]),
        home: MediaQuery(
          data: MediaQueryData(highContrast: highContrast),
          child: Builder(builder: (context) => child),
        ),
      ),
    );

    testWidgets('Full blurs the backdrop; Lite and Off never do', (tester) async {
      await pump(tester, const GlassScope(quality: GlassQuality.full, child: MmGlass(child: SizedBox(width: 100, height: 48))));
      expect(find.byType(BackdropFilter), findsOneWidget);
      await pump(tester, const GlassScope(quality: GlassQuality.lite, child: MmGlass(child: SizedBox(width: 100, height: 48))));
      expect(find.byType(BackdropFilter), findsNothing);
      await pump(tester, const GlassScope(quality: GlassQuality.off, child: MmGlass(child: SizedBox(width: 100, height: 48))));
      expect(find.byType(BackdropFilter), findsNothing);
    });

    testWidgets('high-contrast text puts the Off tier in effect', (tester) async {
      await pump(tester, const GlassScope(quality: GlassQuality.full, child: MmGlass(child: SizedBox(width: 100, height: 48))), highContrast: true);
      expect(find.byType(BackdropFilter), findsNothing);
      final context = tester.element(find.byType(MmGlass));
      expect(GlassScope.tierOf(context), GlassTier.off);
      expect(GlassScope.of(context), GlassQuality.off);
    });

    testWidgets('a sheet that has filled the screen stops blurring', (tester) async {
      await pump(tester, const GlassScope(quality: GlassQuality.full, child: MmGlass(kind: GlassKind.sheet, fill: 1, child: SizedBox(width: 100, height: 48))));
      expect(find.byType(BackdropFilter), findsNothing);
    });

    testWidgets('a pressed control lifts out under the finger, and not under reduced motion', (tester) async {
      Future<double> scaleWhilePressed({required bool reduced}) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(extensions: const [night]),
            home: MediaQuery(
              data: MediaQueryData(disableAnimations: reduced),
              child: Center(child: MmGlassControl(semanticsLabel: 'Ask Mobi', onTap: () {}, child: const Text('Ask Mobi'))),
            ),
          ),
        );
        final gesture = await tester.startGesture(tester.getCenter(find.byType(MmGlassControl)));
        for (var i = 0; i < 25; i++) {
          await tester.pump(const Duration(milliseconds: 16));
        }
        final scales = tester.widgetList<Transform>(find.descendant(of: find.byType(MmGlassControl), matching: find.byType(Transform)));
        final s = scales.isEmpty ? 1.0 : scales.first.transform.getMaxScaleOnAxis();
        await gesture.up();
        await tester.pumpAndSettle();
        return s;
      }

      expect(await scaleWhilePressed(reduced: false), closeTo(GlassTokens.liftScale, 0.005));
      expect(await scaleWhilePressed(reduced: true), 1.0);
    });
  });
}
