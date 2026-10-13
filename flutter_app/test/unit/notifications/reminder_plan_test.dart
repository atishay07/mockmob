import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';

import 'package:timezone/timezone.dart' as tz;

import 'support.dart';

void main() {
  // Monday 12 October 2026, 6:00 PM in Kolkata.
  final now = kolkata(2026, 10, 12, 18).toUtc();

  group('study window reminders', () {
    test('one reminder at the start of each of the next 7 days', () {
      final plan = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: const ReminderState());
      expect(plan.length, 7);
      expect(plan.first.at, kolkata(2026, 10, 12, 20));
      expect(plan.last.at, kolkata(2026, 10, 18, 20));
      expect(plan.first.taskId, 'study_window:2026-10-12');
      expect(plan.first.body, 'Your study window has started. Pick a small next step when you are ready.');
    });

    test('a window that has already started today is not scheduled for today', () {
      final late = kolkata(2026, 10, 12, 20, 30).toUtc();
      final plan = buildReminderPlan(now: late, prefs: prefsWith(weeklyOn: false), state: const ReminderState());
      expect(plan.first.at, kolkata(2026, 10, 13, 20));
      expect(plan.length, 6);
    });

    test('nothing without a window, with the channel off, or while paused', () {
      expect(buildReminderPlan(now: now, prefs: prefsWith(window: null, weeklyOn: false), state: const ReminderState()), isEmpty);
      expect(buildReminderPlan(now: now, prefs: prefsWith(studyOn: false, weeklyOn: false), state: const ReminderState()), isEmpty);
      final paused = const ReminderState().withCategory(NotificationChannelKeys.studyWindow, const CategoryStatus(paused: true));
      expect(buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: paused), isEmpty);
    });

    test('a mute removes the reminders inside it and keeps the ones after it', () {
      final muted = ReminderState(mutedUntil: kolkata(2026, 10, 15, 12).toUtc());
      final plan = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: muted);
      expect(plan.first.at, kolkata(2026, 10, 15, 20));
      expect(plan.length, 4);
    });

    test('a waiting repair replaces the first reminder, not adds a second on the same day', () {
      const repair = RepairReady(attemptId: 'att-9', mistakes: 3, minutes: 10);
      final plan = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: const ReminderState(), repair: repair);
      expect(plan.length, 7);
      expect(plan.first.taskId, 'repair_ready:att-9');
      expect(plan.first.body, 'Your repair is ready: 3 mistakes, about 10 minutes.');
      expect(plan.where((r) => r.taskId.startsWith('study_window:2026-10-12')), isEmpty);
      expect(plan.skip(1).every((r) => r.taskId.startsWith('study_window:')), isTrue);
      expect(plan.first.channel.id, 'repair_ready');
    });

    test('one mistake is singular', () {
      const repair = RepairReady(attemptId: 'a', mistakes: 1, minutes: 5);
      final plan = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: const ReminderState(), repair: repair);
      expect(plan.first.body, 'Your repair is ready: 1 mistake, about 5 minutes.');
    });

    test('a reminder is valid until the window ends', () {
      final plan = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: const ReminderState());
      expect(plan.first.validUntil, kolkata(2026, 10, 12, 21));
    });

    test('actions are Start, Not tonight and Mute for 7 days', () {
      final plan = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: const ReminderState());
      expect([for (final a in plan.first.actions) a.label], ['Start', 'Not tonight', 'Mute for 7 days']);
    });

    test('the student timezone decides the day', () {
      final ny = NotificationPrefs(
        timezone: 'America/New_York',
        channels: const {NotificationChannelKeys.studyWindow: true},
        studyWindow: const StudyWindow(start: ClockTime(20, 0), end: ClockTime(21, 0)),
      );
      final plan = buildReminderPlan(now: now, prefs: ny, state: const ReminderState());
      // 6:00 PM in Kolkata is 8:30 AM in New York, so 8:00 PM there is still today.
      expect((plan.first.at! as tz.TZDateTime).location.name, 'America/New_York');
      expect(plan.first.at!.hour, 20);
    });
  });

  group('repair ready, on its own switch', () {
    const repair = RepairReady(attemptId: 'att-9', mistakes: 3, minutes: 10);

    test('with the study window off it comes at the next 7:00 PM, in its own channel', () {
      final plan = buildReminderPlan(now: now, prefs: prefsWith(studyOn: false, weeklyOn: false), state: const ReminderState(), repair: repair);
      expect(plan.single.taskId, 'repair_ready:att-9');
      expect(plan.single.at, kolkata(2026, 10, 12, 19));
      expect(plan.single.validUntil, kolkata(2026, 10, 12, 22));
      expect(plan.single.channel.id, 'repair_ready');
      expect(plan.single.channel.prefKey, isNull, reason: 'the server has no key for it; its switch is on this phone');
    });

    test('after 7:00 PM it waits for tomorrow evening', () {
      final late = kolkata(2026, 10, 12, 19, 30).toUtc();
      final plan = buildReminderPlan(now: late, prefs: prefsWith(window: null, weeklyOn: false), state: const ReminderState(), repair: repair);
      expect(plan.single.at, kolkata(2026, 10, 13, 19));
    });

    test('its switch off, or its category stopped, leaves the study window alone', () {
      final off = buildReminderPlan(now: now, prefs: prefsWith(weeklyOn: false), state: const ReminderState(repairReadyOn: false), repair: repair);
      expect(off.length, 7);
      expect(off.every((r) => r.taskId.startsWith('study_window:')), isTrue);
      final stopped = const ReminderState().withCategory(repairReadyKey, const CategoryStatus(paused: true));
      expect(buildReminderPlan(now: now, prefs: prefsWith(studyOn: false, weeklyOn: false), state: stopped, repair: repair), isEmpty);
    });

    test('a mute moves it past the mute', () {
      final muted = ReminderState(mutedUntil: kolkata(2026, 10, 14, 12).toUtc());
      final plan = buildReminderPlan(now: now, prefs: prefsWith(studyOn: false, weeklyOn: false), state: muted, repair: repair);
      expect(plan.single.at, kolkata(2026, 10, 14, 19));
    });

    test('its unopened count is its own category', () {
      expect(prefKeyForTask('repair_ready:att-9'), repairReadyKey);
      expect(prefKeyForTask('study_window:2026-10-12'), NotificationChannelKeys.studyWindow);
    });

    test('the switch is kept with the rest of the phone state, on by default', () {
      expect(const ReminderState().repairReadyOn, isTrue);
      final back = ReminderState.fromJsonString(const ReminderState(repairReadyOn: false).toJsonString());
      expect(back.repairReadyOn, isFalse);
    });
  });

  group('weekly plan', () {
    test('off until the student turns it on', () {
      final plan = buildReminderPlan(now: now, prefs: prefsWith(window: null), state: const ReminderState());
      expect(plan, isEmpty);
    });

    test('Sunday at 6:00 PM when on, valid until Monday noon', () {
      final plan = buildReminderPlan(now: now, prefs: prefsWith(window: null), state: const ReminderState(weeklyPlanOn: true));
      expect(plan.single.at, kolkata(2026, 10, 18, 18));
      expect(plan.single.validUntil, kolkata(2026, 10, 19, 12));
      expect(plan.single.body, 'Your week is ready to look at.');
      expect(plan.single.taskId, 'weekly_plan:2026-10-12');
    });

    test('on a Sunday after 6:00 PM it moves to next Sunday', () {
      final sunday = kolkata(2026, 10, 18, 19).toUtc();
      final plan = buildReminderPlan(now: sunday, prefs: prefsWith(window: null), state: const ReminderState(weeklyPlanOn: true));
      expect(plan.single.at, kolkata(2026, 10, 25, 18));
    });

    test('the channel switch off wins over the local choice', () {
      final plan = buildReminderPlan(
        now: now,
        prefs: prefsWith(window: null, weeklyOn: false),
        state: const ReminderState(weeklyPlanOn: true),
      );
      expect(plan, isEmpty);
    });
  });

  test('the plan is in time order', () {
    final plan = buildReminderPlan(now: now, prefs: prefsWith(), state: const ReminderState(weeklyPlanOn: true));
    final times = [for (final r in plan) r.at!];
    expect([...times]..sort(), times);
    expect(plan.map((r) => r.taskId), contains('weekly_plan:2026-10-12'));
  });

  group('payload', () {
    test('round trips a route and a task id', () {
      final p = encodeReminderPayload('/review/mistakes', 'repair_ready:att-9');
      final d = decodeReminderPayload(p);
      expect(d.route, '/review/mistakes');
      expect(d.taskId, 'repair_ready:att-9');
    });

    test('a payload from elsewhere has no task id', () {
      final d = decodeReminderPayload('/result/abc/sealed');
      expect(d.route, '/result/abc/sealed');
      expect(d.taskId, isNull);
    });
  });
}
