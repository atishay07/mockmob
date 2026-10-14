// When Today's own picture of "now" goes out of date. Today reads the clock once per build, so a
// phone left in a pocket overnight would still say "Good evening" and "Tonight's move". The
// providers re-sample on a tick from this schedule, and on resume.
import 'package:timezone/timezone.dart' as tz;

import '../../../core/notifications/timezones.dart';

/// How long the notice for a mock that ended while the student was away stays on Today. After
/// that the paper is in the sheet (or its answers were never recorded and the window is long
/// closed), so the notice stops being the hero. The draft and its answers are left alone.
const Duration endedNoticeWindow = Duration(hours: 24);

/// The ticks never come closer than this, so a clock edge cannot spin the timer.
const Duration _minimumTick = Duration(seconds: 1);

/// How long until Today should re-read the clock: the next hour on the student's wall clock
/// (greeting, late-night mood, midnight and the 4:00 AM "Not today" expiry all fall on one),
/// or sooner for the open session's deadline and the end of its ended notice.
Duration untilNextTodayTick({required DateTime now, required String timezone, int? sessionEndsAtMs}) {
  final zone = locationFor(timezone);
  final local = tz.TZDateTime.from(now, zone);
  final nextHour = tz.TZDateTime(zone, local.year, local.month, local.day, local.hour + 1);
  var wait = nextHour.difference(now);
  if (sessionEndsAtMs != null) {
    final ends = DateTime.fromMillisecondsSinceEpoch(sessionEndsAtMs);
    for (final edge in [ends, ends.add(endedNoticeWindow)]) {
      final toEdge = edge.difference(now);
      if (toEdge > Duration.zero && toEdge < wait) wait = toEdge;
    }
  }
  return wait < _minimumTick ? _minimumTick : wait;
}
