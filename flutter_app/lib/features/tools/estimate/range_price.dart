// What the next subject's full mock costs, for Today's range card: only what the server's quote
// says (never a constant in the app). The first full mock in each subject is free when the quote
// says so (19 Oct, CTO decision with W5: price 0, reason "first_full_mock_free"); otherwise the
// card prints the same cost line Practice prints, and nothing at all while the quote is unknown.
// Pure: tested without a phone.

import '../../../core/models/practice_quote.dart';
import '../../practice/model/cost_line.dart';
import 'estimate_copy.dart';

enum RangeMockPriceKind {
  /// No quote yet, or it failed: no price is shown, never a guess.
  unknown,

  /// The quote says the student's first full mock in this subject is free.
  firstFree,

  /// Free for another reason the quote names (an allowance).
  free,

  /// Anything else the quote says (credits, blocked): Practice's own line.
  other,
}

class RangeMockPrice {
  const RangeMockPrice(this.kind, [this.line]);

  final RangeMockPriceKind kind;

  /// The line under the key, or null.
  final String? line;

  bool get isFree => kind == RangeMockPriceKind.firstFree || kind == RangeMockPriceKind.free;
}

/// The marker the server uses for the free first full mock in a subject (its reason code, reason or
/// allowance kind).
const String firstFullMockFree = 'first_full_mock_free';

bool _firstFullMockFree(PracticeQuote q) =>
    q.reasonCode == firstFullMockFree || q.reason == firstFullMockFree || (q.allowance?.kind.startsWith('first_full_mock') ?? false);

RangeMockPrice rangeMockPrice(PracticeQuote? quote) {
  if (quote == null) return const RangeMockPrice(RangeMockPriceKind.unknown);
  // Free means the quote can launch, charges nothing, and the account pays in credits at all (a Pro
  // account has nothing to be free of).
  final free = quote.launchable && quote.creditCost == 0 && quote.creditBalance != null;
  if (free && _firstFullMockFree(quote)) return const RangeMockPrice(RangeMockPriceKind.firstFree, EstimateCopy.firstMockFree);
  final cost = costLineFor(quote);
  if (cost.isFree) return RangeMockPrice(RangeMockPriceKind.free, cost.text);
  return RangeMockPrice(RangeMockPriceKind.other, cost.text);
}
