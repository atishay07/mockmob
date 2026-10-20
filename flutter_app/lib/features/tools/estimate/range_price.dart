// What the next subject's full mock costs, for Today's range card: only what the server's quote
// says (never a constant in the app). The card prints the same cost line Practice prints, and nothing at all while the
// quote is unknown. D175 (20 Oct): no full mock is called free: the first full mock in each subject is no longer free.
// Pure: tested without a phone.

import '../../../core/models/practice_quote.dart';
import '../../practice/model/cost_line.dart';

enum RangeMockPriceKind {
  /// No quote yet, or it failed: no price is shown, never a guess.
  unknown,

  /// Free for a reason the quote names (an allowance such as the daily one).
  free,

  /// Anything else the quote says (credits, blocked): Practice's own line.
  other,
}

class RangeMockPrice {
  const RangeMockPrice(this.kind, [this.line]);

  final RangeMockPriceKind kind;

  /// The line under the key, or null.
  final String? line;

  bool get isFree => kind == RangeMockPriceKind.free;
}

RangeMockPrice rangeMockPrice(PracticeQuote? quote) {
  if (quote == null) return const RangeMockPrice(RangeMockPriceKind.unknown);
  final cost = costLineFor(quote);
  if (cost.isFree) return RangeMockPrice(RangeMockPriceKind.free, cost.text);
  return RangeMockPrice(RangeMockPriceKind.other, cost.text);
}
