import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_ids.dart';
import 'package:mockmob/core/notifications/notification_planner.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/notifications/quiet_hours.dart';
import 'package:mockmob/core/notifications/timezones.dart';
import 'package:timezone/timezone.dart' as tz;

const start = ClockTime(23, 0);
const end = ClockTime(7, 0);

void main() {
  final kolkata = locationFor('Asia/Kolkata');

  tz.TZDateTime at(int y, int m, int d, int h, [int min = 0]) => tz.TZDateTime(kolkata, y, m, d, h, min);

  group('quiet hours across midnight (11:00 PM to 7:00 AM)', () {
    test('inside: 11:00 PM start inclusive, 7:00 AM end exclusive', () {
      expect(isInQuietHours(at(2026, 10, 12, 22, 59), start, end), isFalse);
      expect(isInQuietHours(at(2026, 10, 12, 23), start, end), isTrue);
      expect(isInQuietHours(at(2026, 10, 13, 0), start, end), isTrue);
      expect(isInQuietHours(at(2026, 10, 13, 6, 59), start, end), isTrue);
      expect(isInQuietHours(at(2026, 10, 13, 7), start, end), isFalse);
      expect(isInQuietHours(at(2026, 10, 13, 12), start, end), isFalse);
    });

    test('11:30 PM waits until 7:00 AM the next day', () {
      final deferred = deferOutOfQuietHours(at(2026, 10, 12, 23, 30), start, end);
      expect(deferred, at(2026, 10, 13, 7));
    });

    test('2:00 AM waits until 7:00 AM the same day', () {
      final deferred = deferOutOfQuietHours(at(2026, 10, 13, 2), start, end);
      expect(deferred, at(2026, 10, 13, 7));
    });

    test('exactly midnight waits until 7:00 AM', () {
      expect(deferOutOfQuietHours(at(2026, 10, 13, 0), start, end), at(2026, 10, 13, 7));
    });

    test('outside quiet hours the time is unchanged', () {
      final t = at(2026, 10, 12, 21, 15);
      expect(deferOutOfQuietHours(t, start, end), t);
    });

    test('deferral crosses a month end', () {
      expect(deferOutOfQuietHours(at(2026, 10, 31, 23, 45), start, end), at(2026, 11, 1, 7));
    });

    test('deferral crosses a year end', () {
      expect(deferOutOfQuietHours(at(2026, 12, 31, 23, 59), start, end), at(2027, 1, 1, 7));
    });

    test('equal start and end means no quiet hours', () {
      expect(isInQuietHours(at(2026, 10, 12, 3), const ClockTime(7, 0), const ClockTime(7, 0)), isFalse);
    });

    test('a window inside one day works too', () {
      const s = ClockTime(13, 0);
      const e = ClockTime(15, 30);
      expect(isInQuietHours(at(2026, 10, 12, 12, 59), s, e), isFalse);
      expect(isInQuietHours(at(2026, 10, 12, 14), s, e), isTrue);
      expect(isInQuietHours(at(2026, 10, 12, 15, 30), s, e), isFalse);
      expect(deferOutOfQuietHours(at(2026, 10, 12, 14), s, e), at(2026, 10, 12, 15, 30));
    });

    test('works in another timezone across a daylight saving change', () {
      final ny = locationFor('America/New_York');
      // 11:30 PM on 31 October 2026 (still EDT); the clocks fall back on 1 November.
      final late = tz.TZDateTime(ny, 2026, 10, 31, 23, 30);
      final deferred = deferOutOfQuietHours(late, start, end);
      expect(deferred, tz.TZDateTime(ny, 2026, 11, 1, 7));
      expect(deferred.hour, 7);
    });
  });

  group('planNotification', () {
    final prefs = NotificationPrefs.defaults.copyChannels({'study_window': true});
    final now = at(2026, 10, 12, 20).toUtc(); // Monday 8:00 PM IST

    NotificationRequest reminder(String id, {DateTime? when, DateTime? validUntil, NotificationChannelSpec? channel}) => NotificationRequest(
          taskId: id,
          channel: channel ?? NotificationChannels.studyReminders,
          title: 'Study',
          body: 'Your repair is ready: 3 mistakes, about 10 minutes.',
          at: when,
          validUntil: validUntil,
        );

    NotificationPlan plan(NotificationRequest r, {List<LedgerEntry> ledger = const [], int cap = 3, NotificationPrefs? p}) =>
        planNotification(request: r, now: now, prefs: p ?? prefs, weeklyCap: cap, ledger: ledger);

    test('a reminder at 11:30 PM is deferred to 7:00 AM', () {
      final p = plan(reminder('a', when: at(2026, 10, 12, 23, 30)));
      expect(p.shouldDeliver, isTrue);
      expect(p.at, at(2026, 10, 13, 7));
      expect(p.silent, isFalse);
    });

    test('a deferred reminder past its validity is dropped as stale', () {
      final p = plan(reminder('a', when: at(2026, 10, 12, 23, 30), validUntil: at(2026, 10, 13, 6).toUtc()));
      expect(p.skipped, NotificationSkip.stale);
    });

    test('a reminder still valid after deferral is kept', () {
      final p = plan(reminder('a', when: at(2026, 10, 12, 23, 30), validUntil: at(2026, 10, 13, 9).toUtc()));
      expect(p.shouldDeliver, isTrue);
    });

    test('a response to the student own action is never deferred and is silent in quiet hours', () {
      final request = NotificationRequest(
        taskId: 'result',
        channel: NotificationChannels.resultsReady,
        title: 'Result ready',
        body: 'Mock 7 was received. Your result is ready.',
        at: at(2026, 10, 12, 23, 30),
        respondsToStudentAction: true,
      );
      final p = plan(request);
      expect(p.at, at(2026, 10, 12, 23, 30));
      expect(p.silent, isTrue);
    });

    test('a response outside quiet hours is not silent', () {
      final request = NotificationRequest(
        taskId: 'result',
        channel: NotificationChannels.resultsReady,
        title: 't',
        body: 'b',
        at: at(2026, 10, 12, 20),
        respondsToStudentAction: true,
      );
      expect(plan(request).silent, isFalse);
    });

    test('a response ignores the caps', () {
      final ledger = [for (var i = 0; i < 5; i++) LedgerEntry(taskId: 'x$i', at: at(2026, 10, 12, 9 + i).toUtc())];
      final request = NotificationRequest(taskId: 'r', channel: NotificationChannels.resultsReady, title: 't', body: 'b', respondsToStudentAction: true);
      expect(plan(request, ledger: ledger).shouldDeliver, isTrue);
    });

    test('a channel the student switched off is skipped', () {
      final off = prefs.copyChannels({'study_window': false});
      expect(plan(reminder('a'), p: off).skipped, NotificationSkip.channelOff);
    });

    test('the mock in progress status has no channel switch', () {
      final request = NotificationRequest(taskId: mockInProgressTaskId, channel: NotificationChannels.mockInProgress, title: 't', body: 'b', respondsToStudentAction: true);
      expect(plan(request).shouldDeliver, isTrue);
    });
  });

  group('weekly cap of 3 and one a day', () {
    final prefs = NotificationPrefs.defaults.copyChannels({'study_window': true});
    final now = at(2026, 10, 12, 8).toUtc();

    NotificationRequest reminder(String id, DateTime when) =>
        NotificationRequest(taskId: id, channel: NotificationChannels.studyReminders, title: 't', body: 'b', at: when);

    NotificationPlan plan(NotificationRequest r, List<LedgerEntry> ledger, {int cap = 3}) =>
        planNotification(request: r, now: now, prefs: prefs, weeklyCap: cap, ledger: ledger);

    LedgerEntry entry(String id, tz.TZDateTime t) => LedgerEntry(taskId: id, at: t.toUtc());

    test('the fourth reminder in a Monday to Sunday week is skipped', () {
      // Monday 12, Tuesday 13 and Wednesday 14 October are used.
      final ledger = [entry('a', at(2026, 10, 12, 9)), entry('b', at(2026, 10, 13, 9)), entry('c', at(2026, 10, 14, 9))];
      expect(plan(reminder('d', at(2026, 10, 15, 9)), ledger).skipped, NotificationSkip.weeklyCap);
    });

    test('three are allowed', () {
      final ledger = [entry('a', at(2026, 10, 12, 9)), entry('b', at(2026, 10, 13, 9))];
      expect(plan(reminder('c', at(2026, 10, 14, 9)), ledger).shouldDeliver, isTrue);
    });

    test('the cap resets on Monday', () {
      final ledger = [entry('a', at(2026, 10, 12, 9)), entry('b', at(2026, 10, 13, 9)), entry('c', at(2026, 10, 14, 9))];
      // Monday 19 October is a new week.
      expect(plan(reminder('d', at(2026, 10, 19, 9)), ledger).shouldDeliver, isTrue);
      // Sunday 18 October is still the old week.
      expect(plan(reminder('d', at(2026, 10, 18, 9)), ledger).skipped, NotificationSkip.weeklyCap);
    });

    test('a second reminder on the same day is skipped', () {
      final ledger = [entry('a', at(2026, 10, 13, 9))];
      expect(plan(reminder('b', at(2026, 10, 13, 18)), ledger).skipped, NotificationSkip.dailyCap);
    });

    test('the same task id is not counted twice when rescheduled', () {
      final ledger = [entry('a', at(2026, 10, 12, 9)), entry('b', at(2026, 10, 13, 9)), entry('c', at(2026, 10, 14, 9))];
      expect(plan(reminder('c', at(2026, 10, 14, 19)), ledger).shouldDeliver, isTrue);
    });

    test('a cap of 0 switches reminders off', () {
      expect(plan(reminder('a', at(2026, 10, 14, 9)), const [], cap: 0).skipped, NotificationSkip.weeklyCap);
    });

    test('a reminder deferred out of quiet hours counts in the week it is delivered', () {
      // 11:30 PM Sunday 18 October is deferred to 7:00 AM Monday 19, a new week with room.
      final ledger = [entry('a', at(2026, 10, 12, 9)), entry('b', at(2026, 10, 13, 9)), entry('c', at(2026, 10, 14, 9))];
      final p = plan(reminder('d', at(2026, 10, 18, 23, 30)), ledger);
      expect(p.shouldDeliver, isTrue);
      expect(p.at, at(2026, 10, 19, 7));
    });
  });

  group('notification ids', () {
    test('are stable and positive', () {
      expect(notificationIdFor('repair:att-1'), notificationIdFor('repair:att-1'));
      expect(notificationIdFor('repair:att-1'), isNot(notificationIdFor('repair:att-2')));
      expect(notificationIdFor('x'), inInclusiveRange(0, 0x7fffffff));
      // A known FNV-1a value guards against accidental change between releases.
      expect(notificationIdFor(''), 0x811c9dc5 & 0x7fffffff);
    });
  });

  group('NotificationService', () {
    late _FakeGateway gateway;
    late MemoryNotificationLedgerStore ledger;
    late NotificationPrefs prefs;
    late int localCap;
    late DateTime now;
    late Set<String> created;
    late NotificationService service;

    setUp(() {
      gateway = _FakeGateway();
      ledger = MemoryNotificationLedgerStore();
      prefs = NotificationPrefs.defaults.copyChannels({'study_window': true});
      localCap = 3;
      now = at(2026, 10, 12, 20).toUtc();
      created = {};
      service = NotificationService(
        gateway: gateway,
        ledger: ledger,
        prefs: () => prefs,
        weeklyCap: () async => localCap,
        createdChannels: () async => created,
        saveCreatedChannels: (c) async => created = c,
        now: () => now,
      );
    });

    NotificationRequest reminder(String id, DateTime when) =>
        NotificationRequest(taskId: id, channel: NotificationChannels.studyReminders, title: 'Study', body: 'Body', at: when);

    test('creates a channel at first value, once', () async {
      await service.schedule(reminder('a', at(2026, 10, 13, 9)));
      await service.schedule(reminder('b', at(2026, 10, 14, 9)));
      expect(gateway.channels, ['study_reminders']);
      expect(created, {'study_reminders'});
    });

    test('schedules in the future with the plugin and records it in the ledger', () async {
      final outcome = await service.schedule(reminder('a', at(2026, 10, 13, 9)));
      expect(outcome.scheduled, isTrue);
      expect(gateway.scheduled.single.at, at(2026, 10, 13, 9));
      expect(gateway.scheduled.single.id, notificationIdFor('a'));
      expect(ledger.entries.single.taskId, 'a');
    });

    test('defers inside quiet hours', () async {
      final outcome = await service.schedule(reminder('a', at(2026, 10, 12, 23, 30)));
      expect(outcome.deliverAt, at(2026, 10, 13, 7));
      expect(gateway.scheduled.single.at, at(2026, 10, 13, 7));
    });

    test('the cap of 3 stops the fourth', () async {
      for (var i = 0; i < 3; i++) {
        final o = await service.schedule(reminder('t$i', at(2026, 10, 13 + i, 9)));
        expect(o.scheduled, isTrue);
      }
      final fourth = await service.schedule(reminder('t3', at(2026, 10, 16, 9)));
      expect(fourth.skipped, NotificationSkip.weeklyCap);
      expect(gateway.scheduled.length, 3);
    });

    test('the server weekly cap lowers the client cap when it is smaller', () async {
      prefs = NotificationPrefs(channels: {...prefs.channels}, weeklyCap: 1);
      await service.schedule(reminder('a', at(2026, 10, 13, 9)));
      final second = await service.schedule(reminder('b', at(2026, 10, 14, 9)));
      expect(second.skipped, NotificationSkip.weeklyCap);
    });

    test('cancelling by task id cancels the plugin id and frees its place in the caps', () async {
      for (var i = 0; i < 3; i++) {
        await service.schedule(reminder('t$i', at(2026, 10, 13 + i, 9)));
      }
      await service.cancel('t1');
      expect(gateway.cancelled, [notificationIdFor('t1')]);
      expect(ledger.entries.map((e) => e.taskId), ['t0', 't2']);
      final again = await service.schedule(reminder('t9', at(2026, 10, 17, 9)));
      expect(again.scheduled, isTrue);
    });

    test('cancelAll clears the plugin and the ledger', () async {
      await service.schedule(reminder('a', at(2026, 10, 13, 9)));
      await service.cancelAll();
      expect(gateway.cancelAllCalls, 1);
      expect(ledger.entries, isEmpty);
    });

    test('a response shows now, silently inside quiet hours, and is not in the ledger', () async {
      now = at(2026, 10, 12, 23, 40).toUtc();
      final outcome = await service.schedule(const NotificationRequest(
        taskId: 'result_ready:att-1',
        channel: NotificationChannels.resultsReady,
        title: 'Result ready',
        body: 'Mock 7 was received. Your result is ready.',
        respondsToStudentAction: true,
      ));
      expect(outcome.silent, isTrue);
      expect(gateway.shown.single.silent, isTrue);
      expect(gateway.scheduled, isEmpty);
      expect(ledger.entries, isEmpty);
    });

    test('an ongoing status is silent and ongoing', () async {
      await service.showOngoing(taskId: mockInProgressTaskId, channel: NotificationChannels.mockInProgress, title: 'Mock 7 in progress', body: 'Open MockMob to continue.');
      expect(gateway.shown.single.ongoing, isTrue);
      expect(gateway.shown.single.silent, isTrue);
      expect(gateway.channels, ['mock_in_progress']);
    });

    test('the plugin gateway schedules with inexact mode only (no exact alarm permission)', () {
      final src = File('lib/core/notifications/notification_gateway.dart').readAsStringSync();
      expect(src, contains('AndroidScheduleMode.inexactAllowWhileIdle'));
      expect(src, isNot(contains('AndroidScheduleMode.exact')));
      expect(src, isNot(contains('alarmClock')));
    });
  });
}

extension on NotificationPrefs {
  NotificationPrefs copyChannels(Map<String, bool> changes) => NotificationPrefs(
        timezone: timezone,
        quietStart: quietStart,
        quietEnd: quietEnd,
        channels: {...channels, ...changes},
        studyWindow: studyWindow,
        weeklyCap: weeklyCap,
      );
}

class _Scheduled {
  _Scheduled(this.id, this.at, this.silent);

  final int id;
  final tz.TZDateTime at;
  final bool silent;
}

class _Shown {
  _Shown(this.id, this.silent, this.ongoing);

  final int id;
  final bool silent;
  final bool ongoing;
}

class _FakeGateway implements LocalNotificationsGateway {
  final channels = <String>[];
  final scheduled = <_Scheduled>[];
  final shown = <_Shown>[];
  final cancelled = <int>[];
  int cancelAllCalls = 0;
  int initCalls = 0;

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async => initCalls++;

  @override
  Future<void> createChannel(NotificationChannelSpec spec) async => channels.add(spec.id);

  @override
  Future<void> schedule({
    required int id,
    required NotificationChannelSpec channel,
    required tz.TZDateTime at,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    List<NotificationActionSpec> actions = const [],
  }) async =>
      scheduled.add(_Scheduled(id, at, silent));

  @override
  Future<void> show({
    required int id,
    required NotificationChannelSpec channel,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    bool ongoing = false,
    List<NotificationActionSpec> actions = const [],
  }) async =>
      shown.add(_Shown(id, silent, ongoing));

  @override
  Future<void> cancel(int id) async => cancelled.add(id);

  @override
  Future<void> cancelAll() async => cancelAllCalls++;

  @override
  Future<bool> areNotificationsEnabled() async => true;
}
