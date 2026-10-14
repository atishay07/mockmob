import '../data/reminder_state.dart';

/// Three unopened reminders in a row stop a category (spec 8).
const int ignoredLimit = 3;

/// A student who opens the app within this long after a reminder was due is counted as having
/// responded to it, whether or not they tapped it.
const Duration respondedWindow = Duration(hours: 2);

/// How long a reminder that was counted as unopened can still be cleared by a late tap. The
/// resume event can run before the notification's tap callback, so a tap on a reminder that was
/// due more than [respondedWindow] ago arrives after it was settled.
const Duration lateTapWindow = Duration(hours: 24);

/// Remembers that a reminder was scheduled, so a later app open can tell how it went. Replaces
/// an earlier record of the same task.
ReminderState recordScheduled(
  ReminderState state, {
  required String taskId,
  required String prefKey,
  required DateTime at,
}) {
  final others = [
    for (final d in state.delivered)
      if (d.taskId != taskId) d,
  ];
  final next = [
    ...others,
    DeliveredReminder(taskId: taskId, prefKey: prefKey, at: at),
  ];
  // Old records never matter: keep the newest 30.
  final trimmed = next.length > 30 ? next.sublist(next.length - 30) : next;
  return state.copyWith(delivered: trimmed);
}

/// The student tapped a reminder or its Start action: it counts as responded to, and the run of
/// unopened reminders in that category starts again from zero.
ReminderState markEngaged(ReminderState state, String taskId, {DateTime? now}) {
  final record = state.delivered.where((d) => d.taskId == taskId).firstOrNull;
  if (record == null) return _clearLateTap(state, taskId, now);
  // Earlier reminders of the same kind that were still waiting are part of the same story: the
  // student has now responded, so none of them is a run of unopened ones.
  final cleared = state.copyWith(
    delivered: [
      for (final d in state.delivered)
        if (d.taskId != taskId && !(d.prefKey == record.prefKey && !d.at.isAfter(record.at))) d,
    ],
  );
  final status = cleared.category(record.prefKey);
  return cleared.withCategory(record.prefKey, status.copyWith(ignoredInRow: 0));
}

/// The reminder was already counted as unopened (the app opened first, then the tap arrived):
/// the tap takes the count back. A pause that this reminder caused ends with it, and the
/// one-time "fewer reminders" line goes unless it was already waiting.
ReminderState _clearLateTap(ReminderState state, String taskId, DateTime? now) {
  final settled = state.settled.where((d) => d.taskId == taskId).firstOrNull;
  if (settled == null) return state;
  // A tap long after the app settled it (a notification left in the tray) is not a late tap.
  if (now != null && now.difference(settled.settledAt) > lateTapWindow) return state;
  final status = state.category(settled.prefKey);
  final causedPause = status.paused && !settled.before.paused;
  final cleared = status.copyWith(
    ignoredInRow: 0,
    paused: causedPause ? false : status.paused,
    hintPending: causedPause ? settled.before.hintPending : status.hintPending,
  );
  return state
      .copyWith(settled: [
        for (final d in state.settled)
          if (d.taskId != taskId) d,
      ])
      .withCategory(settled.prefKey, cleared);
}

/// "Not tonight": a clear answer. It is not an unopened reminder, and it does not reset the run
/// either.
ReminderState markDeclined(ReminderState state, String taskId) =>
    state.copyWith(
      delivered: [
        for (final d in state.delivered)
          if (d.taskId != taskId) d,
      ],
    );

/// Settles every reminder that has come due. Called whenever the app opens.
///
/// - Opened within [respondedWindow] of the reminder: responded, the run resets.
/// - Not opened by then: unopened. The third in a row pauses the category and queues the one-time
///   line "Want fewer reminders? You can turn this one off."
/// - When notifications were off at the time, nothing was shown, so nothing is counted.
ReminderState settleDeliveredReminders(
  ReminderState state, {
  required DateTime now,
  required bool notificationsAllowed,
}) {
  final due = [
    for (final d in state.delivered)
      if (!d.at.isAfter(now)) d,
  ]..sort((a, b) => a.at.compareTo(b.at));
  if (due.isEmpty) return state;

  var next = state.copyWith(
    delivered: [
      for (final d in state.delivered)
        if (d.at.isAfter(now)) d,
    ],
  );
  // Old tombstones never matter again: drop those past the late-tap window.
  next = next.copyWith(
    settled: [
      for (final d in next.settled)
        if (now.difference(d.settledAt) <= lateTapWindow) d,
    ],
  );
  if (!notificationsAllowed) return next;

  for (final d in due) {
    final status = next.category(d.prefKey);
    if (status.paused) continue;
    if (now.difference(d.at) <= respondedWindow) {
      next = next.withCategory(d.prefKey, status.copyWith(ignoredInRow: 0));
      continue;
    }
    // Counted as unopened. The record stays for a day (newest 30) so a late tap can undo it.
    final kept = [
      ...next.settled,
      SettledReminder(taskId: d.taskId, prefKey: d.prefKey, settledAt: now, before: status),
    ];
    next = next.copyWith(settled: kept.length > 30 ? kept.sublist(kept.length - 30) : kept);
    final count = status.ignoredInRow + 1;
    next = next.withCategory(
      d.prefKey,
      count >= ignoredLimit
          ? status.copyWith(
              ignoredInRow: count,
              paused: true,
              hintPending: true,
            )
          : status.copyWith(ignoredInRow: count),
    );
  }
  return next;
}
