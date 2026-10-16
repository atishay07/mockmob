import '../../core/copy/copy.dart' show formatDayMonthShort;

/// The words of the Account sheet that are its own. The credit tiles, the theme switch and sign
/// out are shared with You (`CreditsCopy`, `YouCopy`), so the same words are said once. Sentence
/// case, no exclamation marks, no em dashes.
abstract final class AccountCopy {
  /// The sheet's name for TalkBack.
  static const sheetLabel = 'Account';

  /// When the profile has neither a name nor an email yet.
  static const noName = 'Your account';

  static const planFree = 'Free';
  static const planPro = 'Pro';

  /// Under the Pro tag: "until 12 Jan".
  static String proUntil(DateTime until) => 'until ${formatDayMonthShort(until)}';

  static const credits = 'Credits';
  static const appearance = 'Appearance';

  // Rows.
  static const rowAccount = 'Name, sign-in and plan';
  static const rowNotifications = 'Notifications';
  static const rowPrivacy = 'Privacy';
  static const rowHelp = 'Help and about';
  static const rowContact = 'Write to us';
  static const contactAddress = 'support@mockmob.in';
}
