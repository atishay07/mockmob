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
  if (quote.isAccessRequired) return const CostLine(CostKind.proGated, PracticeCopy.proTag);
  if (!quote.launchable) {
    if (quote.isInsufficientCredits && quote.creditCost != null) {
      return CostLine(CostKind.credits, PracticeCopy.usesCredits(quote.creditCost!, quote.creditBalance));
    }
    return CostLine(CostKind.blocked, blockedTextFor(quote.reasonCode));
  }
  if (quote.freeByAllowance) {
    final kind = quote.allowance!.kind;
    // D175: a full mock is never called free here. A full mock's allowance (the old first full mock or full sample) says
    // nothing about price; the server's own figure below, or nothing, stands.
    if (kind.startsWith('first_full_mock:') || kind.startsWith('full_sample:') || quote.freeReason == firstFullMockFreeReason) {
      return const CostLine(CostKind.none);
    }
    // The free 5-question baseline check in a subject (not a full mock).
    if (kind.startsWith('baseline:')) {
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
  const CreditsLow({required this.balance, required this.cost, this.count});

  final int balance;
  final int cost;

  /// The length the quote was for. A practice set costs a credit a question, so a length above the shortest can be made
  /// shorter; the sentence says so only then.
  final int? count;

  String message(PracticeMode mode) => mode.isMock
      ? PracticeCopy.creditsLowMock(balance, cost, mode == PracticeMode.nta ? 'exam-day mock' : 'Full mock')
      : PracticeCopy.creditsLowPractice(balance, cost, shorterPossible: (count ?? 0) > mode.counts.first);
}

CreditsLow? creditsLowFor(PracticeQuote quote) {
  if (!quote.isInsufficientCredits) return null;
  final cost = quote.creditCost;
  final balance = quote.creditBalance;
  if (cost == null || balance == null) return null;
  return CreditsLow(balance: balance, cost: cost, count: quote.count);
}

/// Whether a mode row for [mode] should be shown at all. NTA-style appears only when the quote
/// returns it: a quote that says the mode is unknown or unavailable hides the row.
bool quoteOffersMode(PracticeQuote quote) =>
    quote.reasonCode != 'mode_unknown' && quote.reasonCode != 'mode_unavailable' && quote.reasonCode != 'unauthenticated';

/// How a mode that Pro may hold (NTA mode, Smart practice) stands for one student (D101).
enum ModeAccess {
  /// Listed and open: a Pro student, or a quote that lets this student in.
  open,

  /// Listed with a quiet Pro tag; a tap opens the Upgrade sheet or, with PLAY_BILLING off, the calm
  /// sheet. Never hidden.
  locked,

  /// The server says the mode is not offered here at all (unknown or switched off): no tile.
  notOffered,
}

/// The mode's standing from its [quote], or, before the quote has answered, from the plan: a Free
/// student's NTA mode and Smart practice are Pro's, so they are listed locked from the first frame
/// (D101: every mode is always listed) and never pop in seconds later.
ModeAccess practiceModeAccess(PracticeQuote? quote, {required bool isPro}) {
  if (quote == null) return isPro ? ModeAccess.open : ModeAccess.locked;
  if (!quoteOffersMode(quote)) return ModeAccess.notOffered;
  return costLineFor(quote).kind == CostKind.proGated ? ModeAccess.locked : ModeAccess.open;
}

/// The words for a quote that cannot launch, chosen by [reasonCode] only: the server's own
/// free-form `reason` is never shown.
String blockedTextFor(String reasonCode) => switch (reasonCode) {
  'inventory_insufficient' || 'inventory_empty' => PracticeCopy.notEnoughQuestionsYet,
  'subject_not_offered' || 'subject_retired' || 'subject_unknown' => PracticeCopy.subjectNotOpen,
  'mode_unknown' || 'mode_unavailable' => PracticeCopy.modeUnavailable,
  'rate_limited' || 'user_unavailable' || 'inventory_unknown' => PracticeCopy.tryLater,
  'unauthenticated' => PracticeCopy.signInAgain,
  _ => PracticeCopy.unavailableFallback,
};
