// Mobi's read of a paper (20 Oct, owner: "it doesn't do the SWOT analysis, it is very basic"): every line from the
// paper's own numbers, ties said honestly, the reach as this paper's arithmetic naming exactly what "Fix these"
// repairs, and the read scaled to the paper's size.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/model/next_move.dart';
import 'package:mockmob/features/result/model/paper_read.dart';

enum _V { r, w, b }

MoveAnalysis _rows(List<(String?, _V)> qs) => MoveAnalysis([
  for (var i = 0; i < qs.length; i++)
    MoveRow(
      qid: 'q${i + 1}',
      number: i + 1,
      chapter: qs[i].$1,
      verdict: switch (qs[i].$2) {
        _V.r => RowVerdict.correct,
        _V.w => RowVerdict.wrong,
        _V.b => RowVerdict.skipped,
      },
      givenIndex: qs[i].$2 == _V.b ? null : 1,
    ),
]);

void main() {
  // Quick 10: Goodwill 1 right 3 wrong; Admission 3 right 1 wrong; Retirement 2 right (clean).
  final ten = _rows([
    ('Goodwill', _V.w),
    ('Admission', _V.r),
    ('Goodwill', _V.w),
    ('Retirement', _V.r),
    ('Admission', _V.r),
    ('Goodwill', _V.r),
    ('Admission', _V.w),
    ('Retirement', _V.r),
    ('Goodwill', _V.w),
    ('Admission', _V.r),
  ]);

  test('the reach names one chapter, its arithmetic, and exactly the answers "Fix these" repairs', () {
    final r = paperReadOf(ten);
    // 6 right, 4 wrong: 26. Goodwill's 3 wrong fixed: 26 + 18 = 44.
    expect(r.reach, 'Those 3 wrong answers in Goodwill cost you 18 marks. Answered right, this paper would have been 44, not 26.');
    expect(r.fixQids, ['q1', 'q3', 'q9']);
    expect(r.fixChapter, 'Goodwill');
    // The rest of the reach, because Goodwill is not every wrong answer.
    expect(r.reachNote, 'With every wrong answer right, this paper would have been 50.');
    expect(PaperReadCopy.fixKey(3), 'Fix these 3');
  });

  test('strengths are real: a clean chapter, never the chapter that lost the most', () {
    final r = paperReadOf(ten);
    expect(r.strengths.first, 'All 2 right in Retirement.');
  });

  test('chapters are ranked with ties shared', () {
    final tied = _rows([('A', _V.w), ('B', _V.w), ('A', _V.r), ('B', _V.r), ('C', _V.r), ('C', _V.r), ('A', _V.r), ('B', _V.r)]);
    final r = paperReadOf(tied);
    expect([for (final c in r.leakChapters) (c.name, c.rank, c.tied)], [('A', 1, true), ('B', 1, true)]);
    // The reach takes the first tied chapter in paper order, and says so by name: what the key repairs is what it says.
    expect(r.fixChapter, 'A');
    expect(r.reach, contains('in A'));
  });

  test('nothing right: no strength is made up', () {
    final r = paperReadOf(_rows([for (var i = 0; i < 10; i++) ('Goodwill', _V.b)]));
    expect(r.strengths, isEmpty);
    // One chapter: no ranking, the loss in words.
    expect(r.leaks, ['In Goodwill, 10 questions left blank cost 50 marks.']);
    expect(r.reach, 'Answered right, the 10 questions you left blank would have made this paper 50, not 0.');
    expect(r.fixQids, isEmpty);
  });

  test('all right: nothing lost and the next step', () {
    final r = paperReadOf(_rows([for (var i = 0; i < 5; i++) ('Goodwill', _V.r)]));
    expect(r.strengths, ['You got all 5 right, so there is nothing to fix from this paper.']);
    expect(r.leaks, ['No marks slipped on this paper.']);
    expect(r.reach, 'You took all 25 marks, so a harder paper is the next step.');
    expect(r.risks, isEmpty);
  });

  test('threats only from real numbers: rushed wrong answers need recorded times', () {
    expect(paperReadOf(ten).risks, isEmpty);
    final timed = paperReadOf(ten, dwellMs: {'q1': 9000, 'q3': 12000, 'q9': 45000, for (var i = 2; i <= 10; i += 2) 'q$i': 40000});
    expect(timed.risks.first, '2 wrong answers took under 20 seconds each. Read twice before you mark.');
  });

  test('a chapter slipping against the earlier papers is a threat', () {
    final r = paperReadOf(ten, history: {'Goodwill': (n: 6, right: 5)});
    expect(r.risks, contains('Goodwill is slipping: 5 of 6 right in your earlier papers, 1 of 4 today.'));
  });

  test('changed answers: the ones that cost are a weakness, the ones that won a strength', () {
    final r = paperReadOf(ten, changes: [-6, 6, 6]);
    expect(r.leaks, contains('One changed answer cost you 6 marks.'));
    expect(r.strengths, contains('2 changed answers won you 12 marks.'));
  });

  test('the read scales with the paper: a short set gets one line a block and no note', () {
    final five = paperReadOf(_rows([('A', _V.r), ('A', _V.w), ('B', _V.r), ('B', _V.r), ('A', _V.r)]));
    expect(five.strengths.length, lessThanOrEqualTo(1));
    expect(five.reachNote, isNull);
    final fifty = paperReadOf(_rows([for (var i = 0; i < 50; i++) ('C${i % 5}', i % 3 == 0 ? _V.w : _V.r)]));
    expect(fifty.reachNote, isNotNull);
  });

  test('a held key is never in "Fix these"', () {
    final r = paperReadOf(ten, reviews: {'q3': 'under_review'});
    expect(r.fixQids, isNot(contains('q3')));
  });

  test('the end of a long paper left blank is said with its marks', () {
    final r = paperReadOf(_rows([
      for (var i = 0; i < 16; i++) ('A', i.isEven ? _V.r : _V.w),
      for (var i = 0; i < 4; i++) ('B', _V.b),
    ]));
    expect(r.risks, contains('The last 4 questions were left blank: 20 marks not earned. Keep time for the end.'));
  });
}
