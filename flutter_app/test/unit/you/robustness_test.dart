// Regressions for ROBUSTNESS you-02 (PrefToggle half) and you-05 (usage data stays usable).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/you/privacy/usage_data_controller.dart';
import 'package:mockmob/features/you/you_providers.dart';

import 'you_test_support.dart';

/// A store whose reads wait for [release], so a test can choose while a read is in flight.
class _GatedStore extends MemoryPrefsStore {
  final Completer<void> gate = Completer<void>();

  @override
  Future<bool?> getBool(String key) async {
    await gate.future;
    return super.getBool(key);
  }
}

void main() {
  group('PrefToggle (you-02)', () {
    test('a choice made while the stored value is still being read is not undone by the read', () async {
      final store = _GatedStore();
      final container = ProviderContainer(overrides: [appPrefsProvider.overrideWithValue(AppPrefs(store))]);
      addTearDown(container.dispose);
      final sub = container.listen(openResultsDirectlyProvider, (_, _) {});
      addTearDown(sub.close);

      expect(container.read(openResultsDirectlyProvider), isFalse);
      await container.read(openResultsDirectlyProvider.notifier).set(true);
      store.gate.complete();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(container.read(openResultsDirectlyProvider), isTrue, reason: 'the read said off, the tap said on');
    });

    test('with no choice made, the stored value is applied', () async {
      final store = MemoryPrefsStore();
      await AppPrefs(store).setOpenResultsDirectly(true);
      final container = ProviderContainer(overrides: [appPrefsProvider.overrideWithValue(AppPrefs(store))]);
      addTearDown(container.dispose);
      final sub = container.listen(openResultsDirectlyProvider, (_, _) {});
      addTearDown(sub.close);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(container.read(openResultsDirectlyProvider), isTrue);
    });
  });

  group('UsageDataController (you-05)', () {
    ProviderContainer containerFor(FakeConsent consent) {
      final c = ProviderContainer(overrides: youOverrides(consent: consent));
      addTearDown(c.dispose);
      final sub = c.listen(usageDataControllerProvider, (_, _) {});
      addTearDown(sub.close);
      return c;
    }

    test('a platform error during a withdrawal does not leave the switch busy for good', () async {
      final consent = FakeConsent(consentState(AgeBand.adult, on: true))..failWith = StateError('disk full');
      final c = containerFor(consent);
      await c.read(usageDataControllerProvider.notifier).setAllowed(false);
      final ui = c.read(usageDataControllerProvider);
      expect(ui.busy, isFalse);
      expect(ui.phase, UsagePhase.unreached);

      // And the next tap works.
      consent.failWith = null;
      await c.read(usageDataControllerProvider.notifier).setAllowed(false);
      expect(c.read(usageDataControllerProvider).phase, UsagePhase.withdrawn);
    });

    test('a platform error during a turn-on says it failed and unlocks the switch', () async {
      final consent = FakeConsent(consentState(AgeBand.adult))..failWith = StateError('disk full');
      final c = containerFor(consent);
      await c.read(usageDataControllerProvider.notifier).setAllowed(true);
      expect(c.read(usageDataControllerProvider).phase, UsagePhase.enableFailed);
      expect(c.read(usageDataControllerProvider).busy, isFalse);
    });

    test('a platform error while changing the age answer says so', () async {
      final consent = FakeConsent(consentState(AgeBand.adult))..failWith = StateError('disk full');
      final c = containerFor(consent);
      await c.read(usageDataControllerProvider.notifier).changeAge(AgeBand.minor);
      expect(c.read(usageDataControllerProvider).phase, UsagePhase.ageFailed);
    });

    test('an unread consent record never reaches the repository: nothing is switched off by guess', () async {
      final consent = FakeConsent(consentState(AgeBand.unknown, status: ConsentStatus.notLoaded));
      final c = containerFor(consent);
      await c.read(usageDataControllerProvider.notifier).setAllowed(false);
      expect(consent.allowedCalls, isEmpty, reason: 'writing the unknown band would erase an adult opt-in on the server');
      expect(consent.loads, 1);
      expect(c.read(usageDataControllerProvider).busy, isFalse);
    });
  });
}
