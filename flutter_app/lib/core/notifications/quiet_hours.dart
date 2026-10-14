import 'package:timezone/timezone.dart' as tz;

import '../models/notification_prefs.dart';

/// True when [at] falls inside quiet hours. The window may cross midnight (11:00 PM to
/// 7:00 AM): the start is inclusive and the end exclusive. Equal start and end mean no quiet
/// hours.
bool isInQuietHours(tz.TZDateTime at, ClockTime start, ClockTime end) {
  final minute = at.hour * 60 + at.minute;
  final s = start.minutesOfDay;
  final e = end.minutesOfDay;
  if (s == e) return false;
  return s < e ? (minute >= s && minute < e) : (minute >= s || minute < e);
}

/// The next time quiet hours end at or after [at]. Only meaningful when [at] is inside quiet
/// hours: across midnight, 11:30 PM waits until 7:00 AM the next day, and 2:00 AM until 7:00 AM
/// the same day.
tz.TZDateTime quietHoursEnd(tz.TZDateTime at, ClockTime end) {
  var candidate = tz.TZDateTime(at.location, at.year, at.month, at.day, end.hour, end.minute);
  if (candidate.isBefore(at) || candidate.isAtSameMomentAs(at)) {
    // `day + 1` is normalised by the constructor, including across month ends and DST.
    candidate = tz.TZDateTime(at.location, at.year, at.month, at.day + 1, end.hour, end.minute);
  }
  return candidate;
}

/// Reminders that are not a response to the student's own action wait until quiet hours end.
/// Outside quiet hours [at] is returned unchanged.
tz.TZDateTime deferOutOfQuietHours(tz.TZDateTime at, ClockTime start, ClockTime end) =>
    isInQuietHours(at, start, end) ? quietHoursEnd(at, end) : at;
