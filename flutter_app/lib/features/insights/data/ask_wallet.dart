import '../../../core/models/ai_credits.dart';
import '../../../core/models/json_helpers.dart';

/// The AI credit wallet as Ask shows it: the same wallet the website reads (`GET /api/ai/credits`,
/// and the `usageSnapshot.aiWallet` a chat reply carries). Free accounts include 50 credits a
/// month and Pro 50 (the server's AI_FREE_MONTHLY_CREDITS and AI_PRO_INCLUDED_MONTHLY_CREDITS);
/// purchased credits sit beside them and never expire. Included credits spend first.
///
/// A wallet the server could not read has no numbers: [total] is null then, never zero.
class AskWallet {
  const AskWallet({
    this.state,
    this.total,
    this.includedRemaining,
    this.includedMonthly,
    this.bonus,
    this.resetAt,
    this.paid = false,
  });

  /// From the credits read. The server sends `spendable` as a yes or no and the count as
  /// `total`; an older payload (and the test fakes) carry the count in `spendable`.
  factory AskWallet.fromCredits(AiCredits c) {
    final w = c.wallet;
    final known = w != null && w.known != false;
    return AskWallet(
      state: c.state,
      total: known ? (w.total ?? w.spendable) : null,
      includedRemaining: known ? w.includedRemaining : null,
      includedMonthly: known ? w.includedMonthlyCredits : null,
      bonus: known ? w.bonusCredits : null,
      resetAt: w?.resetAt,
      paid: c.isPaid,
    );
  }

  /// From a chat reply's `usageSnapshot`: the wallet as stored right after the reply was charged.
  /// Null when the snapshot has no wallet.
  static AskWallet? fromSnapshot(Object? snapshot) {
    final s = asJson(snapshot);
    if (s['aiWallet'] is! Map) return null;
    final w = asJson(s['aiWallet']);
    final known = asBool(w['known']) != false;
    return AskWallet(
      state: asString(w['state']),
      total: known ? asInt(w['total']) : null,
      includedRemaining: known ? asInt(w['includedRemaining']) : null,
      includedMonthly: known ? asInt(w['includedMonthlyCredits']) : null,
      bonus: known ? asInt(w['bonusCredits']) : null,
      resetAt: asDate(w['resetAt']),
      paid: asBool(s['isPaid']) ?? asBool(w['paid']) ?? false,
    );
  }

  /// `available`, `empty`, `paused`, `schema_unavailable` or `error`.
  final String? state;

  /// Credits that can be spent now, or null when the balance is not known.
  final int? total;
  final int? includedRemaining;
  final int? includedMonthly;

  /// Purchased credits. They never expire.
  final int? bonus;

  /// When the included credits renew (the first of next month, India time).
  final DateTime? resetAt;
  final bool paid;

  bool get known => total != null;
  bool get paused => state == 'paused';

  /// Written replies cannot be bought now: paused, no credits, or a wallet the server could not
  /// read. An unknown state is not a refusal.
  bool get cannotWrite => paused || empty || state == 'schema_unavailable' || state == 'error';

  /// A real zero, read from the server. An unknown balance is never empty.
  bool get empty => !paused && total == 0;

  /// The same wallet with the balance a refusal reported (a 402 says how many are left).
  AskWallet withTotal(int total) => AskWallet(
        state: total == 0 && !paused ? 'empty' : state,
        total: total,
        includedRemaining: total == 0 ? 0 : includedRemaining,
        includedMonthly: includedMonthly,
        bonus: total == 0 ? 0 : bonus,
        resetAt: resetAt,
        paid: paid,
      );
}

const _ist = Duration(hours: 5, minutes: 30);

/// The first of next month in India: when included credits renew if the server has not said.
DateTime nextIndiaMonthStart(DateTime now) {
  final ist = now.toUtc().add(_ist);
  // Midnight IST on the 1st is 18:30 UTC on the last day of the month before.
  return DateTime.utc(ist.year, ist.month + 1, 1).subtract(_ist);
}

const _months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/// "1 November": the day the included credits renew, on India's calendar (the website's words).
String renewDay(AskWallet? wallet, DateTime now) {
  final at = (wallet?.resetAt ?? nextIndiaMonthStart(now)).toUtc().add(_ist);
  return '${at.day} ${_months[at.month - 1]}';
}
