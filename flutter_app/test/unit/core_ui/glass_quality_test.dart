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
  });

  group('GlassQualitySetting', () {
    test('defaults to Full, saves a choice and downgrades Full to Lite only', () async {
      final store = MemoryPrefsStore();
      final container = ProviderContainer(overrides: [appPrefsProvider.overrideWithValue(AppPrefs(store))]);
      addTearDown(container.dispose);

      expect(container.read(glassQualityProvider), GlassQuality.full);
      await container.read(glassQualityProvider.notifier).downgrade();
      expect(container.read(glassQualityProvider), GlassQuality.lite);
      expect(await AppPrefs(store).glassQuality(), 'lite');

      await container.read(glassQualityProvider.notifier).choose(GlassQuality.off);
      await container.read(glassQualityProvider.notifier).downgrade();
      expect(container.read(glassQualityProvider), GlassQuality.off, reason: 'a choice of Off is never changed');
    });

    test('Night is the default theme choice', () async {
      expect(await AppPrefs(MemoryPrefsStore()).theme(), ThemeChoice.dark);
    });
  });
}
