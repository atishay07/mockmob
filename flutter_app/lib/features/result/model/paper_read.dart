import 'dart:math' as math;

import '../../../core/models/models.dart' show Attempt;
import '../widgets/finish_reveal.dart' show FinishChapter, finishChaptersOf;
import 'next_move.dart';

/// The read of one paper after its finish moment (20 Oct, owner: "it doesn't do the SWOT analysis, it is very basic"):
/// Mobi's debrief, free and written on the phone (no model call). What went well, where the marks leaked (chapters
/// ranked with ties shared, I14), the marks within reach as this paper's own arithmetic with one key that opens the
/// repair of exactly those answers, and what to watch. Built only from this result's own numbers: the verdicts, the
/// chapters, the time per question and the answer changes when the phone recorded them, and the student's earlier
/// papers in the subject when the history has them. A line whose numbers are not there is left out, so a 5-question
/// set gets a lighter read than a full paper.
class PaperRead {
  const PaperRead({
    required this.strengths,
    required this.leakChapters,
    required this.leaks,
    required this.reach,
    required this.reachNote,
    required this.risks,
    this.fixQids = const [],
    this.fixChapter,
  });

  /// Strengths: none to three lines (none when nothing was right: a strength is never made up).
  final List<String> strengths;

  /// Weaknesses: the chapters that lost marks, ranked with ties shared (I14).
  final List<FinishChapter> leakChapters;

  /// Weaknesses said in words (changed answers that cost marks; a paper with no chapters).
  final List<String> leaks;

  /// Opportunity: the marks within reach, as arithmetic on this paper ("Fix the 2 wrong answers in Goodwill and this
  /// paper is 45, not 33.").
  final String reach;

  /// What one fix is worth, under [reach]; null when there is nothing to fix or the paper is short.
  final String? reachNote;

  /// Threats: rushed wrong answers, more wrong than right, a chapter slipping against earlier papers, the end of the
  /// paper left blank, one question that ate the clock. Empty when the numbers show none.
  final List<String> risks;

  /// The wrong answers [reach] names, in paper order: "Fix these" repairs exactly these. Empty when [reach] is not
  /// about wrong answers.
  final List<String> fixQids;

  /// The chapter [fixQids] are in, when they are one chapter's.
  final String? fixChapter;

  /// Lines in all (the debrief's length follows the paper's size).
  int get lineCount => strengths.length + leaks.length + risks.length + 1 + (leakChapters.isEmpty ? 0 : 1);
}

/// Wrong answers picked faster than this are "rushed" (the practice analysis' own quick-pick line).
const int readQuickMs = 20000;

/// Right answers inside this were "quick and sure".
const int readSureMs = 30000;

/// A chapter's record in the student's earlier papers of the subject: questions seen and answered right.
typedef ChapterRecord = ({int n, int right});

/// Builds the read. [dwellMs] is the time per question by qid (empty when the phone did not record it); [changes] is
/// each changed answer's effect on the marks (+6 for wrong to right, -6 for right to wrong, and so on); [previousShare]
/// is the share right in the last paper of the same subject, when the history has one, and [subject] its name;
/// [history] is each chapter's record across the earlier papers of the subject (empty without history).
PaperRead paperReadOf(
  MoveAnalysis a, {
  Map<String, String> reviews = const {},
  Map<String, int> dwellMs = const {},
  List<int> changes = const [],
  double? previousShare,
  String? subject,
  Map<String, ChapterRecord> history = const {},
}) {
  final m = a.marks;
  // A short set gets one line a block; a full paper up to three.
  final cap = m.questions < 8 ? 1 : (m.questions < 30 ? 2 : 3);
  final ranked = rankedChapterCosts(a, reviews: reviews);
  final chapters = finishChaptersOf(ranked);
  final share = m.questions == 0 ? 0.0 : m.right / m.questions;

  // ---- Strengths ------------------------------------------------------------------------------------------------
  final strengths = <String>[];
  final byChapter = <String, ChapterRecord>{};
  for (final r in a.rows) {
    final c = r.chapter;
    if (c == null || c.isEmpty) continue;
    final was = byChapter[c] ?? (n: 0, right: 0);
    byChapter[c] = (n: was.n + 1, right: was.right + (r.verdict == RowVerdict.correct ? 1 : 0));
  }
  final clean = [
    for (final e in byChapter.entries)
      if (e.value.n >= 2 && e.value.right == e.value.n) e.key,
  ];
  if (m.right == m.questions && m.questions > 0) {
    strengths.add(PaperReadCopy.allRight(m.questions));
  } else if (clean.isNotEmpty && byChapter.length > 1) {
    strengths.add(PaperReadCopy.cleanChapters(clean, [for (final c in clean) byChapter[c]!.n]));
  } else {
    // The chapter with the best share right, at least 2 right and 60% (never one of the chapters that lost the most).
    final worst = chapters.where((c) => c.rank == 1).map((c) => c.name).toSet();
    final best = byChapter.entries.where((e) => e.value.right >= 2 && e.value.right / e.value.n >= 0.6 && !worst.contains(e.key)).toList()
      ..sort((x, y) => (y.value.right / y.value.n).compareTo(x.value.right / x.value.n));
    if (best.isNotEmpty && byChapter.length > 1) {
      strengths.add(PaperReadCopy.bestChapter(best.first.key, best.first.value.right, best.first.value.n));
    }
  }
  final sure = [
    for (final r in a.rows)
      if (r.verdict == RowVerdict.correct && (dwellMs[r.qid] ?? readSureMs) < readSureMs) r,
  ];
  if (sure.length >= 2 && strengths.length < cap) strengths.add(PaperReadCopy.quickAndSure(sure.length));
  final helped = changes.where((c) => c > 0).toList();
  if (helped.isNotEmpty && strengths.length < cap) strengths.add(PaperReadCopy.changesHelped(helped.length, helped.fold(0, (s, c) => s + c)));
  if (previousShare != null && subject != null && share >= previousShare + 0.1 && strengths.length < cap) {
    strengths.add(PaperReadCopy.upFrom(previousShare, share, subject));
  }
  // Never a strength made up to fill the block: with nothing right, there is none, and the block is left out.
  if (strengths.isEmpty && m.right > 0) strengths.add(PaperReadCopy.banked(m.right));

  // ---- Weaknesses -----------------------------------------------------------------------------------------------
  final leaks = <String>[];
  final hurt = changes.where((c) => c < 0).toList();
  if (hurt.isNotEmpty) leaks.add(PaperReadCopy.changesCost(hurt.length, -hurt.fold(0, (s, c) => s + c)));
  // One chapter (a chapter set) has no ranking to show: its loss is said in words.
  if (chapters.length < 2 && m.gap > 0) leaks.add(PaperReadCopy.lostPlain(m.wrong, m.blank, chapter: chapters.firstOrNull?.name));
  if (m.gap == 0) leaks.add(PaperReadCopy.nothingLost);

  // ---- Opportunity ----------------------------------------------------------------------------------------------
  // The reach is what one "Fix these" repairs: the wrong answers of one chapter (a repair run is one chapter's), the
  // chapter with the most wrong answers (the costlier, then the first in paper order, when tied), else every wrong
  // answer.
  String reach;
  String? reachNote;
  var fixQids = <String>[];
  String? fixChapter;
  if (m.wrong > 0) {
    FinishChapter? target;
    for (final c in chapters) {
      if (c.wrong > (target?.wrong ?? 0)) target = c;
    }
    final rows = [
      for (final r in a.rows)
        if (r.verdict == RowVerdict.wrong && (target == null || r.chapter == target.name) && !isKeyHeld(reviews, r.qid)) r,
    ];
    fixQids = [for (final r in rows) r.qid];
    fixChapter = target?.name;
    final w = rows.isEmpty ? m.wrong : rows.length;
    reach = PaperReadCopy.reachWrong(w, m.scored, m.scored + 6 * w, chapter: fixChapter, all: w == m.wrong);
    reachNote = w < m.wrong ? PaperReadCopy.reachEvery(m.wrong, m.scored + 6 * m.wrong) : PaperReadCopy.sixEach;
  } else if (m.blank > 0) {
    reach = PaperReadCopy.reachBlank(m.blank, m.scored, m.scored + 5 * m.blank);
    reachNote = PaperReadCopy.fiveEach;
  } else {
    reach = PaperReadCopy.reachAll(m.max);
  }

  // ---- Threats --------------------------------------------------------------------------------------------------
  final risks = <String>[];
  final rushed = [
    for (final r in a.rows)
      if (r.verdict == RowVerdict.wrong && (dwellMs[r.qid] ?? readQuickMs) < readQuickMs) r,
  ];
  if (rushed.isNotEmpty) risks.add(PaperReadCopy.rushed(rushed.length));
  // A chapter that lost marks today and was answered better before: at least 3 earlier questions and 2 today, and a
  // drop of a quarter or more in the share right.
  if (risks.length < cap) {
    for (final c in chapters) {
      final before = history[c.name];
      final now = byChapter[c.name];
      if (before == null || now == null || before.n < 3 || now.n < 2) continue;
      if (now.right / now.n <= before.right / before.n - 0.25) {
        risks.add(PaperReadCopy.slipping(c.name, before.right, before.n, now.right, now.n));
        break;
      }
    }
  }
  if (previousShare != null && subject != null && share <= previousShare - 0.1 && risks.length < cap) {
    risks.add(PaperReadCopy.downFrom(previousShare, share, subject));
  }
  if (m.wrong > m.right && m.answered >= 3 && risks.length < cap) risks.add(PaperReadCopy.moreWrong(m.wrong, m.right));
  // The end of a long paper left blank: the clock ran out before it, or the paper was left.
  var trailing = 0;
  for (final r in a.rows.reversed) {
    if (r.verdict != RowVerdict.skipped) break;
    trailing++;
  }
  if (m.questions >= 20 && trailing >= 3 && trailing < m.questions && risks.length < cap) {
    risks.add(PaperReadCopy.endBlank(trailing, trailing * 5));
  }
  if (dwellMs.length >= 5 && risks.length < cap) {
    final times = dwellMs.values.toList()..sort();
    final median = times[times.length ~/ 2];
    final slow = a.rows.where((r) => (dwellMs[r.qid] ?? 0) >= math.max(90000, median * 3)).toList();
    if (slow.isNotEmpty) risks.add(PaperReadCopy.slow(slow.first.number, dwellMs[slow.first.qid]!));
  }

  return PaperRead(
    strengths: strengths.take(cap).toList(),
    leakChapters: chapters,
    leaks: leaks,
    reach: reach,
    reachNote: m.questions < 8 ? null : reachNote,
    risks: risks.take(cap).toList(),
    fixQids: fixQids,
    fixChapter: fixChapter,
  );
}

/// Each chapter's record across the student's [last] papers of [current]'s subject before it (any mode, answered
/// rows only from papers whose answers were recorded). Chapters with no name are left out.
Map<String, ChapterRecord> chapterHistoryOf(Iterable<Attempt> all, Attempt current, {int last = 5}) {
  final earlier = [
    for (final a in all)
      if (a.id != current.id && a.subject == current.subject && a.completedAt.isBefore(current.completedAt) && a.questions.isNotEmpty) a,
  ]..sort((x, y) => y.completedAt.compareTo(x.completedAt));
  final out = <String, ChapterRecord>{};
  for (final a in earlier.take(last)) {
    for (final q in a.questions) {
      final chapter = q.chapter;
      final d = a.detailFor(q.id);
      if (chapter == null || chapter.isEmpty || d == null) continue;
      final was = out[chapter] ?? (n: 0, right: 0);
      out[chapter] = (n: was.n + 1, right: was.right + (d.isCorrect == true ? 1 : 0));
    }
  }
  return out;
}

/// The read's words, in Mobi's voice, read aloud before they were written: plain, whole sentences for a 17-year-old.
abstract final class PaperReadCopy {
  /// The debrief's heading: Mobi's on practice and full mocks, plain on an NTA paper (no Mobi there).
  static const String title = "Mobi's read of this paper";
  static const String titlePlain = 'Your read of this paper';
  static const String free = 'Free';
  static const String strengths = 'Strengths';
  static const String weaknesses = 'Weaknesses';
  static const String opportunity = 'Opportunity';
  static const String risks = 'Threats';
  static const String lostHead = 'Marks lost';
  static const String tied = 'Tied';

  /// The key that repairs what the reach names.
  static String fixKey(int n) => n == 1 ? 'Fix this one' : 'Fix these $n';
  static String fixNote(int n) => n == 1 ? '1 credit.' : '1 credit each.';
  static String fixSpoken(int n, String? chapter) =>
      n == 1 ? 'Fix this one${chapter == null ? '' : ' in $chapter'}. 1 credit.' : 'Fix these $n${chapter == null ? '' : ' in $chapter'}. 1 credit each.';

  static String _pct(double s) => '${(s * 100).round()}%';

  static String cleanChapters(List<String> names, List<int> counts) {
    if (names.length == 1) return 'All ${counts.first} right in ${names.first}.';
    if (names.length == 2) return 'Every question right in ${names[0]} and ${names[1]}.';
    return 'Every question right in ${names[0]}, ${names[1]} and ${names.length - 2} more chapters.';
  }

  static String allRight(int n) => 'You got all $n right, so there is nothing to fix from this paper.';
  static String bestChapter(String name, int right, int n) => '$right of $n right in $name.';
  static String quickAndSure(int n) => '$n right answers took under 30 seconds each.';
  static String changesHelped(int n, int marks) =>
      n == 1 ? 'One changed answer won you $marks marks.' : '$n changed answers won you $marks marks.';
  static String upFrom(double before, double now, String subject) =>
      'Up from ${_pct(before)} right in your last $subject paper to ${_pct(now)}.';
  static String banked(int right) => right == 1 ? 'Your 1 right answer earned 5 marks.' : 'Your $right right answers earned ${right * 5} marks.';

  static String changesCost(int n, int marks) =>
      n == 1 ? 'One changed answer cost you $marks marks.' : '$n changed answers cost you $marks marks.';
  // Whole sentences (app-finish F8): "In Goodwill, 2 wrong answers cost 12 marks and 1 question left blank cost 5 more."
  static String lostPlain(int wrong, int blank, {String? chapter}) {
    final parts = [
      if (wrong > 0) '$wrong wrong ${wrong == 1 ? 'answer' : 'answers'} cost ${wrong * 6} marks',
      if (blank > 0) '$blank ${blank == 1 ? 'question' : 'questions'} left blank cost ${blank * 5} ${wrong > 0 ? 'more' : 'marks'}',
    ];
    final body = parts.join(' and ');
    return chapter == null ? '${body[0].toUpperCase()}${body.substring(1)}.' : 'In $chapter, $body.';
  }
  static const String nothingLost = 'You lost no marks on this paper.';

  // A counterfactual about this paper, never a promise (app-finish F2): a repair is practice and never rescores the
  // paper, so the line says what those answers cost and what they would have made it.
  static String reachWrong(int w, int scored, int would, {String? chapter, bool all = false}) {
    final answers = w == 1 ? 'That wrong answer' : 'Those $w wrong answers';
    final where = chapter != null ? ' in $chapter' : '';
    return '$answers$where cost you ${would - scored} marks. Answered right, this paper would have been ${_signed(would)}, not ${_signed(scored)}.';
  }

  static String reachEvery(int wrong, int would) => 'With every wrong answer right, this paper would have been ${_signed(would)}.';
  static String reachBlank(int b, int scored, int would) => b == 1
      ? 'Answered right, the question you left blank would have made this paper ${_signed(would)}, not ${_signed(scored)}.'
      : 'Answered right, the $b questions you left blank would have made this paper ${_signed(would)}, not ${_signed(scored)}.';
  static String reachAll(int max) => 'You took all $max marks, so a harder paper is the next step.';
  static const String sixEach = 'Each wrong answer you fix is worth 6 marks: the 5 you missed and the 1 taken off.';
  static const String fiveEach = 'Each question answered right is worth 5 marks.';

  static String rushed(int n) => n == 1
      ? 'One wrong answer took under 20 seconds. Read it twice before you mark.'
      : '$n wrong answers took under 20 seconds each. Read twice before you mark.';
  static String slipping(String chapter, int rightBefore, int nBefore, int rightNow, int nNow) =>
      '$chapter is slipping: $rightBefore of $nBefore right in your earlier papers, $rightNow of $nNow today.';
  static String downFrom(double before, double now, String subject) =>
      'Down from ${_pct(before)} right in your last $subject paper to ${_pct(now)}.';
  static String moreWrong(int wrong, int right) =>
      'More answers were wrong ($wrong) than right ($right). Each wrong one takes a mark off.';
  static String endBlank(int n, int marks) => 'The last $n questions were left blank: $marks marks not earned. Keep time for the end.';
  static String slow(int number, int ms) {
    final s = (ms / 1000).round();
    final t = s < 60 ? '$s seconds' : '${s ~/ 60}m ${(s % 60).toString().padLeft(2, '0')}s';
    return 'Q$number took $t. On the real paper, move on and come back to it.';
  }

  static String _signed(int v) => v < 0 ? '−${-v}' : '$v';
}
