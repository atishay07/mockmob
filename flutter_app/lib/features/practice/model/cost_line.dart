import '../../../core/models/practice_quote.dart';
import '../copy.dart';
import 'practice_selection.dart';

enum CostKind {
  /// Nothing to say (Pro access, or nothing is charged).
  none,
  freeToday,
  freeFirst,
  credits,
  proGated,

  /// Not launchable for a reason the server states in plain text.
  blocked,
}

/// The one line a mode row or the setup screen prints about cost, derived only from the quote
/// (spec 5.4): never from constants in the app.
class CostLine {
  const CostLine(this.kind, [this.text]);

  final CostKind kind;
  final String? text;

  bool get isFree => kind == CostKind.freeToday || kind == CostKind.freeFirst;
}

CostLine costLineFor(PracticeQuote quote) {
  if (quote.isAccessRequired) return const CostLine(CostKind.proGated, PracticeCopy.partOfPro);
  if (!quote.launchable) {
    if (quote.isInsufficientCredits && quote.creditCost != null) {
      return CostLine(CostKind.credits, PracticeCopy.usesCredits(quote.creditCost!, quote.creditBalance));
    }
    final reason = quote.reason;
    return CostLine(CostKind.blocked, reason == null || reason.trim().isEmpty ? PracticeCopy.unavailableFallback : reason);
  }
  if (quote.freeByAllowance) {
    final kind = quote.allowance!.kind;
    if (kind.startsWith('baseline:') || kind.startsWith('full_sample:')) {
      return CostLine(CostKind.freeFirst, PracticeCopy.freeFirstIn(quote.subjectName ?? 'this subject'));
    }
    return const CostLine(CostKind.freeToday, PracticeCopy.freeToday);
  }
  final cost = quote.creditCost ?? 0;
  if (quote.creditBalance != null && cost > 0) {
    return CostLine(CostKind.credits, PracticeCopy.usesCredits(cost, quote.creditBalance));
  }
  return const CostLine(CostKind.none);
}

/// The credits-low state (spec 5.4): the balance and what this mode costs, both from the quote.
class CreditsLow {
  const CreditsLow({required this.balance, required this.cost});

  final int balance;
  final int cost;

  String message(PracticeMode mode) => mode.isMock
      ? PracticeCopy.creditsLowMock(balance, cost, mode == PracticeMode.nta ? 'NTA-style mock' : 'Full mock')
      : PracticeCopy.creditsLowPractice(balance, cost);
}

CreditsLow? creditsLowFor(PracticeQuote quote) {
  if (!quote.isInsufficientCredits) return null;
  final cost = quote.creditCost;
  final balance = quote.creditBalance;
  if (cost == null || balance == null) return null;
  return CreditsLow(balance: balance, cost: cost);
}

/// Whether a mode row for [mode] should be shown at all. NTA-style appears only when the quote
/// returns it: a quote that says the mode is unknown or unavailable hides the row.
bool quoteOffersMode(PracticeQuote quote) =>
    quote.reasonCode != 'mode_unknown' && quote.reasonCode != 'mode_unavailable' && quote.reasonCode != 'unauthenticated';
