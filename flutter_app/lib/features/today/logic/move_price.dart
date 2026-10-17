// The price line under the lead card's key (TODAY-1018 section 5, "Pro and Free"; W-060: the cost
// is shown before the press). Only the server's own numbers: a practice or a full mock says what
// its quote says (the same words Practice uses), a repair says what the AI credit wallet holds,
// Revise is free. Pure: the screen reads the quote and the wallet and passes them in; an unknown
// price shows no line at all, never a guess and never zero.
import '../../../core/models/ai_credits.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/router/routes.dart';
import '../../practice/model/cost_line.dart';
import '../../practice/model/practice_selection.dart' show QuoteQuery;
import '../copy.dart';
import 'today_model.dart';

/// The quote the move's key would launch with, or null when the key starts no priced practice.
/// Chapter practice costs the same as Quick practice (the quote takes no chapter).
QuoteQuery? quoteQueryFor(MoveHero m) {
  final t = m.primary.target;
  if (t is! GoTo || !m.primary.startsSession) return null;
  final uri = Uri.tryParse(t.location);
  if (uri == null) return null;
  final q = uri.queryParameters;
  final subject = q['subject'];
  if (subject == null || subject.isEmpty) return null;
  if (uri.path == AppRoutes.practiceStart) {
    final mode = q['mode'];
    // A fresh check has no cost to check (it proves a repair).
    if (q.containsKey('recoveryFrom')) return null;
    return QuoteQuery(subject: subject, apiMode: mode == 'smart' ? 'smart' : 'quick', count: int.tryParse(q['count'] ?? '') ?? 10, purpose: q['purpose']);
  }
  if (uri.path == AppRoutes.practiceSetup('full')) return QuoteQuery(subject: subject, apiMode: 'full', count: 50);
  return null;
}

/// Whether the move is a repair (its price is the AI credit wallet's).
bool _isRepair(MoveHero m) => m.kind == MoveKind.repair || m.kind == MoveKind.firstRepair || m.kind == MoveKind.returning;

/// The line, from what is known; null when nothing true can be said yet.
String? priceLine(MoveHero m, {AiCredits? credits, PracticeQuote? quote}) {
  if (m.kind == MoveKind.failure || m.kind == MoveKind.done) return null;
  if (_isRepair(m)) {
    if (credits == null || credits.isPaused) return null;
    final balance = credits.explanationBalance;
    return balance == null ? null : TodayCopy.priceRepair(balance);
  }
  if (m.kind == MoveKind.revise) return TodayCopy.priceFree;
  if (quote == null) return null;
  return costLineFor(quote).text;
}

/// The key a price is kept under: the same move, whichever card shows it (the lead or a choice).
String priceKeyOf(MoveHero m) => '${m.kind.name}|${m.subjectId}|${m.primary.label}';
