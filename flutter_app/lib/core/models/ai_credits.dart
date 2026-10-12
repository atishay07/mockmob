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
  int? get balance => known == false ? null : spendable;

  bool get isKnown => balance != null;
}

class AiCredits {
  const AiCredits({
    required this.state,
    this.wallet,
    this.isPaid = false,
    this.tier,
    this.practiceBalance,
  });

  factory AiCredits.fromJson(Json j) {
    final practice = asJson(j['practiceCredits']);
    return AiCredits(
      state: asStringOr(j['state'], 'error'),
      wallet: j['wallet'] is Map ? AiWallet.fromJson(asJson(j['wallet'])) : null,
      isPaid: asBool(j['isPaid']) ?? false,
      tier: asString(j['tier']),
      practiceBalance: asInt(practice['balance']),
    );
  }

  /// `available`, `empty`, `paused`, `schema_unavailable` or `error`.
  final String state;
  final AiWallet? wallet;
  final bool isPaid;
  final String? tier;

  /// Practice credits, the other ledger.
  final int? practiceBalance;

  /// Explanation credits, or null when unknown. Never render null as zero.
  int? get explanationBalance => wallet?.balance;
  DateTime? get resetAt => wallet?.resetAt;
  bool get isPaused => state == 'paused';
}
