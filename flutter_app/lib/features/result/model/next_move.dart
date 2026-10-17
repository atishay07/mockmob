// The result screen's first two layers (docs/design-decisions/pass-1017/RESULT-1017.md 4.2 to 4.4, packet A1): what
// happened in one glance (the receipt, the costliest chapter) and the one next move, chosen by stated rules.
//
// A port of the website's `data/result_next_move.mjs` (packet S1). Both are tested against the same fixtures
// (`test/fixtures/result_next_move/*.json`), so the two platforms never disagree about what a student does next.
// Pure: no Flutter, no providers. Every number comes from the attempt's rows, the server's repair order, the key
// checks or the wallet; an unknown balance has no number.

import '../../../core/copy/formatters.dart' show formatTime12;
import '../copy.dart' show ResultCopy;

/// The rules' constants, the same as the website's `NEXT_MOVE_RULES`.
abstract final class NextMoveRules {
  /// A wrong answer costs 6: the 5 not won plus the 1 taken off.
  static const gapWrong = 6;
  static const gapBlank = 5;

  /// A chapter with under 15 percent right leads its detail with the right count ("1 right of 10: ...").
  static const fewRight = 0.15;

  /// Under 40 percent of answered questions right: a chapter set before single repairs.
  static const weakShare = 0.4;

  /// "Practise 10 on {chapter}".
  static const setSize = 10;

  /// Practice credits for a 10-question Quick practice.
  static const practiceCost = 10;

  /// With 5 or fewer left, the time for all of them is said.
  static const fewRepairs = 5;

  /// 11 PM to 5 AM: one plain line in the panel, never a figure.
  static const lateFrom = 23;
  static const lateUntil = 5;
}

/// How a question went. `skipped` is a blank (the web's word, kept so the fixtures read the same).
enum RowVerdict { correct, wrong, skipped }

/// One question of the paper as the rules read it.
class MoveRow {
  const MoveRow({required this.qid, required this.number, required this.verdict, this.chapter, this.givenIndex});

  final String qid;

  /// 1-based paper position.
  final int number;
  final String? chapter;
  final RowVerdict verdict;
  final int? givenIndex;

  factory MoveRow.fromJson(Map<String, dynamic> j) => MoveRow(
    qid: j['qid'] as String,
    number: j['number'] as int,
    chapter: j['chapter'] as String?,
    verdict: switch (j['verdict']) {
      'correct' => RowVerdict.correct,
      'wrong' => RowVerdict.wrong,
      _ => RowVerdict.skipped,
    },
    givenIndex: j['givenIndex'] as int?,
  );
}

/// The paper's marks, +5 and -1.
class MoveMarks {
  const MoveMarks({required this.right, required this.wrong, required this.blank});

  final int right;
  final int wrong;
  final int blank;

  int get questions => right + wrong + blank;
  int get max => questions * 5;
  int get scored => right * 5 - wrong;
  int get gap => max - scored;
  int get gapWrong => wrong * NextMoveRules.gapWrong;
  int get gapBlank => blank * NextMoveRules.gapBlank;
  int get answered => right + wrong;
}

/// The rows, their marks and the wrong answers that name a pick (the website's `analysisFromRows`).
class MoveAnalysis {
  MoveAnalysis(this.rows)
    : marks = MoveMarks(
        right: rows.where((r) => r.verdict == RowVerdict.correct).length,
        wrong: rows.where((r) => r.verdict == RowVerdict.wrong).length,
        blank: rows.where((r) => r.verdict == RowVerdict.skipped).length,
      );

  final List<MoveRow> rows;
  final MoveMarks marks;

  /// Wrong answers with a recorded pick, in paper order.
  List<MoveRow> get mistakes => [
    for (final r in rows)
      if (r.verdict == RowVerdict.wrong && r.givenIndex != null) r,
  ];
}

/// One item of the server's repair order (`lab.repairOrder.items`).
class MoveOrderItem {
  const MoveOrderItem({required this.qid, required this.reason, this.line});

  final String qid;

  /// `most_right`, `common_trap` or `paper`.
  final String reason;

  /// "18 of 22 other students got it right."
  final String? line;
}

/// The server's repair order. [cohort] when at least one item is led by what other students answered.
class MoveOrder {
  const MoveOrder({required this.cohort, required this.items});

  final bool cohort;
  final List<MoveOrderItem> items;

  List<String> get qids => [for (final i in items) i.qid];
}

/// The chapter that cost the most, with its counts.
class ChapterCost {
  ChapterCost(this.chapter, this.firstAt);

  final String chapter;
  final int firstAt;
  int n = 0;
  int right = 0;
  int wrong = 0;
  int blank = 0;
  int marks = 0;
}

/// Layer 1's finding: "Share Capital cost 29 of the 122 marks you missed." and its detail line.
class CostliestLine {
  const CostliestLine({required this.line, this.detail, this.chapter});

  final String line;
  final String? detail;
  final String? chapter;
}

enum MoveKind { harder, practise, repair, check }

enum AltKind { repair, practise, paper, credits }

/// The quieter way out under the panel: one text action.
class MoveAlt {
  const MoveAlt({required this.kind, required this.label, this.detail, this.qid, this.number, this.chapter});

  final AltKind kind;
  final String label;

  /// One line under the link on what it gives and costs, said before it is tapped (a repair offered
  /// beside a chapter set). Not part of the cross-platform fixtures; null when the label says it all.
  final String? detail;
  final String? qid;
  final int? number;
  final String? chapter;
}

/// The one next move (RESULT-1017 4.3).
class ResultMove {
  const ResultMove({
    required this.kind,
    required this.rule,
    required this.label,
    required this.why,
    this.value,
    this.cost,
    this.late,
    this.alt,
    this.note,
    this.qid,
    this.number,
    this.chapter,
  });

  final MoveKind kind;

  /// Which row of the table chose it (1 to 5).
  final int rule;

  /// The volt key: "Repair Q42".
  final String label;

  /// One line on why: "Share Capital. You picked D. 18 of 22 other students got it right."
  final String why;

  /// What a repair gives, before paying. Repair only.
  final String? value;

  /// The cost and the balance: "1 AI credit. You have 68. No charge if the repair cannot be written."
  final String? cost;

  /// "It is late. One repair is enough for tonight." from 11 PM to 5 AM.
  final String? late;
  final MoveAlt? alt;

  /// "All 4 repairs take about 15 minutes."
  final String? note;

  /// The mistake a repair or a check opens.
  final String? qid;
  final int? number;

  /// The chapter a practise move opens (null: the whole subject).
  final String? chapter;
}

const _held = {'withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected'};
const _letters = 'ABCDEFGH';

String _plural(int n, String word) => '$n $word${n == 1 ? '' : 's'}';

bool _isHeld(Map<String, String> reviews, String qid) => _held.contains(reviews[qid]);

/// "full mock", "NTA paper", "practice".
String paperKind(String? mode) => switch (mode) {
  'full' => 'full mock',
  'nta' => 'NTA paper',
  'smart' => 'smart practice',
  _ => 'practice',
};

/// "46m 36s", "2m 05s", "48s". Null for no time.
String? shortDuration(Duration? d) {
  if (d == null || d.inMilliseconds <= 0) return null;
  final s = (d.inMilliseconds / 1000).round();
  return s < 60 ? '${s}s' : '${s ~/ 60}m ${(s % 60).toString().padLeft(2, '0')}s';
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// The one receipt: "Accountancy full mock. Recorded 9:41 PM, 46m 36s." A paper from another day names the day:
/// "Recorded 14 Oct, 9:41 PM". No duration when the record has none. [at] and [now] are local times.
String receiptLine({required String subjectName, String? mode, DateTime? at, Duration? duration, required DateTime now}) {
  final head = [if (subjectName.isNotEmpty) subjectName, paperKind(mode)].join(' ');
  String? when;
  if (at != null) {
    final sameDay = at.year == now.year && at.month == now.month && at.day == now.day;
    when = 'Recorded ${sameDay ? '' : '${at.day} ${_months[at.month - 1]}, '}${formatTime12(at)}';
  }
  final tail = [?when, ?shortDuration(duration)].join(', ');
  final first = head.isEmpty ? '' : '${head[0].toUpperCase()}${head.substring(1)}.';
  return [if (first.isNotEmpty) first, if (tail.isNotEmpty) '$tail.'].join(' ');
}

/// The chapter that cost the most marks (6 per wrong, 5 per blank), leaving out questions whose key is held or
/// corrected. Ties: more wrong answers first, then the chapter that comes earlier in the paper. Null when nothing
/// was missed or the rows have no chapter.
ChapterCost? costliest(MoveAnalysis a, {Map<String, String> reviews = const {}}) {
  final by = <String, ChapterCost>{};
  for (var i = 0; i < a.rows.length; i++) {
    final r = a.rows[i];
    final chapter = r.chapter;
    if (chapter == null || chapter.isEmpty) continue;
    final c = by.putIfAbsent(chapter, () => ChapterCost(chapter, i));
    c.n++;
    if (_isHeld(reviews, r.qid)) continue;
    switch (r.verdict) {
      case RowVerdict.correct:
        c.right++;
      case RowVerdict.wrong:
        c.wrong++;
        c.marks += NextMoveRules.gapWrong;
      case RowVerdict.skipped:
        c.blank++;
        c.marks += NextMoveRules.gapBlank;
    }
  }
  final list = [
    for (final c in by.values)
      if (c.marks > 0) c,
  ]..sort((x, y) {
      final m = y.marks.compareTo(x.marks);
      if (m != 0) return m;
      final w = y.wrong.compareTo(x.wrong);
      return w != 0 ? w : x.firstAt.compareTo(y.firstAt);
    });
  return list.isEmpty ? null : list.first;
}

/// "Share Capital cost 29 of the 122 marks you missed." / "4 wrong and 1 left blank, of 6 questions." Nothing
/// missed: "Every question right." Without chapter data: the marks split.
CostliestLine costliestLine(MoveAnalysis a, {Map<String, String> reviews = const {}}) {
  final m = a.marks;
  if (m.gap == 0) return const CostliestLine(line: 'Every question right.');
  if (m.answered == 0) return CostliestLine(line: 'All ${m.blank} were left blank: ${m.gapBlank} marks not earned.');
  final c = costliest(a, reviews: reviews);
  // A negative score makes the marks missed exceed the paper ("51 of 50"). Then the line says what was lost
  // and the chapter's own counts follow, never a figure bigger than the paper.
  if (m.scored < 0) {
    final lost = ResultCopy.negativeLoss(m.wrong, m.blank);
    return CostliestLine(
      line: lost,
      detail: c == null ? null : ResultCopy.negativeChapterDetail(c.chapter, c.n, c.wrong, c.blank, c.marks),
      chapter: c?.chapter,
    );
  }
  if (c == null) {
    if (m.wrong > 0 && m.gapWrong >= m.gapBlank) {
      return CostliestLine(line: '${_plural(m.wrong, 'wrong answer')} cost ${m.gapWrong} of the ${m.gap} marks you missed.');
    }
    return CostliestLine(line: '${_plural(m.blank, 'blank')} left ${m.gapBlank} marks unearned.');
  }
  final parts = [if (c.wrong > 0) '${c.wrong} wrong', if (c.blank > 0) '${c.blank} left blank'].join(' and ');
  final detail = c.n > 0 && c.right / c.n < NextMoveRules.fewRight ? '${c.right} right of ${c.n}: $parts.' : '$parts, of ${_plural(c.n, 'question')}.';
  return CostliestLine(line: '${c.chapter} cost ${c.marks} of the ${m.gap} marks you missed.', detail: detail, chapter: c.chapter);
}

/// Rows in repair order (the order's qids first, in its order), then paper order.
List<MoveRow> inRepairOrder(List<MoveRow> rows, MoveOrder? order) {
  final qids = order?.qids ?? const <String>[];
  if (qids.isEmpty) return rows;
  final rank = {for (var i = 0; i < qids.length; i++) qids[i]: i};
  final indexed = [for (var i = 0; i < rows.length; i++) (rows[i], i)];
  indexed.sort((x, y) {
    final a = rank[x.$1.qid] ?? 1 << 30;
    final b = rank[y.$1.qid] ?? 1 << 30;
    return a != b ? a.compareTo(b) : x.$2.compareTo(y.$2);
  });
  return [for (final e in indexed) e.$1];
}

/// The wrong answers repair can open, in repair order: not held, not repaired yet.
List<MoveRow> openMistakes(MoveAnalysis a, {Map<String, String> reviews = const {}, MoveOrder? order, Set<String> repaired = const {}}) =>
    inRepairOrder([
      for (final r in a.mistakes)
        if (!_isHeld(reviews, r.qid) && !repaired.contains(r.qid)) r,
    ], order);

/// "18 of 22 other students got it right." for a mistake the cohort leads, else null.
String? cohortLine(MoveOrder? order, String qid) {
  if (order == null || !order.cohort) return null;
  for (final i in order.items) {
    if (i.qid == qid) return i.reason != 'paper' ? i.line : null;
  }
  return null;
}

/// Three minutes a mistake, rounded up to five.
int? allRepairMinutes(int count) => count > 0 ? ((count * 3 + 4) ~/ 5) * 5 : null;

/// "It is late. One repair is enough for tonight." from 11 PM to 5 AM, else null.
String? lateLine(int? hour) {
  if (hour == null) return null;
  return hour >= NextMoveRules.lateFrom || hour < NextMoveRules.lateUntil ? 'It is late. One repair is enough for tonight.' : null;
}

/// The value line's lead, so a screen can set the four parts in ink: "A repair gives you ".
const repairValueLead = 'A repair gives you ';

/// "A repair gives you why D looked right, the trap, one rule to keep, and a new question to check it held." Without
/// a check ready the last clause goes, so it never promises what will not come.
String repairValueLine(String? letter, {bool checkReady = true}) {
  final pick = letter ?? 'your answer';
  return checkReady
      ? '${repairValueLead}why $pick looked right, the trap, one rule to keep, and a new question to check it held.'
      : '${repairValueLead}why $pick looked right, the trap, and one rule to keep.';
}

/// What the repair offered beside a chapter set gives: "It gives you why C looked right, the trap and one rule to
/// keep. You have 9." The link already says "1 AI credit", so the line carries the value and the balance.
String repairAltDetail(String? letter, int? aiCredits) =>
    ['It gives you why ${letter ?? 'your answer'} looked right, the trap and one rule to keep.', ?haveLine(aiCredits)].join(' ');

/// "You have 68." or null when the balance is unknown (never "You have 0" for unknown).
String? haveLine(int? balance) => balance == null ? null : 'You have $balance.';

/// "1 AI credit. You have 68. No charge if the repair cannot be written."
String repairCostLine(int? aiCredits) => ['1 AI credit.', ?haveLine(aiCredits), 'No charge if the repair cannot be written.'].join(' ');

/// The cost of a 10-question chapter set: Pro covers it; otherwise practice credits and the balance.
String practiceCostLine({bool isPremium = false, int? practiceCredits}) {
  if (isPremium) return 'Pro covers this set.';
  return ['This set uses ${NextMoveRules.practiceCost} practice credits.', ?haveLine(practiceCredits)].join(' ');
}

/// The one next move, first rule that applies:
///   1 nothing missed: a harder paper
///   2 under 40% of answered right, or nothing answered: practise the costliest chapter
///   3 a wrong answer can be repaired and AI credits are 1 or more, or unknown: repair the first in repair order
///     (inside the costliest chapter when one is there)
///   4 every wrong answer repaired, a check not taken: check it held (free)
///   5 otherwise (0 AI credits, keys held, only blanks, all done): practise the costliest chapter
///
/// [checks] holds the checks the server has marked (`qid` to true for right, false for wrong).
ResultMove nextMove({
  required MoveAnalysis analysis,
  Map<String, String> reviews = const {},
  MoveOrder? order,
  Set<String> repaired = const {},
  Map<String, bool> checks = const {},
  int? aiCredits,
  int? practiceCredits,
  bool isPremium = false,
  String? mode,
  String subjectName = '',
  bool labReady = true,
  int? hour,
}) {
  final m = analysis.marks;
  final subject = subjectName.isEmpty ? 'this subject' : subjectName;
  final top = costliest(analysis, reviews: reviews);
  final open = openMistakes(analysis, reviews: reviews, order: order, repaired: repaired);
  final noAi = aiCredits != null && aiCredits < 1;
  final repairable = open.isNotEmpty && !noAi;
  MoveRow pickRepair() {
    if (top != null) {
      for (final r in open) {
        if (r.chapter == top.chapter) return r;
      }
    }
    return open.first;
  }

  ResultMove practise(int rule, String why) {
    final chapter = m.answered == 0 ? null : top?.chapter;
    final first = repairable ? pickRepair() : null;
    final given = first?.givenIndex;
    final firstLetter = given != null && given >= 0 && given < _letters.length ? _letters[given] : null;
    final MoveAlt? alt = first != null
        ? MoveAlt(
            kind: AltKind.repair,
            label: 'Or repair Q${first.number} first, 1 AI credit',
            detail: repairAltDetail(firstLetter, aiCredits),
            qid: first.qid,
            number: first.number,
            chapter: first.chapter,
          )
        : noAi && open.isNotEmpty
        ? const MoveAlt(kind: AltKind.credits, label: 'See your AI credits')
        : null;
    return ResultMove(
      kind: MoveKind.practise,
      rule: rule,
      label: chapter != null ? 'Practise ${NextMoveRules.setSize} on $chapter' : 'Practise ${NextMoveRules.setSize} in $subject',
      why: why,
      cost: practiceCostLine(isPremium: isPremium, practiceCredits: practiceCredits),
      alt: alt,
      chapter: chapter,
    );
  }

  // 1. Nothing missed.
  if (m.gap == 0) {
    final mock = mode == 'full' || mode == 'nta';
    return ResultMove(
      kind: MoveKind.harder,
      rule: 1,
      label: mock ? 'Set up a harder full mock' : 'Practise ${NextMoveRules.setSize} harder in $subject',
      why: 'Every question right. A harder paper finds what is left.',
      alt: const MoveAlt(kind: AltKind.paper, label: 'Take another fresh paper'),
    );
  }

  // 2. A weak paper: a chapter set before single repairs.
  if (m.answered == 0 || m.right / m.answered < NextMoveRules.weakShare) {
    final String why;
    if (m.answered == 0) {
      why = 'Nothing was answered on this paper, so a short set in $subject comes first.';
    } else if (top != null && top.wrong > top.right) {
      why = '${top.chapter}: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes.';
    } else if (top != null) {
      why = '${top.chapter} cost the most marks, so a chapter set comes before repairing single mistakes.';
    } else {
      why = 'Most answers on this paper were wrong, so a short set comes before repairing single mistakes.';
    }
    return practise(2, why);
  }

  // 3. Repair the first mistake in repair order.
  if (repairable) {
    final r = pickRepair();
    final given = r.givenIndex;
    final letter = given != null && given >= 0 && given < _letters.length ? _letters[given] : null;
    final cohort = cohortLine(order, r.qid);
    final left = open.length;
    return ResultMove(
      kind: MoveKind.repair,
      rule: 3,
      label: 'Repair Q${r.number}',
      why: [if (r.chapter != null) '${r.chapter}.', if (letter != null) 'You picked $letter.', ?cohort].join(' '),
      value: repairValueLine(letter, checkReady: labReady),
      cost: repairCostLine(aiCredits),
      late: lateLine(hour),
      alt: top == null
          ? null
          : MoveAlt(kind: AltKind.practise, label: 'Practise ${NextMoveRules.setSize} on ${top.chapter} instead', chapter: top.chapter),
      note: left <= NextMoveRules.fewRepairs && left > 1 ? '${left == 2 ? 'Both' : 'All $left'} repairs take about ${allRepairMinutes(left)} minutes.' : null,
      qid: r.qid,
      number: r.number,
      chapter: r.chapter,
    );
  }

  // 4. Every wrong answer repaired; a check not taken yet.
  final mistakes = inRepairOrder([
    for (final r in analysis.mistakes)
      if (!_isHeld(reviews, r.qid)) r,
  ], order);
  final done = [
    for (final r in mistakes)
      if (repaired.contains(r.qid)) r,
  ];
  MoveRow? unchecked;
  for (final r in done) {
    if (!checks.containsKey(r.qid)) {
      unchecked = r;
      break;
    }
  }
  if (mistakes.isNotEmpty && done.length == mistakes.length && unchecked != null) {
    return ResultMove(
      kind: MoveKind.check,
      rule: 4,
      label: 'Check Q${unchecked.number} held',
      why: 'You repaired ${done.length} of ${mistakes.length}. One new question each shows whether the fix held.',
      cost: 'No extra credit.',
      late: lateLine(hour),
      qid: unchecked.qid,
      number: unchecked.number,
      chapter: unchecked.chapter,
    );
  }

  // 5. Practise the costliest chapter.
  final String why;
  if (noAi && open.isNotEmpty) {
    why = 'Repairs use AI credits. ${haveLine(0)}';
  } else if (mistakes.isNotEmpty && done.length == mistakes.length) {
    why = 'Every mistake on this paper is repaired. A set on ${top?.chapter ?? subject} keeps it.';
  } else if (top != null) {
    why = '${top.chapter} cost the most marks on this paper.';
  } else {
    why = 'A short set in $subject comes next.';
  }
  return practise(5, why);
}

/// The mistakes head: "Your 12 mistakes" with "−72 marks", or "3 of 12 repaired" once any are.
({String title, String? side}) mistakesHead({required int count, int repairedCount = 0}) {
  if (count == 0) return (title: 'No mistakes to repair', side: null);
  return (
    title: 'Your ${_plural(count, 'mistake')}',
    side: repairedCount > 0 ? '$repairedCount of $count repaired' : '−${count * NextMoveRules.gapWrong} marks',
  );
}
