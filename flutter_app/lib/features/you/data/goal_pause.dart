// The weekly goal's pause as You treats it. The server can still hold a `pausedUntil` that has
// passed; a pause that is over is not shown and is not sent back with a save.

/// The last day of a pause that is still running on [now], or null when there is none, it has
/// ended or the value is not a date. A pause runs through its last day.
DateTime? activePauseEnd(String? raw, DateTime now) {
  final date = raw == null ? null : DateTime.tryParse(raw);
  if (date == null) return null;
  return date.isBefore(DateTime(now.year, now.month, now.day)) ? null : date;
}

/// The `pausedUntil` a goal save sends: the stored value while the pause still runs, null once
/// it has ended. A value that is not a date is sent as it came, because saving without the
/// student's pause would end it.
String? pauseToKeep(String? raw, DateTime now) {
  if (raw == null) return null;
  if (DateTime.tryParse(raw) == null) return raw;
  return activePauseEnd(raw, now) == null ? null : raw;
}
