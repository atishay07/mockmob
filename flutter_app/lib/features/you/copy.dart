/// Every user-facing string of the You feature. Binding rules apply: sentence case, no middle
/// dots, no emoji, no arrows, no exclamation successes, 12-hour times, "Saved" only for work the
/// server acknowledged, no prices. Voice: a senior who has been through CUET, warm and plain.
library;

import '../../core/copy/copy.dart';
import 'data/subject_catalog.dart' show youSubjectNames;

abstract final class YouCopy {
  // The sheet card (identity first).
  static const hubTitle = 'You';
  static const sheetOverline = 'Your sheet, CUET UG 2027';
  static String sheetOverlineFor(int year) => 'Your sheet, CUET UG $year';
  static const finishSheet = 'Add your course and colleges. Today plans the road from them.';
  static const finishSheetKey = 'Finish your sheet';
  static const editSubjects = 'Edit';
  static const editSubjectsLabel = 'Edit subjects';
  static const sheetNameFallback = 'Your sheet';
  static String signedInAs(String email) => 'Signed in as $email';
  static const fieldCourse = 'Course';
  static const fieldColleges = 'Colleges';
  static const fieldSubjects = 'Subjects';
  static const fieldWeek = 'This week';
  static const fieldWeekFailed = 'This week did not load.';
  static const weekOpen = 'Rhythm';
  static String weekToGo(int left) => left == 1 ? '1 day to your goal' : '$left days to your goal';
  static const rhythmOffLine = 'Rhythm is off. Your record stays.';
  static String collegeChoice(int rank, String name) => 'Choice $rank, $name';

  static const showMe = 'Show me';
  static const showMeMilestones = 'Show me, the milestones you earned';
  static String hubGreeting(String firstName) => 'Hi, $firstName.';

  // The token shelf.
  static const shelfTitle = 'Milestones';
  static const shelfSeeAll = 'See all';
  static const shelfLoadFailed = 'Your milestones did not load.';

  // Hub groups and rows.
  static const hubProgress = 'Progress';
  static const hubSettings = 'Settings';
  static const hubTools = 'CUET tools';
  static const rowRhythm = 'Weekly goal and rhythm';
  static const rowRecord = 'Repair record';
  static const rowMilestones = 'Milestones';
  static const rowBests = 'Personal bests';
  static const rowNotifications = 'Notifications';
  static const rowAppearance = 'Appearance and feel';
  static const rowPrivacy = 'Privacy';
  static const rowAccount = 'Account';
  static const rowHelp = 'Help and about';
  static const toolCompass = 'Compass';
  static const toolCombo = 'Combo Planner';
  static const toolOpenFailed = 'We could not open that page. Check your connection and try again.';
  static const accountPro = 'Pro';

  static String goalNote(int days) => 'Goal: ${days == 1 ? '1 day' : '$days days'} a week';
  static String weeksInRhythm(int weeks) => weeks == 1 ? '1 week in rhythm' : '$weeks weeks in rhythm';
  static String pausedUntil(String date) => 'Rhythm is paused until $date.';
  static String weekCount(int days, int goal) => '$days of ${plural(goal, 'study day')}';

  static const privacyOffForAccount = 'Off for your account';
  static const privacyOn = 'Usage data is on';
  static const privacyOff = 'Usage data is off';
  static const privacyUnknown = 'Usage data is treated as off';

  // Goal editor.
  static const goalTitle = 'Weekly goal';
  static const goalQuestion = 'How many days a week do you want to study?';
  static const goalCounts = 'A study day is a day you finish a practice, a mock or a repair.';
  static String goalFigure(int days) => days == 1 ? '1 day a week' : '$days days a week';
  static String goalUnit(int days) => days == 1 ? 'day a week' : 'days a week';
  static const goalEveryDay = 'Every day of the week. There are no rest days at this goal.';
  static const goalStudy = 'Study';
  static const goalRest = 'Rest';
  static String goalDayLabel(int days, bool selected) =>
      '${days == 1 ? '1 day' : '$days days'} a week${selected ? ', selected' : ''}';
  static String goalPaused(String date) => 'Rhythm is paused until $date. Changing the goal keeps the pause.';
  static const goalSave = 'Save goal';
  static const goalChangedElsewhere = 'Your goal was changed on another device. This is the current one.';
  static String goalSaved(DateTime at) => 'Goal saved at ${formatTime12(at)}.';
  static const goalOffline = 'You are offline. Your goal was not changed. Try again when you are connected.';
  static const goalRejected = 'That goal was not accepted. Pick a number from 1 to 7.';
  static const goalFailed = 'We could not save your goal. Nothing was changed. Try again.';
  static const goalLoadFailedTitle = 'We could not load your goal';
  static const goalLoadFailedBody = 'Check your connection and try again.';
  static const tryAgain = 'Try again';
  static const goalStale = 'Showing the goal from the last time you were online.';

  // Appearance and feel.
  static const appearanceTitle = 'Appearance and feel';
  static const themeHeading = 'Theme';
  static const themeDark = 'Night';
  static const themeDarkNote = 'Warm charcoal';
  static const themeLight = 'Daylight';
  static const themeLightNote = 'Warm paper';
  static const themeSystem = 'Match phone';
  static const themeSystemNote = 'Follows your phone';
  static const glassHeading = 'Glass';
  static const glassNote = 'Full blurs the dock and sheets. Lite and Off are easier on older phones.';
  static const feelHeading = 'Feel';
  static const reduceMotion = 'Reduce motion';
  static const reduceMotionNote = 'Keeps screens still. It follows your phone unless you turn it on here.';
  static const reduceMotionSystem = 'Change it in your phone settings, under accessibility.';
  static const reduceMotionFromPhone = 'On, from your phone';
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

  // Privacy and usage data.
  static const privacyTitle = 'Usage data';
  static const consentExplanation =
      'We count which parts of the app are used, such as starting a mock or finishing a repair, '
      'along with the app version. We do not collect your answers, marks, questions, contacts, '
      'location or an advertising ID. Turn this off any time and collection stops straight away.';
  static const seeEvents = 'See every event we collect';
  static const eventsTitle = 'Every event we collect';
  static const eventsIntro =
      'Each one has a name, a time, your app version and, at most, a few '
      'plain labels such as the subject or the kind of practice.';
  static const offForAccount = 'Off for your account.';
  static const offForAccountNote = 'Usage data can only be turned on by someone who says they are 18 or older.';
  static const operationalHeading = 'What this switch does not cover';
  static const operationalNote =
      'Your sessions, scores, notification settings and plan are kept to run your account. Google '
      'Play also reports crashes and performance to us. This switch controls neither.';
  static const changeAnswer = 'Change my age answer';
  static const ageQuestion = 'Are you 18 or older?';
  static const ageYes = 'Yes';
  static const ageNo = 'No';
  static const agePreferNot = 'Prefer not to say';
  static const consentLoading = 'Loading your usage-data choice';
  static const consentLoadFailedTitle = 'We could not load your usage-data choice';
  static const consentLoadFailedBody = 'Usage data stays off until we can check. Try again when you are connected.';
  static const consentEnabling = 'Saving your choice';
  static const consentTurningOff = 'Turning off. Collection has already stopped.';
  static const consentEnableFailed = 'We could not save that. Usage data is still off. Try again.';
  static const consentWithdrawn = 'Usage data is off and earlier data was deleted.';
  static const consentEnabled = 'Usage data is on. Saved.';
  static const consentWithdrawnShort = 'Usage data is off. We stopped collecting it.';
  static const consentDeleteFailed = 'Your choice was saved, but deleting earlier data failed. Try again.';
  static const consentUnreached =
      'Collection is off on this phone. We could not reach the server to delete earlier data. Try again.';
  static const ageChangeFailed = 'We could not save your answer. Try again.';

  // Account.
  static const accountTitle = 'Account';
  static const accountName = 'Name';
  static const accountEmail = 'Email';
  static const accountPlan = 'Plan';
  static const accountProfile = 'Profile';
  static const accountSecurity = 'Security';
  static const accountPassword = 'Password';
  static const accountPasswordNote = 'Set or change the password you can sign in with';
  static const accountAddPhone = 'Add a phone number';
  static const accountAddPhoneNote = 'Sign in with a code sent to your phone';
  static const accountEmailNote = 'You sign in with this address. It cannot be changed here.';
  static String accountCredits(int n) => n == 1 ? '1 credit' : '$n credits';
  static const signOut = 'Sign out';
  static const signOutTitle = 'Sign out of MockMob?';
  static const signOutPlain = 'You will need to sign in again to use MockMob on this phone.';
  static String signOutUnsent(int count) =>
      '${plural(count, 'answer')} ${count == 1 ? 'is' : 'are'} on this phone and not sent.';
  static const signOutUnsentNote = 'Signing out removes them from this phone.';
  static const signOutUnknown = 'We could not check for answers still on this phone.';
  static const signOutUnknownNote = 'Any that are not sent will be removed from this phone.';
  static String signOutQueued(int count) =>
      '${plural(count, 'study update')} ${count == 1 ? 'is' : 'are'} waiting to send from this phone.';
  static String signOutQueuedAsk(int count) => signOutQueued(count);
  static const signOutQueuedNote =
      'They send when you sign in again with this account. Signing in with a different account removes them.';
  static String expiredWork(int count) =>
      '${plural(count, 'study update')} could not be sent within 7 days, so ${count == 1 ? 'it was' : 'they were'} removed from this phone.';
  static const expiredWorkDismiss = 'Got it';
  static const signOutStay = 'Stay signed in';
  static const signOutAnyway = 'Sign out anyway';
  static const signOutFailed = 'We could not sign you out. Try again.';
  static const cancel = 'Cancel';
  static const deleteRow = 'Delete account';
  static const deleteRowNote = 'Ask us to delete your account and study records';

  // Delete account.
  static const deleteTitle = 'Delete your account';
  static const deleteConsequences =
      'We delete your account and study records within 30 days. Payment records required by law '
      'are kept.';
  static const deleteNotInstant = 'Tapping only sends us your request. We record it first, then you sign out.';
  static String deleteUnsent(int count) =>
      '${plural(count, 'answer')} on this phone ${count == 1 ? 'has' : 'have'} not been sent. '
      '${count == 1 ? 'It' : 'They'} will be removed when you are signed out.';
  static const deleteUnknown = 'We could not check this phone for answers that are not sent. Any that are will be removed when you are signed out.';
  static const deleteWord = 'DELETE';
  static const deleteTypeLabel = 'Type DELETE to confirm';
  static const deleteHint = 'Type here';
  static String deleteQueued(int count) =>
      '${plural(count, 'study update')} waiting to send will be removed too.';
  static const deleteCancelNote =
      'To cancel, email support@mockmob.in from your account address before we finish.';
  static const deleteRequest = 'Request deletion';
  static const deleteKeep = 'Keep my account';
  static const deleteOffline = 'You are offline. Nothing was requested. Try again when you are connected.';
  static const deleteFailed = 'We could not send your request. Nothing was requested. Try again.';
  static const deleteReceivedTitle = 'Your request is with us';
  static const deleteAlready = 'Your request is already with us.';
  static const deleteRecordedHeadline = 'Your request is recorded. Sign out when you are ready.';
  static String deleteRecordedAt(DateTime at) => 'Request recorded at ${formatTime12(at)}.';
  static String deleteRequestedOn(DateTime at) => 'Requested on ${formatDayMonth(at)}.';
  static const deleteSignOutNote = 'Signing out ends your session on this phone.';
  static const deleteSignOutFailed = 'Your request is recorded, but we could not sign you out. Try again.';

  // Help and about.
  static const helpTitle = 'Help and about';
  static const supportEmail = 'support@mockmob.in';
  static const helpContact = 'Write to us';
  static const helpContactNote = 'A result that looks wrong, a question that confused you, or anything else.';
  static const helpEmail = 'Email support';
  static const helpCopy = 'Copy address';
  static const helpCopied = 'Address copied.';
  static const helpMailFailed = 'We could not open an email app. You can copy the address instead.';
  static const helpPolicies = 'Policies';
  static const helpPrivacyPolicy = 'Privacy policy';
  static const helpTerms = 'Terms of use';
  static const aboutHeading = 'About';
  static const helpNonAffiliation = 'An independent practice app, not affiliated with NTA or the University of Delhi.';
  static const sourcesHeading = 'Where the facts come from';
  static const sourceExam = 'Exam pattern and dates';
  static const sourceExamFrom = 'NTA, cuet.nta.nic.in';
  static const sourceCourses = 'Course eligibility';
  static const sourceCoursesFrom = 'DU Bulletin 2026-27, du.ac.in';
  static const sourceScores = 'College scores';
  static const sourceScoresFrom = 'University of Delhi, 2026 admissions';
  static String helpVersion(String version) => 'Version $version';
  static const supportMailSubject = 'MockMob app help';
}

/// Display names for the public subject ids, so the sheet never prints a raw id.
String subjectDisplayName(String id) => switch (id) {
      'business' => 'Business Studies',
      'gat' => 'General Test',
      'maths' => 'Mathematics',
      'applied_mathematics' => 'Applied Mathematics',
      _ => youSubjectNames[id] ?? _humanize(id),
    };

String _humanize(String id) {
  final words = id.replaceAll(RegExp(r'[_\-]+'), ' ').trim();
  if (words.isEmpty) return id;
  return words[0].toUpperCase() + words.substring(1);
}
