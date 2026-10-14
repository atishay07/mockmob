import 'json_helpers.dart';

/// A time of day without a date. The wire format is a 24-hour `HH:MM` string.
class ClockTime implements Comparable<ClockTime> {
  const ClockTime(this.hour, this.minute);

  /// Parses `HH:MM`. Returns null for anything else.
  static ClockTime? tryParse(String? s) {
    if (s == null) return null;
    final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(s.trim());
    if (m == null) return null;
    final h = int.parse(m.group(1)!);
    final min = int.parse(m.group(2)!);
    if (h > 23 || min > 59) return null;
    return ClockTime(h, min);
  }

  final int hour;
  final int minute;

  int get minutesOfDay => hour * 60 + minute;

  /// 24-hour wire form, `23:00`.
  String toWire() => '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';

  @override
  int compareTo(ClockTime other) => minutesOfDay.compareTo(other.minutesOfDay);

  @override
  bool operator ==(Object other) => other is ClockTime && other.hour == hour && other.minute == minute;

  @override
  int get hashCode => Object.hash(hour, minute);

  @override
  String toString() => toWire();
}

class StudyWindow {
  const StudyWindow({required this.start, required this.end});

  static StudyWindow? fromJson(Object? v) {
    if (v is! Map) return null;
    final s = ClockTime.tryParse(asString(v['start']));
    final e = ClockTime.tryParse(asString(v['end']));
    return s == null || e == null ? null : StudyWindow(start: s, end: e);
  }

  final ClockTime start;
  final ClockTime end;

  Json toJson() => {'start': start.toWire(), 'end': end.toWire()};
}

/// Notification channel keys on the wire.
abstract final class NotificationChannelKeys {
  static const checkDue = 'check_due';
  static const weeklyPlan = 'weekly_plan';
  static const studyWindow = 'study_window';
  static const resultReady = 'result_ready';
  static const all = [checkDue, weeklyPlan, studyWindow, resultReady];
}

/// `GET/PUT /api/me/notification-prefs` [API 2.3].
class NotificationPrefs {
  const NotificationPrefs({
    this.timezone = 'Asia/Kolkata',
    this.quietStart = const ClockTime(23, 0),
    this.quietEnd = const ClockTime(7, 0),
    this.channels = const {
      NotificationChannelKeys.checkDue: true,
      NotificationChannelKeys.weeklyPlan: true,
      NotificationChannelKeys.studyWindow: false,
      NotificationChannelKeys.resultReady: true,
    },
    this.studyWindow,
    this.weeklyCap = 5,
  });

  /// Spec defaults while nothing has loaded: Asia/Kolkata, 11:00 PM to 7:00 AM.
  static const defaults = NotificationPrefs();

  factory NotificationPrefs.fromJson(Json j) {
    final ch = asJson(j['channels']);
    return NotificationPrefs(
      timezone: asStringOr(j['timezone'], 'Asia/Kolkata'),
      quietStart: ClockTime.tryParse(asString(j['quietStart'])) ?? const ClockTime(23, 0),
      quietEnd: ClockTime.tryParse(asString(j['quietEnd'])) ?? const ClockTime(7, 0),
      channels: {
        for (final k in NotificationChannelKeys.all) k: asBool(ch[k]) ?? defaults.channels[k]!,
      },
      studyWindow: StudyWindow.fromJson(j['studyWindow']),
      weeklyCap: asInt(j['weeklyCap']) ?? 5,
    );
  }

  final String timezone;
  final ClockTime quietStart;
  final ClockTime quietEnd;
  final Map<String, bool> channels;
  final StudyWindow? studyWindow;
  final int weeklyCap;

  bool channelOn(String key) => channels[key] ?? false;

  /// A study window that starts or ends inside quiet hours (a conflict the editor must show).
  bool get studyWindowInQuietHours {
    final w = studyWindow;
    if (w == null) return false;
    bool inside(ClockTime t) {
      final m = t.minutesOfDay;
      final s = quietStart.minutesOfDay;
      final e = quietEnd.minutesOfDay;
      return s <= e ? (m >= s && m < e) : (m >= s || m < e);
    }

    return inside(w.start);
  }
}
