import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';

void main() {
  group('RasterBudgetMonitor', () {
    test('fires only after two seconds of frames with p90 raster over 12 ms', () {
      final m = RasterBudgetMonitor();
      var fired = false;
      // 1.5 s of slow frames at 60 Hz: not yet.
      for (var i = 0; i < 90; i++) {
        fired = m.add(endMicros: i * 16667, rasterMicros: 15000);
      }
      expect(fired, isFalse);
      for (var i = 90; i < 130; i++) {
        fired = m.add(endMicros: i * 16667, rasterMicros: 15000);
      }
      expect(fired, isTrue);
    });

    test('ignores a busy window whose p90 is within budget', () {
      final m = RasterBudgetMonitor();
      var fired = false;
      for (var i = 0; i < 200; i++) {
        // One slow frame in twenty.
        fired = m.add(endMicros: i * 16667, rasterMicros: i % 20 == 0 ? 30000 : 6000) || fired;
      }
      expect(fired, isFalse);
    });

    test('an idle gap resets the window', () {
      final m = RasterBudgetMonitor();
      var fired = false;
      for (var i = 0; i < 100; i++) {
        fired = m.add(endMicros: i * 16667, rasterMicros: 15000) || fired;
      }
      // Half a second idle, then another short burst.
      for (var i = 0; i < 100; i++) {
        fired = m.add(endMicros: 2200000 + i * 16667, rasterMicros: 15000) || fired;
      }
      expect(fired, isFalse);
    });

    test('fires on a slow phone at 25 fps with 40 ms frames', () {
      final m = RasterBudgetMonitor();
      var fired = false;
      for (var i = 0; i < 60 && !fired; i++) {
        fired = m.add(endMicros: i * 40000, rasterMicros: 40000);
      }
      expect(fired, isTrue);
    });

    test('fires on a struggling phone at 4 fps with 300 ms frames (no false idle gaps)', () {
      final m = RasterBudgetMonitor();
      var fired = false;
      for (var i = 0; i < 30 && !fired; i++) {
        fired = m.add(endMicros: i * 250000, rasterMicros: 300000);
      }
      expect(fired, isTrue);
    });

    test('the budget follows the refresh rate', () {
      expect(RasterBudgetMonitor.thresholdFor(60), const Duration(milliseconds: 12));
      expect(RasterBudgetMonitor.thresholdFor(90).inMicroseconds, 10000);
      expect(RasterBudgetMonitor.thresholdFor(120).inMicroseconds, 7500);
    });
  });

  group('GlassQualitySetting', () {
    test('defaults to Full; the automatic step to Lite is kept apart from the choice', () async {
      final store = MemoryPrefsStore();
      final container = ProviderContainer(overrides: [appPrefsProvider.overrideWithValue(AppPrefs(store))]);
      addTearDown(container.dispose);

      expect(container.read(glassQualityProvider), GlassQuality.full);
      await container.read(glassQualityProvider.notifier).downgrade();
      expect(container.read(glassQualityProvider), GlassQuality.lite);
      expect(container.read(glassQualityProvider.notifier).chosen, GlassQuality.full);
      expect(container.read(glassQualityProvider.notifier).autoLite, isTrue);
      expect(await AppPrefs(store).glassQuality(), isNull, reason: 'the automatic step is not saved as the choice');
      expect(await AppPrefs(store).glassAutoLite(), isTrue);

      // Picking Full again clears the automatic step.
      await container.read(glassQualityProvider.notifier).choose(GlassQuality.full);
      expect(container.read(glassQualityProvider), GlassQuality.full);
      expect(await AppPrefs(store).glassAutoLite(), isFalse);

      await container.read(glassQualityProvider.notifier).choose(GlassQuality.off);
      await container.read(glassQualityProvider.notifier).downgrade();
      expect(container.read(glassQualityProvider), GlassQuality.off, reason: 'a choice of Off is never changed');
    });

    test('a saved choice read before the first frame applies at once', () {
      final container = ProviderContainer(
        overrides: [
          appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
          glassBootProvider.overrideWithValue(const GlassBoot(chosen: GlassQuality.full, autoLite: true)),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(glassQualityProvider), GlassQuality.lite);
    });

    test('Night is the default theme choice', () async {
      expect(await AppPrefs(MemoryPrefsStore()).theme(), ThemeChoice.dark);
    });
  });

  group('GlassBoot first launch', () {
    Future<(GlassBoot, AppPrefs)> boot({required bool lowMemory, String? saved, bool auto = false}) async {
      final prefs = AppPrefs(MemoryPrefsStore());
      if (saved != null) await prefs.setGlassQuality(saved);
      if (auto) await prefs.setGlassAutoLite(true);
      return (await GlassBoot.read(prefs, lowMemory: () async => lowMemory), prefs);
    }

    test('a low-memory phone with nothing chosen starts on Lite as the automatic step, not as a choice', () async {
      final (glass, prefs) = await boot(lowMemory: true);
      expect(glass.chosen, GlassQuality.full, reason: 'the student has chosen nothing');
      expect(glass.autoLite, isTrue);
      expect(await prefs.glassAutoLite(), isTrue, reason: 'kept, so the next launch is the same');
      expect(await prefs.glassQuality(), isNull);

      final container = ProviderContainer(overrides: [glassBootProvider.overrideWithValue(glass), appPrefsProvider.overrideWithValue(prefs)]);
      addTearDown(container.dispose);
      expect(container.read(glassQualityProvider), GlassQuality.lite);
      final setting = container.read(glassQualityProvider.notifier);
      expect(setting.chosen, GlassQuality.full);
      expect(setting.autoLite, isTrue, reason: 'Appearance says so and offers Full again');
    });

    test('a phone with enough memory starts on Full', () async {
      final (glass, _) = await boot(lowMemory: false);
      expect(glass.autoLite, isFalse);
      expect(glass.chosen, GlassQuality.full);
    });

    test('a saved choice is never overridden by the memory rule', () async {
      final (full, _) = await boot(lowMemory: true, saved: 'full');
      expect(full.autoLite, isFalse, reason: 'a student who picked Full keeps Full');
      final (off, _) = await boot(lowMemory: true, saved: 'off');
      expect(off.chosen, GlassQuality.off);
    });

    test('picking Full on a low-memory phone clears the automatic step for good', () async {
      final (glass, prefs) = await boot(lowMemory: true);
      final container = ProviderContainer(overrides: [glassBootProvider.overrideWithValue(glass), appPrefsProvider.overrideWithValue(prefs)]);
      addTearDown(container.dispose);
      container.read(glassQualityProvider);
      await container.read(glassQualityProvider.notifier).choose(GlassQuality.full);
      expect(container.read(glassQualityProvider), GlassQuality.full);
      final again = await GlassBoot.read(prefs, lowMemory: () async => true);
      expect(again.autoLite, isFalse, reason: 'the saved Full choice outranks the memory rule on the next launch');
    });
  });
}
