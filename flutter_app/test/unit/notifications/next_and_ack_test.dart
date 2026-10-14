import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/features/notifications/logic/next_reminder.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';
import 'package:mockmob/features/notifications/services/reminder_scheduler.dart';
import 'package:mockmob/features/notifications/services/reminder_taps.dart';

import 'support.dart';

void main() {
  group('NextReminder text', () {
    final now = DateTime(2026, 10, 15, 18);

    test('tonight, with the repair it is about', () {
      final next = NextReminder.at(DateTime(2026, 10, 15, 20, 30), NextKind.repair, mistakes: 3);
      expect(next.headline(now), 'Next reminder: tonight 8:30 PM, repair 3 mistakes');
    });

    test('one mistake is singular', () {
      final next = NextReminder.at(DateTime(2026, 10, 15, 20, 30), NextKind.repair, mistakes: 1);
      expect(next.headline(now), endsWith('repair 1 mistake'));
    });

    test('a morning slot today, tomorrow and a later day', () {
      expect(NextReminder.at(DateTime(2026, 10, 15, 9), NextKind.study).headline(now), 'Next reminder: today 9:00 AM, study window');
      expect(NextReminder.at(DateTime(2026, 10, 16, 7), NextKind.study).headline(now), 'Next reminder: tomorrow 7:00 AM, study window');
      expect(NextReminder.at(DateTime(2026, 10, 18, 18), NextKind.weekly).headline(now), 'Next reminder: Sun 18 Oct 6:00 PM, weekly plan');
    });

    test('nothing scheduled carries its reason', () {
      const next = NextReminder.nothing(NothingReason.quietHours);
      expect(next.headline(now), 'Nothing scheduled');
      expect(next.why, contains('Quiet hours'));
      expect(next.sentence(now), startsWith('Nothing scheduled. '));
      expect(next.isScheduled, isFalse);
      expect(next.minuteOfDay, isNull);
    });

    test('the day bar dot is the minute of the day', () {
      expect(NextReminder.at(DateTime(2026, 10, 15, 20, 30), NextKind.study).minuteOfDay, 20 * 60 + 30);
    });

    test('nextReminderFrom picks the earliest accepted, else the reason', () {
      final early = DateTime(2026, 10, 15, 20);
      final late = DateTime(2026, 10, 16, 20);
      expect(nextReminderFrom(accepted: [(late, NextKind.study, null), (early, NextKind.repair, 2)], skips: const [], planned: 2).kind, NextKind.repair);
      expect(nextReminderFrom(accepted: const [], skips: const [], planned: 0).reason, NothingReason.off);
      expect(nextReminderFrom(accepted: const [], skips: const [NextSkip.stale], planned: 3).reason, NothingReason.quietHours);
      expect(nextReminderFrom(accepted: const [], skips: const [NextSkip.cap, NextSkip.stale], planned: 3).reason, NothingReason.weeklyCap);
      expect(nextReminderFrom(accepted: const [], skips: const [NextSkip.daily], planned: 3).reason, NothingReason.dailyCap);
    });

    test('a running mute is the reason, said with the day it ends', () {
      final until = DateTime(2026, 10, 19, 18);
      final next = nextReminderFrom(accepted: const [], skips: const [NextSkip.stale], planned: 0, mutedUntil: until);
      expect(next.reason, NothingReason.muted);
      expect(next.headline(now), 'Nothing scheduled');
      expect(next.why, 'Muted until Mon 19 Oct.');
    });

    test('a reminder that falls after the mute wins over the mute', () {
      final after = DateTime(2026, 10, 20, 20);
      final next = nextReminderFrom(accepted: [(after, NextKind.study, null)], skips: const [], planned: 1, mutedUntil: DateTime(2026, 10, 19, 18));
      expect(next.isScheduled, isTrue);
      expect(next.at, after);
    });

    test('the daily limit is said in its own words, not as the weekly one', () {
      expect(const NextReminder.nothing(NothingReason.dailyCap).why, isNot(contains('weekly')));
      expect(const NextReminder.nothing(NothingReason.weeklyCap).why, contains('weekly'));
    });
  });

  group('the scheduler reports the real next reminder', () {
    ReminderScheduler withNext(Rig rig, List<NextReminder> into) => ReminderScheduler(
          service: rig.service,
          store: rig.store,
          prefs: () => rig.prefs,
          repair: () => rig.repair,
          ensureReady: rig.service.initialize,
          now: () => rig.now,
          onNext: into.add,
        );

    test('the first accepted study reminder', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      final seen = <NextReminder>[];
      await withNext(rig, seen).sync();
      expect(seen.last.kind, NextKind.study);
      expect(seen.last.at, kolkata(2026, 10, 12, 20));
    });

    test('a repair waiting takes the first slot and names its mistakes', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false), repair: const RepairReady(attemptId: 'a1', mistakes: 3, minutes: 12));
      final seen = <NextReminder>[];
      await withNext(rig, seen).sync();
      expect(seen.last.kind, NextKind.repair);
      expect(seen.last.mistakes, 3);
    });

    test('blocked notifications say so', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.gateway.enabled = false;
      final seen = <NextReminder>[];
      await withNext(rig, seen).sync();
      expect(seen.last.reason, NothingReason.blocked);
    });

    test('a study window inside quiet hours is nothing scheduled, for quiet hours', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false, window: const StudyWindow(start: ClockTime(23, 30), end: ClockTime(23, 59))));
      final seen = <NextReminder>[];
      await withNext(rig, seen).sync();
      expect(seen.last.reason, NothingReason.quietHours);
    });

    test('a mute reports the first reminder after it, never one inside it', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      final seen = <NextReminder>[];
      final scheduler = withNext(rig, seen);
      await scheduler.mute();
      final next = seen.last;
      if (next.isScheduled) {
        expect(next.at!.isAfter(rig.now.add(const Duration(days: 7)).subtract(const Duration(minutes: 1))), isTrue);
      } else {
        expect(next.reason, NothingReason.muted);
      }
    });

    test('everything off is nothing scheduled, off', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false, studyOn: false));
      final seen = <NextReminder>[];
      await withNext(rig, seen).sync();
      expect(seen.last.reason, NothingReason.off);
    });
  });

  group('Not tonight and Mute are answered', () {
    late List<ReminderAck> acks;
    late List<String> opened;
    late int unmuted;
    late int muted;
    late ReminderTapHandler handler;

    setUp(() {
      acks = [];
      opened = [];
      unmuted = 0;
      muted = 0;
      handler = ReminderTapHandler(
        opened: (id) async => opened.add(id),
        declined: (_) async {},
        mute: () async => muted++,
        open: (_) {},
        unmute: () async => unmuted++,
        acknowledge: (a) async => acks.add(a),
      );
    });

    final payload = encodeReminderPayload('/review/mistakes', 'repair_ready:a1');

    test('Not tonight is answered and names the reminder it replaces', () async {
      await handler.handle(NotificationTap(payload: payload, actionId: ReminderActions.notTonight));
      expect(acks.single.muted, isFalse);
      expect(acks.single.taskId, 'repair_ready:a1');
    });

    test('Mute mutes and is answered', () async {
      await handler.handle(NotificationTap(payload: payload, actionId: ReminderActions.mute));
      expect(muted, 1);
      expect(acks.single.muted, isTrue);
    });

    test('Resume turns reminders back on and answers nothing more', () async {
      await handler.handle(NotificationTap(payload: encodeReminderPayload('/you/notifications', 'ack:mute'), actionId: ReminderActions.resume));
      expect(unmuted, 1);
      expect(acks, isEmpty);
    });

    test('tapping an answer opens its screen but is not counted as a reminder response', () async {
      await handler.handle(NotificationTap(payload: encodeReminderPayload('/you/notifications', 'ack:mute')));
      expect(opened, isEmpty);
    });

    test('a failing acknowledge never throws', () async {
      final failing = ReminderTapHandler(
        opened: (_) async {},
        declined: (_) async {},
        mute: () async {},
        open: (_) {},
        acknowledge: (_) async => throw StateError('plugin'),
      );
      await failing.handle(NotificationTap(payload: payload, actionId: ReminderActions.notTonight));
    });
  });

  group('expanded notifications', () {
    test('a long repair line is kept whole when the notification opens out', () {
      const body = 'Your repair is ready: 12 mistakes, about 30 minutes.';
      expect(bigTextFor(body).bigText, body);
    });
  });

  group('NotificationService.acknowledge', () {
    test('shows a silent replacement under the reminder id and takes itself away', () async {
      final rig = Rig();
      await rig.service.acknowledge(
        taskId: 'repair_ready:a1',
        channel: NotificationChannels.repairReady,
        title: 'Okay, no repair tonight',
        body: 'Your repair stays in Review whenever you want it.',
        lasts: const Duration(milliseconds: 20),
      );
      expect(rig.gateway.shown, hasLength(1));
      final id = rig.gateway.shown.single;
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(rig.gateway.cancelled, contains(id));
    });
  });
}
