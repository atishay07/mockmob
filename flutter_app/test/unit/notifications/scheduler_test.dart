import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/notifications/notification_ids.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';
import 'package:mockmob/features/notifications/services/reminder_taps.dart';

import 'support.dart';

void main() {
  group('ReminderScheduler.sync', () {
    test('schedules the study window reminders, at most 3 in the Monday to Sunday week', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      // 7 planned, the weekly cap of 3 lets the first three through.
      expect(rig.gateway.scheduled.length, 3);
      expect(rig.gateway.scheduled.map((s) => s.at).toList(), [kolkata(2026, 10, 12, 20), kolkata(2026, 10, 13, 20), kolkata(2026, 10, 14, 20)]);
    });

    test('a second sync cancels what was ahead and schedules the same again, never twice', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.length, 3);
    });

    test('nothing is scheduled while notifications are not allowed', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.gateway.enabled = false;
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });

    test('nothing is changed while the student settings have not loaded', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      final before = rig.gateway.scheduled.length;
      rig.prefs = null;
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.length, before);
      expect(rig.gateway.cancelled, isEmpty);
    });

    test('a study window inside quiet hours waits for 7:00 AM and is dropped as stale', () async {
      final rig = Rig(
        prefs: prefsWith(
          weeklyOn: false,
          window: const StudyWindow(start: ClockTime(23, 30), end: ClockTime(23, 59)),
        ),
      );
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });

    test('turning the channel off cancels the reminders that were scheduled', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isNotEmpty);
      rig.prefs = prefsWith(weeklyOn: false, studyOn: false);
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });

    test('the repair reminder goes when the repair is done', () async {
      final rig = Rig(
        prefs: prefsWith(weeklyOn: false),
        repair: const RepairReady(attemptId: 'att-9', mistakes: 3, minutes: 10),
      );
      await rig.scheduler.sync();
      final repairId = notificationIdFor('repair_ready:att-9');
      expect(rig.gateway.scheduled.any((s) => s.id == repairId), isTrue);

      rig.repair = null;
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.any((s) => s.id == repairId), isFalse);
      expect(rig.gateway.scheduled.length, 3);
    });

    test('Mute for 7 days cancels what is ahead and schedules nothing until it ends', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      await rig.scheduler.mute();
      expect(rig.gateway.scheduled, isEmpty);
      final state = await rig.store.load();
      expect(state.mutedUntil!.isAtSameMomentAs(rig.now.add(const Duration(days: 7))), isTrue);

      await rig.scheduler.unmute();
      expect(rig.gateway.scheduled, isNotEmpty);
    });

    test('the weekly plan is off until turned on, then goes through the engine', () async {
      final rig = Rig(prefs: prefsWith(window: null));
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
      await rig.scheduler.setWeeklyPlan(true);
      expect(rig.gateway.scheduled.single.at, kolkata(2026, 10, 18, 18));
      expect(rig.gateway.scheduled.single.body, 'Your week is ready to look at.');
    });

    test('with a study window on, the weekly plan still gets a slot under the weekly cap', () async {
      final rig = Rig(prefs: prefsWith());
      await rig.scheduler.setWeeklyPlan(true);
      // Cap 3 in the Monday to Sunday week: the Sunday plan plus the next two study reminders.
      expect(rig.gateway.scheduled.any((s) => s.at == kolkata(2026, 10, 18, 18)), isTrue);
      expect(rig.gateway.scheduled.length, 3);
      // A second pass keeps the same three.
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.any((s) => s.at == kolkata(2026, 10, 18, 18)), isTrue);
      expect(rig.gateway.scheduled.length, 3);
    });

    test('one failed request does not stop the rest of the plan', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.gateway.failOnce = true;
      await expectLater(rig.scheduler.sync(), throwsA(isA<StateError>()));
      // The first request failed, the next ones were still scheduled.
      expect(rig.gateway.scheduled.length, 3);
    });

    test('reminders only use inexact scheduling through the engine (no exact alarm API in the plan)', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      for (final s in rig.gateway.scheduled) {
        expect(s.payload, startsWith('/'));
        expect(s.actions.map((a) => a.id), [ReminderActions.start, ReminderActions.notTonight, ReminderActions.mute]);
      }
    });
  });

  group('stopping after 3 unopened', () {
    test('three reminders that came and went unopened stop the category and queue the hint', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      // Three days later, the student opens the app for the first time.
      rig.now = kolkata(2026, 10, 15, 9).toUtc();
      final stopped = await rig.scheduler.settle();
      expect(stopped, isTrue);
      final state = await rig.store.load();
      expect(state.category(NotificationChannelKeys.studyWindow).paused, isTrue);
      expect(state.category(NotificationChannelKeys.studyWindow).hintPending, isTrue);

      await rig.scheduler.sync();
      // Paused: nothing new is scheduled (the three that already fired are history).
      expect(rig.gateway.scheduled.where((s) => s.at.isAfter(rig.now)), isEmpty);

      await rig.scheduler.markFewerRemindersShown(NotificationChannelKeys.studyWindow);
      expect((await rig.store.load()).category(NotificationChannelKeys.studyWindow).hintPending, isFalse);
    });

    test('turning it back on starts again', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      rig.now = kolkata(2026, 10, 15, 9).toUtc();
      await rig.scheduler.settle();
      await rig.scheduler.resumeCategory(NotificationChannelKeys.studyWindow);
      expect(rig.gateway.scheduled, isNotEmpty);
    });
  });

  group('tap handling', () {
    late Rig rig;
    late List<String> opened;
    late ReminderTapHandler taps;

    setUp(() async {
      rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      opened = [];
      taps = ReminderTapHandler(
        opened: rig.scheduler.reminderOpened,
        declined: rig.scheduler.reminderDeclined,
        mute: rig.scheduler.mute,
        open: opened.add,
      );
    });

    String firstPayload() => rig.gateway.scheduled.first.payload!;

    test('tapping a reminder opens its route', () async {
      await taps.handle(NotificationTap(payload: firstPayload()));
      expect(opened, ['/today']);
    });

    test('Start opens its route and counts as a response', () async {
      await taps.handle(NotificationTap(payload: firstPayload(), actionId: ReminderActions.start));
      expect(opened, ['/today']);
      final state = await rig.store.load();
      expect(state.delivered.where((d) => d.taskId == 'study_window:2026-10-12'), isEmpty);
    });

    test('Not tonight opens nothing', () async {
      await taps.handle(NotificationTap(payload: firstPayload(), actionId: ReminderActions.notTonight));
      expect(opened, isEmpty);
    });

    test('Mute for 7 days mutes and opens nothing', () async {
      await taps.handle(NotificationTap(payload: firstPayload(), actionId: ReminderActions.mute));
      expect(opened, isEmpty);
      expect((await rig.store.load()).isMuted(rig.now), isTrue);
    });

    test('a payload that is not an app route opens nothing', () async {
      await taps.handle(const NotificationTap(payload: 'https://evil.example/login'));
      await taps.handle(const NotificationTap(payload: '/not/a/route/at/all/x'));
      await taps.handle(const NotificationTap(payload: null));
      expect(opened, isEmpty);
    });

    test('a failed record write still opens the route and does not throw', () async {
      final failing = ReminderTapHandler(
        opened: (_) async => throw StateError('disk'),
        declined: (_) async => throw StateError('disk'),
        mute: () async => throw StateError('disk'),
        open: opened.add,
      );
      await failing.handle(NotificationTap(payload: firstPayload()));
      expect(opened, ['/today']);
      await failing.handle(NotificationTap(payload: firstPayload(), actionId: ReminderActions.notTonight));
      await failing.handle(NotificationTap(payload: firstPayload(), actionId: ReminderActions.mute));
    });

    test('the result-ready payload from the session engine still opens', () async {
      await taps.handle(const NotificationTap(payload: '/result/att-1/sealed'));
      expect(opened, ['/result/att-1/sealed']);
    });
  });
}
