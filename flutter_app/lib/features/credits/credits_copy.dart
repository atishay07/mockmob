/// Every word of the Credits page and of the credit tiles on You and in the Account sheet.
///
/// On a server that keeps one credits balance (owner D78, release 10) there is one name, "Credits", and
/// the words "Practice credits" and "AI credits" never appear as balances. On an older server there are
/// two, "Practice credits" and "AI credits". Sentence case, no exclamation marks, no em dashes, no middle
/// dots, 12-hour times.
library;

import '../../core/copy/copy.dart';
import 'data/credits_models.dart';

abstract final class CreditsCopy {
  static const title = 'Credits';
  static const sectionPlan = 'Plan and credits';

  // Plan.
  static const planFree = 'Free';
  static const planPro = 'Pro';
  static const planProLine = 'Pro plan';
  static String planUntil(DateTime until) => 'Pro until ${formatDayMonth(until)} ${until.year}';
  static const planProActive = 'Pro is active';
  static const planProIncludes = 'Pro includes unlimited practice.';

  // The two pools: what each one pays for.
  static const practiceMeaning = 'For mocks and practice sets';
  static const practiceProMeaning = 'Practice is unlimited on Pro';
  static const aiMeaning = 'For Ask Mobi and repair explanations';
  static const unlimited = 'Unlimited';
  static String renews(DateTime date) => 'Renews ${formatDayMonth(date)}';

  // The one credits balance.
  static const oneName = 'Credits';
  static const oneMeaning = 'For practice, mocks and Ask Mobi';
  static const oneUnknown = 'Credits did not load.';
  static const oneProMeaning = 'For Ask Mobi and repairs. Practice is unlimited on Pro.';

  /// "1 credit", "40 credits".
  static String count(int n) => n == 1 ? '1 credit' : '$n credits';

  /// "38 of 50 free credits left this month".
  static String freeLeft(int left, int of) => '$left of $of free credits left this month';

  /// "Free credits renew 1 November".
  static String freeRenews(DateTime date) => 'Free credits renew ${formatDayMonth(date)}';

  /// "70 held. They do not expire."
  static String held(int n) => '$n held. They do not expire.';
  static const filterPractice = 'Practice';
  static const filterAi = 'AI';
  static const filterLabel = 'Show history for';

  /// A balance that did not load. Never shown as zero.
  static const notLoaded = 'Not loaded';
  static const checking = 'Checking';

  static String balanceLabel(CreditPool pool, String figure, String meaning) => '${pool.name}, $figure. $meaning';

  // History.
  static const historyTitle = 'History';
  static const filterAll = 'All';
  static const showMore = 'Show earlier';
  static const loadingMore = 'Loading earlier lines';
  static const moreFailed = 'We could not load earlier lines. Try again.';
  static const tryAgain = 'Try again';

  static const historyEmptyTitle = 'Nothing spent yet';
  static const historyEmptyBody = 'When you use Practice credits or AI credits, each line shows here with what is left.';
  static const historyEmptyBodyOne = 'When you spend credits, each line shows here.';
  static String historyEmptyFor(CreditPool pool) => 'No ${pool.name} lines in what has loaded yet.';

  static const historyFailedTitle = 'History did not load';
  static const historyFailedBody = 'Check your connection and try again.';
  static const loadFailedTitle = 'We could not load your credits';
  static const loadFailedBody = 'Check your connection and try again.';
  static const stale = 'Showing the figures from the last time you were online.';

  /// The second line of a history row, for TalkBack.
  ///
  /// Two pools: the pool and the count, "Used 1 AI credit." The running figure is left out: on an older
  /// server it is counted per ledger and can disagree with the balance on the card above (final walk,
  /// "50 AI credits left" next to a balance of 10).
  ///
  /// One balance: "Used 10 credits. 108 left." The figure is the server's own one balance after the line;
  /// it sends it only for this month's lines, so an older line says only what it used.
  static String line(CreditEntry e, {bool oneBalance = false}) {
    final n = e.delta.abs();
    final count = oneBalance ? CreditsCopy.count(n) : e.pool.count(n);
    final change = e.isSpend ? 'Used $count' : 'Added $count';
    final after = oneBalance ? e.balanceAfter : null;
    return after == null ? '$change.' : '$change. $after left.';
  }

  /// The value column's second line, "40 left": one balance mode only, and only when the server sent it.
  static String? left(CreditEntry e, {bool oneBalance = false}) => !oneBalance || e.balanceAfter == null ? null : '${e.balanceAfter} left';

  /// The 12 sp tag under the title: the pool, said once ("Practice credits", "AI credits"). None in one
  /// balance mode, where there is no pool to name.
  static String? tag(CreditEntry e, {bool oneBalance = false}) => oneBalance ? null : e.pool.name;

  /// The row's words for TalkBack (the long form: what it was, the count, and in one balance mode what is left).
  static String rowLabel(CreditEntry e, String when, {bool oneBalance = false}) {
    final what = e.what.isEmpty ? (e.isSpend ? 'Credits used' : 'Credits added') : e.what;
    return '$what. ${line(e, oneBalance: oneBalance)} $when';
  }

  /// The title of a row with no words from the server.
  static String whatFallback(CreditEntry e) => e.isSpend ? 'Credits used' : 'Credits added';

  static const today = 'Today';
  static const yesterday = 'Yesterday';
}
