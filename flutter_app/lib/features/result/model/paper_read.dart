import 'dart:math' as math;

import '../widgets/finish_reveal.dart' show FinishChapter, finishChaptersOf;
import 'next_move.dart';

/// The read of one paper after its finish moment (20 Oct, owner: "it doesn't do the SWOT analysis"): what went well,
/// where the marks were lost, what was within reach, and what to watch. Built only from this result's own numbers (the
/// verdicts, the chapters, the time per question and the answer changes when the phone recorded them, and the share
/// right in the last paper of this subject when the history has one). Nothing is estimated or invented: a line whose
/// numbers are not there is left out, so a 5-question set gets a lighter read than a full paper.
class PaperRead {
  const PaperRead({
    required this.strengths,
    required this.leakChapters,
    required this.leaks,
    required this.reach,
    required this.reachNote,
    required this.risks,
  });

  /// Strengths: one or two lines.
  final List<String> strengths;

  /// Weaknesses: the chapters that lost marks, ranked with ties shared (I14).
  final List<FinishChapter> leakChapters;

  /// Weaknesses said in words (changed answers that cost marks; a paper with no chapters).
  final List<String> leaks;

  /// Opportunity: the marks within reach, as arithmetic on this paper ("With the 2 wrong answers in Goodwill right,
  /// this paper is 45, not 33.").
  final String reach;

  /// What one fix is worth, under [reach]; null when there is nothing to fix.
  final String? reachNote;

  /// Risks: time pressure, more wrong than right, a drop from the last paper. Empty when the numbers show none.
  final List<String> risks;
}

/// Wrong answers picked faster than this are "rushed" (the practice analysis' own quick-pick line).
const int readQuickMs = 20000;

/// Right answers inside this were "quick and sure".
const int readSureMs = 30000;

/// Builds the read. [dwellMs] is the time per question by qid (empty when the phone did not record it); [changes] is
/// each changed answer's effect on the marks (+6 for wrong to right, -6 for right to wrong, and so on); [previousShare]
/// is the share right in the last paper of the same subject, when the history has one, and [subject] its name.
PaperRead paperReadOf(
  MoveAnalysis a, {
  Map<String, String> reviews = const {},
  Map<String, int> dwellMs = const {},
  List<int> changes = const [],
  double? previousShare,
  String? subject,
}) {
  final m = a.marks;
  final light = m.questions < 8;
  final cap = light ? 1 : 2;
  final ranked = rankedChapterCosts(a, reviews: reviews);
  final chapters = finishChaptersOf(ranked);
  final share = m.questions == 0 ? 0.0 : m.right / m.questions;

  // ---- Strengths ------------------------------------------------------------------------------------------------
  final strengths = <String>[];
  final byChapter = <String, ({int n, int right})>{};
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
  if (clean.isNotEmpty && byChapter.length > 1) {
    strengths.add(PaperReadCopy.cleanChapters(clean, [for (final c in clean) byChapter[c]!.n]));
  } else if (m.right == m.questions && m.questions > 0) {
    strengths.add(PaperReadCopy.allRight(m.questions));
  } else {
    // The chapter with the best share right, at least 2 right and 60% (never one that lost the most marks alone).
    final best = byChapter.entries.where((e) => e.value.right >= 2 && e.value.right / e.value.n >= 0.6).toList()
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
  if (previousShare != null && subject != null && share >= previousShare + 0.1 && strengths.length < cap) {
    strengths.add(PaperReadCopy.upFrom(previousShare, share, subject));
  }
  if (strengths.isEmpty) {
    if (m.right > 0) {
      strengths.add(PaperReadCopy.banked(m.right));
    } else if (m.answered > 0) {
      strengths.add(PaperReadCopy.attempted(m.answered, m.questions));
    } else {
      strengths.add(PaperReadCopy.noneTakenOff);
    }
  }

  // ---- Weaknesses -----------------------------------------------------------------------------------------------
  final leaks = <String>[];
  final hurt = changes.where((c) => c < 0).toList();
  if (hurt.isNotEmpty) leaks.add(PaperReadCopy.changesCost(hurt.length, -hurt.fold(0, (s, c) => s + c)));
  if (chapters.isEmpty && m.gap > 0) leaks.add(PaperReadCopy.lostPlain(m.wrong, m.blank));
  if (m.gap == 0) leaks.add(PaperReadCopy.nothingLost);

  // ---- Opportunity ----------------------------------------------------------------------------------------------
  String reach;
  String? reachNote;
  if (m.wrong > 0) {
    // The wrong answers in the chapters that lost the most (all of them when tied); else every wrong answer.
    final top = chapters.where((c) => c.rank == 1).toList();
    final topWrong = top.fold(0, (s, c) => s + c.wrong);
    final w = topWrong > 0 ? topWrong : m.wrong;
    final where = topWrong > 0 && top.length == 1 ? top.first.name : null;
    final tiedTop = topWrong > 0 && top.length > 1 ? top.length : null;
    reach = PaperReadCopy.reachWrong(w, m.scored, m.scored + 6 * w, chapter: where, tiedChapters: tiedTop);
    reachNote = PaperReadCopy.sixEach;
  } else if (m.blank > 0) {
    reach = PaperReadCopy.reachBlank(m.blank, m.scored, m.scored + 5 * m.blank);
    reachNote = PaperReadCopy.fiveEach;
  } else {
    reach = PaperReadCopy.reachAll(m.max);
  }

  // ---- Risks ----------------------------------------------------------------------------------------------------
  final risks = <String>[];
  final rushed = [
    for (final r in a.rows)
      if (r.verdict == RowVerdict.wrong && (dwellMs[r.qid] ?? readQuickMs) < readQuickMs) r,
  ];
  if (rushed.isNotEmpty) risks.add(PaperReadCopy.rushed(rushed.length));
  if (previousShare != null && subject != null && share <= previousShare - 0.1 && risks.length < cap) {
    risks.add(PaperReadCopy.downFrom(previousShare, share, subject));
  }
  if (m.wrong > m.right && m.answered >= 3 && risks.length < cap) risks.add(PaperReadCopy.moreWrong(m.wrong, m.right));
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
    reachNote: light ? null : reachNote,
    risks: risks.take(cap).toList(),
  );
}

/// The read's words, read aloud before they were written: plain, whole sentences for a 17-year-old.
abstract final class PaperReadCopy {
  static const String title = 'SWOT for this paper';
  static const String strengths = 'Strengths';
  static const String weaknesses = 'Weaknesses';
  static const String opportunity = 'Opportunity';
  static const String risks = 'Risks';
  static const String lostHead = 'Marks lost';
  static const String tied = 'Tied';

  static String _pct(double s) => '${(s * 100).round()}%';

  static String cleanChapters(List<String> names, List<int> counts) {
    if (names.length == 1) return '${names.first}: all ${counts.first} right.';
    if (names.length == 2) return '${names[0]} and ${names[1]}: every one right.';
    return '${names[0]}, ${names[1]} and ${names.length - 2} more: every one right.';
  }

  static String allRight(int n) => 'All $n right. Nothing to fix from this paper.';
  static String bestChapter(String name, int right, int n) => '$name: $right of $n right.';
  static String quickAndSure(int n) => '$n right answers took under 30 seconds each.';
  static String upFrom(double before, double now, String subject) =>
      'Up from ${_pct(before)} right in your last $subject paper to ${_pct(now)}.';
  static String banked(int right) => '$right right: +${right * 5} marks banked.';
  static String attempted(int answered, int total) => 'You attempted $answered of $total. Each one now has its reason below.';
  static const String noneTakenOff = 'No wrong answers, so no marks were taken off.';

  static String changesCost(int n, int marks) =>
      n == 1 ? 'One changed answer cost you $marks marks.' : '$n changed answers cost you $marks marks.';
  static String lostPlain(int wrong, int blank) => [
    if (wrong > 0) '$wrong wrong: ${wrong * 6} marks',
    if (blank > 0) '$blank not attempted: ${blank * 5} marks',
  ].join('. ') + '.';
  static const String nothingLost = 'No marks lost.';

  static String reachWrong(int w, int scored, int would, {String? chapter, int? tiedChapters}) {
    final answers = w == 1 ? 'the wrong answer' : 'the $w wrong answers';
    final where = chapter != null ? ' in $chapter' : (tiedChapters != null ? ' in your top $tiedChapters chapters' : '');
    return 'With $answers$where right, this paper is ${_signed(would)}, not ${_signed(scored)}.';
  }

  static String reachBlank(int b, int scored, int would) =>
      'With the $b not attempted answered right, this paper is ${_signed(would)}, not ${_signed(scored)}.';
  static String reachAll(int max) => 'All $max marks. A harder set is the next step.';
  static const String sixEach = 'Each wrong answer you fix is worth 6 marks: the 5 you missed and the 1 taken off.';
  static const String fiveEach = 'Each question answered right is worth 5 marks.';

  static String rushed(int n) => n == 1
      ? 'One wrong answer took under 20 seconds. Read it twice next time.'
      : '$n wrong answers took under 20 seconds each. Read those twice next time.';
  static String downFrom(double before, double now, String subject) =>
      'Down from ${_pct(before)} right in your last $subject paper to ${_pct(now)}.';
  static String moreWrong(int wrong, int right) =>
      'More answers were wrong ($wrong) than right ($right). Each wrong one takes a mark off.';
  static String slow(int number, int ms) {
    final s = (ms / 1000).round();
    final t = s < 60 ? '$s seconds' : '${s ~/ 60}m ${(s % 60).toString().padLeft(2, '0')}s';
    return 'Q$number took $t. On the real paper, move on and come back to it.';
  }

  static String _signed(int v) => v < 0 ? '−${-v}' : '$v';
}
