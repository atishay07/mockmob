import 'json_helpers.dart';

/// The repair's check, "Check it held" (Repair v4, contract `repair-check-v1`): after the
/// explanation the student answers one fresh, unseen, published bank question on the same idea.
/// It comes with the repair's credit: no second charge and no model call. The key of the check
/// question is never sent before the answer.
///
/// Every model here reads additively: unknown fields are ignored and a missing field is absent,
/// so an older or newer server never breaks the screen.

/// What the repair response's `check` field says is on offer.
enum RepairCheckStatus {
  /// A question is on offer right now.
  ready,

  /// Nothing to offer, with a [RepairCheckInfo.reason].
  none,

  /// The check was answered already (a reopened repair).
  answered,

  /// The check could not be offered right now (not a verdict on the student).
  unchecked;

  static RepairCheckStatus? fromWire(String? s) => switch (s) {
        'ready' => ready,
        'none' => none,
        'answered' => answered,
        'unchecked' => unchecked,
        _ => null,
      };
}

/// `check` on the `POST /api/recovery/repair` response (status `explained` and `stored` only).
/// Absent on older servers, on a held repair and on one that was not explained: the screen then
/// renders nothing at all.
class RepairCheckInfo {
  const RepairCheckInfo({required this.status, this.available = false, this.reason, this.message, this.href, this.askHref});

  /// Null for a missing field, a field that is not an object, or a status this app does not know.
  static RepairCheckInfo? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final status = RepairCheckStatus.fromWire(asString(j['status']));
    if (status == null) return null;
    return RepairCheckInfo(
      status: status,
      available: asBool(j['available']) ?? status == RepairCheckStatus.ready,
      reason: _text(j['reason']),
      message: _text(j['message']),
      href: _text(j['href']),
      askHref: _text(j['askHref']),
    );
  }

  final RepairCheckStatus status;

  /// A check question is on offer right now (false once answered).
  final bool available;

  /// `no_unseen`, `passage_format`, `repair_first`, `not_saved`, `lookup_failed`,
  /// `check_unavailable`, `check_changed`, `invalid_pick`; null when [status] is ready or answered.
  final String? reason;

  /// The reason in plain words, from the server.
  final String? message;

  /// `/api/recovery/check?attemptId=..&questionId=..` (relative).
  final String? href;

  /// `/mentor?tab=ask&q=<attemptId>:<questionId>`: the Ask Mobi follow-up about the original mistake.
  final String? askHref;

  /// Trying again can help only for these reasons.
  bool get canRetry => reason == 'lookup_failed' || reason == 'check_unavailable';

  /// The student-facing line for a none or unchecked check: the server's words, or the contract's
  /// own sentence for the reason, or the general one.
  String get line => message ?? RepairCheckReasons.line(reason);
}

/// The contract's `reasons`, word for word. The server's `message` wins when it sent one.
abstract final class RepairCheckReasons {
  static const noUnseen = 'No unseen question on this idea yet.';
  static const passageFormat = 'This one needs its reading passage, so there is no short check for it.';
  static const repairFirst = 'The check comes with the repair. Explain this mistake first.';
  static const notSaved = 'This repair was not saved, so there is no check to open. Nothing was charged.';
  static const lookupFailed =
      'We could not confirm which questions you have already seen, so we are not offering one. Nothing was charged.';
  static const checkUnavailable = 'The check is not available right now. Nothing was charged.';
  static const checkChanged = 'That question was withdrawn before it was marked. Nothing was recorded.';
  static const invalidPick = 'Pick one of the four options.';

  static String line(String? reason) => switch (reason) {
        'no_unseen' => noUnseen,
        'passage_format' => passageFormat,
        'repair_first' => repairFirst,
        'not_saved' => notSaved,
        'lookup_failed' => lookupFailed,
        'check_changed' => checkChanged,
        'invalid_pick' => invalidPick,
        _ => checkUnavailable,
      };
}

/// One option of a check question, in the bank's own order (A to D as stored): the bank's
/// explanations name option letters, so the order is never shuffled.
class CheckOption {
  const CheckOption({required this.index, required this.text, this.isKey = false, this.isPick = false});

  final int index;
  final String text;

  /// Only on an answered row: this is the key (today's key text).
  final bool isKey;

  /// Only on an answered row: this is the option the student chose.
  final bool isPick;

  String get letter => index >= 0 && index < 26 ? String.fromCharCode(65 + index) : '${index + 1}';
}

/// "Of the 41 questions in this chapter, 7 are new to you and can be used for a check."
class CheckPool {
  const CheckPool({required this.unseen, required this.ofChapter});

  static CheckPool? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final unseen = asInt(j['unseen']);
    final total = asInt(j['ofChapter']);
    if (unseen == null || total == null) return null;
    return CheckPool(unseen: unseen, ofChapter: total);
  }

  final int unseen;
  final int ofChapter;
}

/// The question of `GET /api/recovery/check` (status `ready`): no key, no explanation and no marks
/// before the answer.
class CheckQuestion {
  const CheckQuestion({
    required this.checkQuestionId,
    required this.question,
    required this.options,
    this.subject,
    this.chapter,
    this.topic,
    this.format,
    this.basis,
    this.basisLine,
    this.pool,
    this.rule,
  });

  /// A well-formed question has an id, a stem and exactly four options with text. Half a question
  /// is never shown, so anything else is null.
  static CheckQuestion? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final id = _text(j['checkQuestionId']);
    final stem = _text(j['question']);
    final options = <CheckOption>[];
    final raw = j['options'];
    if (raw is List) {
      for (var i = 0; i < raw.length; i++) {
        final o = raw[i];
        if (o is! Map) return null;
        final text = _text(o['text']);
        if (text == null) return null;
        options.add(CheckOption(
          index: asInt(o['index']) ?? i,
          text: text,
          isKey: asBool(o['isKey']) ?? false,
          isPick: asBool(o['isPick']) ?? false,
        ));
      }
    }
    if (id == null || stem == null || options.length != 4) return null;
    return CheckQuestion(
      checkQuestionId: id,
      question: stem,
      options: options,
      subject: _text(j['subject']),
      chapter: _text(j['chapter']),
      topic: _text(j['topic']),
      format: _text(j['format']),
      basis: _text(j['basis']),
      basisLine: _text(j['basisLine']),
      pool: CheckPool.tryParse(j['pool']),
      rule: _text(j['rule']),
    );
  }

  final String checkQuestionId;
  final String question;
  final List<CheckOption> options;
  final String? subject;
  final String? chapter;
  final String? topic;
  final String? format;

  /// `concept`, `topic` or `chapter`: what the question is tied to.
  final String? basis;

  /// "Same topic: Goodwill".
  final String? basisLine;
  final CheckPool? pool;

  /// The repair's rule line, or null.
  final String? rule;
}

/// When the mistake (and a missed check question) come back in Revise.
class CheckRevise {
  const CheckRevise({required this.scheduled, this.nextAt, this.dueDay, this.whenLabel, this.cards});

  static CheckRevise? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final scheduled = asBool(j['scheduled']);
    if (scheduled == null) return null;
    return CheckRevise(
      scheduled: scheduled,
      nextAt: asDate(j['nextAt']),
      dueDay: _text(j['dueDay']),
      whenLabel: _text(j['whenLabel']),
      cards: asInt(j['cards']),
    );
  }

  /// False when Revise could not be written (the table is missing): the screen then says nothing
  /// about Revise, so it never promises a card that does not exist.
  final bool scheduled;
  final DateTime? nextAt;

  /// The India day the card falls due, `2026-10-17`.
  final String? dueDay;

  /// The server's own word for it (`tomorrow`, `today`).
  final String? whenLabel;
  final int? cards;
}

/// The marked answer: the verdict, today's key, the student's pick and the bank's explanation.
class CheckResult {
  const CheckResult({
    required this.right,
    required this.line,
    required this.keyIndex,
    required this.options,
    this.checkQuestionId,
    this.pick,
    this.keyText,
    this.pickedText,
    this.explanation,
    this.ruleLine,
    this.basis,
    this.basisLine,
    this.answeredAt,
    this.revise,
  });

  /// A result the screen can show: a verdict, the key and four rows. Otherwise null.
  static CheckResult? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final right = asBool(j['right']);
    final line = _text(j['line']);
    final key = j['key'] is Map ? asJson(j['key']) : const <String, dynamic>{};
    final keyIndex = asInt(key['index']);
    final rows = <CheckOption>[];
    final raw = j['options'];
    if (raw is List) {
      for (var i = 0; i < raw.length; i++) {
        final o = raw[i];
        if (o is! Map) return null;
        rows.add(CheckOption(
          index: asInt(o['index']) ?? i,
          text: _text(o['text']) ?? 'Option',
          isKey: asBool(o['isKey']) ?? false,
          isPick: asBool(o['isPick']) ?? false,
        ));
      }
    }
    if (right == null || line == null || keyIndex == null || rows.length != 4) return null;
    final picked = j['picked'] is Map ? asJson(j['picked']) : const <String, dynamic>{};
    return CheckResult(
      right: right,
      line: line,
      keyIndex: keyIndex,
      options: rows,
      checkQuestionId: _text(j['checkQuestionId']),
      pick: asInt(j['pick']),
      keyText: _text(key['text']),
      pickedText: _text(picked['text']),
      explanation: _text(j['explanation']),
      ruleLine: _text(j['ruleLine']),
      basis: _text(j['basis']),
      basisLine: _text(j['basisLine']),
      answeredAt: asDate(j['answeredAt']),
      revise: CheckRevise.tryParse(j['revise']),
    );
  }

  /// Right on a new question from the same topic.
  final bool right;

  /// The finished sentence for the verdict, from the server.
  final String line;
  final int keyIndex;
  final List<CheckOption> options;
  final String? checkQuestionId;

  /// The position the student saw (0 to 3).
  final int? pick;
  final String? keyText;
  final String? pickedText;

  /// The bank's explanation, cut at a sentence end; null when the bank has none.
  final String? explanation;

  /// The repair's rule, or null. Shown when the check was missed.
  final String? ruleLine;
  final String? basis;
  final String? basisLine;
  final DateTime? answeredAt;
  final CheckRevise? revise;

  /// The student's own pick: marked on a row, else the `pick` index.
  int? get pickIndex {
    for (final o in options) {
      if (o.isPick) return o.index;
    }
    return pick;
  }
}

/// What `GET /api/recovery/check` answered with a 2xx.
sealed class CheckLoad {
  const CheckLoad();

  /// Null when the body is not a shape this app can show (the screen then offers a retry).
  static CheckLoad? tryParse(Object? body) {
    if (body is! Map) return null;
    final j = asJson(body);
    if (j['ok'] != true) return null;
    switch (asString(j['status'])) {
      case 'ready':
        final q = CheckQuestion.tryParse(j['check']);
        return q == null ? null : CheckReady(q);
      case 'answered':
        final q = CheckQuestion.tryParse(j['check']);
        final r = CheckResult.tryParse(j['result']);
        return q == null || r == null ? null : CheckStored(q, r);
      case 'none':
        return CheckNone(reason: _text(j['reason']), message: _text(j['message']), pool: CheckPool.tryParse(j['pool']));
    }
    return null;
  }
}

class CheckReady extends CheckLoad {
  const CheckReady(this.question);

  final CheckQuestion question;
}

/// The student answered already: the stored result, unchanged.
class CheckStored extends CheckLoad {
  const CheckStored(this.question, this.result);

  final CheckQuestion question;
  final CheckResult result;
}

class CheckNone extends CheckLoad {
  const CheckNone({this.reason, this.message, this.pool});

  final String? reason;
  final String? message;
  final CheckPool? pool;

  bool get canRetry => reason == 'lookup_failed' || reason == 'check_unavailable';
  String get line => message ?? RepairCheckReasons.line(reason);
}

/// `POST /api/recovery/check` answered 200.
class CheckAnswer {
  const CheckAnswer({required this.result, required this.replayed});

  static CheckAnswer? tryParse(Object? body) {
    if (body is! Map) return null;
    final j = asJson(body);
    if (j['ok'] != true || asString(j['status']) != 'answered') return null;
    final result = CheckResult.tryParse(j['result']);
    return result == null ? null : CheckAnswer(result: result, replayed: asBool(j['replayed']) ?? false);
  }

  final CheckResult result;

  /// The answer was already stored: the first answer counts and nothing was written twice.
  final bool replayed;
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}
