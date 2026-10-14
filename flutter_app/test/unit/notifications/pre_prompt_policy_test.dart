import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/logic/pre_prompt_policy.dart';
import 'package:mockmob/features/notifications/services/android_permission_requester.dart';
import 'package:mockmob/features/notifications/services/notification_providers.dart';

import 'support.dart';
import 'widget_support.dart';

void main() {
  final now = DateTime(2026, 10, 12, 21);
  DateTime ago(Duration d) => now.subtract(d);

  bool offer({
    NotificationPermission permission = NotificationPermission.notAsked,
    int asks = 0,
    DateTime? last,
    PrePromptMoment moment = PrePromptMoment.afterResult,
  }) => shouldOfferPrePrompt(permission: permission, askCount: asks, lastAskedAt: last, now: now, moment: moment);

  group('the re-ask cadence', () {
    test('the first ask is due at once, with nothing recorded', () {
      expect(offer(), isTrue);
      expect(offer(permission: NotificationPermission.denied), isTrue);
    });

    test('it never comes back once reminders are on, or when nothing can be asked', () {
      expect(offer(permission: NotificationPermission.granted), isFalse);
      expect(offer(permission: NotificationPermission.granted, asks: 3, last: ago(const Duration(days: 60))), isFalse);
      expect(offer(permission: NotificationPermission.unavailable), isFalse);
    });

    test('after a refusal it comes back 2 days after the first ask, 4 after the second, 7 after the third, then every 10', () {
      const table = {
        1: Duration(days: 2),
        2: Duration(days: 4),
        3: Duration(days: 7),
        4: Duration(days: 10),
        5: Duration(days: 10),
        9: Duration(days: 10),
        30: Duration(days: 10),
      };
      for (final e in table.entries) {
        expect(prePromptGapAfter(e.key), e.value, reason: 'after ${e.key} asks');
        expect(offer(asks: e.key, last: ago(e.value - const Duration(minutes: 1))), isFalse, reason: 'a minute early, after ${e.key} asks');
        expect(offer(asks: e.key, last: ago(e.value)), isTrue, reason: 'on the day, after ${e.key} asks');
        expect(offer(asks: e.key, last: ago(e.value + const Duration(days: 40))), isTrue, reason: 'long after, after ${e.key} asks');
      }
    });

    test('never twice in a day, whatever the count says', () {
      for (var asks = -1; asks <= 20; asks++) {
        expect(prePromptGapAfter(asks) >= prePromptMinGap, isTrue, reason: 'gap after $asks');
        expect(offer(asks: asks, last: ago(const Duration(hours: 23))), isFalse, reason: '23 hours after, with $asks asks');
        expect(offer(asks: asks, last: ago(const Duration(minutes: 5))), isFalse, reason: '5 minutes after, with $asks asks');
      }
      // A count that was lost while the date was kept is still held to a day.
      expect(offer(last: ago(const Duration(hours: 23))), isFalse);
      expect(offer(last: ago(const Duration(days: 1))), isTrue);
    });

    test('a last ask in the future (the clock moved back) reads as not yet', () {
      expect(offer(asks: 1, last: now.add(const Duration(days: 1))), isFalse);
    });

    test('a count with no date is due: the next ask records the date', () {
      expect(offer(asks: 3), isTrue);
    });

    test('a student Android no longer asks is still offered the sheet', () {
      expect(offer(permission: NotificationPermission.denied, asks: 2, last: ago(const Duration(days: 4))), isTrue);
      expect(offer(permission: NotificationPermission.denied, asks: 2, last: ago(const Duration(days: 3))), isFalse);
    });
  });

  group('where it may ask', () {
    test('only right after a finished session', () {
      expect(offer(moment: PrePromptMoment.afterResult), isTrue);
    });

    test('never in NTA mode, during a session or on a cold start, even when everything else says due', () {
      for (final moment in [PrePromptMoment.ntaMode, PrePromptMoment.inSession, PrePromptMoment.appOpen]) {
        expect(offer(moment: moment), isFalse, reason: '$moment, first ask');
        expect(offer(asks: 4, last: ago(const Duration(days: 90)), moment: moment), isFalse, reason: '$moment, long after');
        expect(offer(permission: NotificationPermission.denied, moment: moment), isFalse, reason: '$moment, blocked');
      }
    });
  });

  group('the main key', () {
    test('Allow while Android still asks, Open settings once it no longer does', () {
      expect(prePromptPrimaryFor(NotificationPermission.notAsked), PrePromptPrimary.allow);
      expect(prePromptPrimaryFor(NotificationPermission.denied), PrePromptPrimary.openSettings);
      expect(prePromptPrimaryFor(NotificationPermission.unavailable), PrePromptPrimary.allow);
      expect(prePromptPrimaryFor(NotificationPermission.granted), PrePromptPrimary.allow);
    });

    test('Android settings take over after the second refusal, not the first', () async {
      final memory = MemoryPrefsStore();
      final driver = _RefusingDriver();
      final requester = AndroidPermissionRequester(driver: driver, prefs: AppPrefs(memory), store: memory);
      expect(prePromptPrimaryFor(await requester.notificationPermission()), PrePromptPrimary.allow);
      await requester.requestNotificationPermission();
      expect(prePromptPrimaryFor(await requester.notificationPermission()), PrePromptPrimary.allow, reason: 'Android still shows its dialog');
      await requester.requestNotificationPermission();
      expect(prePromptPrimaryFor(await requester.notificationPermission()), PrePromptPrimary.openSettings);
      // Turned on in Android settings afterwards: nothing left to ask.
      driver.enabled = true;
      expect(await requester.notificationPermission(), NotificationPermission.granted);
    });
  });

  group('the cadence on this phone', () {
    late Rig rig;
    late FakePermissionRequester permission;
    late AppPrefs prefs;
    late ProviderContainer c;

    setUp(() {
      rig = Rig(prefs: prefsWith());
      permission = FakePermissionRequester(NotificationPermission.notAsked);
      prefs = AppPrefs(MemoryPrefsStore());
      c = ProviderContainer(overrides: featureOverrides(rig: rig, repo: FakePrefsRepo(null), permission: permission, appPrefs: prefs));
    });

    tearDown(() => c.dispose());

    Future<bool> due() {
      c.invalidate(prePromptDueProvider);
      return c.read(prePromptDueProvider.future);
    }

    Future<void> ask() => c.read(prePromptAsksProvider).record();

    test('a refused student is asked on the spaced days and never twice in a day', () async {
      expect(await due(), isTrue, reason: 'the first moment');

      await ask();
      expect((await prefs.lastPrePromptAt())!.isAtSameMomentAs(rig.now), isTrue);
      expect((await rig.store.load()).prePromptAskCount, 1);
      expect(await due(), isFalse, reason: 'asked a moment ago');

      rig.now = rig.now.add(const Duration(days: 1));
      expect(await due(), isFalse, reason: 'a day later, still inside the 2 days');
      rig.now = rig.now.add(const Duration(days: 1));
      expect(await due(), isTrue, reason: '2 days after the first ask');

      await ask();
      expect(await due(), isFalse, reason: 'twice in a day is never');
      rig.now = rig.now.add(const Duration(days: 3));
      expect(await due(), isFalse, reason: '3 days after the second ask; it waits 4');
      rig.now = rig.now.add(const Duration(days: 1));
      expect(await due(), isTrue, reason: '4 days after the second ask');

      await ask();
      rig.now = rig.now.add(const Duration(days: 6));
      expect(await due(), isFalse);
      rig.now = rig.now.add(const Duration(days: 1));
      expect(await due(), isTrue, reason: '7 days after the third ask');

      await ask();
      rig.now = rig.now.add(const Duration(days: 9));
      expect(await due(), isFalse);
      rig.now = rig.now.add(const Duration(days: 1));
      expect(await due(), isTrue, reason: '10 days after the fourth ask');

      await ask();
      rig.now = rig.now.add(const Duration(days: 10));
      expect(await due(), isTrue, reason: 'then every 10 days');
      expect((await rig.store.load()).prePromptAskCount, 5);
    });

    test('NTA mode, a running session and a cold start are never asked, whatever the history', () async {
      for (final moment in [PrePromptMoment.ntaMode, PrePromptMoment.inSession, PrePromptMoment.appOpen]) {
        expect(await c.read(prePromptDueAtProvider(moment).future), isFalse, reason: '$moment');
      }
      expect(await c.read(prePromptDueAtProvider(PrePromptMoment.afterResult).future), isTrue);
      rig.now = rig.now.add(const Duration(days: 90));
      c.invalidate(prePromptDueAtProvider);
      expect(await c.read(prePromptDueAtProvider(PrePromptMoment.ntaMode).future), isFalse);
    });

    test('a student Android no longer asks is offered the sheet; one who turned it on is not', () async {
      permission.current = NotificationPermission.denied;
      expect(await due(), isTrue);
      permission.current = NotificationPermission.granted;
      expect(await due(), isFalse);
    });

    test('the old rule that ended it after one refusal is gone', () async {
      // The system question was put and refused on an earlier build, and Not now was pressed twice.
      await prefs.setNotificationPermissionAsked(true);
      await ask();
      await ask();
      rig.now = rig.now.add(const Duration(days: 60));
      expect(await due(), isTrue);
    });
  });
}

/// A system dialog the student refuses every time.
class _RefusingDriver implements NotificationPermissionDriver {
  bool enabled = false;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<bool> request() async => false;
}
