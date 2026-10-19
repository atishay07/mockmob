import 'json_helpers.dart';

/// The explanation wallet inside `GET /api/ai/credits` [API 2.11]. Balances are nullable on
/// purpose: `known:false` must never be shown as zero.
class AiWallet {
  const AiWallet({
    this.state,
    this.known,
    this.spendable,
    this.includedMonthlyCredits,
    this.includedRemaining,
    this.bonusCredits,
    this.total,
    this.resetAt,
  });

  factory AiWallet.fromJson(Json j) => AiWallet(
        state: asString(j['state']),
        known: asBool(j['known']),
        spendable: asInt(j['spendable']),
        includedMonthlyCredits: asInt(j['includedMonthlyCredits']),
        includedRemaining: asInt(j['includedRemaining']),
        bonusCredits: asInt(j['bonusCredits']),
        total: asInt(j['total']),
        resetAt: asDate(j['resetAt']),
      );

  final String? state;
  final bool? known;
  final int? spendable;
  final int? includedMonthlyCredits;
  final int? includedRemaining;
  final int? bonusCredits;
  final int? total;

  /// When the monthly credits renew.
  final DateTime? resetAt;

  /// Explanation credits the student can spend now, or null when the balance is not known.
  /// The server sends `spendable` as a yes or no and the count as `total`; an older payload
  /// (and some test fakes) carry the count in `spendable`, so `total` wins and `spendable` is the
  /// fallback only when it is a number.
  int? get balance => known == false ? null : (total ?? spendable);

  bool get isKnown => balance != null;
}

class AiCredits {
  const AiCredits({
    required this.state,
    this.wallet,
    this.isPaid = false,
    this.tier,
    this.practiceBalance,
    this.oneBalance = false,
    this.checkoutOpen,
  });

  factory AiCredits.fromJson(Json j) {
    final practice = asJson(j['practiceCredits']);
    final one = asJson(j['credits']);
    return AiCredits(
      state: asStringOr(j['state'], 'error'),
      wallet: j['wallet'] is Map ? AiWallet.fromJson(asJson(j['wallet'])) : null,
      isPaid: asBool(j['isPaid']) ?? false,
      tier: asString(j['tier']),
      practiceBalance: asInt(practice['balance']),
      // The one credits balance (owner D78, release 10): the server sends a known `credits` total, and the
      // wallet's own total is then that one balance. An older server sends no `credits` block.
      oneBalance: asBool(one['known']) == true && asInt(one['total']) != null,
      checkoutOpen: asBool(asJson(j['checkout'])['open']),
    );
  }

  /// `available`, `empty`, `paused`, `schema_unavailable` or `error`.
  final String state;
  final AiWallet? wallet;
  final bool isPaid;
  final String? tier;

  /// Practice credits, the other ledger.
  final int? practiceBalance;

  /// The server keeps one credits balance: the wallet's total is that balance, called "credits", never
  /// "AI credits".
  final bool oneBalance;

  /// Whether new credit packs are on sale (`checkout.open`): false while the server pauses them,
  /// null when it did not say. The app's Google Play packs follow it, so the app never sells a pack
  /// the website has paused (PLAY-BILLING-PLAN-1018).
  final bool? checkoutOpen;

  /// Explanation credits, or null when unknown. Never render null as zero.
  int? get explanationBalance => wallet?.balance;
  DateTime? get resetAt => wallet?.resetAt;
  bool get isPaused => state == 'paused';
}
