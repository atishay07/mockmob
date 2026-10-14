/// The usage-data event schema, exactly as the server accepts it (`src/lib/server/usage.js`).
/// An event with an unknown name or any other prop key is dropped by the server as a whole,
/// so the client refuses to queue it at all.
library;

import 'dart:convert';

/// Shown to the student as the exact switch label (spec 5.12.3).
const usageDataConsentLabel = 'Allow usage data to improve MockMob';

const maxEventsPerBatch = 50;
const maxPropStringLength = 64;
const maxAppVersionLength = 32;
const maxPropsBytes = 1024;

/// Events older than this are rejected by the server (7 days); stop short of the edge.
const maxEventAge = Duration(days: 6, hours: 23);

/// Allowed event names.
abstract final class AnalyticsEvents {
  static const sessionStarted = 'session_started';
  static const sessionSubmitted = 'session_submitted';
  static const resultOpened = 'result_opened';
  static const recapOpened = 'recap_opened';
  static const recapSkipped = 'recap_skipped';
  static const nextMoveImpression = 'next_move_impression';
  static const nextMoveReasonOpened = 'next_move_reason_opened';
  static const nextMoveStarted = 'next_move_started';
  static const nextMoveDismissed = 'next_move_dismissed';
  static const repairStarted = 'repair_started';
  static const repairCompleted = 'repair_completed';
  static const freshCheckCompleted = 'fresh_check_completed';
  static const reminderPermissionResult = 'reminder_permission_result';
  static const notificationOpened = 'notification_opened';
  static const goalSet = 'goal_set';
  static const weeklyGoalMet = 'weekly_goal_met';
  static const finishForNow = 'finish_for_now';
  static const appLinkOpened = 'app_link_opened';
  static const appOpened = 'app_opened';

  static const all = {
    sessionStarted,
    sessionSubmitted,
    resultOpened,
    recapOpened,
    recapSkipped,
    nextMoveImpression,
    nextMoveReasonOpened,
    nextMoveStarted,
    nextMoveDismissed,
    repairStarted,
    repairCompleted,
    freshCheckCompleted,
    reminderPermissionResult,
    notificationOpened,
    goalSet,
    weeklyGoalMet,
    finishForNow,
    appLinkOpened,
    appOpened,
  };
}

enum AnalyticsPropType { string, number }

/// Allowed prop keys and their types. Strings are at most 64 characters.
const analyticsPropTypes = <String, AnalyticsPropType>{
  'subject': AnalyticsPropType.string,
  'mode': AnalyticsPropType.string,
  'state': AnalyticsPropType.string,
  'action_type': AnalyticsPropType.string,
  'minutes': AnalyticsPropType.number,
  'count': AnalyticsPropType.number,
  'outcome': AnalyticsPropType.string,
  'source': AnalyticsPropType.string,
  'screen': AnalyticsPropType.string,
  'variant': AnalyticsPropType.string,
};

/// The plain-words list behind "See every event we collect".
const analyticsEventDescriptions = <String, String>{
  AnalyticsEvents.appOpened: 'You opened the app',
  AnalyticsEvents.appLinkOpened: 'You opened a MockMob link',
  AnalyticsEvents.sessionStarted: 'You started a mock or practice',
  AnalyticsEvents.sessionSubmitted: 'You submitted a mock or practice',
  AnalyticsEvents.resultOpened: 'You opened a result',
  AnalyticsEvents.recapOpened: 'You opened the recap after a mock',
  AnalyticsEvents.recapSkipped: 'You skipped a recap card',
  AnalyticsEvents.nextMoveImpression: 'Today showed a next step',
  AnalyticsEvents.nextMoveReasonOpened: 'You opened why a next step was suggested',
  AnalyticsEvents.nextMoveStarted: 'You started a suggested next step',
  AnalyticsEvents.nextMoveDismissed: 'You chose not to do a suggested step today',
  AnalyticsEvents.repairStarted: 'You started a repair',
  AnalyticsEvents.repairCompleted: 'You finished a repair',
  AnalyticsEvents.freshCheckCompleted: 'You finished a fresh-question check',
  AnalyticsEvents.reminderPermissionResult: 'You answered the reminder permission question',
  AnalyticsEvents.notificationOpened: 'You opened a reminder',
  AnalyticsEvents.goalSet: 'You set a weekly goal',
  AnalyticsEvents.weeklyGoalMet: 'You met your weekly goal',
  AnalyticsEvents.finishForNow: 'You chose to finish for now',
};

/// Returns the props if they all fit the schema, or null when the event must not be queued:
/// an unknown key, a wrong type, a string over 64 characters, a non-finite number, or props
/// over 1 KB once encoded.
Map<String, Object>? validateEventProps(Map<String, Object?>? props) {
  if (props == null || props.isEmpty) return const {};
  final out = <String, Object>{};
  for (final e in props.entries) {
    final type = analyticsPropTypes[e.key];
    final v = e.value;
    if (type == null || v == null) return null;
    switch (type) {
      case AnalyticsPropType.string:
        if (v is! String || v.length > maxPropStringLength) return null;
      case AnalyticsPropType.number:
        if (v is! num || !v.isFinite) return null;
    }
    out[e.key] = v;
  }
  return utf8.encode(jsonEncode(out)).length <= maxPropsBytes ? out : null;
}
