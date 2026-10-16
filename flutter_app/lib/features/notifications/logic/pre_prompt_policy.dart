import '../../../core/permissions/permission_requester.dart';

/// How long the sheet waits after the Nth ask before it may come back: 2 days after the first
/// ask, 4 after the second, 7 after the third.
const List<Duration> prePromptGaps = [
  Duration(days: 2),
  Duration(days: 4),
  Duration(days: 7),
];

/// The wait after every ask from the fourth on.
const Duration prePromptLaterGap = Duration(days: 10);

/// The least time between two asks, whatever else says it is due: never more than one a day.
const Duration prePromptMinGap = Duration(days: 1);

/// The wait after [asks] asks. Never shorter than [prePromptMinGap].
Duration prePromptGapAfter(int asks) {
  if (asks <= 0) return prePromptMinGap;
  final gap = asks <= prePromptGaps.length ? prePromptGaps[asks - 1] : prePromptLaterGap;
  return gap < prePromptMinGap ? prePromptMinGap : gap;
}

/// Where in the app the sheet is being considered. Only the moment right after a finished
/// session's result may ask: never while a session runs, never in NTA mode, and never when the
/// app has just opened and the student has not finished anything yet.
enum PrePromptMoment {
  /// A finished session's result or recap is on screen.
  afterResult(true),

  /// A mock, a practice set or a repair is running.
  inSession(false),

  /// NTA mode: the exam-day instructions, the paper and its result.
  ntaMode(false),

  /// The app was just opened and nothing has been finished yet.
  appOpen(false);

  const PrePromptMoment(this.mayAsk);

  final bool mayAsk;
}

/// Whether to show the "Remind me when it matters" sheet now (spec 8).
///
/// It comes back after a Not now, a refused system question or a closed sheet, and keeps coming
/// back while reminders are still off: 2 days after the first ask, 4 after the second, 7 after
/// the third, then every 10 days, and never more than once a day. [askCount] is how many times
/// it was put to the student; [lastAskedAt] is when the last one was. It never comes back once
/// reminders are on, and never at a moment that is not [PrePromptMoment.afterResult].
///
/// A student whom Android has stopped asking ([NotificationPermission.denied]) is still offered
/// the sheet: its key then opens Android settings (see [prePromptPrimaryFor]).
bool shouldOfferPrePrompt({
  required NotificationPermission permission,
  required int askCount,
  required DateTime? lastAskedAt,
  required DateTime now,
  PrePromptMoment moment = PrePromptMoment.afterResult,
  DateTime? inviteShownOn,
}) {
  if (!moment.mayAsk) return false;
  if (permission == NotificationPermission.granted ||
      permission == NotificationPermission.unavailable) {
    return false;
  }
  // The invitation on You already asked today: whichever asks first holds the other back until
  // tomorrow, so a student is never asked twice in a day.
  if (inviteShownOn != null && sameCalendarDay(inviteShownOn, now)) return false;
  final last = lastAskedAt;
  // No date kept: the next ask records one.
  if (last == null) return true;
  // A last ask in the future (the clock moved back) reads as not yet.
  return now.difference(last) >= prePromptGapAfter(askCount);
}

/// What the sheet's main key does.
enum PrePromptPrimary {
  /// Shows Android's own question.
  allow,

  /// Opens MockMob's notification settings in Android, because Android no longer shows its
  /// question (refused twice on Android 13 and later).
  openSettings,
}

/// The main key for the permission as it stands when the sheet opens.
PrePromptPrimary prePromptPrimaryFor(NotificationPermission permission) =>
    permission == NotificationPermission.denied
    ? PrePromptPrimary.openSettings
    : PrePromptPrimary.allow;

/// Whether two moments fall on the same calendar day on this phone.
bool sameCalendarDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// What the invitation's key does: ask Android, or open Android's settings when it no longer asks.
enum InviteAction { turnOn, openSettings }

/// The key for the permission as it stands.
InviteAction inviteActionFor(NotificationPermission permission) =>
    permission == NotificationPermission.denied ? InviteAction.openSettings : InviteAction.turnOn;

/// Whether the invitation on You (and only there: never in a paper, never in the runner or NTA
/// mode) is due now. It stays while reminders are off, and after a Not now it comes back on the
/// same gaps as the post-result sheet (2, 4, 7, then every 10 days), counted on its own.
///
/// [remindersOn] is the app's own setting (at least one reminder kind switched on), and
/// [declinedAsks] with [lastDeclinedAt] are this invitation's own history. [postResultAskedAt] is
/// when the post-result sheet last asked: on that same calendar day the invitation stays away.
bool shouldShowYouInvite({
  required NotificationPermission permission,
  required bool remindersOn,
  required int declinedAsks,
  required DateTime? lastDeclinedAt,
  required DateTime? postResultAskedAt,
  required DateTime now,
}) {
  if (permission == NotificationPermission.unavailable) return false;
  if (permission == NotificationPermission.granted && remindersOn) return false;
  if (postResultAskedAt != null && sameCalendarDay(postResultAskedAt, now)) return false;
  final last = lastDeclinedAt;
  if (last == null) return true;
  return now.difference(last) >= prePromptGapAfter(declinedAsks);
}
