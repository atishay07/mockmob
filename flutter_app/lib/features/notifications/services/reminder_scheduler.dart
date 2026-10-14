import 'dart:async';

import '../../../core/models/notification_prefs.dart';
import '../../../core/notifications/notifications.dart';
import '../data/reminder_state.dart';
import '../data/reminder_store.dart';
import '../logic/reminder_outcomes.dart';
import '../logic/reminder_plan.dart';

/// How long Mute for 7 days lasts.
const Duration muteLength = Duration(days: 7);

/// Plans and schedules the student's reminders on top of the core notification engine: the
/// study-window reminder, the repair-ready reminder (gone as soon as the repair is done), and
/// the weekly plan (off until the student turns it on). Scheduling is inexact only.
///
/// Plain Dart with its inputs passed in, so it is tested without the plugin. Every change to
/// what the student wants ends in [sync], which cancels the reminders that are still ahead and
/// schedules the current plan. Reminders that already fired are left alone, so the weekly cap
/// keeps counting them.
///
/// The ongoing "Mock 7 in progress" status and the background "result is ready" post belong to
/// the session engine in core (`session_notifications.dart`), which already uses the right
/// channels and words; they are not reminders and are not muted by Mute for 7 days.
class ReminderScheduler {
  ReminderScheduler({
    required this._service,
    required this._store,
    required this._prefs,
    required this._repair,
    required this._ensureReady,
    DateTime Function()? now,
    this._onStateChanged,
  }) : _now = now ?? DateTime.now;

  final NotificationService _service;
  final ReminderStore _store;
  final NotificationPrefs? Function() _prefs;
  final RepairReady? Function() _repair;
  final Future<void> Function() _ensureReady;
  final DateTime Function() _now;
  final void Function()? _onStateChanged;

  Future<void>? _running;
  bool _again = false;

  /// Re-plans everything. Overlapping calls are folded into one more pass, so a burst of edits
  /// never races.
  Future<void> sync() {
    final running = _running;
    if (running != null) {
      _again = true;
      return running;
    }
    return _running = _loop().whenComplete(() => _running = null);
  }

  /// Runs passes until no edit is waiting. A pass that fails does not drop the pass an edit
  /// queued meanwhile: the first failure is kept and thrown once the queue is empty.
  Future<void> _loop() async {
    Object? failure;
    StackTrace? failureStack;
    do {
      _again = false;
      try {
        await _syncOnce();
      } on Object catch (error, stack) {
        failure ??= error;
        failureStack ??= stack;
      }
    } while (_again);
    if (failure != null) Error.throwWithStackTrace(failure, failureStack!);
  }

  Future<void> _syncOnce() async {
    // Sign-out and account switches cancel everything; a pass that began before that must not
    // schedule the previous student's reminders afterwards.
    final epoch = _service.clearEpoch;
    bool cleared() => _service.clearEpoch != epoch;
    await _ensureReady();
    final prefs = _prefs();
    // Without the student's settings (not loaded, nothing cached) nothing is changed.
    if (prefs == null) return;
    final now = _now();

    final before = await _store.load();
    final stillAhead = [
      for (final d in before.delivered)
        if (d.at.isAfter(now)) d,
    ];
    for (final d in stillAhead) {
      await _service.cancel(d.taskId);
    }
    if (cleared()) return;
    var state = await _store.update(
      (s) => s.copyWith(
        delivered: [
          for (final d in s.delivered)
            if (!d.at.isAfter(now)) d,
        ],
      ),
    );

    if (!await _service.areNotificationsEnabled()) {
      _onStateChanged?.call();
      return;
    }

    final plan = buildReminderPlan(
      now: now,
      prefs: prefs,
      state: state,
      repair: _repair(),
      scheduledIds: {for (final d in stillAhead) d.taskId},
    );
    // The reminders still ahead are cancelled by now, so one failed request must not stop the
    // rest of the plan from being scheduled. The first failure is reported once all were tried.
    Object? failure;
    StackTrace? failureStack;
    for (final request in plan) {
      if (cleared()) return;
      try {
        final outcome = await _service.schedule(request);
        if (outcome.skipped == NotificationSkip.cleared || cleared()) return;
        final at = outcome.deliverAt;
        if (outcome.scheduled && at != null) {
          state = await _store.update(
            (s) => recordScheduled(
              s,
              taskId: request.taskId,
              prefKey: prefKeyForTask(request.taskId),
              at: at,
            ),
          );
        }
      } on Object catch (error, stack) {
        failure ??= error;
        failureStack ??= stack;
      }
    }
    _onStateChanged?.call();
    if (failure != null) Error.throwWithStackTrace(failure, failureStack!);
  }

  /// Settles reminders that came due since the app was last open: responded or unopened. Call
  /// whenever the app opens or resumes, before [sync]. Returns whether a category just stopped.
  Future<bool> settle() async {
    await _ensureReady();
    final allowed = await _service.areNotificationsEnabled();
    final now = _now();
    final before = await _store.load();
    final after = await _store.update(
      (s) =>
          settleDeliveredReminders(s, now: now, notificationsAllowed: allowed),
    );
    final stoppedNow = [
      for (final e in after.categories.entries)
        if (e.value.paused && !before.category(e.key).paused) e.key,
    ];
    _onStateChanged?.call();
    return stoppedNow.isNotEmpty;
  }

  /// Mute for 7 days: reminders pause on this phone and the ones already scheduled are cancelled.
  Future<void> mute() async {
    final until = _now().add(muteLength);
    await _store.update((s) => s.copyWith(mutedUntil: until));
    await sync();
  }

  Future<void> unmute() async {
    await _store.update((s) => s.copyWith(clearMute: true));
    await sync();
  }

  Future<void> setWeeklyPlan(bool on) async {
    await _store.update((s) => s.copyWith(weeklyPlanOn: on));
    await sync();
  }

  /// The repair-ready switch, kept on this phone.
  Future<void> setRepairReady(bool on) async {
    await _store.update((s) => s.copyWith(repairReadyOn: on));
    await sync();
  }

  /// The student turned a stopped category back on: it starts counting from zero again.
  Future<void> resumeCategory(String prefKey) async {
    await _store.update((s) => s.withCategory(prefKey, const CategoryStatus()));
    await sync();
  }

  /// "Want fewer reminders?" was shown, so it is not shown again.
  Future<void> markFewerRemindersShown(String prefKey) async {
    await _store.update(
      (s) => s.withCategory(
        prefKey,
        s.category(prefKey).copyWith(hintPending: false),
      ),
    );
    _onStateChanged?.call();
  }

  /// The student tapped a reminder (or its Start action).
  Future<void> reminderOpened(String taskId) async {
    await _store.update((s) => markEngaged(s, taskId));
    _onStateChanged?.call();
  }

  /// The student chose Not tonight.
  Future<void> reminderDeclined(String taskId) async {
    await _store.update((s) => markDeclined(s, taskId));
    _onStateChanged?.call();
  }

  /// One ask of the pre-prompt was put to the student and not taken up: the sheet opened, or the
  /// recap row was answered with Not now. Counted for the spacing and the wording of the next
  /// ask (`PrePromptAsks` also writes the time).
  Future<void> prePromptDismissed() async {
    await _store.update(
      (s) => s.copyWith(prePromptNotNowCount: s.prePromptNotNowCount + 1),
    );
    _onStateChanged?.call();
  }
}
