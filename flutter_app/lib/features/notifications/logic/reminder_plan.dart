import 'package:timezone/timezone.dart' as tz;

import '../../../core/models/notification_prefs.dart';
import '../../../core/notifications/notification_planner.dart' show weekKey;
import '../../../core/notifications/notifications.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';
import '../data/reminder_state.dart';
import 'evening_move.dart';

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
String encodeReminderPayload(String route, String taskId) {
  // A route may carry its own query (a repair's count, a practice run's subject): it travels
  // beside the task id, never inside the path.
  final target = Uri.tryParse(route);
  if (target == null || target.queryParameters.isEmpty) {
    return Uri(path: route, queryParameters: {'nx': taskId}).toString();
  }
  return Uri(path: target.path, queryParameters: {...target.queryParameters, 'nx': taskId}).toString();
}

/// The route (with its own query, when it has one) and task id inside a payload. The task id is
/// null for payloads from other parts of the app, such as the result-ready notification.
({String route, String? taskId}) decodeReminderPayload(String payload) {
  final uri = Uri.tryParse(payload);
  if (uri == null) return (route: payload, taskId: null);
  final rest = {...uri.queryParameters}..remove('nx');
  final route = rest.isEmpty ? uri.path : Uri(path: uri.path, queryParameters: rest).toString();
  return (route: route, taskId: uri.queryParameters['nx']);
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
  static const resume = 'resume';
}

/// Task ids of the silent answers to Not tonight and Mute for 7 days. A tap on one opens its screen
/// and is never counted as a response to a reminder.
const String ackTaskPrefix = 'ack:';

String _dayKey(tz.TZDateTime t) =>
    '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';

/// The reminders that should be scheduled now, in the order the caps should be spent on them:
/// the weekly plan first, then the rest soonest first. Pure: the scheduler cancels what it scheduled before and schedules these.
///
/// - Study window: one reminder at the start of each of the next [studyWindowHorizonDays]
///   days, only while the Study window channel is on, a window is set and the category is not
///   paused.
/// - Repair ready: its own switch and category. When a repair is waiting it takes the first
///   study-window slot (the time the student chose to study, so a day never has two), or, with
///   no study window planned, the next 7:00 PM. It is planned whether or not the study window
///   is on.
/// - Weekly plan: Sunday at 6:00 PM, only after the student turned it on.
/// - Nothing is planned for a moment inside a mute. The days ahead are counted from the end of
///   the mute when it is still running, so a 7-day mute does not leave the week after it empty
///   for a student who stays away.
/// - A slot less than a minute away is not newly planned, but one that is already scheduled
///   ([scheduledIds], the task ids that were ahead before this re-plan) is kept, so a re-plan
///   a few seconds before it fires does not cancel it and lose it.
/// - Evening facts ([evening], from the student's own record): the reminder names tonight's move
///   in the words and route of Today's card, the day a student has already studied gets none,
///   and the Sunday line carries the real week. Without them (nothing loaded, another day's
///   facts) every reminder says its ordinary line, never a guess.
/// Quiet hours and the weekly and daily caps are applied later by the notification engine.
List<NotificationRequest> buildReminderPlan({
  required DateTime now,
  required NotificationPrefs prefs,
  required ReminderState state,
  RepairReady? repair,
  EveningFacts? evening,
  Set<String> scheduledIds = const {},
}) {
  final location = locationFor(prefs.timezone);
  final local = tz.TZDateTime.from(now, location);
  final muteEnd = state.mutedUntil;
  bool muted(tz.TZDateTime at) => muteEnd != null && at.isBefore(muteEnd);
  // The day the horizon starts on: today, or the day the mute ends when that is later.
  final base = muteEnd != null && muteEnd.isAfter(now)
      ? tz.TZDateTime.from(muteEnd, location)
      : local;
  final soonest = local.add(const Duration(minutes: 1));

  final out = <NotificationRequest>[];
  final repairOn = repair != null && state.repairReadyOn && !state.category(repairReadyKey).paused;

  // Facts taken on another day say nothing about this one.
  final localDay = _dayKey(local);
  final facts = evening != null && evening.day == _dayKey(local) ? evening : null;

  /// The move for a slot on [at]'s day: today's own, or the usual one for a later evening.
  EveningMove? moveFor(tz.TZDateTime at) => facts == null ? null : (_dayKey(at) == localDay ? facts.today : facts.later);

  /// Today's slot is skipped once the student has studied today.
  bool studiedOn(tz.TZDateTime at) => facts != null && facts.studiedToday && _dayKey(at) == localDay;

  NotificationRequest repairRequest(tz.TZDateTime at, tz.TZDateTime until) {
    final taskId = '$repairTaskPrefix${repair!.attemptId}';
    final move = moveFor(at);
    final named = move != null && move.kind == EveningMoveKind.repair;
    return NotificationRequest(
      taskId: taskId,
      channel: NotificationChannels.repairReady,
      title: NotificationsCopy.repairTitle,
      // The count Today shows (tonight's chapter), not a different one.
      body: named ? move.line : NotificationsCopy.repairBody(repair.mistakes, repair.minutes),
      payload: encodeReminderPayload(named ? move.route : AppRoutes.reviewMistakes, taskId),
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
        base.year,
        base.month,
        base.day + i,
        window.start.hour,
        window.start.minute,
      );
      // A reminder less than a minute away is not worth newly scheduling; one already
      // scheduled stays, or the re-plan would cancel it and never put it back.
      if (start.isBefore(soonest)) {
        final alreadyScheduled =
            scheduledIds.contains('$studyTaskPrefix${_dayKey(start)}') ||
            (repairOn &&
                !repairUsed &&
                scheduledIds.contains('$repairTaskPrefix${repair.attemptId}'));
        if (start.isBefore(local) || !alreadyScheduled) continue;
      }
      if (muted(start)) continue;
      if (studiedOn(start)) continue;
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
      final move = moveFor(start);
      // A repair reminder only rides this slot when Today's own move for the evening is that repair.
      final repairHere = repairOn && !repairUsed && (move == null || move.kind == EveningMoveKind.repair);
      if (repairHere) {
        repairUsed = true;
        out.add(repairRequest(start, end));
      } else {
        final taskId = '$studyTaskPrefix${_dayKey(start)}';
        out.add(
          NotificationRequest(
            taskId: taskId,
            channel: NotificationChannels.studyReminders,
            title: move == null ? NotificationsCopy.studyTitle : eveningTitle(start),
            body: move?.line ?? NotificationsCopy.studyBody,
            payload: encodeReminderPayload(move?.route ?? AppRoutes.today, taskId),
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
      final at = tz.TZDateTime(location, base.year, base.month, base.day + i, repairEveningTime.hour, repairEveningTime.minute);
      if (muted(at) || studiedOn(at)) continue;
      final move = moveFor(at);
      // Today's own move for that evening is not this repair (a "Not today", another pick):
      // the reminder does not push it.
      if (move != null && move.kind != EveningMoveKind.repair) continue;
      if (at.isBefore(soonest) &&
          (at.isBefore(local) ||
              !scheduledIds.contains('$repairTaskPrefix${repair.attemptId}'))) {
        continue;
      }
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
      base.year,
      base.month,
      base.day + (DateTime.sunday - base.weekday),
      weeklyPlanTime.hour,
      weeklyPlanTime.minute,
    );
    final sundayScheduled =
        !sunday.isBefore(local) &&
        scheduledIds.contains('$weeklyTaskPrefix${weekKey(sunday)}');
    if ((sunday.isBefore(soonest) && !sundayScheduled) || muted(sunday)) {
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
      // The real week when it can be told truthfully, else the ordinary line.
      final line = weeklyLineFor(facts?.week, sunday);
      out.add(
        NotificationRequest(
          taskId: taskId,
          channel: NotificationChannels.weeklyPlan,
          title: line?.title ?? NotificationsCopy.weeklyTitle,
          body: line?.body ?? NotificationsCopy.weeklyBody,
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

  // The weekly plan is spent first: it is one a week and the student turned it on by choice, so
  // daily study reminders must not use up the weekly cap before Sunday comes round.
  bool isWeekly(NotificationRequest r) => r.taskId.startsWith(weeklyTaskPrefix);
  out.sort((a, b) {
    final wa = isWeekly(a), wb = isWeekly(b);
    if (wa != wb) return wa ? -1 : 1;
    return a.at!.compareTo(b.at!);
  });
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
