import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/logic/pre_prompt_policy.dart';
import 'package:mockmob/features/notifications/logic/reminder_outcomes.dart';

const key = NotificationChannelKeys.studyWindow;

ReminderState withDue(ReminderState s, String id, DateTime at) => recordScheduled(s, taskId: id, prefKey: key, at: at);

void main() {
  final t0 = DateTime(2026, 10, 12, 20);

  group('unopened reminders', () {
    test('a reminder opened within 2 hours counts as responded to', () {
      var s = withDue(const ReminderState(), 'a', t0);
      s = s.withCategory(key, const CategoryStatus(ignoredInRow: 2));
      s = settleDeliveredReminders(s, now: t0.add(const Duration(minutes: 90)), notificationsAllowed: true);
      expect(s.category(key).ignoredInRow, 0);
      expect(s.delivered, isEmpty);
    });

    test('a reminder not opened for more than 2 hours counts as unopened', () {
      var s = withDue(const ReminderState(), 'a', t0);
      s = settleDeliveredReminders(s, now: t0.add(const Duration(hours: 5)), notificationsAllowed: true);
      expect(s.category(key).ignoredInRow, 1);
      expect(s.category(key).paused, isFalse);
    });

    test('the third unopened reminder in a row pauses the category and queues the hint once', () {
      var s = const ReminderState();
      for (var i = 0; i < 3; i++) {
        s = withDue(s, 'r$i', t0.add(Duration(days: i)));
      }
      s = settleDeliveredReminders(s, now: t0.add(const Duration(days: 5)), notificationsAllowed: true);
      expect(s.category(key).paused, isTrue);
      expect(s.category(key).hintPending, isTrue);
      expect(s.category(key).ignoredInRow, 3);
    });

    test('an opened reminder in the middle starts the count again', () {
      var s = const ReminderState();
      s = withDue(s, 'a', t0);
      s = withDue(s, 'b', t0.add(const Duration(days: 1)));
      s = withDue(s, 'c', t0.add(const Duration(days: 2)));
      s = markEngaged(s, 'c');
      s = settleDeliveredReminders(s, now: t0.add(const Duration(days: 4)), notificationsAllowed: true);
      expect(s.category(key).ignoredInRow, 0);
      expect(s.category(key).paused, isFalse);
    });

    test('nothing is counted while notifications were off', () {
      var s = withDue(const ReminderState(), 'a', t0);
      s = settleDeliveredReminders(s, now: t0.add(const Duration(days: 1)), notificationsAllowed: false);
      expect(s.category(key).ignoredInRow, 0);
      expect(s.delivered, isEmpty);
    });

    test('Not tonight is neither unopened nor a reset', () {
      var s = const ReminderState().withCategory(key, const CategoryStatus(ignoredInRow: 2));
      s = withDue(s, 'a', t0);
      s = markDeclined(s, 'a');
      s = settleDeliveredReminders(s, now: t0.add(const Duration(days: 1)), notificationsAllowed: true);
      expect(s.category(key).ignoredInRow, 2);
      expect(s.category(key).paused, isFalse);
    });

    test('a reminder still ahead is left alone', () {
      final s = withDue(const ReminderState(), 'a', t0.add(const Duration(days: 1)));
      final next = settleDeliveredReminders(s, now: t0, notificationsAllowed: true);
      expect(next.delivered.length, 1);
    });

    test('state survives a round trip through its stored form', () {
      var s = withDue(const ReminderState(weeklyPlanOn: true, prePromptNotNowCount: 1), 'a', t0);
      s = s.copyWith(mutedUntil: t0.add(const Duration(days: 7)));
      s = s.withCategory(key, const CategoryStatus(ignoredInRow: 3, paused: true, hintPending: true));
      final back = ReminderState.fromJsonString(s.toJsonString());
      expect(back.weeklyPlanOn, isTrue);
      expect(back.prePromptNotNowCount, 1);
      expect(back.mutedUntil, s.mutedUntil);
      expect(back.category(key).paused, isTrue);
      expect(back.delivered.single.taskId, 'a');
    });

    test('unreadable stored state is empty state', () {
      expect(ReminderState.fromJsonString('{broken').weeklyPlanOn, isFalse);
      expect(ReminderState.fromJsonString(null).delivered, isEmpty);
    });
  });

  group('pre-prompt policy', () {
    final now = DateTime(2026, 10, 12, 21);

    bool offer({
      NotificationPermission permission = NotificationPermission.notAsked,
      int notNow = 0,
      DateTime? last,
    }) => shouldOfferPrePrompt(permission: permission, notNowCount: notNow, lastNotNowAt: last, now: now);

    test('offered the first time', () => expect(offer(), isTrue));

    test('never offered once the system question was answered', () {
      expect(offer(permission: NotificationPermission.granted), isFalse);
      expect(offer(permission: NotificationPermission.denied), isFalse);
      expect(offer(permission: NotificationPermission.unavailable), isFalse);
    });

    test('after Not now it waits 14 days', () {
      expect(offer(notNow: 1, last: now.subtract(const Duration(days: 13))), isFalse);
      expect(offer(notNow: 1, last: now.subtract(const Duration(days: 14))), isTrue);
    });

    test('after a second Not now it never returns', () {
      expect(offer(notNow: 2, last: now.subtract(const Duration(days: 60))), isFalse);
    });

    test('a missing date after one Not now does not offer', () {
      expect(offer(notNow: 1), isFalse);
    });
  });
}
