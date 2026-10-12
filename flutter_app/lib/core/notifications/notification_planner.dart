import 'package:timezone/timezone.dart' as tz;

import '../models/notification_prefs.dart';
import 'notification_channels.dart';
import 'quiet_hours.dart';
import 'timezones.dart';

/// Pushes allowed per day, whatever the weekly cap says (spec 8: one push a day).
const dailyNotificationCap = 1;

/// Client-side weekly cap until the server sender exists (amendment A6).
const defaultWeeklyNotificationCap = 3;

class NotificationActionSpec {
  const NotificationActionSpec({required this.id, required this.label});

  final String id;
  final String label;
}

/// One notification to schedule or post.
class NotificationRequest {
  const NotificationRequest({
    required this.taskId,
    required this.channel,
    required this.title,
    required this.body,
    this.payload,
    this.at,
    this.validUntil,
    this.respondsToStudentAction = false,
    this.actions = const [],
  });

  /// Stable id of the task the notification is about. Cancelling by it also cancels the
  /// schedule, and a task is only ever scheduled once ("one push per due item").
  final String taskId;
  final NotificationChannelSpec channel;
  final String title;
  final String body;

  /// Opaque value handed back when the student taps it (a route, never raw data).
  final String? payload;

  /// When to show it. Null means as soon as allowed.
  final DateTime? at;

  /// A reminder that would be delivered after this moment is dropped as stale.
  final DateTime? validUntil;

  /// True for a response to the student's own action (a result received after a background
  /// submit). It is never deferred, arrives silently inside quiet hours, and does not use the
  /// reminder caps.
  final bool respondsToStudentAction;
  final List<NotificationActionSpec> actions;
}

/// A notification scheduled or posted earlier, kept to enforce the caps.
class LedgerEntry {
  const LedgerEntry({required this.taskId, required this.at});

  final String taskId;
  final DateTime at;
}

enum NotificationSkip { channelOff, stale, weeklyCap, dailyCap }

class NotificationPlan {
  const NotificationPlan.deliver(this.at, {this.silent = false}) : skipped = null;

  const NotificationPlan.skip(this.skipped)
      : at = null,
        silent = false;

  /// Delivery time in the student's timezone.
  final tz.TZDateTime? at;

  /// No sound, vibration or heads-up (a result arriving inside quiet hours).
  final bool silent;
  final NotificationSkip? skipped;

  bool get shouldDeliver => skipped == null;
}

/// The Monday of the week containing [t], as a `yyyy-mm-dd` key, in the student's timezone.
String weekKey(tz.TZDateTime t) {
  final monday = tz.TZDateTime(t.location, t.year, t.month, t.day - (t.weekday - DateTime.monday));
  return '${monday.year}-${monday.month.toString().padLeft(2, '0')}-${monday.day.toString().padLeft(2, '0')}';
}

String _dayKey(tz.TZDateTime t) => '${t.year}-${t.month}-${t.day}';

/// Decides whether and when a notification is delivered. Pure, so quiet-hours deferral across
/// midnight and the caps are unit tested without a plugin.
///
/// - A channel the student switched off is skipped.
/// - A response to the student's own action is delivered now, silently inside quiet hours.
/// - A reminder inside quiet hours waits until they end (7:00 AM by default), and is dropped
///   if that is past its validity.
/// - A reminder is skipped when its week already holds [weeklyCap] notifications or its day
///   already holds one. The same task id never counts twice.
NotificationPlan planNotification({
  required NotificationRequest request,
  required DateTime now,
  required NotificationPrefs prefs,
  required int weeklyCap,
  required List<LedgerEntry> ledger,
}) {
  final key = request.channel.prefKey;
  if (key != null && !prefs.channelOn(key)) return const NotificationPlan.skip(NotificationSkip.channelOff);

  final location = locationFor(prefs.timezone);
  final wanted = tz.TZDateTime.from(request.at ?? now, location);

  if (request.respondsToStudentAction) {
    return NotificationPlan.deliver(wanted, silent: isInQuietHours(wanted, prefs.quietStart, prefs.quietEnd));
  }

  final at = deferOutOfQuietHours(wanted, prefs.quietStart, prefs.quietEnd);
  final validUntil = request.validUntil;
  if (validUntil != null && at.isAfter(validUntil)) return const NotificationPlan.skip(NotificationSkip.stale);

  final others = [
    for (final e in ledger)
      if (e.taskId != request.taskId) tz.TZDateTime.from(e.at, location),
  ];
  final thisWeek = weekKey(at);
  if (weeklyCap <= 0 || others.where((t) => weekKey(t) == thisWeek).length >= weeklyCap) {
    return const NotificationPlan.skip(NotificationSkip.weeklyCap);
  }
  final thisDay = _dayKey(at);
  if (others.where((t) => _dayKey(t) == thisDay).length >= dailyNotificationCap) {
    return const NotificationPlan.skip(NotificationSkip.dailyCap);
  }
  return NotificationPlan.deliver(at);
}
