/// Shared formatters (binding rules 3 and 4): 12-hour times, "12 October" dates, marks with
/// their denominator, "about 10 minutes" durations. Pure functions over already-localised
/// `DateTime`s: callers convert to the student's timezone first.
library;

const List<String> _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const List<String> _weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/// Weekday initials, Monday first.
const List<String> weekdayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/// Full weekday names, Monday first.
const List<String> weekdayNames = _weekdays;

/// The real minus sign (U+2212), bundled in both fonts.
const String minusSign = '−';

/// "11:42 PM". Midnight is "12:00 AM", noon "12:00 PM".
String formatTime12(DateTime time) {
  final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
  final minute = time.minute.toString().padLeft(2, '0');
  final suffix = time.hour < 12 ? 'AM' : 'PM';
  return '$hour:$minute $suffix';
}

/// Evening runs from 4:00 PM to 4:59 AM: the hours a student says "tonight" about.
bool isEvening(DateTime time) => time.hour >= 16 || time.hour < 5;

/// "tonight" from 4:00 PM to 4:59 AM, otherwise "today".
String tonightOrToday(DateTime time) => isEvening(time) ? 'tonight' : 'today';

/// "Tonight" or "Today", for the start of a sentence.
String tonightOrTodayTitle(DateTime time) => isEvening(time) ? 'Tonight' : 'Today';

/// "12 October".
String formatDayMonth(DateTime date) => '${date.day} ${_months[date.month - 1]}';

/// "11 Oct": the day and the month's first three letters, for a meta line.
String formatDayMonthShort(DateTime date) => '${date.day} ${_months[date.month - 1].substring(0, 3)}';

/// "Monday, 12 October".
String formatWeekdayDate(DateTime date) => '${_weekdays[date.weekday - 1]}, ${formatDayMonth(date)}';

/// "Monday" for a `DateTime.weekday` value (1 = Monday).
String weekdayName(int weekday) => _weekdays[(weekday - 1) % 7];

/// "115 out of 250 marks". Negative marks use the real minus sign.
String formatMarks(int marks, int outOf) => '${_signed(marks)} out of $outOf marks';

/// The bare figure, "115" or "−12".
String formatSignedNumber(int value) => _signed(value);

String _signed(int value) => value < 0 ? '$minusSign${-value}' : '$value';

/// "about 10 minutes", "about 1 minute", "about 1 hour 20 minutes", "less than a minute".
String formatDurationAbout(Duration duration) {
  final totalMinutes = (duration.inSeconds / 60).round();
  if (totalMinutes < 1) return 'less than a minute';
  if (totalMinutes < 60) return 'about ${plural(totalMinutes, 'minute')}';
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;
  if (minutes == 0) return 'about ${plural(hours, 'hour')}';
  return 'about ${plural(hours, 'hour')} ${plural(minutes, 'minute')}';
}

/// Clock face for timers: "47:12", or "1:02:18" from an hour up.
String formatTimer(Duration duration) {
  final total = duration.inSeconds < 0 ? 0 : duration.inSeconds;
  final hours = total ~/ 3600;
  final minutes = (total % 3600) ~/ 60;
  final seconds = total % 60;
  final ss = seconds.toString().padLeft(2, '0');
  if (hours > 0) return '$hours:${minutes.toString().padLeft(2, '0')}:$ss';
  return '$minutes:$ss';
}

/// "1 question", "8 questions". Pass [pluralForm] for irregular words ("1 person", "2 people").
String plural(int count, String singular, {String? pluralForm}) {
  final word = count == 1 ? singular : (pluralForm ?? '${singular}s');
  return '$count $word';
}

/// Just the word, for sentences that print the number separately ("is", "are").
String pluralWord(int count, String singular, {String? pluralForm}) {
  return count == 1 ? singular : (pluralForm ?? '${singular}s');
}

/// Joins words as "A", "A and B", "A, B and C".
String joinWithAnd(List<String> items) {
  if (items.isEmpty) return '';
  if (items.length == 1) return items.first;
  return '${items.sublist(0, items.length - 1).join(', ')} and ${items.last}';
}
