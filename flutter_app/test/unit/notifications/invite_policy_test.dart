import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/data/invite_store.dart';
import 'package:mockmob/features/notifications/logic/pre_prompt_policy.dart';
import 'package:mockmob/features/notifications/logic/pre_prompt_variants.dart';

void main() {
  final now = DateTime(2026, 10, 16, 21);

  bool show({
    NotificationPermission permission = NotificationPermission.notAsked,
    bool on = false,
    int asks = 0,
    DateTime? declined,
    DateTime? postResult,
    DateTime? at,
  }) => shouldShowYouInvite(
    permission: permission,
    remindersOn: on,
    declinedAsks: asks,
    lastDeclinedAt: declined,
    postResultAskedAt: postResult,
    now: at ?? now,
  );

  group('when the invitation on You is due', () {
    test('it shows the first time, while reminders are off', () {
      expect(show(), isTrue);
      expect(show(permission: NotificationPermission.denied), isTrue);
    });

    test('Android allows it but the app setting is off: still invited, no system question needed', () {
      expect(show(permission: NotificationPermission.granted, on: false), isTrue);
    });

    test('it is gone once reminders are on, and where nothing can be asked', () {
      expect(show(permission: NotificationPermission.granted, on: true), isFalse);
      expect(show(permission: NotificationPermission.unavailable), isFalse);
    });

    test('after a Not now it returns after 2, 4, 7 and then every 10 days', () {
      const gaps = {1: 2, 2: 4, 3: 7, 4: 10, 8: 10};
      for (final e in gaps.entries) {
        final day = Duration(days: e.value);
        expect(show(asks: e.key, declined: now.subtract(day - const Duration(minutes: 1))), isFalse, reason: 'a minute early after ${e.key}');
        expect(show(asks: e.key, declined: now.subtract(day)), isTrue, reason: 'on time after ${e.key}');
      }
    });

    test('a Not now yesterday keeps it away today, two days later it returns', () {
      final declined = DateTime(2026, 10, 15, 21);
      expect(show(asks: 1, declined: declined), isFalse);
      expect(show(asks: 1, declined: declined, at: DateTime(2026, 10, 17, 21)), isTrue);
    });

    test('a day the post-result sheet asked, it stays away; the next day it is back', () {
      expect(show(postResult: DateTime(2026, 10, 16, 9)), isFalse);
      expect(show(postResult: DateTime(2026, 10, 15, 23, 59)), isTrue);
    });

    test('the key follows what Android allows', () {
      expect(inviteActionFor(NotificationPermission.notAsked), InviteAction.turnOn);
      expect(inviteActionFor(NotificationPermission.granted), InviteAction.turnOn);
      expect(inviteActionFor(NotificationPermission.denied), InviteAction.openSettings);
    });
  });

  group('the post-result sheet and the invitation share one day', () {
    bool offer({DateTime? inviteShownOn}) => shouldOfferPrePrompt(
      permission: NotificationPermission.notAsked,
      askCount: 0,
      lastAskedAt: null,
      now: now,
      inviteShownOn: inviteShownOn,
    );

    test('the sheet waits when the invitation was on screen today', () {
      expect(offer(), isTrue);
      expect(offer(inviteShownOn: DateTime(2026, 10, 16)), isFalse);
      expect(offer(inviteShownOn: DateTime(2026, 10, 15)), isTrue);
    });

    test('the invitation never counts for a moment that is not a result', () {
      for (final moment in [PrePromptMoment.inSession, PrePromptMoment.ntaMode, PrePromptMoment.appOpen]) {
        expect(
          shouldOfferPrePrompt(permission: NotificationPermission.notAsked, askCount: 0, lastAskedAt: null, now: now, moment: moment),
          isFalse,
        );
      }
    });
  });

  group('wording changes with each return', () {
    test('six wordings are used in turn, and each return differs from the one before', () {
      final titles = [for (var asks = 0; asks < prePromptVariantCount; asks++) prePromptVariantFor(asks).title];
      expect(titles.toSet().length, prePromptVariantCount);
      for (var asks = 1; asks < 12; asks++) {
        expect(prePromptVariantFor(asks).title, isNot(prePromptVariantFor(asks - 1).title));
      }
    });
  });

  group('the invitation history', () {
    test('it keeps the count, the time and the day, and reads an unreadable text as empty', () async {
      final memory = MemoryPrefsStore();
      final store = InviteStore(memory, userId: 'u1');
      expect((await store.load()).declinedAsks, 0);

      await store.recordDeclined(now);
      await store.markShown(now);
      final back = await InviteStore(memory, userId: 'u1').load();
      expect(back.declinedAsks, 1);
      expect(back.lastDeclinedAt, now);
      expect(back.shownOn, DateTime(2026, 10, 16));

      // Another account starts clean.
      expect((await InviteStore(memory, userId: 'u2').load()).declinedAsks, 0);

      await memory.setString('notif_you_invite_u1', '{not json');
      expect((await store.load()).declinedAsks, 0);
    });

    test('two quick writes both land', () async {
      final store = InviteStore(MemoryPrefsStore(), userId: 'u1');
      await Future.wait([store.recordDeclined(now), store.markShown(now)]);
      final h = await store.load();
      expect(h.declinedAsks, 1);
      expect(h.shownOn, isNotNull);
    });

    test('nothing is kept while signed out', () async {
      final memory = MemoryPrefsStore();
      final store = InviteStore(memory, userId: null);
      await store.recordDeclined(now);
      expect(memory.values, isEmpty);
    });
  });
}
