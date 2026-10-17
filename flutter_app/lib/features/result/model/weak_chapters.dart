// "Where your marks went" on the result (v15 spec 3.1): ONE list of the chapters that cost marks on this paper.
// It replaces the separate "chapters by marks left open" ranking the owner rejected (N15). Pure: no Flutter. Every
// figure comes from the paper's own rows, with the same arithmetic as the costliest-chapter line: a wrong answer costs
// 6 (the 5 not won and the 1 taken off), a blank 5, and a question whose key is held or corrected counts for nothing.

import 'next_move.dart';

/// One chapter that cost marks.
class WeakChapter {
  const WeakChapter({required this.chapter, required this.questions, required this.right, required this.wrong, required this.blank});

  final String chapter;
  final int questions;
  final int right;
  final int wrong;
  final int blank;

  /// Marks lost: 6 for each wrong answer, 5 for each blank.
  int get lost => wrong * NextMoveRules.gapWrong + blank * NextMoveRules.gapBlank;

  /// Marks the chapter had on the paper: 5 for each question.
  int get available => questions * 5;

  /// More was lost than the chapter had: every mark gone, and the wrong answers took more off.
  bool get overdrawn => lost > available;

  /// 0 to 1, for the bar.
  double get share => available == 0 ? 0 : (lost / available).clamp(0.0, 1.0);

  /// "4 wrong and 1 left blank, of 10 questions."
  String get counts {
    final parts = [if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank left blank'].join(' and ');
    return '$parts, of $questions question${questions == 1 ? '' : 's'}.';
  }

  /// The marks as a student says them: "29 of 50 marks lost", or "All 50 marks lost, 3 more taken off" when the wrong
  /// answers took more than the chapter had (never "53 of 50").
  String get marksLine => overdrawn ? 'All $available marks lost, ${lost - available} more taken off' : '$lost of $available marks lost';
}

/// The chapters that cost marks, the costliest first (ties: more wrong answers, then the chapter that comes first in the
/// paper). Questions whose key is held or corrected leave the loss out, as in the costliest-chapter line. Empty when
/// nothing was missed or the rows have no chapter.
List<WeakChapter> weakChapters(MoveAnalysis a, {Map<String, String> reviews = const {}}) {
  const held = {'withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected'};
  final order = <String>[];
  final n = <String, int>{};
  final right = <String, int>{};
  final wrong = <String, int>{};
  final blank = <String, int>{};
  for (final r in a.rows) {
    final chapter = r.chapter;
    if (chapter == null || chapter.isEmpty) continue;
    if (!n.containsKey(chapter)) order.add(chapter);
    n[chapter] = (n[chapter] ?? 0) + 1;
    if (held.contains(reviews[r.qid])) continue;
    switch (r.verdict) {
      case RowVerdict.correct:
        right[chapter] = (right[chapter] ?? 0) + 1;
      case RowVerdict.wrong:
        wrong[chapter] = (wrong[chapter] ?? 0) + 1;
      case RowVerdict.skipped:
        blank[chapter] = (blank[chapter] ?? 0) + 1;
    }
  }
  final list = [
    for (final c in order)
      WeakChapter(chapter: c, questions: n[c]!, right: right[c] ?? 0, wrong: wrong[c] ?? 0, blank: blank[c] ?? 0),
  ].where((c) => c.lost > 0).toList();
  final firstAt = {for (var i = 0; i < order.length; i++) order[i]: i};
  list.sort((x, y) {
    final m = y.lost.compareTo(x.lost);
    if (m != 0) return m;
    final w = y.wrong.compareTo(x.wrong);
    return w != 0 ? w : firstAt[x.chapter]!.compareTo(firstAt[y.chapter]!);
  });
  return list;
}
