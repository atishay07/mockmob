import 'ai_credits.dart';
import 'json_helpers.dart';

/// The trap types of a v2 repair (REPAIR-LAB-AUDIT-2026-10-14 section 5.3), each with a plain
/// label about the option, never about the student. The same labels as the website's
/// `TRAP_LABELS` in `data/repair_presentation.mjs`.
const repairTrapLabels = <String, String>{
  'partly_true': 'A partly true option',
  'reversed': 'The relation turned around',
  'look_alike_term': 'A look-alike term',
  'missed_not_except': 'A missed NOT or EXCEPT',
  'not_in_passage': 'Not in the passage',
  'calculation_slip': 'A calculation slip',
  'wrong_rule': 'The wrong rule applied',
  'one_step_short': 'One step short',
  'extreme_word': 'An extreme word',
  'assertion_reason_link': 'The assertion and reason link',
  'other': 'The trap in this option',
};

/// The heading for [trapType]; an unknown or missing type reads as neutral wording, never a code.
String repairTrapLabel(String? trapType) => repairTrapLabels[trapType] ?? repairTrapLabels['other']!;

/// Text of one Mistake Repair explanation. v1 (stored repairs written before v2) carries
/// `key_idea`, `why_tempting`, `why_wrong` and `next_step`; v2 adds the trap, another way to see
/// it, a worked contrast and a rule to keep. Every v2 field is optional, so either payload reads.
class RepairExplanation {
  const RepairExplanation({
    required this.keyIdea,
    this.whyTempting,
    this.whyWrong,
    this.nextStep,
    this.generatedAt,
    this.trapType,
    this.anotherWay,
    this.contrast,
    this.rule,
  });

  factory RepairExplanation.fromJson(Json j) {
    String? text(Object? v) {
      final s = asString(v)?.trim();
      return s == null || s.isEmpty ? null : s;
    }

    final rule = text(j['rule']);
    return RepairExplanation(
      // A v2 payload may carry the rule in place of `key_idea`: the idea is then the rule.
      keyIdea: text(j['key_idea']) ?? rule ?? '',
      whyTempting: text(j['trap']) ?? text(j['why_tempting']),
      whyWrong: text(j['why_wrong']),
      nextStep: text(j['next_step']),
      generatedAt: asDate(j['generatedAt']),
      trapType: text(j['trap_type']),
      anotherWay: text(j['another_way']),
      contrast: text(j['contrast']),
      rule: rule,
    );
  }

  final String keyIdea;

  /// Why the chosen option looked right (v2 `trap`, v1 `why_tempting`).
  final String? whyTempting;
  final String? whyWrong;
  final String? nextStep;
  final DateTime? generatedAt;

  /// v2 only: one of [repairTrapLabels]' keys, or anything else (read as `other`).
  final String? trapType;

  /// v2 only: the idea explained another way.
  final String? anotherWay;

  /// v2 only: a worked "if X then B; here Y, so C".
  final String? contrast;

  /// v2 only: the rule to keep, 15 words or fewer.
  final String? rule;

  /// A v2 payload: it carries a rule.
  bool get isV2 => rule != null;

  /// The heading of a v2 repair, null for v1.
  String? get trapHeading => isV2 ? repairTrapLabel(trapType) : null;

  /// The line to keep: the v2 rule, or the v1 key idea.
  String get keepLine => rule ?? keyIdea;
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
