// v13 copy fixes from the 17 Oct critique: a source said once, a negative score that never claims more marks than
// the paper holds, and Across your mocks said as a finding.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/model/next_move.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/rules/copy.dart';

MoveRow _row(int n, RowVerdict v, String chapter) => MoveRow(qid: 'q$n', number: n, verdict: v, chapter: chapter, givenIndex: v == RowVerdict.wrong ? 1 : null);

void main() {
  group('review chapter rows say each source once', () {
    test('one source, as before', () {
      expect(ReviewCopy.fromPapers(['Mock 2']), 'from Mock 2');
      expect(ReviewCopy.fromPapers(['Quick practice']), 'from Quick practice');
    });

    test('two quick practices are counted, never repeated', () {
      expect(ReviewCopy.fromPapers(['Quick practice', 'Quick practice']), 'from 2 quick practices');
      expect(ReviewCopy.fromPapers(['Quick practice', 'Quick practice', 'Quick practice']), 'from 3 quick practices');
    });

    test('a mock and quick practices', () {
      expect(ReviewCopy.fromPapers(['Mock 1', 'Quick practice']), 'from Mock 1 and a quick practice');
      expect(ReviewCopy.fromPapers(['Mock 1', 'Quick practice', 'Quick practice']), 'from Mock 1 and 2 quick practices');
      expect(ReviewCopy.fromPapers(['Mock 2', 'Mock 1']), 'from Mock 2 and Mock 1');
      expect(ReviewCopy.fromPapers(['Mock 2', 'Quick practice', 'Mock 1']), 'from Mock 2, a quick practice and Mock 1');
    });

    test('two keys of the same name are told apart by their day', () {
      expect(ReviewCopy.repairGroupFromKey(2, 'Quick practice'), 'Repair 2 from Quick practice');
      expect(ReviewCopy.repairGroupFromKey(2, 'Quick practice', date: '12 Oct'), 'Repair 2 from Quick practice, 12 Oct');
    });

    test('a past paper below zero uses the minus sign', () {
      expect(ReviewCopy.pastLine('16 October', -1, 250), '16 October, −1 of 250');
      expect(ReviewCopy.pastLine('3 October', 9, 250), '3 October, 9 of 250');
    });
  });

  group('a negative score never implies more marks than the paper holds', () {
    // 10 questions, 1 wrong and 9 blank: -1 of 50. Financial Markets: 4 questions, 1 wrong, 3 blank.
    final practice = MoveAnalysis([
      _row(1, RowVerdict.wrong, 'Financial Markets'),
      for (var i = 2; i <= 4; i++) _row(i, RowVerdict.skipped, 'Financial Markets'),
      for (var i = 5; i <= 10; i++) _row(i, RowVerdict.skipped, 'Planning'),
    ]);

    test('the lost marks are said as two plain amounts', () {
      expect(ResultCopy.negativeLoss(1, 9), 'You lost 6 marks to 1 wrong answer and left 45 unearned.');
      expect(ResultCopy.negativeLoss(3, 0), 'You lost 18 marks to 3 wrong answers.');
    });

    test('the costliest line leads with the loss and the chapter follows with its counts', () {
      expect(practice.marks.scored, -1);
      final c = costliestLine(practice);
      expect(c.line, 'You lost 6 marks to 1 wrong answer and left 45 unearned.');
      expect(c.detail, 'Financial Markets: 4 questions, 1 wrong, 3 blank, 21 marks.');
      expect(c.chapter, 'Financial Markets');
      expect(c.line, isNot(contains('you missed')));
    });

    test('a positive score keeps the website sentence', () {
      final ok = MoveAnalysis([
        for (var i = 1; i <= 7; i++) _row(i, RowVerdict.correct, 'A'),
        _row(8, RowVerdict.wrong, 'Share Capital'),
        _row(9, RowVerdict.skipped, 'Share Capital'),
        _row(10, RowVerdict.correct, 'A'),
      ]);
      expect(costliestLine(ok).line, 'Share Capital cost 11 of the 11 marks you missed.');
    });

    test('the card words drop the denominator that exceeds the paper', () {
      expect(ResultCopy.breakdownTitle(51, max: 50), 'Where the marks went');
      expect(ResultCopy.breakdownTitle(30, max: 50), 'Where the other 30 marks went');
      expect(ResultCopy.costUnit(51, max: 50), 'marks');
      expect(ResultCopy.costUnit(30, max: 50), 'of 30 missed');
      expect(ResultCopy.costLabel(21, 51, max: 50), '21 marks cost in this chapter.');
      expect(ResultCopy.costLabel(21, 30, max: 50), '21 of the 30 marks you missed were in this chapter.');
    });
  });

  group('Across your mocks, said as a finding', () {
    test('the same number every time is "in each of your last N"', () {
      expect(
        RulesCopy.neverOpenedLine('Never opened, last 3 Business Studies mocks, oldest first: 49, 49 and 49 of 50.'),
        'You left 49 of 50 questions unopened in each of your last 3 Business Studies mocks.',
      );
    });

    test('numbers that differ keep their order', () {
      expect(
        RulesCopy.neverOpenedLine('Never opened, last 2 Accountancy mocks, oldest first: 0 and 49 of 50.'),
        'In your last 2 Accountancy mocks you left 0 and 49 of 50 questions unopened, oldest first.',
      );
      expect(
        RulesCopy.neverOpenedLine('Never opened, last 3 Accountancy mocks, oldest first: 7, 6 and 4 of 50.'),
        'In your last 3 Accountancy mocks you left 7, 6 and 4 of 50 questions unopened, oldest first.',
      );
    });

    test('a sentence of another shape is left as the server wrote it', () {
      const gate = 'Never opened needs 3 timed mocks in a subject. You have 1.';
      expect(RulesCopy.neverOpenedLine(gate), gate);
    });
  });
}
