import 'mistake_index.dart';
import 'repair_state.dart';

/// What the repair ending states, from the run when it is still in memory, or from the
/// acknowledgements stored on this phone after a restart. Counts only acknowledged repairs.
class EndingModel {
  const EndingModel({
    required this.chapter,
    required this.subjectId,
    required this.source,
    required this.repaired,
    required this.total,
    this.setAside = 0,
    this.reviewed = 0,
    this.lastAckedAt,
    this.repairedNowIds = const {},
    this.repairedEarlierIds = const {},
    this.touchedKeys = const {},
    this.resolvedKeys = const {},
    this.repairedBefore = true,
  });

  factory EndingModel.of({required String attemptId, RepairRunState? run, ReviewIndex? index}) {
    final attemptItems = [
      for (final g in index?.groups ?? const <ChapterGroup>[])
        for (final i in g.items)
          if (i.attemptId == attemptId) i,
    ];
    if (run != null) {
      final now = {
        for (final s in run.steps)
          if (s.countsAsRepaired) s.item.questionId,
      };
      return EndingModel(
        chapter: run.chapter,
        subjectId: run.subjectId,
        source: run.source,
        repaired: run.repairedCount,
        total: run.steps.length,
        setAside: run.setAsideCount,
        reviewed: run.reviewedCount,
        lastAckedAt: run.lastAckedAt,
        repairedNowIds: now,
        repairedEarlierIds: {
          for (final i in attemptItems)
            if (i.stage == MistakeStage.repaired && !now.contains(i.questionId)) i.questionId,
        },
        touchedKeys: run.touchedKeys,
        resolvedKeys: {
          for (final s in run.steps)
            if (s.outcome is OutcomeExplained || s.outcome is OutcomeSetAside) s.item.key,
        },
        repairedBefore: run.repairedBefore,
      );
    }
    // After a restart: the acknowledged repairs of this attempt, as stored on this phone.
    final repaired = [
      for (final i in attemptItems)
        if (i.stage == MistakeStage.repaired) i,
    ];
    DateTime? last;
    for (final i in repaired) {
      final at = i.stageAt;
      if (at != null && (last == null || at.isAfter(last))) last = at;
    }
    final first = repaired.isNotEmpty ? repaired.first : (attemptItems.isNotEmpty ? attemptItems.first : null);
    return EndingModel(
      chapter: first?.chapter ?? '',
      subjectId: first?.subjectId ?? '',
      source: first?.source ?? '',
      repaired: repaired.length,
      total: repaired.length,
      lastAckedAt: last,
      repairedEarlierIds: {for (final i in repaired) i.questionId},
      touchedKeys: {for (final i in repaired) i.key},
    );
  }

  final String chapter;
  final String subjectId;
  final String source;
  final int repaired;
  final int total;
  final int setAside;
  final int reviewed;

  /// The receipt time: the last acknowledged repair call.
  final DateTime? lastAckedAt;
  final Set<String> repairedNowIds;
  final Set<String> repairedEarlierIds;
  final Set<String> touchedKeys;

  /// Keys of the run's steps that are no longer open: repaired (now or as a reopen) or set aside.
  /// The ending's "left" count never includes them, even while Review's index still lists the
  /// just-repaired question as open (its local record is written a beat after the answer).
  final Set<String> resolvedKeys;
  final bool repairedBefore;
}

/// The open mistakes of one chapter, split by whether they are in the paper the repair ran on.
class ChapterOpen {
  const ChapterOpen({required this.here, required this.elsewhere});

  /// Open in this paper: what the run covered.
  final int here;

  /// Open in other papers: the run never touched them.
  final int elsewhere;
}

/// What is still open in [chapter] of [subjectId], or null when the index is not known. [resolved]
/// (the run's own resolved step keys, [EndingModel.resolvedKeys]) is never counted as open.
ChapterOpen? chapterOpenSplit(
  ReviewIndex? index, {
  required String attemptId,
  required String chapter,
  required String subjectId,
  Set<String> resolved = const {},
}) {
  if (index == null || chapter.isEmpty) return null;
  var here = 0;
  var elsewhere = 0;
  for (final g in index.openGroups) {
    if (g.chapter != chapter || g.subjectId != subjectId) continue;
    for (final i in g.open) {
      if (resolved.contains(i.key)) continue;
      if (i.attemptId == attemptId) {
        here++;
      } else {
        elsewhere++;
      }
    }
  }
  return ChapterOpen(here: here, elsewhere: elsewhere);
}
