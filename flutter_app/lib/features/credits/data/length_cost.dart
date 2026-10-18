// What each row of "How many questions?" costs (final walk: the sheet listed 5, 10, 15, 20 and the full
// mock with no price on any row; the price showed only on the card after a pick).
//
// The price comes from the same source as the card's line after a pick: the server's quote for that
// exact length when it has answered, and otherwise the per-question rule the server charges (owner D65:
// a credit a question, so 5 questions are 5 credits and the 50-question full mock is 50). On Pro, practice
// uses no credits: "Included", with no upsell. A row the student cannot afford says so on the row.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/models/practice_quote.dart';
import '../../practice/data/practice_quote.dart' show practiceQuoteProvider;
import '../../practice/model/practice_selection.dart' show QuoteQuery;

/// One row's price: the words on the row's right ("5 credits", "Included", "Free") and, when the student
/// has fewer credits than it takes, the balance under it ("You have 12").
class LengthCost {
  const LengthCost(this.price, {this.short});

  final String price;

  /// "You have 12": set only when the row costs more than the student has.
  final String? short;

  /// The row's words for TalkBack: "15 credits. You have 12, not enough".
  String get spoken => switch (short) {
        null => price,
        LengthCostCopy.notEnough => '$price. $short',
        final s => '$price. $s, not enough',
      };

  @override
  bool operator ==(Object other) => other is LengthCost && other.price == price && other.short == short;

  @override
  int get hashCode => Object.hash(price, short);

  @override
  String toString() => 'LengthCost($price, $short)';
}

abstract final class LengthCostCopy {
  static const included = 'Included';
  static const free = 'Free';
  static String credits(int n) => n == 1 ? '1 credit' : '$n credits';
  static String youHave(int n) => 'You have $n';
  static const notEnough = 'Not enough credits';
}

/// The quote a row would launch with: the card's own quote ([base]) at the row's length. A full mock is
/// its own mode at 50 questions. Null when the card starts nothing priced (a repair, a fresh check).
QuoteQuery? lengthQuoteQuery(QuoteQuery? base, {required int? questions, required bool fullMock}) {
  if (base == null || questions == null) return null;
  if (fullMock) return QuoteQuery(subject: base.subject, apiMode: 'full', count: questions);
  final set = base.apiMode == 'full';
  return QuoteQuery(subject: base.subject, apiMode: set ? 'quick' : base.apiMode, count: questions, purpose: set ? null : base.purpose);
}

/// The price of one row, from the quote when there is one and the D65 rule otherwise. [balance] is the
/// student's spendable credits when known (never a stale copy). Null when nothing true can be said: a
/// quote that cannot launch for a reason other than credits, or a mode Free cannot open.
LengthCost? lengthCostFor({required int questions, required bool fullMock, PracticeQuote? quote, required bool isPro, int? balance}) {
  if (quote != null) {
    if (quote.isAccessRequired) return null;
    if (quote.isInsufficientCredits && quote.creditCost != null) {
      final have = quote.creditBalance ?? balance;
      return LengthCost(LengthCostCopy.credits(quote.creditCost!), short: have == null ? LengthCostCopy.notEnough : LengthCostCopy.youHave(have));
    }
    if (!quote.launchable) return null;
    if (quote.freeByAllowance) return const LengthCost(LengthCostCopy.free);
    final cost = quote.creditCost ?? 0;
    if (cost > 0) {
      final have = quote.creditBalance ?? balance;
      return LengthCost(LengthCostCopy.credits(cost), short: have != null && have < cost ? LengthCostCopy.youHave(have) : null);
    }
    return LengthCost(isPro || quote.entitlementKind == 'access' ? LengthCostCopy.included : LengthCostCopy.free);
  }
  if (isPro) return const LengthCost(LengthCostCopy.included);
  final cost = fullMock ? 50 : questions;
  return LengthCost(LengthCostCopy.credits(cost), short: balance != null && balance < cost ? LengthCostCopy.youHave(balance) : null);
}

/// The price of one row for the signed-in student: the row's quote is asked for while the sheet is open
/// (it is advisory and spends nothing), and the D65 rule shows until it answers. The balance a row is
/// measured against is the server's own, from the quotes (the card's quote has usually answered already):
/// on a one-balance server that is the one credits balance, on an older one the Practice credits.
final lengthCostProvider = Provider.autoDispose.family<LengthCost?, ({QuoteQuery? base, int? questions, bool fullMock})>((ref, row) {
  final query = lengthQuoteQuery(row.base, questions: row.questions, fullMock: row.fullMock);
  if (query == null) return null;
  final quote = ref.watch(practiceQuoteProvider(query)).value;
  final card = row.base == null ? null : ref.watch(practiceQuoteProvider(row.base!)).value;
  final isPro = ref.watch(authSnapshotProvider.select((a) => a.isPro));
  return lengthCostFor(questions: row.questions!, fullMock: row.fullMock, quote: quote, isPro: isPro, balance: quote?.creditBalance ?? card?.creditBalance);
});
