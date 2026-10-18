/// Every word of the Wallet. Two credit names only, "Practice credits" and "AI credits". Sentence
/// case, no exclamation marks, no emoji, no middle dots, 12-hour times. No price is written here:
/// a price on this screen is only ever Google Play's own string (lib/features/billing).
library;

import '../../core/copy/copy.dart';

abstract final class WalletCopy {
  static const title = 'Wallet';

  // Practice credits.
  static const practiceName = 'Practice credits';
  static const practiceFor = 'For mocks and practice sets. One credit is one question.';
  static String aboutQuestions(int n) => n == 1 ? 'About 1 question' : 'About $n questions';
  static const practiceUnlimited = 'Unlimited';
  static const practiceUnlimitedNote = 'Practice is unlimited on Pro.';

  // AI credits.
  static const aiName = 'AI credits';
  static const aiFor = 'For Ask Mobi and repair explanations.';
  static String aiIncluded(int left, int of) => '$left of $of included this month';
  static String aiBought(int n) => '$n bought, no expiry';
  static const aiPaused = 'AI replies are paused just now.';

  /// "Resets 1 November, 12:00 AM".
  static String resets(DateTime at) => 'Resets ${formatDayMonth(at)}, ${formatTime12(at)}';

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
  static const historyEmptyBody = 'When you use Practice credits or AI credits, each line shows here with what is left.';
  static const historyFailedTitle = 'History did not load';
  static const historyFailedBody = 'Check your connection and try again.';
  static const showEarlier = 'Show earlier';
  static const loadingMore = 'Loading earlier lines';
  static const moreFailed = 'We could not load earlier lines. Try again.';
  static const today = 'Today';
  static const yesterday = 'Yesterday';
}
