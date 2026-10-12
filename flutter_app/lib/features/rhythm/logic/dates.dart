// Calendar helpers. Dates here are plain calendar dates held as UTC midnights, so they never
// shift with the phone's own timezone.
import 'package:timezone/timezone.dart' as tz;

import '../../../core/copy/formatters.dart';
import '../../../core/notifications/timezones.dart';

/// `YYYY-MM-DD` to a UTC-midnight date, or null when it is not a real date.
DateTime? parseIsoDate(String? text) {
  if (text == null) return null;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(text);
  if (m == null) return null;
  final y = int.parse(m.group(1)!);
  final mo = int.parse(m.group(2)!);
  final d = int.parse(m.group(3)!);
  final date = DateTime.utc(y, mo, d);
  return date.month == mo && date.day == d ? date : null;
}

String formatIsoDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

/// "26 October".
String formatDayMonthDate(DateTime date) => formatDayMonth(date);

/// The student's calendar date for [instant], in the IANA zone [zoneName].
DateTime studentDate(DateTime instant, String zoneName) {
  final local = tz.TZDateTime.from(instant, locationFor(zoneName));
  return DateTime.utc(local.year, local.month, local.day);
}

/// The wall clock of [instant] in the student's zone, as a plain `DateTime` for the formatters.
DateTime studentClock(DateTime instant, String zoneName) {
  final local = tz.TZDateTime.from(instant, locationFor(zoneName));
  return DateTime(local.year, local.month, local.day, local.hour, local.minute);
}

/// "9 October", with the year added when it is not [now]'s year.
String formatAchievedDate(DateTime instant, String zoneName, DateTime now) {
  final date = studentDate(instant, zoneName);
  final thisYear = studentDate(now, zoneName).year;
  return date.year == thisYear ? formatDayMonth(date) : '${formatDayMonth(date)} ${date.year}';
}
