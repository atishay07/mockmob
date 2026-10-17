import '../../../core/copy/formatters.dart';
import '../copy.dart';
import 'review_providers.dart' show ReviewClock;

/// "12 Oct, 11:08 PM", with the time held together so "11:08 PM" never splits across two lines.
/// The student's own clock (their timezone), the 12-hour form.
String whenText(ReviewClock clock, DateTime t) {
  final local = clock.local(t);
  return '${formatDayMonthShort(local)}, ${ReviewCopy.bindTime(formatTime12(local))}';
}

/// Which paper a mistake came from and when it was attempted: "Mock 3, 14 Oct, 9:41 PM" (F17).
/// [at] is when the paper was finished, the moment the answers were handed in.
String paperWhen(ReviewClock clock, String source, DateTime at) => '$source, ${whenText(clock, at)}';
