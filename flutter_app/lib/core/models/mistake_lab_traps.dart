import 'json_helpers.dart';

/// Mistake Lab v4 slice 4 (spec 4.7 second part, 4.8 and 4.11): the trap named under a wrong
/// option, "Traps you meet" across mocks, "Same mistakes later" in Prove, and Revise.
///
/// The website builds every sentence (`data/trap_atlas.js`, `data/revise.js`) and sends it
/// finished, so the app only lays the words out and the two surfaces cannot drift. Read like the
/// rest of the Lab: unknown fields are ignored, and a part that cannot be read honestly is null,
/// so the screen leaves it out instead of guessing.
///
/// Where each part arrives:
/// - `GET /api/attempts/:id`: `lab.traps` ([LabTraps]) and `lab.prove.later` ([SameMistakesLater])
/// - `GET /api/me/traps`: [TrapsMeet]
/// - `GET /api/me/revise?cap=5|10`: [ReviseRead]
/// - `POST /api/me/revise/answer {questionId, choice}`: [ReviseAnswer]

/// One trap named under the student's own wrong option (`lab.traps.tags[qid]`).
///
/// [source] says where the name comes from: `repair` (a Mistake Repair named it on this option)
/// or `format` (the question's own format makes it). It never claims a cause and never names the
/// student's mind. The server sends no tag for a held or reviewed question, a blank, a key under
/// question, or a repair that disagrees; so a tag in hand is a tag to show.
class TrapTag {
  const TrapTag({
    required this.qid,
    required this.index,
    required this.letter,
    required this.trapType,
    required this.label,
    required this.text,
    required this.source,
    this.detail,
    this.sourceText,
  });

  static const repair = 'repair';
  static const format = 'format';

  static TrapTag? tryParse(String qid, Object? v) {
    if (qid.isEmpty || v is! Map) return null;
    final j = asJson(v);
    final index = asInt(j['index']);
    final text = _text(j['text']);
    final source = asStringOr(j['source'], '');
    if (index == null || index < 0 || text == null || (source != repair && source != format)) return null;
    return TrapTag(
      qid: qid,
      index: index,
      letter: asStringOr(j['letter'], ''),
      trapType: asStringOr(j['trapType'], ''),
      label: _text(j['label']) ?? text,
      text: text,
      source: source,
      detail: _text(j['detail']),
      sourceText: _text(j['sourceText']),
    );
  }

  final String qid;

  /// The option the trap is on, 0-based in this paper's order.
  final int index;

  /// That option's letter ("B"), to check it against the option on screen.
  final String letter;
  final String trapType;

  /// "A look-alike term".
  final String label;

  /// "Trap: a look-alike term".
  final String text;

  /// [repair] or [format].
  final String source;

  /// A format trap's one sentence ("This option matches 2 of the 4 pairs as the key does.").
  final String? detail;

  /// "Named by Mistake Repair" or "From the question format".
  final String? sourceText;
}

/// `lab.traps`: the tags on this paper's wrong answers, by question id.
class LabTraps {
  const LabTraps({required this.tags, this.version = 1});

  static LabTraps? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final tags = <String, TrapTag>{};
    asJson(j['tags']).forEach((qid, t) {
      final tag = TrapTag.tryParse(qid, t);
      if (tag != null) tags[qid] = tag;
    });
    if (tags.isEmpty) return null;
    return LabTraps(version: asInt(j['version']) ?? 1, tags: tags);
  }

  final int version;
  final Map<String, TrapTag> tags;

  /// The tag for question [qid], or null.
  TrapTag? tagFor(String qid) => tags[qid];
}

/// "Traps you meet" (`GET /api/me/traps`): per named trap, how often it caught the student, with
/// the before and since split and the "Falling" or "Still catching you" label only where its gate
/// passes. A row shows from 3 chances.
class TrapsMeet {
  const TrapsMeet({
    required this.state,
    required this.title,
    this.version = 1,
    this.rows = const [],
    this.message,
    this.basis,
    this.fine,
  });

  /// At least one trap has 3 or more chances: [rows].
  static const ready = 'ready';

  /// No trap has 3 chances yet: [message] says how one shows up.
  static const empty = 'empty';

  static TrapsMeet? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final state = asStringOr(j['state'], '');
    final title = _text(j['title']);
    if ((state != ready && state != empty) || title == null) return null;
    final rows = [for (final r in asJsonList(j['rows'])) ?TrapRow.tryParse(r)];
    final message = _text(j['message']);
    if (state == ready && rows.isEmpty) return null;
    if (state == empty && message == null) return null;
    return TrapsMeet(
      version: asInt(j['version']) ?? 1,
      state: state,
      title: title,
      rows: state == ready ? rows : const [],
      message: state == empty ? message : null,
      basis: _text(j['basis']),
      fine: _text(j['fine']),
    );
  }

  final int version;

  /// [ready] or [empty].
  final String state;

  /// "Traps you meet".
  final String title;
  final List<TrapRow> rows;

  /// The sentence shown instead of rows when there are none.
  final String? message;

  /// "A chance is a question you answered where one wrong option carries this trap."
  final String? basis;

  /// How a trap is named and the 3-chance floor.
  final String? fine;

  bool get isReady => state == ready;
}

/// One trap of [TrapsMeet]: "A look-alike term: caught 5 of 10 times."
class TrapRow {
  const TrapRow({
    required this.trapType,
    required this.label,
    required this.caught,
    required this.of,
    required this.text,
    this.periods,
    this.status,
    this.statusLabel,
  });

  static const falling = 'falling';
  static const still = 'still';

  static TrapRow? tryParse(Json j) {
    final text = _text(j['text']);
    final caught = asInt(j['caught']);
    final of = asInt(j['of']);
    if (text == null || caught == null || of == null || of <= 0 || caught < 0 || caught > of) return null;
    final status = asStringOr(j['status'], '');
    final label = _text(j['statusLabel']);
    final known = (status == falling || status == still) && label != null;
    return TrapRow(
      trapType: asStringOr(j['trapType'], ''),
      label: _text(j['label']) ?? text,
      caught: caught,
      of: of,
      text: text,
      periods: TrapPeriods.tryParse(j['periods']),
      // A status without its words would be colour alone: it is left out.
      status: known ? status : null,
      statusLabel: known ? label : null,
    );
  }

  final String trapType;
  final String label;

  /// Times this trap caught the student, of [of] chances.
  final int caught;
  final int of;

  /// "A look-alike term: caught 5 of 10 times."
  final String text;

  /// The before and since split, when each period passes its floor.
  final TrapPeriods? periods;

  /// [falling], [still] or null.
  final String? status;

  /// "Falling" or "Still catching you".
  final String? statusLabel;

  /// Caught as a share of chances, 0 to 1, for the bar (the same two numbers as [text]).
  double get share => of <= 0 ? 0 : (caught / of).clamp(0.0, 1.0);
}

/// "Before 8 Oct: 4 of 5. Since: 1 of 5."
class TrapPeriods {
  const TrapPeriods({required this.date, required this.beforeK, required this.beforeN, required this.sinceK, required this.sinceN, required this.text});

  static TrapPeriods? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final text = _text(j['text']);
    final before = j['before'] is Map ? asJson(j['before']) : null;
    final since = j['since'] is Map ? asJson(j['since']) : null;
    if (text == null || before == null || since == null) return null;
    final bk = asInt(before['k']);
    final bn = asInt(before['n']);
    final sk = asInt(since['k']);
    final sn = asInt(since['n']);
    if (bk == null || bn == null || sk == null || sn == null) return null;
    if (bn <= 0 || sn <= 0 || bk < 0 || sk < 0 || bk > bn || sk > sn) return null;
    return TrapPeriods(date: _text(j['date']) ?? '', beforeK: bk, beforeN: bn, sinceK: sk, sinceN: sn, text: text);
  }

  /// The middle chance's day, "8 Oct".
  final String date;
  final int beforeK;
  final int beforeN;
  final int sinceK;
  final int sinceN;

  /// "Before 8 Oct: 4 of 5. Since: 1 of 5."
  final String text;
}

/// "Same mistakes later" in Prove (`lab.prove.later`): which of this paper's wrong answers come
/// back in Revise, and when, with the one honest difference from Prove's fresh questions.
class SameMistakesLater {
  const SameMistakesLater({
    required this.title,
    required this.count,
    required this.total,
    required this.when,
    required this.line,
    required this.note,
    required this.open,
    this.version = 1,
    this.dueDay,
    this.dayLabel,
    this.fine,
  });

  static const now = 'now';
  static const tomorrow = 'tomorrow';
  static const day = 'day';

  static SameMistakesLater? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    if (asStringOr(j['state'], '') != 'scheduled') return null;
    final title = _text(j['title']);
    final line = _text(j['line']);
    final note = _text(j['note']);
    final open = _text(j['open']);
    final count = asInt(j['count']);
    final total = asInt(j['total']);
    final when = asStringOr(j['when'], '');
    if (title == null || line == null || note == null || open == null) return null;
    if (count == null || total == null || count <= 0 || total < count) return null;
    if (when != now && when != tomorrow && when != day) return null;
    return SameMistakesLater(
      version: asInt(j['version']) ?? 1,
      title: title,
      count: count,
      total: total,
      when: when,
      dueDay: _text(j['dueDay']),
      dayLabel: _text(j['dayLabel']),
      line: line,
      note: note,
      fine: _text(j['fine']),
      open: open,
    );
  }

  final int version;

  /// "Same mistakes later".
  final String title;

  /// Questions that come back on [dueDay] (at most 10, the day's cap).
  final int count;

  /// All this paper's wrong answers that come back at some day.
  final int total;

  /// [now], [tomorrow] or [day].
  final String when;
  final String? dueDay;
  final String? dayLabel;

  /// "7 of these come back tomorrow, Fri 16 Oct."
  final String line;

  /// "Same questions, so this checks memory. Fresh questions check the idea."
  final String note;

  /// Revise's cap, the cost and the accuracy statement.
  final String? fine;

  /// "Open Revise".
  final String open;

  /// Revise has questions for the student today: the button shows.
  bool get ready => when == now;
}

/// The words Revise sends for its own labels. A missing label falls back to contract v1's.
class ReviseLabels {
  const ReviseLabels({
    this.title = 'Revise',
    this.sub = 'Same question, so this checks memory. A check on new questions is separate.',
    this.fine = 'Revise costs no credits. It does not change your record, your chapter numbers or any accuracy.',
    this.boxes = const {
      1: 'back after 1 day',
      2: 'after 3 days',
      3: 'after 7 days',
      4: 'after 21 days',
    },
  });

  factory ReviseLabels.fromJson(Json j) {
    const d = ReviseLabels();
    final boxes = <int, String>{...d.boxes};
    asJson(j['boxes']).forEach((k, v) {
      final n = int.tryParse(k);
      final s = _text(v);
      if (n != null && n >= 1 && n <= 4 && s != null) boxes[n] = s;
    });
    return ReviseLabels(title: _text(j['title']) ?? d.title, sub: _text(j['sub']) ?? d.sub, fine: _text(j['fine']) ?? d.fine, boxes: boxes);
  }

  final String title;
  final String sub;
  final String fine;

  /// Box 1 to 4: "back after 1 day", "after 3 days", "after 7 days", "after 21 days".
  final Map<int, String> boxes;
}

/// `GET /api/me/revise`: today's questions from the student's own wrong answers, the four boxes
/// with their counts, and the finished sentences. The server leaves the key out until an answer.
class ReviseRead {
  const ReviseRead({
    required this.state,
    this.version = 1,
    this.today,
    this.cap = 10,
    this.due = 0,
    this.shown = 0,
    this.answeredToday = 0,
    this.minutes = 0,
    this.boxes = const [0, 0, 0, 0],
    this.cards = 0,
    this.nextDay,
    this.nextDayLabel,
    this.head,
    this.summary,
    this.next,
    this.labels = const ReviseLabels(),
    this.items = const [],
    this.queue,
  });

  static const ready = 'ready';
  static const empty = 'empty';
  static const unavailable = 'unavailable';

  /// The read when the server says Revise cannot be read now (no table yet, or a 503).
  static const notAvailable = ReviseRead(state: unavailable);

  /// Throws [FormatException] for a body that is not a Revise read, so the read counts as failed.
  factory ReviseRead.parse(Object? v) {
    if (v is! Map) throw const FormatException('revise: not an object');
    final j = asJson(v);
    final state = asStringOr(j['state'], '');
    if (state == unavailable) return notAvailable;
    if (state != ready && state != empty) throw const FormatException('revise: unknown state');
    final boxesRaw = j['boxes'] is List ? j['boxes'] as List : const [];
    final boxes = [for (var i = 0; i < 4; i++) i < boxesRaw.length ? (asInt(boxesRaw[i]) ?? 0).clamp(0, 1 << 30) : 0];
    final items = [for (final i in asJsonList(j['items'])) ?ReviseItem.tryParse(i)];
    return ReviseRead(
      queue: j['queue'] is Map ? ReviseQueue.tryParse(asJson(j['queue'])) : null,
      version: asInt(j['version']) ?? 1,
      state: state,
      today: _text(j['today']),
      cap: asInt(j['cap']) ?? 10,
      due: asInt(j['due']) ?? 0,
      shown: asInt(j['shown']) ?? items.length,
      answeredToday: asInt(j['answeredToday']) ?? 0,
      minutes: asInt(j['minutes']) ?? 0,
      boxes: boxes,
      cards: asInt(j['cards']) ?? 0,
      nextDay: _text(j['nextDay']),
      nextDayLabel: _text(j['nextDayLabel']),
      head: _text(j['head']),
      summary: _text(j['summary']),
      next: _text(j['next']),
      labels: ReviseLabels.fromJson(asJson(j['labels'])),
      items: items,
    );
  }

  final int version;

  /// [ready], [empty] (no card yet) or [unavailable].
  final String state;

  /// The student's India day, "2026-10-16".
  final String? today;

  /// Questions a day at most: 5 or 10.
  final int cap;

  /// Cards due today, beyond the cap too.
  final int due;

  /// Questions the student is asked today (at most the cap, less what they answered).
  final int shown;
  final int answeredToday;

  /// About how long [shown] questions take.
  final int minutes;

  /// Active cards per box, 1 to 4.
  final List<int> boxes;

  /// All the student's cards.
  final int cards;
  final String? nextDay;

  /// "Sat 17 Oct".
  final String? nextDayLabel;

  /// "4 questions to revise today" or "Nothing to revise today".
  final String? head;

  /// "4 due today. 7 cards, 2 recalled twice."
  final String? summary;

  /// "The next ones are due on Sat 17 Oct.", or the empty sentence.
  final String? next;
  final ReviseLabels labels;
  final List<ReviseItem> items;

  /// Revise as one queue (LEARN-REVIEW-1017 5.8, `?queue=1`): null from an older server or a plain read.
  final ReviseQueue? queue;

  /// The questions this run plays: the queue's wrong answers and repaired mistakes (deduped by the
  /// server, a question due in both is one `again` card), or the plain list from an older server.
  List<ReviseItem> get runItems {
    final q = queue;
    if (q == null) return items;
    return q.back;
  }

  bool get isUnavailable => state == unavailable;

  /// No card at all: the entry stays out of the way.
  bool get isEmpty => state == empty;
}

/// One question to recall: no key, no explanation until it is answered.
class ReviseItem {
  const ReviseItem({
    required this.questionId,
    required this.question,
    required this.options,
    required this.box,
    this.subject,
    this.chapter,
    this.passage,
    this.kind = kindQuestion,
    this.source,
  });

  /// A wrong answer due again (same question).
  static const kindQuestion = 'question';

  /// A repaired mistake due again (same question, key hidden).
  static const kindAgain = 'again';

  static ReviseItem? tryParse(Json j) {
    final id = asStringOr(j['questionId'], '');
    final question = _text(j['question']);
    final options = [for (final o in j['options'] is List ? j['options'] as List : const []) if (_text(o) != null) _text(o)!];
    if (id.isEmpty || question == null || options.length < 2) return null;
    final passage = j['passage'] is Map ? _text(asJson(j['passage'])['text']) : null;
    return ReviseItem(
      questionId: id,
      question: question,
      options: options,
      box: (asInt(j['box']) ?? 1).clamp(1, 4),
      subject: _text(j['subject']),
      chapter: _text(j['chapter']),
      passage: passage,
      kind: asStringOr(j['kind'], kindQuestion) == kindAgain ? kindAgain : kindQuestion,
      source: _text(j['source']),
    );
  }

  /// [kindQuestion] or [kindAgain].
  final String kind;

  /// Where the wrong answer came from, finished by the server ("Mock 2, 12 Oct, 10:42 PM").
  final String? source;

  final String questionId;
  final String? subject;
  final String? chapter;
  final String question;
  final String? passage;
  final List<String> options;

  /// The box the card is in now, 1 to 4.
  final int box;
}

/// The merged Revise queue (`GET /api/me/revise?queue=1`, the website's `reviseQueue.js`): the
/// questions back (wrong answers and repaired mistakes), the pending Check it held and the lesson
/// cards due, deduped by question and capped by the server.
class ReviseQueue {
  const ReviseQueue({this.back = const [], this.counts = const ReviseQueueCounts(), this.total = 0, this.minutes = 0, this.checkNumbers = const []});

  static ReviseQueue? tryParse(Json j) {
    final raw = asJsonList(j['items']);
    final back = <ReviseItem>[];
    final checks = <int>[];
    for (final i in raw) {
      final kind = asStringOr(i['kind'], '');
      if (kind == ReviseItem.kindQuestion || kind == ReviseItem.kindAgain) {
        final item = ReviseItem.tryParse(i);
        if (item != null) back.add(item);
      } else if (kind == 'check') {
        checks.add(asInt(i['number']) ?? 0);
      }
    }
    final c = asJson(j['counts']);
    return ReviseQueue(
      back: back,
      counts: ReviseQueueCounts(
        back: back.length,
        again: back.where((i) => i.kind == ReviseItem.kindAgain).length,
        checks: asInt(c['checks']) ?? checks.length,
        cards: (asInt(c['cards']) ?? 0).clamp(0, 5),
      ),
      total: asInt(j['total']) ?? raw.length,
      minutes: asInt(j['minutes']) ?? 0,
      checkNumbers: checks,
    );
  }

  /// The questions back, in play order.
  final List<ReviseItem> back;
  final ReviseQueueCounts counts;

  /// Everything due today across the four sources (the head's number).
  final int total;
  final int minutes;

  /// The question numbers of the pending checks (0 when the server did not name one).
  final List<int> checkNumbers;
}

class ReviseQueueCounts {
  const ReviseQueueCounts({this.back = 0, this.again = 0, this.checks = 0, this.cards = 0});

  final int back;
  final int again;
  final int checks;
  final int cards;
}

/// The server's grade of one recall (`POST /api/me/revise/answer`).
class ReviseAnswer {
  const ReviseAnswer({
    required this.correct,
    required this.keyIndex,
    required this.outcome,
    required this.box,
    required this.retired,
    required this.line,
    this.explanation,
    this.dueDay,
    this.dueLabel,
  });

  static const right = 'right';
  static const wrong = 'wrong';
  static const done = 'done';

  /// Null for a body that is not a confirmed grade: nothing says it was saved.
  static ReviseAnswer? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    if (asBool(j['ok']) != true) return null;
    final correct = asBool(j['correct']);
    final keyIndex = asInt(j['keyIndex']);
    final outcome = asStringOr(j['outcome'], '');
    final line = _text(j['line']);
    final box = asInt(j['box']);
    if (correct == null || keyIndex == null || keyIndex < 0 || line == null || box == null) return null;
    if (outcome != right && outcome != wrong && outcome != done) return null;
    return ReviseAnswer(
      correct: correct,
      keyIndex: keyIndex,
      outcome: outcome,
      box: box.clamp(1, 4),
      retired: asBool(j['retired']) ?? outcome == done,
      line: line,
      explanation: _text(j['explanation']),
      dueDay: _text(j['dueDay']),
      dueLabel: _text(j['dueLabel']),
    );
  }

  final bool correct;

  /// The right option, an index into the options the question was sent with.
  final int keyIndex;

  /// [right], [wrong] or [done] (right in the last box: the card is finished).
  final String outcome;

  /// The box the card is in now.
  final int box;
  final bool retired;

  /// "Right. It comes back in 3 days."
  final String line;

  /// The stored explanation (never a model call), or null.
  final String? explanation;
  final String? dueDay;
  final String? dueLabel;
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}
