import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/ending_model.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/repair_state.dart';

import 'support/review_fixtures.dart';

/// FINDINGS 9 and 26: the ending said "1 left in" a chapter right after that chapter's only
/// mistake was repaired, because Review's index had not yet read the new local record. The "left"
/// count now leaves out the run's own resolved steps.
void main() {
  RepairRunState runOf(ReviewIndex index, List<String> qids, {required List<MistakeOutcome?> outcomes}) {
    final items = [for (final q in qids) index.item('m7', q)!];
    return RepairRunState(
      attemptId: 'm7',
      chapter: items.first.chapter,
      subjectId: items.first.subjectId,
      source: items.first.source,
      steps: [for (var i = 0; i < items.length; i++) RepairStep(items[i], outcomes[i])],
      phase: RepairPhase.ending,
    );
  }

  OutcomeExplained explained() =>
      OutcomeExplained(RepairResponse.fromJson(explainedJson()), ackedAt: DateTime.utc(2026, 10, 12, 17, 38), requestId: 'req-a');

  test('Nothing left in this chapter: the just-repaired question is never counted as left', () {
    // The index still lists Accounting ratios' one mistake (m7-q6) as open: its record is not read yet.
    final index = buildReviewIndex([mock7, mock6], const []);
    final run = runOf(index, ['m7-q6'], outcomes: [explained()]);
    final model = EndingModel.of(attemptId: 'm7', run: run, index: index);
    expect(model.resolvedKeys, {'m7/m7-q6'});

    final stale = chapterOpenSplit(index, attemptId: 'm7', chapter: model.chapter, subjectId: model.subjectId)!;
    expect(stale.here, 1, reason: 'the bug: the index alone still counts it');

    final open = chapterOpenSplit(index, attemptId: 'm7', chapter: model.chapter, subjectId: model.subjectId, resolved: model.resolvedKeys)!;
    expect(open.here, 0);
    expect(open.elsewhere, 0);
    expect(ReviewCopy.endingFact(model.chapter, open.here, elsewhere: open.elsewhere), 'Nothing left in Accounting ratios.');
  });

  test('a run left part way counts only its steps that are still open', () {
    final index = buildReviewIndex([mock7, mock6], const []);
    // Partnership in Mock 7: questions 1, 11 and 31. One repaired, one set aside, one not reached.
    final run = runOf(index, ['m7-q0', 'm7-q10', 'm7-q30'], outcomes: [explained(), const OutcomeSetAside(heldByServer: true), null]);
    final model = EndingModel.of(attemptId: 'm7', run: run, index: index);
    final open = chapterOpenSplit(index, attemptId: 'm7', chapter: model.chapter, subjectId: model.subjectId, resolved: model.resolvedKeys)!;
    expect(open.here, 1);
    expect(open.elsewhere, 2, reason: "Mock 6's two Partnership mistakes are in another paper");
    expect(
      ReviewCopy.endingFact(model.chapter, open.here, elsewhere: open.elsewhere, setAside: model.setAside),
      '1 left in Partnership. 2 more in other papers. 1 set aside while its key is checked.',
    );
  });

  test('a key review is not a repair: it stays left', () {
    final index = buildReviewIndex([mock7], const []);
    final run = runOf(index, ['m7-q6'], outcomes: [const OutcomeKeyReview(KeyReviewReason.chosen)]);
    final model = EndingModel.of(attemptId: 'm7', run: run, index: index);
    final open = chapterOpenSplit(index, attemptId: 'm7', chapter: model.chapter, subjectId: model.subjectId, resolved: model.resolvedKeys)!;
    expect(open.here, 1);
  });
}
