/// Every word of the Wallet. One balance, "Credits". Sentence
/// case, no exclamation marks, no emoji, no middle dots, 12-hour times. No price is written here:
/// a price on this screen is only ever Google Play's own string (lib/features/billing).
library;

import '../../core/copy/copy.dart';

abstract final class WalletCopy {
  static const title = 'Wallet';

  // The one balance.
  static const creditsName = 'Credits';
  /// What one credit buys, in the app's own words (20 Oct, L-02/L-20: one noun pair, "a doubt" and "a fix"; the 2
  /// questions are new CUET-style questions from the checked bank, never "real CUET questions"). It makes no free
  /// claim: whether the first full mock in each subject is free is the server's to say, in its `buys` line, in the words
  /// of [firstMockFreeClause]. So this line is true on every server.
  static const creditsFor =
      '1 credit buys 1 practice question, 1 doubt or 1 fix. A doubt gets Mobi’s answer, a follow-up and 2 new CUET-style '
      'questions. A fix explains one mistake and tests it on 2 fresh questions. A full mock costs 50 credits. Everything '
      'Mobi reads from your record is free. The cost shows before you start.';

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

  // D165 (owner, 20 Oct): new accounts start with 50 credits, and an invite gives the friend and the inviter 100 credits
  // each once the friend finishes a first practice. Ready, and shown only once the server says the offer is live
  // (`referralOfferLiveProvider`); until then nothing here is drawn.
  static const keptPartNoteReferrals = 'Welcome, invite and top-up credits. They do not expire.';
  static const welcomeCredits = 'New accounts start with 50 credits.';
  static const inviteTitle = 'Invite a friend';
  static const inviteBody = 'When your friend joins and finishes their first practice, you both get 100 credits.';
  static const inviteLabel = 'Invite a friend. When your friend joins and finishes their first practice, you both get 100 credits.';
  static const lowNote = 'You are running low. A top-up or Pro keeps you practising.';

  // What credits buy: the server's price list, as tiles. The first full mock line only when the server says so.
  static const buysTitle = 'What credits buy';
  static const costShows = 'What Mobi reads from your marks is free. The cost always shows before you start.';
  static const buyQuestion = 'A practice question';
  static const buyMock = 'A full mock';
  static const buyMockFirstFree = 'First one in each subject is free';

  /// Why the first full mock in each subject is free (K6, owner 20 Oct: "why was this decided?"), in one plain line under
  /// the price list. Only while the server's rule is on.
  static const firstMockWhy =
      'Your first full mock in each subject is free, so you can sit a real exam-style paper and see your full reveal before you pay.';
  static const buysCostColumn = 'Cost';
  // What Mobi does for a credit, by one noun pair everywhere (L-20): a doubt and a fix. There is no 3-credit "deeper
  // analysis" (C-dec 3), Mobi never charges for talking, and what it reads from the record is free.
  static const buyDoubt = 'A doubt';
  static const buyDoubtNote = 'Mobi’s answer, a follow-up and 2 new questions';
  static const buyFix = 'A fix';
  static const buyFixNote = 'One mistake explained, then tested twice';
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
