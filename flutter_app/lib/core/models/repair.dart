import 'ai_credits.dart';
import 'json_helpers.dart';

/// Text of one Mistake Repair explanation. Limits per the contract: 320 and 220 characters.
class RepairExplanation {
  const RepairExplanation({
    required this.keyIdea,
    this.whyTempting,
    this.whyWrong,
    this.nextStep,
    this.generatedAt,
  });

  factory RepairExplanation.fromJson(Json j) => RepairExplanation(
        keyIdea: asStringOr(j['key_idea'], ''),
        whyTempting: asString(j['why_tempting']),
        whyWrong: asString(j['why_wrong']),
        nextStep: asString(j['next_step']),
        generatedAt: asDate(j['generatedAt']),
      );

  final String keyIdea;
  final String? whyTempting;
  final String? whyWrong;
  final String? nextStep;
  final DateTime? generatedAt;
}

enum RepairStatus {
  explained,
  stored,
  heldForRecheck,
  notExplained;

  static RepairStatus? fromWire(String? s) => switch (s) {
        'explained' => explained,
        'stored' => stored,
        'held_for_recheck' => heldForRecheck,
        'not_explained' => notExplained,
        _ => null,
      };

  String get wire => switch (this) {
        explained => 'explained',
        stored => 'stored',
        heldForRecheck => 'held_for_recheck',
        notExplained => 'not_explained',
      };

  /// Only these two outcomes may count as a repaired mistake.
  bool get countsAsRepaired => this == explained || this == stored;
}

class RepairResponseFormatException implements Exception {
  const RepairResponseFormatException(this.reason);

  final String reason;

  @override
  String toString() => 'RepairResponseFormatException($reason)';
}

/// 200 body of `POST /api/recovery/repair` [API 2.9].
class RepairResponse {
  const RepairResponse({
    required this.status,
    this.explanation,
    this.charged,
    this.wallet,
    this.practiceHref,
    this.chosenIndex,
    this.keyIndex,
  });

  /// Accepts only the four documented statuses and requires `key_idea` for `explained` and
  /// `stored`; anything else throws [RepairResponseFormatException].
  factory RepairResponse.fromJson(Json j) {
    final status = RepairStatus.fromWire(asString(j['status']));
    if (status == null) throw const RepairResponseFormatException('unknown_status');
    RepairExplanation? explanation;
    if (j['repair'] is Map) explanation = RepairExplanation.fromJson(asJson(j['repair']));
    if (status.countsAsRepaired && (explanation == null || explanation.keyIdea.isEmpty)) {
      throw const RepairResponseFormatException('missing_key_idea');
    }
    return RepairResponse(
      status: status,
      explanation: explanation,
      charged: asInt(j['charged']),
      wallet: j['wallet'] is Map ? AiWallet.fromJson(asJson(j['wallet'])) : null,
      practiceHref: asString(j['practiceHref']),
      chosenIndex: asInt(j['chosenIndex']),
      keyIndex: asInt(j['keyIndex']),
    );
  }

  final RepairStatus status;
  final RepairExplanation? explanation;

  /// Explanation credits taken for this call (0 for a reopen or a held question).
  final int? charged;
  final AiWallet? wallet;

  /// Web path. Convert to a native Quick practice start; never open it as is.
  final String? practiceHref;
  final int? chosenIndex;
  final int? keyIndex;
}
