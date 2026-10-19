import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/ending_model.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/repair_key_plan.dart';

import 'support/review_fixtures.dart';

RepairLocalRecord _explained(String attempt, String qid) => RepairLocalRecord(
  attemptId: attempt,
  questionId: qid,
  requestId: 'req-$qid-000000000000',
  status: RepairLocalStatus.explained,
  ackedAt: DateTime.utc(2026, 10, 12, 18),
);

/// Mock 7's five wrong answers, as the result page lists them: three in Partnership (questions 1,
/// 11 and 31) and one each in Accounting ratios (7) and Issue of shares (14).
List<RepairKeyRow> _wrong(ReviewIndex index) => [
  for (final g in index.groups)
    for (final i in g.items)
      if (i.attemptId == 'm7') RepairKeyRow(qid: i.questionId, number: i.number, chapter: i.chapter),
];

void main() {
  group('the result page repair key names the run it opens', () {
    test('5 wrong answers across chapters: the key counts the chapter, not the page', () {
      final index = buildReviewIndex([mock7, mock6, quick], const []);
      final wrong = _wrong(index);
      expect(wrong, hasLength(5));
      final plan = RepairKeyPlan.of(wrong, attemptId: 'm7', index: index)!;
      expect(plan.chapter, startsWith('Partnership'));
      expect(plan.count, 3, reason: 'one chapter of one paper, like the run');
      expect(plan.others, 2);
      expect(plan.firstQid, 'm7-q0');
      // The run the key opens holds exactly that many mistakes, starting there.
      final run = index.openIn('m7', plan.chapter);
      expect(run.length, plan.count);
      expect(run.first.questionId, plan.firstQid);
      expect(ReviewCopy.repairKeyNote(plan.chapter, plan.others), 'Partnership. The other 2 are in Your papers.');
      expect(ReviewCopy.repairKeyNote(plan.chapter, 1), 'Partnership. The other 1 is in Your papers.');
    });

    test('a repaired mistake is not offered again; the key follows what is still open', () {
      final index = buildReviewIndex([mock7, mock6, quick], [_explained('m7', 'm7-q0')]);
      final plan = RepairKeyPlan.of(_wrong(index), attemptId: 'm7', index: index)!;
      expect(plan.count, 2);
      expect(plan.firstQid, 'm7-q10');
      expect(plan.others, 2);
    });

    test('every wrong answer in one chapter: the key counts them all and has no note', () {
      final index = buildReviewIndex([mock6], const []);
      final wrong = [
        for (final i in index.groups.single.items) RepairKeyRow(qid: i.questionId, number: i.number, chapter: i.chapter),
      ];
      final plan = RepairKeyPlan.of(wrong, attemptId: 'm6', index: index)!;
      expect(plan.count, wrong.length);
      expect(plan.others, 0);
    });

    test('nothing open means no repair key', () {
      final index = buildReviewIndex([mock6], [_explained('m6', 'm6-q5'), _explained('m6', 'm6-q20')]);
      final wrong = [RepairKeyRow(qid: 'm6-q5', number: 6, chapter: 'Partnership: admission of a partner')];
      expect(RepairKeyPlan.of(wrong, attemptId: 'm6', index: index), isNull);
    });

    test('without an index every wrong answer counts (the run waits for the index)', () {
      final plan = RepairKeyPlan.of(const [
        RepairKeyRow(qid: 'a', number: 2, chapter: 'One'),
        RepairKeyRow(qid: 'b', number: 5, chapter: 'Two'),
        RepairKeyRow(qid: 'c', number: 7, chapter: 'Two'),
      ])!;
      expect(plan.chapter, 'Two');
      expect(plan.count, 2);
      expect(plan.others, 1);
    });
  });

  group('the ending says what is left in this paper and in other papers apart', () {
    test('open mistakes of the chapter in another paper are not "left" from this one', () {
      // Mock 7 and Mock 6 share Partnership. Mock 7's three are all repaired; Mock 6's two are open.
      final index = buildReviewIndex([mock7, mock6], [
        _explained('m7', 'm7-q0'),
        _explained('m7', 'm7-q10'),
        _explained('m7', 'm7-q30'),
      ]);
      final chapter = index.item('m7', 'm7-q0')!.chapter;
      final open = chapterOpenSplit(index, attemptId: 'm7', chapter: chapter, subjectId: 'accountancy')!;
      expect(open.here, 0);
      expect(open.elsewhere, 2);
      final line = ReviewCopy.endingFact(chapter, open.here, elsewhere: open.elsewhere);
      expect(line, 'Nothing left in Partnership from this paper. 2 in other papers.');
    });

    test('the plain forms are unchanged when no other paper has any', () {
      expect(ReviewCopy.endingFact('Partnership', 0), 'Nothing left in Partnership.');
      expect(ReviewCopy.endingFact('Partnership', 2), '2 left in Partnership.');
      expect(ReviewCopy.endingFact('Partnership', 1, elsewhere: 1, setAside: 1), '1 left in Partnership. 1 more in other papers. 1 set aside while its key is checked.');
    });

    test('without an index the open count is not claimed', () {
      expect(chapterOpenSplit(null, attemptId: 'm7', chapter: 'x', subjectId: 'accountancy'), isNull);
    });
  });
}
