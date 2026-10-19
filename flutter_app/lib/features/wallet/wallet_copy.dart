/// Every word of the Wallet. One balance, "Credits". Sentence
/// case, no exclamation marks, no emoji, no middle dots, 12-hour times. No price is written here:
/// a price on this screen is only ever Google Play's own string (lib/features/billing).
library;

import '../../core/copy/copy.dart';

abstract final class WalletCopy {
  static const title = 'Wallet';

  // The one balance.
  static const creditsName = 'Credits';
  /// Only while the server's own line (`buys`) has not loaded: the website's words, word for word (creditCopy
  /// ONE_CREDIT_LINE, copy pass 19 Oct), so the line never changes when it loads. A full mock's price says the first
  /// one in each subject is free (C-dec 1).
  static const creditsFor =
      '1 credit buys 1 practice question or 1 chat reply. A full mock costs 50, and your first one in each subject is free. '
      'Deeper analysis costs 3. The cost shows before you start.';
  static String freeLeft(int left, int of) => '$left of $of free credits left this month';
  static String held(int n) => n == 1 ? '1 held credit' : '$n held credits';
  static const heldNote = 'Held credits do not expire.';
  static const practiceUnlimitedNote = 'Practice is unlimited on Pro.';

  /// "Free credits refill on 1 November at 12:00 AM".
  static String resets(DateTime at) => 'Free credits refill on ${formatDayMonth(at)} at ${formatTime12(at)}';

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
