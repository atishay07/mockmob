// The late-night line (spec 6.8): between 11 PM and 7 AM, in the student's own clock, after a
// finished session the ending adds "That is a good place to stop for tonight." Once per night,
// dismissible, off in settings (the host reads the You setting and remembers the night). It
// never blocks anything and never repeats.
import '../copy.dart';

/// [studentClock] is the wall clock in the student's timezone (see `studentClock`).
bool isLateNight(DateTime studentClock) => studentClock.hour >= 23 || studentClock.hour < 7;

/// The line for a night, or null outside it. The caller decides once per night.
String? lateNightLine(DateTime studentClock) => isLateNight(studentClock) ? RhythmCopy.lateNightStop : null;

/// The key a host stores to show the line once per night: the date the night started on.
String lateNightKey(DateTime studentClock) {
  final start = studentClock.hour < 7 ? studentClock.subtract(const Duration(days: 1)) : studentClock;
  return '${start.year}-${start.month.toString().padLeft(2, '0')}-${start.day.toString().padLeft(2, '0')}';
}
