/// Every word of the Wallet. One balance, "Credits". Sentence
/// case, no exclamation marks, no emoji, no middle dots, 12-hour times. No price is written here:
/// a price on this screen is only ever Google Play's own string (lib/features/billing).
library;

import '../../core/copy/copy.dart';

abstract final class WalletCopy {
  static const title = 'Wallet';

  // The one balance.
  static const creditsName = 'Credits';
  static const creditsFor = '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.';
  static String freeLeft(int left, int of) => '$left of $of free credits left this month';
  static String held(int n) => n == 1 ? '1 held credit' : '$n held credits';
  static const heldNote = 'Held credits do not expire.';
  static const practiceUnlimitedNote = 'Practice is unlimited on Pro.';

  /// "Resets 1 November, 12:00 AM".
  static String resets(DateTime at) => 'Free credits reset ${formatDayMonth(at)}, ${formatTime12(at)}';

  // Loading and failure. A balance that did not load is never zero.
  static const notLoaded = 'Not loaded';
  static const checking = 'Checking';
  static const tryAgain = 'Try again';
  static const stale = 'Showing the figures from the last time you were online.';

  // Plan.
  static const planFree = 'Free';
  static const planPro = 'Pro';

  // Pro row, for a Free student when Google Play is on.
  static const proRowTitle = 'Pro';
  static const proRowNote = 'Unlimited practice, Smart practice and the exam-day screen.';

  // History.
  static const recent = 'Recent';
  static const historyEmptyTitle = 'Nothing spent yet';
  static const historyEmptyBody = 'When you spend credits, each line shows here with what is left.';
  static const historyFailedTitle = 'History did not load';
  static const historyFailedBody = 'Check your connection and try again.';
  static const showEarlier = 'Show earlier';
  static const loadingMore = 'Loading earlier lines';
  static const moreFailed = 'We could not load earlier lines. Try again.';
  static const today = 'Today';
  static const yesterday = 'Yesterday';
}
