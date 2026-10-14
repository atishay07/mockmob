import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/data/reminder_store.dart';
import 'package:mockmob/features/notifications/logic/reminder_outcomes.dart';

import 'support.dart';

const _study = NotificationChannelKeys.studyWindow;

/// The key the store keeps the state under for `user-1` (see `ReminderStore`).
const _storeKey = 'notif_feature_state_user-1';

void main() {
  group('you-03: one unreadable record does not reset the reminder state', () {
    late Rig rig;
    final muteEnd = DateTime(2026, 10, 19, 18);

    setUp(() => rig = Rig());

    Future<void> seed(Map<String, Object?> json) async => rig.memory.setString(_storeKey, jsonEncode(json));

    test('a delivered entry with a null field is skipped and the mute and the pause stay', () async {
      await seed({
        'm': muteEnd.millisecondsSinceEpoch,
        'w': true,
        'r': false,
        'c': {
          _study: {'i': 3, 'p': true, 'h': true},
        },
        'd': [
          {'t': 'bad', 'k': _study, 'a': null},
          {'t': 'good', 'k': _study, 'a': DateTime(2026, 10, 20, 20).millisecondsSinceEpoch},
        ],
        'n': 2,
      });

      final loaded = await rig.store.load();
      expect(loaded.mutedUntil, muteEnd);
      expect(loaded.category(_study).paused, isTrue);
      expect(loaded.delivered.map((d) => d.taskId), ['good']);
      expect(loaded.weeklyPlanOn, isTrue);
      expect(loaded.repairReadyOn, isFalse);

      // The next write (any settle, sync or Mute tap) must not write defaults over it.
      await rig.store.update((s) => s.copyWith(prePromptNotNowCount: s.prePromptNotNowCount + 1));
      final after = await rig.store.load();
      expect(after.mutedUntil, muteEnd, reason: 'a student who muted for 7 days must stay muted');
      expect(after.category(_study).paused, isTrue, reason: 'a paused category must stay paused');
      expect(after.prePromptNotNowCount, 3);
    });

    test('a category with a non-map value is skipped on its own', () async {
      await seed({
        'm': muteEnd.millisecondsSinceEpoch,
        'c': {
          _study: {'i': 3, 'p': true, 'h': false},
          'weekly_plan': 'oops',
          'check_due': 7,
        },
      });
      final loaded = await rig.store.load();
      expect(loaded.mutedUntil, muteEnd);
      expect(loaded.category(_study).paused, isTrue);
      expect(loaded.category('weekly_plan').paused, isFalse);
    });

    test('a wrong-typed field falls back to its default and keeps its neighbours', () async {
      await seed({
        'm': muteEnd.millisecondsSinceEpoch,
        'w': 'yes',
        'c': {
          _study: {'i': 'three', 'p': true},
        },
      });
      final loaded = await rig.store.load();
      expect(loaded.mutedUntil, muteEnd);
      expect(loaded.weeklyPlanOn, isFalse);
      expect(loaded.category(_study).paused, isTrue);
      expect(loaded.category(_study).ignoredInRow, 0);
    });

    test('text that is not a JSON object is copied aside before the state is rewritten', () async {
      await rig.memory.setString(_storeKey, '{broken');
      await rig.store.update((s) => s.copyWith(weeklyPlanOn: true));
      expect(rig.memory.values['${_storeKey}_unreadable'], '{broken');
      expect((await rig.store.load()).weeklyPlanOn, isTrue);
    });

    test('readable state is never copied aside', () async {
      await rig.store.update((s) => s.copyWith(weeklyPlanOn: true));
      await rig.store.update((s) => s.copyWith(repairReadyOn: false));
      expect(rig.memory.values.containsKey('${_storeKey}_unreadable'), isFalse);
    });

    test('a failed read is not mistaken for unreadable text and writes nothing', () async {
      final broken = _ThrowingStore();
      broken.values[_storeKey] = jsonEncode({'m': muteEnd.millisecondsSinceEpoch});
      final failing = ReminderStore(broken, userId: 'user-1');
      await expectLater(failing.update((s) => s.copyWith(clearMute: true)), throwsA(isA<StateError>()));
      expect(broken.values[_storeKey], jsonEncode({'m': muteEnd.millisecondsSinceEpoch}));
      expect(broken.values.containsKey('${_storeKey}_unreadable'), isFalse);
    });
  });

  group('you-06: a late tap does not count as unopened', () {
    final due = DateTime(2026, 10, 12, 19);
    final lateTap = DateTime(2026, 10, 12, 21, 30);

    ReminderState scheduled(ReminderState s, String id, DateTime at) =>
        recordScheduled(s, taskId: id, prefKey: _study, at: at);

    test('the resume settles first, then the tap arrives: the count is taken back', () {
      var s = scheduled(const ReminderState(), 'a', due);
      s = settleDeliveredReminders(s, now: lateTap, notificationsAllowed: true);
      expect(s.category(_study).ignoredInRow, 1);

      s = markEngaged(s, 'a', now: lateTap);
      expect(s.category(_study).ignoredInRow, 0);
      expect(s.settled, isEmpty);
    });

    test('three late taps in a row never pause the category', () {
      var s = const ReminderState();
      for (var day = 0; day < 3; day++) {
        final at = due.add(Duration(days: day));
        final tapAt = lateTap.add(Duration(days: day));
        s = scheduled(s, 'r$day', at);
        s = settleDeliveredReminders(s, now: tapAt, notificationsAllowed: true);
        s = markEngaged(s, 'r$day', now: tapAt);
      }
      expect(s.category(_study).paused, isFalse);
      expect(s.category(_study).ignoredInRow, 0);
    });

    test('a pause the third reminder caused ends when that reminder is tapped late', () {
      var s = const ReminderState().withCategory(_study, const CategoryStatus(ignoredInRow: 2));
      s = scheduled(s, 'c', due);
      s = settleDeliveredReminders(s, now: lateTap, notificationsAllowed: true);
      expect(s.category(_study).paused, isTrue);
      expect(s.category(_study).hintPending, isTrue);

      s = markEngaged(s, 'c', now: lateTap);
      expect(s.category(_study).paused, isFalse);
      expect(s.category(_study).hintPending, isFalse);
      expect(s.category(_study).ignoredInRow, 0);
    });

    test('a category the student left paused earlier stays paused', () {
      var s = const ReminderState().withCategory(_study, const CategoryStatus(ignoredInRow: 3, paused: true));
      s = scheduled(s, 'a', due);
      s = settleDeliveredReminders(s, now: lateTap, notificationsAllowed: true);
      s = markEngaged(s, 'a', now: lateTap);
      expect(s.category(_study).paused, isTrue);
    });

    test('a reminder that was truly unopened still counts', () {
      var s = scheduled(const ReminderState(), 'a', due);
      s = settleDeliveredReminders(s, now: lateTap, notificationsAllowed: true);
      expect(s.category(_study).ignoredInRow, 1);
      expect(s.settled.single.taskId, 'a');
    });

    test('a tap a day after the app settled it is not a late tap', () {
      var s = scheduled(const ReminderState(), 'a', due);
      s = settleDeliveredReminders(s, now: lateTap, notificationsAllowed: true);
      s = markEngaged(s, 'a', now: lateTap.add(const Duration(hours: 25)));
      expect(s.category(_study).ignoredInRow, 1);
    });

    test('the record of settled reminders survives storage and keeps the newest 30', () {
      var s = const ReminderState();
      for (var i = 0; i < 35; i++) {
        // Each in its own category, so none is paused before it is counted.
        s = recordScheduled(s, taskId: 'r$i', prefKey: 'cat$i', at: due.subtract(Duration(minutes: i)));
      }
      s = settleDeliveredReminders(s, now: lateTap, notificationsAllowed: true);
      expect(s.settled.length, 30);
      final back = ReminderState.fromJsonString(s.toJsonString());
      expect(back.settled.length, 30);
      expect(back.settled.map((d) => d.taskId).toSet(), {for (var i = 5; i < 35; i++) 'r$i'});
    });

    test('through the scheduler: resume settles, the tap clears, nothing is paused', () async {
      final rig = Rig(start: lateTap.toUtc());
      await rig.store.update((s) => scheduled(s.withCategory(_study, const CategoryStatus(ignoredInRow: 2)), 'a', due));

      await rig.scheduler.settle();
      expect((await rig.store.load()).category(_study).paused, isTrue);

      await rig.scheduler.reminderOpened('a');
      final after = await rig.store.load();
      expect(after.category(_study).paused, isFalse);
      expect(after.category(_study).ignoredInRow, 0);
    });
  });
}

/// A store whose reads fail, like a platform error from shared preferences.
class _ThrowingStore extends MemoryPrefsStore {
  @override
  Future<String?> getString(String key) async => throw StateError('read failed');
}
