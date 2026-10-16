/// Every word of the Credits page and of the credit tiles on You. Two credit names only,
/// "Practice credits" and "AI credits", and every line that spends one names its pool and says
/// what is left. Sentence case, no exclamation marks, no em dashes, no middle dots, 12-hour times.
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
  static String historyEmptyFor(CreditPool pool) => 'No ${pool.name} lines in what has loaded yet.';

  static const historyFailedTitle = 'History did not load';
  static const historyFailedBody = 'Check your connection and try again.';
  static const loadFailedTitle = 'We could not load your credits';
  static const loadFailedBody = 'Check your connection and try again.';
  static const stale = 'Showing the figures from the last time you were online.';

  /// The second line of a history row: the pool and the count, then what is left.
  ///
  /// "Used 1 AI credit. 8 AI credits left."
  static String line(CreditEntry e) {
    final count = e.pool.count(e.delta.abs());
    final change = e.isSpend ? 'Used $count' : 'Added $count';
    final after = e.balanceAfter;
    return after == null ? '$change.' : '$change. ${e.pool.count(after)} left.';
  }

  /// The value column's second line: what is left, "40 left". Null when the server sent no balance.
  static String? left(CreditEntry e) => e.balanceAfter == null ? null : '${e.balanceAfter} left';

  /// The 12 sp tag under the title: the pool, said once ("Practice credits", "AI credits").
  static String tag(CreditEntry e) => e.pool.name;

  /// The row's words for TalkBack (the long form: pool, count and what is left).
  static String rowLabel(CreditEntry e, String when) {
    final what = e.what.isEmpty ? (e.isSpend ? 'Credits used' : 'Credits added') : e.what;
    return '$what. ${line(e)} $when';
  }

  /// The title of a row with no words from the server.
  static String whatFallback(CreditEntry e) => e.isSpend ? 'Credits used' : 'Credits added';

  static const today = 'Today';
  static const yesterday = 'Yesterday';
}
