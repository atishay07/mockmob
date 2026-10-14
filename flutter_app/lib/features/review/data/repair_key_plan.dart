import '../../../core/domain/tonight_pick.dart';
import 'mistake_index.dart';

/// One wrong answer on a result page: its question id, its 1-based number and its chapter.
class RepairKeyRow {
  const RepairKeyRow({required this.qid, required this.number, this.chapter});

  final String qid;
  final int number;
  final String? chapter;
}

/// What a result page's repair key opens. A repair run covers one chapter of one paper
/// (`RepairRun.open`), so the key names that run: the chapter holding the most open mistakes of
/// the paper (the same pick as Today, Review and Start), its count, and how many open mistakes
/// of the paper sit in other chapters (they stay in Review).
class RepairKeyPlan {
  const RepairKeyPlan({required this.chapter, required this.firstQid, required this.count, required this.others});

  final String chapter;
  final String firstQid;

  /// The run's mistake count: the number on the key.
  final int count;

  /// Open mistakes of this paper outside the run's chapter.
  final int others;

  /// Plans the key for [wrong] (the paper's wrong answers). With a [index], only the mistakes
  /// Review still holds open count (a repaired one is not offered again); without one every wrong
  /// answer counts, as the run will wait for the index. Null when nothing is open.
  static RepairKeyPlan? of(List<RepairKeyRow> wrong, {String? attemptId, ReviewIndex? index}) {
    final open = [
      for (final r in wrong)
        if (index == null || attemptId == null || (index.item(attemptId, r.qid)?.stage.isOpen ?? false)) r,
    ];
    final pick = pickTonightChapter(open, chapterOf: (r) => r.chapter, numberOf: (r) => r.number);
    if (pick == null) return null;
    return RepairKeyPlan(
      chapter: pick.chapter,
      firstQid: pick.items.first.qid,
      count: pick.items.length,
      others: pick.paperOpen - pick.items.length,
    );
  }
}
