/// Every user-facing string of the You feature (spec 5.10 to 5.12). Binding rules apply:
/// sentence case, no middle dots, no emoji, no arrows, no exclamation successes, 12-hour times,
/// "On this phone" for local work, "Saved on the server" for acknowledged work, no prices.
library;

import '../../core/copy/copy.dart';

abstract final class YouCopy {
  // Hub (5.10).
  static const hubTitle = 'You';
  static const hubProgress = 'Progress';
  static const hubSettings = 'Settings';
  static const hubTools = 'CUET tools';
  static String signedInAs(String email) => 'Signed in as $email';

  static const rowRhythm = 'Weekly goal and rhythm';
  static const rowRecord = 'Repair record';
  static const rowMilestones = 'Milestones';
  static const rowBests = 'Personal bests';
  static const rowNotifications = 'Notifications';
  static const rowAppearance = 'Appearance and feel';
  static const rowPrivacy = 'Privacy';
  static const rowAccount = 'Account';
  static const rowHelp = 'Help';
  static const toolCompass = 'Compass';
  static const toolCombo = 'Combo Planner';
  static const toolOpenFailed = 'We could not open that page. Check your connection and try again.';

  static String goalNote(int days) => 'Goal: ${days == 1 ? '1 day' : '$days days'} a week';
  static String weeksInRhythm(int weeks) => 'Weeks in rhythm: $weeks';
  static String pausedUntil(String date) => 'Rhythm is paused until $date.';

  static const privacyOffForAccount = 'Off for your account';
  static const privacyOn = 'Usage data is on';
  static const privacyOff = 'Usage data is off';
  static const privacyUnknown = 'Usage data is treated as off';

  // Goal editor (5.11, 6.1).
  static const goalTitle = 'Weekly goal';
  static const goalQuestion = 'How many days a week do you want to study?';
  static const goalCounts = 'A study day is a day you finish a practice, a mock or a repair.';
  static String goalFigure(int days) => days == 1 ? '1 day a week' : '$days days a week';
  static const goalRestDays = 'The other days are rest days.';
  static const goalEveryDay = 'Every day of the week. There are no rest days at this goal.';
  static const goalStudy = 'study';
  static const goalRest = 'rest';
  static String goalDayLabel(int days, bool selected) =>
      '${days == 1 ? '1 day' : '$days days'} a week${selected ? ', selected' : ''}';
  static String goalPaused(String date) => 'Rhythm is paused until $date. Changing the goal keeps the pause.';
  static const goalSave = 'Save goal';
  static String goalSaved(DateTime at) => 'Goal saved on the server at ${formatTime12(at)}.';
  static const goalOffline = 'You are offline. Your goal was not changed. Try again when you are connected.';
  static const goalRejected = 'That goal was not accepted. Pick a number from 1 to 7.';
  static const goalFailed = 'We could not save your goal. Nothing was changed. Try again.';
  static const goalLoadFailedTitle = 'We could not load your goal';
  static const goalLoadFailedBody = 'Check your connection and try again.';
  static const tryAgain = 'Try again';
  static const goalStale = 'Showing the goal from the last time you were online.';

  // Appearance and feel (5.12.2).
  static const appearanceTitle = 'Appearance and feel';
  static const themeHeading = 'Theme';
  static const themeSystem = 'Match phone';
  static const themeSystemNote = 'Light or dark, whichever your phone uses.';
  static const themeLight = 'Light';
  static const themeLightNote = 'Paper colours.';
  static const themeDark = 'Dark';
  static const themeDarkNote = 'Night colours.';
  static const feelHeading = 'Feel';
  static const reduceMotion = 'Reduce motion';
  static const reduceMotionNote = 'Keeps screens still. It follows your phone unless you turn it on here.';
  static const reduceMotionSystem = 'Your phone is set to remove animations, so motion is already reduced.';
  static const touchFeedback = 'Touch feedback';
  static const touchFeedbackNote = 'A small tap when you press keys and choices.';
  static const openDirectly = 'Open results directly';
  static const openDirectlyNote = 'Skips the sealed sheet and opens the full result.';
  static const lateNight = 'Late-night lines';
  static const lateNightNote = 'A short line after a session between 11:00 PM and 7:00 AM.';
  static const celebrationsHeading = 'Celebrations';
  static const celebrationsFull = 'Full';
  static const celebrationsQuiet = 'Quiet';
  static const celebrationsOff = 'Off';
  static const celebrationsFullNote = 'A mark on your sheet, a short sweep and a tap when something is finished.';
  static const celebrationsQuietNote = 'The same moments as plain text, with no motion or tap.';
  static const celebrationsOffNote = 'Nothing extra. Your record still updates.';

  // Privacy and usage data (5.12.3).
  static const privacyTitle = 'Usage data';
  static const consentExplanation =
      'We count which parts of the app are used, such as starting a mock or finishing a repair, '
      'along with the app version. We do not collect your answers, marks, questions, contacts, '
      'location or an advertising ID. Nothing goes to ad or analytics companies. You can turn '
      'this off any time here and collection stops straight away.';
  static const seeEvents = 'See every event we collect';
  static const eventsTitle = 'Every event we collect';
  static const eventsIntro =
      'These are all of them. Each one has a name, a time, your app version and, at most, a few '
      'plain labels such as the subject or the kind of practice.';
  static const offForAccount = 'Off for your account.';
  static const offForAccountNote =
      'Usage data can only be turned on by someone who says they are 18 or older.';
  static const operationalNote =
      'Your sessions, scores, notification settings and plan are kept to run your account. This '
      'switch does not control them. Google Play also reports crashes and performance to us, and '
      'this switch does not control that either.';
  static const changeAnswer = 'Change my answer';
  static const ageQuestion = 'Are you 18 or older?';
  static const ageNote = 'This only decides your data settings.';
  static const ageYes = 'Yes';
  static const ageNo = 'No';
  static const agePreferNot = 'Prefer not to say';
  static const consentLoading = 'Loading your usage-data choice';
  static const consentLoadFailedTitle = 'We could not load your usage-data choice';
  static const consentLoadFailedBody = 'Usage data stays off until we can check. Try again when you are connected.';
  static const consentEnabling = 'Saving your choice';
  static const consentTurningOff = 'Turning off. Collection has already stopped.';
  static const consentEnableFailed = 'We could not save that. Usage data is still off. Try again.';
  static const consentWithdrawn =
      'Usage data is off. We stopped collecting it. Earlier usage data was deleted.';
  static const consentEnabled = 'Usage data is on. Saved. You can turn it off here any time.';
  static const consentWithdrawnShort = 'Usage data is off. We stopped collecting it.';
  static const consentDeleteFailed = 'Your choice was saved, but deleting earlier data failed. Try again.';
  static const consentUnreached =
      'Collection is off on this phone. We could not reach the server to delete earlier data. Try again.';
  static const ageChangeFailed = 'We could not save your answer. Try again.';

  // Account (5.12.4).
  static const accountTitle = 'Account';
  static const accountName = 'Name';
  static const accountEmail = 'Email';
  static const accountPlan = 'Plan';
  static const accountPlanOff = 'Not on Pro';
  static String planActiveUntil(DateTime date) => 'Pro is active until ${formatDayMonth(date)} ${date.year}';
  static const planActive = 'Pro is active';
  static const planHonoured = 'Pro bought on mockmob.in is honoured here.';
  static const signOut = 'Sign out';
  static const signOutTitle = 'Sign out of MockMob?';
  static const signOutPlain = 'You will need to sign in again to use MockMob on this phone.';
  static String signOutUnsent(int count) =>
      '${plural(count, 'answer')} ${count == 1 ? 'is' : 'are'} on this phone and not sent. Sign out anyway?';
  static const signOutUnsentNote = 'Signing out removes them from this phone.';
  static const signOutStay = 'Stay signed in';
  static const signOutAnyway = 'Sign out anyway';
  static const signOutFailed = 'We could not sign you out. Try again.';
  static const deleteRow = 'Delete account';
  static const deleteRowNote = 'Ask us to delete your account and study records';

  // Delete account (5.12.4).
  static const deleteTitle = 'Delete your MockMob account';
  static const deleteConsequences =
      'We delete your account and study records within 30 days. Payment records required by law '
      'are kept. You will be signed out.';
  static const deleteNotInstant = 'Your account is not deleted the moment you tap. We record your request first.';
  static String deleteUnsent(int count) =>
      '${plural(count, 'answer')} on this phone ${count == 1 ? 'has' : 'have'} not been sent. '
      '${count == 1 ? 'It' : 'They'} will be removed when you are signed out.';
  static const deleteRequest = 'Request deletion';
  static const deleteKeep = 'Keep my account';
  static const deleteOffline = 'You are offline. Nothing was requested. Try again when you are connected.';
  static const deleteFailed = 'We could not send your request. Nothing was requested. Try again.';
  static const deleteReceivedTitle = 'Your request is with us';
  static const deleteAlready = 'Your request is already with us.';
  static String deleteRecordedAt(DateTime at) => 'Request recorded on the server at ${formatTime12(at)}.';
  static String deleteRequestedOn(DateTime at) => 'Requested on ${formatDayMonth(at)}.';
  static const deleteSignOutNote = 'Signing out ends your session on this phone.';
  static const deleteSignOutFailed = 'Your request is recorded, but we could not sign you out. Try again.';

  // Help (5.12.4).
  static const helpTitle = 'Help';
  static const supportEmail = 'support@mockmob.in';
  static const helpContact = 'Write to us';
  static const helpContactNote = 'Questions, problems with a result, or anything that looks wrong.';
  static const helpEmail = 'Email support';
  static const helpCopy = 'Copy address';
  static const helpCopied = 'Address copied.';
  static const helpMailFailed = 'We could not open an email app. You can copy the address instead.';
  static const helpPolicies = 'Policies';
  static const helpPrivacyPolicy = 'Privacy policy';
  static const helpTerms = 'Terms of use';
  static const helpNonAffiliation = 'MockMob is not affiliated with NTA or Delhi University.';
  static String helpVersion(String version) => 'Version $version';
  static const supportMailSubject = 'MockMob app help';
}
