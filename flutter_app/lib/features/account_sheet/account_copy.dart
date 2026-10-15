/// Every word of the Account sheet. Sentence case, no exclamation marks, no em dashes.
abstract final class AccountCopy {
  /// The sheet's name for TalkBack.
  static const sheetLabel = 'Account';

  /// When the profile has neither a name nor an email yet.
  static const noName = 'Your account';

  static const planFree = 'Free';
  static const planPro = 'Pro';

  // Credits: two ledgers, each said with what it pays for.
  static const credits = 'Credits';
  static const practiceTitle = 'Practice credits';
  static const practiceMeaning = 'For papers and chapter sets';
  static const practiceProMeaning = 'Practice is unlimited on Pro';
  static const unlimited = 'Unlimited';
  static const aiTitle = 'AI credits';
  static const aiMeaning = 'One per AI reply in Ask Mobi';
  static const aiPaused = 'AI replies are paused';
  static String aiRenews(String date) => 'Renews $date';

  /// A balance that did not load. Never shown as zero.
  static const notLoaded = 'Not loaded';
  static const checking = 'Checking';

  /// Where each balance leads.
  static const practiceOpens = 'Opens your plan and credits';
  static const aiOpens = 'Opens Ask Mobi';

  static String practiceLabel(String figure, String meaning) => 'Practice credits, $figure. $meaning. $practiceOpens';
  static String aiLabel(String figure, String meaning) => 'AI credits, $figure. $meaning. $aiOpens';

  static const appearance = 'Appearance';
  static const themeDark = 'Night';
  static const themeLight = 'Daylight';
  static const themeSystem = 'Match phone';

  // Rows.
  static const rowAccount = 'Name, sign-in and plan';
  static const rowNotifications = 'Notifications';
  static const rowStudyDays = 'Study days';
  static const rowPrivacy = 'Privacy';
  static const rowHelp = 'Help and about';
  static const rowContact = 'Write to us';
  static const contactAddress = 'support@mockmob.in';

  static const signOut = 'Sign out';
  static const signOutFailed = 'We could not sign you out. Try again.';
}
