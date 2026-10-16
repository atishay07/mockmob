import 'ai_credits.dart';
import 'json_helpers.dart';
import 'repair_check.dart';

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

/// One line of "The other options" in a v3 repair: why the option at [index] (0-based, in the
/// order the student saw the options) is wrong.
class RepairOtherOption {
  const RepairOtherOption({required this.index, required this.why});

  final int index;
  final String why;
}

/// Text of one Mistake Repair explanation. v1 (stored repairs written before v2) carries
/// `key_idea`, `why_tempting`, `why_wrong` and `next_step`; v2 adds the trap, another way to see
/// it, a worked contrast and a rule to keep; v3 adds why the key is right, a line for each other
/// option and a memory hook, and carries the second explanation in the same response. Every
/// field after v1 is optional, so any payload reads.
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
    this.whyRight,
    this.others = const [],
    this.memoryHook,
  });

  factory RepairExplanation.fromJson(Json j) {
    String? text(Object? v) {
      final s = asString(v)?.trim();
      return s == null || s.isEmpty ? null : s;
    }

    final rule = text(j['rule']);
    return RepairExplanation(
      // A v2 or v3 payload may carry the rule in place of `key_idea`: the idea is then the rule.
      keyIdea: text(j['key_idea']) ?? rule ?? '',
      // v3 sends `trap` and, for older apps, the same words as `why_tempting`.
      whyTempting: text(j['trap']) ?? text(j['why_tempting']),
      whyWrong: text(j['why_wrong']),
      nextStep: text(j['next_step']),
      generatedAt: asDate(j['generatedAt']),
      trapType: text(j['trap_type']),
      anotherWay: text(j['another_way']),
      contrast: text(j['contrast']),
      rule: rule,
      whyRight: text(j['why_right']),
      others: _others(j['others']),
      memoryHook: text(j['memory_hook']),
    );
  }

  /// The valid entries of `others`, one per option, in the order the options were served. An
  /// entry without a whole non-negative `index` or without text, or one that repeats an index, is
  /// left out; the rest still show.
  static List<RepairOtherOption> _others(Object? v) {
    if (v is! List) return const [];
    final seen = <int>{};
    final out = <RepairOtherOption>[];
    for (final e in v) {
      if (e is! Map) continue;
      final index = asInt(e['index']);
      final why = asString(e['why'])?.trim();
      if (index == null || index < 0 || why == null || why.isEmpty || !seen.add(index)) continue;
      out.add(RepairOtherOption(index: index, why: why));
    }
    out.sort((a, b) => a.index.compareTo(b.index));
    return out;
  }

  final String keyIdea;

  /// Why the chosen option looked right (v2 and v3 `trap`, v1 `why_tempting`).
  final String? whyTempting;
  final String? whyWrong;
  final String? nextStep;
  final DateTime? generatedAt;

  /// v2 and v3: one of [repairTrapLabels]' keys, or anything else (read as `other`).
  final String? trapType;

  /// The idea explained another way (v2; in v3 it comes in the same response and is revealed by a
  /// tap, with no second call).
  final String? anotherWay;

  /// A worked "if X then B; here Y, so C".
  final String? contrast;

  /// The rule to keep, 15 words or fewer.
  final String? rule;

  /// v3 only: why the answer key's option is right.
  final String? whyRight;

  /// v3 only: why each option that is neither the pick nor the key is wrong. Empty when the
  /// server sent none (a two-option question, or a block it dropped).
  final List<RepairOtherOption> others;

  /// v3 only: a short way to remember the rule.
  final String? memoryHook;

  /// 3 when `why_right` is present, 2 when only a rule is, otherwise 1. The payload's layout, not a
  /// promise about the server: a repair stored before v3 keeps its own layout.
  int get version => isV3 ? 3 : (rule != null ? 2 : 1);

  /// A v3 payload: it says why the key is right, and (as every v3 repair does) gives a rule. A
  /// payload with `why_right` but no rule reads in the older layout instead of half a new one.
  bool get isV3 => whyRight != null && rule != null;

  /// A v2 payload or later: it carries a rule.
  bool get isV2 => rule != null;

  /// The heading of a v2 or v3 repair, null for v1.
  String? get trapHeading => isV2 ? repairTrapLabel(trapType) : null;

  /// The line to keep: the rule, or the v1 key idea.
  String get keepLine => rule ?? keyIdea;
}

/// "Since 9 Oct, 2 of your 3 repairs in Correct Word Usage had this trap."
/// The server builds [line] from the student's own repairs; the app only shows it.
class RepairPattern {
  const RepairPattern({required this.line, this.scope, this.k, this.n, this.trapType});

  /// Null when the map has no line: a pattern with nothing to say is no pattern.
  static RepairPattern? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final line = asString(j['line'])?.trim();
    if (line == null || line.isEmpty) return null;
    return RepairPattern(
      line: line,
      scope: asString(j['scope']),
      k: asInt(j['k']),
      n: asInt(j['n']),
      trapType: asString(j['trapType']),
    );
  }

  final String line;

  /// `chapter` or `subject`.
  final String? scope;
  final int? k;
  final int? n;
  final String? trapType;
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
    this.pattern,
    this.check,
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
      pattern: RepairPattern.tryParse(j['pattern']),
      check: status.countsAsRepaired ? RepairCheckInfo.tryParse(j['check']) : null,
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

  /// A repeated trap across the student's repaired mistakes, or null (also when the server could
  /// not work it out in time). Shown under "From your record".
  final RepairPattern? pattern;

  /// "Check it held": what the server offers after the explanation (`explained` and `stored`
  /// only). Null on an older server and for any other outcome: the screen then renders nothing.
  final RepairCheckInfo? check;
}
