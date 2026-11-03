// Every user-facing string of the notifications feature (spec 8 and 5.12.1). Sentence case, no
// middle dots, no emoji, no appended arrows, no exclamation successes, 12-hour times.

import '../../core/copy/copy.dart';

abstract final class NotificationsCopy {
  // Pre-prompt sheet (spec 8).
  static const String promptTitle = 'Remind me when it matters';
  static const String promptLead =
      'Three kinds of reminder, and you choose which ones stay on.';
  static const String promptExamplesLabel = 'What they would say';
  static const String promptAllow = 'Allow reminders';
  static const String promptNotNow = 'Not now';
  static const String promptStudyNote =
      'Reminders come at most once a day and never during quiet hours.';

  static const String grantedTitle = 'Reminders are on';
  static const String grantedBody =
      'You will hear when a result you submitted in the background is ready. Pick a study time if you want a nudge, or leave it.';
  static const String grantedPickTime = 'Choose a study time';
  static const String grantedDone = 'Done';

  static const String deniedTitle = 'Reminders stay off';
  static const String deniedBody =
      'You can change this in Android settings any time. Studying works the same without them.';
  static const String deniedDone = 'Done';

  static const String exampleResultChannel = 'Result ready';
  static const String exampleResultBody =
      'Mock 7 was received. Your result is ready.';
  static const String exampleStudyChannel = 'Study window';
  static const String exampleStudyBody =
      'Your repair is ready: 3 mistakes, about 10 minutes.';
  static const String exampleWeeklyChannel = 'Weekly plan';
  static const String exampleWeeklyBody = 'Your week is ready to look at.';

  static String promptQuietLine(String start, String end) =>
      'Quiet hours are $start to $end.';

  // Settings screen (spec 5.12.1).
  static const String settingsTitle = 'Notifications';
  static const String settingsBack = 'Back';
  static const String loadFailedTitle =
      'We could not load your reminder settings';
  static const String loadFailedBody =
      'Nothing was changed. Try again when you have a connection.';
  static const String offlineTitle = 'You are offline';
  static const String offlineBody =
      'Your reminder settings need a connection to load.';
  static const String retry = 'Try again';
  static String staleBanner(DateTime at) =>
      'Showing settings from ${formatTime12(at)}. Changes need a connection.';
  static String staleBannerFailed(DateTime at) =>
      'Showing settings from ${formatTime12(at)}. We could not refresh them. Try again soon.';
  static const String saveFailed =
      'We could not save that. Your earlier setting is still in place.';

  // System permission.
  static const String permissionOn = 'Notifications are on';
  static const String permissionOnBody =
      'Android lets MockMob show reminders and results.';
  static const String permissionOff = 'Notifications are off';
  static const String permissionOffBody =
      'Turn them on to hear when a result is ready or your study window starts.';
  static const String permissionTurnOn = 'Turn on';
  static const String permissionBlocked =
      'Notifications are blocked in Android settings';
  static const String permissionBlockedBody =
      'To get reminders, open Settings, Apps, MockMob, Notifications and allow them. Studying works the same without them.';

  // Your day.
  static const String dayHeading = 'Your day';
  static const String dayQuiet = 'Quiet hours';
  static const String dayStudy = 'Study window';
  static const String dayQuietOff = 'Quiet hours are off';

  // Channels.
  static const String channelsHeading = 'What I want to hear about';
  static const String channelResult = 'Result ready';
  static const String channelResultBody =
      'When a mock you submitted in the background has its result. Quiet hours make it silent.';
  static const String channelStudy = 'Study window';
  static const String channelStudyBody =
      'One reminder when your study window starts.';
  static const String channelWeekly = 'Weekly plan';
  static const String channelWeeklyBody =
      'A look at your week, on Sunday evening.';
  static const String channelCheck = 'Check due';
  static const String channelCheckBody = 'When a fresh-question check is due.';
  static const String channelPaused =
      'Paused after 3 reminders went unopened. Turn it on to restart.';
  static const String fewerReminders =
      'Want fewer reminders? You can turn this one off.';
  static const String fewerRemindersDismiss = 'Got it';

  // Study window.
  static const String windowHeading = 'Study window';
  static const String windowStarts = 'Starts';
  static const String windowEnds = 'Ends';
  static const String windowRemove = 'Remove study window';
  static const String windowEmpty =
      'No study window yet. Turn on Study window above to choose one.';
  static String conflict(String time) =>
      'Your $time reminder falls inside quiet hours. Move one of them.';

  // Quiet hours.
  static const String quietHeading = 'Quiet hours';
  static const String quietStarts = 'Starts';
  static const String quietEnds = 'Ends';
  static const String quietBody =
      'Reminders wait until quiet hours end. Studying is never blocked.';

  // Weekly cap.
  static const String capHeading = 'Reminders a week';
  static const String capBody =
      'Never more than one a day. A result you are waiting for does not count.';
  static String capSemantics(int n) => '$n ${pluralWord(n, 'reminder')} a week';

  // Mute.
  static const String muteHeading = 'Take a break';
  static const String muteKey = 'Mute for 7 days';
  static const String muteBody =
      'Pauses reminders on this phone. Results you are waiting for still arrive.';
  static String muted(DateTime until) =>
      'Muted on this phone until ${formatWeekdayDate(until)}, ${formatTime12(until)}.';
  static const String unmute = 'Unmute';

  // Time picker sheet.
  static String pickTitle(String what) => 'Set $what';
  static const String pickHour = 'Hour';
  static const String pickMinute = 'Minute';
  static const String pickPeriod = 'AM or PM';
  static const String pickAm = 'AM';
  static const String pickPm = 'PM';
  static String pickSet(String time) => 'Set $time';

  // Notification text (spec 8). No streak, guilt, pet or admission wording.
  static const String actionStart = 'Start';
  static const String actionNotTonight = 'Not tonight';
  static const String actionMute = 'Mute for 7 days';

  static const String studyTitle = 'Study window';
  static const String studyBody =
      'Your study window has started. Pick a small next step when you are ready.';
  static const String returnBody =
      'Pick up with a small next step whenever you are ready.';
  static const String repairTitle = 'Repair ready';
  static String repairBody(int mistakes, int minutes) =>
      'Your repair is ready: ${plural(mistakes, 'mistake')}, about $minutes minutes.';
  static const String weeklyTitle = 'Weekly plan';
  static const String weeklyBody = 'Your week is ready to look at.';
}
