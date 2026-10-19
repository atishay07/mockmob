/// Every word of the Wallet. One balance, "Credits". Sentence
/// case, no exclamation marks, no emoji, no middle dots, 12-hour times. No price is written here:
/// a price on this screen is only ever Google Play's own string (lib/features/billing).
library;

import '../../core/copy/copy.dart';

abstract final class WalletCopy {
  static const title = 'Wallet';

  // The one balance.
  static const creditsName = 'Credits';
  /// Only while the server's own line (`buys`) has not loaded: the website's line with the free first full mock switched
  /// off (creditCopy ONE_CREDIT_LINE), word for word. It makes no free claim: whether the first full mock in each subject
  /// is free is the server's to say (release 11 can switch it off), and it says so in `buys` when it loads, in the words
  /// of [firstMockFreeClause]. So this line is true on every server and only ever gains the clause.
  static const creditsFor =
      '1 credit buys 1 practice question or 1 chat reply. A full mock costs 50 credits. '
      'Deeper analysis costs 3 credits. The cost shows before you start.';

  /// The clause the server's `buys` line carries while the free first full mock is on (creditCopy FIRST_ONE_FREE).
  static const firstMockFreeClause = ', and your first one in each subject is free';
  static String freeLeft(int left, int of) => '$left of $of free credits left this month';
  static String held(int n) => n == 1 ? '1 held credit' : '$n held credits';
  static const heldNote = 'Held credits do not expire.';
  static const practiceUnlimitedNote = 'Practice is unlimited on Pro.';

  /// "Free credits refill on 1 November at 12:00 AM".
  static String resets(DateTime at) => 'Free credits refill on ${formatDayMonth(at)} at ${formatTime12(at)}';

  // The balance, split honestly (I8: a new account shows 150 = 50 free this month + 100 kept welcome credits).
  static const toSpend = 'credits to spend';
  static const freePart = 'Free this month';
  static String freePartNote(int left, int of, DateTime? refill) =>
      refill == null ? '$left of $of left' : '$left of $of left. Refills ${formatDayMonth(refill)}';
  static const keptPart = 'Kept credits';
  static const keptPartNote = 'Your welcome credits and any top-ups. They do not expire.';
  static const lowNote = 'You are running low. A top-up or Pro keeps you practising.';

  // What credits buy: the server's price list, as tiles. The first full mock line only when the server says so.
  static const buysTitle = 'What credits buy';
  static const costShows = 'The cost always shows before you start.';
  static const buyQuestion = 'A practice question';
  static const buyMock = 'A full mock';
  static const buyMockFirstFree = 'First one in each subject is free';
  static const buyAnalysis = 'Deeper analysis';
  static const buyReply = 'An Ask Mobi reply';
  static const includedOnPro = 'Included';
  static String creditsWord(int n) => n == 1 ? 'credit' : 'credits';

  // The Pro bridge, for a Free student when Google Play is on.
  static const proBridgeTitle = 'Pro makes practice unlimited';
  static const proBridgeBody = 'Practise as much as you like without spending credits, with Smart practice and the exam-day screen.';
  static const proBridgeKey = 'See Pro';

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
