import 'package:timezone/timezone.dart' as tz;

import '../../../core/models/notification_prefs.dart';
import '../../../core/notifications/notification_planner.dart' show weekKey;
import '../../../core/notifications/notifications.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';
import '../data/reminder_state.dart';

/// How many days of study-window reminders are scheduled ahead. They are re-planned every time
/// the app opens, so a student who stays away gets nothing after this many days.
const int studyWindowHorizonDays = 7;

/// Sunday at 6:00 PM, the weekly plan's moment.
const ClockTime weeklyPlanTime = ClockTime(18, 0);

/// The repair reminder's moment when there is no study window to ride on: 7:00 PM.
const ClockTime repairEveningTime = ClockTime(19, 0);

/// How long the evening repair reminder stays worth showing after its moment.
const Duration repairEveningValidity = Duration(hours: 3);

/// The category key of the repair-ready reminder. The server has no channel key for it: the
/// switch and the unopened count live on this phone.
const String repairReadyKey = 'repair_ready';

/// Study-window reminders go through the notification engine under these task ids.
const String studyTaskPrefix = 'study_window:';
const String repairTaskPrefix = 'repair_ready:';
const String weeklyTaskPrefix = 'weekly_plan:';

/// The student has mistakes waiting for a repair (the notification text of spec 8).
class RepairReady {
  const RepairReady({
    required this.attemptId,
    required this.mistakes,
    required this.minutes,
  });

  final String attemptId;
  final int mistakes;

  /// About this many minutes (`repairMinutes`).
  final int minutes;
}

/// The value handed back when a notification is tapped: an in-app route plus the task id that
/// lets the app count a response. Never raw data.
String encodeReminderPayload(String route, String taskId) =>
    Uri(path: route, queryParameters: {'nx': taskId}).toString();

/// The route and task id inside a payload. The task id is null for payloads from other parts
/// of the app, such as the result-ready notification.
({String route, String? taskId}) decodeReminderPayload(String payload) {
  final uri = Uri.tryParse(payload);
  if (uri == null) return (route: payload, taskId: null);
  return (route: uri.path, taskId: uri.queryParameters['nx']);
}

const _startAction = NotificationActionSpec(
  id: ReminderActions.start,
  label: NotificationsCopy.actionStart,
);
const _notTonightAction = NotificationActionSpec(
  id: ReminderActions.notTonight,
  label: NotificationsCopy.actionNotTonight,
);
const _muteAction = NotificationActionSpec(
  id: ReminderActions.mute,
  label: NotificationsCopy.actionMute,
);

/// Ids of the notification actions.
abstract final class ReminderActions {
  static const start = 'start';
  static const notTonight = 'not_tonight';
  static const mute = 'mute_7d';
}

String _dayKey(tz.TZDateTime t) =>
    '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';

/// The reminders that should be scheduled now, in the order the caps should be spent on them
/// (soonest first). Pure: the scheduler cancels what it scheduled before and schedules these.
///
/// - Study window: one reminder at the start of each of the next [studyWindowHorizonDays]
///   days, only while the Study window channel is on, a window is set and the category is not
///   paused.
/// - Repair ready: its own switch and category. When a repair is waiting it takes the first
///   study-window slot (the time the student chose to study, so a day never has two), or, with
///   no study window planned, the next 7:00 PM. It is planned whether or not the study window
///   is on.
/// - Weekly plan: Sunday at 6:00 PM, only after the student turned it on.
/// - Nothing is planned for a moment inside a mute.
/// Quiet hours and the weekly and daily caps are applied later by the notification engine.
List<NotificationRequest> buildReminderPlan({
  required DateTime now,
  required NotificationPrefs prefs,
  required ReminderState state,
  RepairReady? repair,
}) {
  final location = locationFor(prefs.timezone);
  final local = tz.TZDateTime.from(now, location);
  final muteEnd = state.mutedUntil;
  bool muted(tz.TZDateTime at) => muteEnd != null && at.isBefore(muteEnd);

  final out = <NotificationRequest>[];
  final repairOn = repair != null && state.repairReadyOn && !state.category(repairReadyKey).paused;

  NotificationRequest repairRequest(tz.TZDateTime at, tz.TZDateTime until) {
    final taskId = '$repairTaskPrefix${repair!.attemptId}';
    return NotificationRequest(
      taskId: taskId,
      channel: NotificationChannels.repairReady,
      title: NotificationsCopy.repairTitle,
      body: NotificationsCopy.repairBody(repair.mistakes, repair.minutes),
      payload: encodeReminderPayload(AppRoutes.reviewMistakes, taskId),
      at: at,
      validUntil: until,
      actions: const [_startAction, _notTonightAction, _muteAction],
    );
  }

  var repairUsed = false;
  final window = prefs.studyWindow;
  final studyKey = NotificationChannelKeys.studyWindow;
  if (window != null &&
      prefs.channelOn(studyKey) &&
      !state.category(studyKey).paused) {
    for (var i = 0; i < studyWindowHorizonDays; i++) {
      final start = tz.TZDateTime(
        location,
        local.year,
        local.month,
        local.day + i,
        window.start.hour,
        window.start.minute,
      );
      // A reminder less than a minute away is not worth scheduling.
      if (start.isBefore(local.add(const Duration(minutes: 1)))) continue;
      if (muted(start)) continue;
      var end = tz.TZDateTime(
        location,
        start.year,
        start.month,
        start.day,
        window.end.hour,
        window.end.minute,
      );
      if (!end.isAfter(start)) {
        end = tz.TZDateTime(
          location,
          start.year,
          start.month,
          start.day + 1,
          window.end.hour,
          window.end.minute,
        );
      }
      if (repairOn && !repairUsed) {
        repairUsed = true;
        out.add(repairRequest(start, end));
      } else {
        final taskId = '$studyTaskPrefix${_dayKey(start)}';
        out.add(
          NotificationRequest(
            taskId: taskId,
            channel: NotificationChannels.studyReminders,
            title: NotificationsCopy.studyTitle,
            body: NotificationsCopy.studyBody,
            payload: encodeReminderPayload(AppRoutes.today, taskId),
            at: start,
            validUntil: end,
            actions: const [_startAction, _notTonightAction, _muteAction],
          ),
        );
      }
    }
  }

  // No study-window slot took the repair: the next 7:00 PM that is ahead and outside a mute.
  if (repairOn && !repairUsed) {
    for (var i = 0; i < studyWindowHorizonDays; i++) {
      final at = tz.TZDateTime(location, local.year, local.month, local.day + i, repairEveningTime.hour, repairEveningTime.minute);
      if (at.isBefore(local.add(const Duration(minutes: 1))) || muted(at)) continue;
      out.add(repairRequest(at, at.add(repairEveningValidity)));
      break;
    }
  }

  final weeklyKey = NotificationChannelKeys.weeklyPlan;
  if (state.weeklyPlanOn &&
      prefs.channelOn(weeklyKey) &&
      !state.category(weeklyKey).paused) {
    var sunday = tz.TZDateTime(
      location,
      local.year,
      local.month,
      local.day + (DateTime.sunday - local.weekday),
      weeklyPlanTime.hour,
      weeklyPlanTime.minute,
    );
    if (sunday.isBefore(local.add(const Duration(minutes: 1)))) {
      sunday = tz.TZDateTime(
        location,
        sunday.year,
        sunday.month,
        sunday.day + 7,
        weeklyPlanTime.hour,
        weeklyPlanTime.minute,
      );
    }
    if (!muted(sunday)) {
      final taskId = '$weeklyTaskPrefix${weekKey(sunday)}';
      out.add(
        NotificationRequest(
          taskId: taskId,
          channel: NotificationChannels.weeklyPlan,
          title: NotificationsCopy.weeklyTitle,
          body: NotificationsCopy.weeklyBody,
          payload: encodeReminderPayload(AppRoutes.todayWeeklyEnding, taskId),
          at: sunday,
          // Still welcome on Monday morning, stale after that.
          validUntil: tz.TZDateTime(
            location,
            sunday.year,
            sunday.month,
            sunday.day + 1,
            12,
          ),
          actions: const [_muteAction],
        ),
      );
    }
  }

  out.sort((a, b) => a.at!.compareTo(b.at!));
  return out;
}

/// The wire channel key a reminder task id belongs to.
String prefKeyForTask(String taskId) {
  if (taskId.startsWith(weeklyTaskPrefix)) {
    return NotificationChannelKeys.weeklyPlan;
  }
  if (taskId.startsWith(repairTaskPrefix)) return repairReadyKey;
  return NotificationChannelKeys.studyWindow;
}
