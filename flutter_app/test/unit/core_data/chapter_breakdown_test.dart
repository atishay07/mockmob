import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';

import 'support/fixtures.dart';

void main() {
  group('observedChapterBreakdown', () {
    test('marksLost is wrong * 6 + unattempted * 5 and sorts descending', () {
      final attempt = attemptOf(questions: [
        ...chapterOf('Goodwill', right: 3, wrong: 1), // 6
        ...chapterOf('Admission of a partner', right: 3, wrong: 4, blank: 2), // 34
        ...chapterOf('Ratios', right: 1, wrong: 0, blank: 3), // 15
      ]);
      final b = observedChapterBreakdown(attempt);
      expect([for (final s in b.stats) s.chapter], ['Admission of a partner', 'Ratios', 'Goodwill']);
      final top = b.stats.first;
      expect(top.marksLost, 4 * 6 + 2 * 5);
      expect(top.questions, 9);
      expect((top.correct, top.wrong, top.unattempted), (3, 4, 2));
      expect(b.leader?.chapter, 'Admission of a partner');
    });

    test('ties break on wrong answers, then chapter name, so order is stable', () {
      final attempt = attemptOf(questions: [
        ...chapterOf('Beta', wrong: 2, right: 1), // 12
        ...chapterOf('Alpha', wrong: 2, right: 1), // 12
        ...chapterOf('Gamma', blank: 2, right: 1), // 10
        ...chapterOf('Delta', wrong: 1, blank: 1, right: 1), // 11
      ]);
      final b = observedChapterBreakdown(attempt);
      expect([for (final s in b.stats) s.chapter], ['Alpha', 'Beta', 'Delta', 'Gamma']);
    });

    test('equal loss with more wrong answers sorts first', () {
      // 30 lost each: A has 5 wrong, B has 6 blank.
      final attempt = attemptOf(questions: [
        ...chapterOf('B', blank: 6, right: 1),
        ...chapterOf('A', wrong: 5, right: 1),
      ]);
      final b = observedChapterBreakdown(attempt);
      expect([for (final s in b.stats) s.chapter], ['A', 'B']);
    });

    test('a chapter with fewer than 3 questions is never named as the leader', () {
      final attempt = attemptOf(questions: [
        ...chapterOf('Tiny', wrong: 2), // 12 lost but only 2 questions
        ...chapterOf('Big', right: 2, wrong: 1), // 6 lost, 3 questions
      ]);
      final b = observedChapterBreakdown(attempt);
      expect(b.stats.first.chapter, 'Tiny');
      expect(b.leader?.chapter, 'Big');
      expect(b.listWrongByNumber, isFalse);
    });

    test('when every chapter is under 3 questions, no leader and wrong answers list by number', () {
      final attempt = attemptOf(questions: [
        ('A', V.wrong),
        ('A', V.right),
        ('B', V.right),
        ('B', V.wrong),
      ]);
      final b = observedChapterBreakdown(attempt);
      expect(b.leader, isNull);
      expect(b.listWrongByNumber, isTrue);
      expect(b.wrongNumbers, [1, 4]);
    });

    test('wrong and not attempted are kept apart with question numbers', () {
      final attempt = attemptOf(questions: [
        ('A', V.right),
        ('A', V.wrong),
        ('A', V.blank),
        ('A', V.wrong),
      ]);
      final s = observedChapterBreakdown(attempt).stats.single;
      expect(s.wrongNumbers, [2, 4]);
      expect(s.blankNumbers, [3]);
    });

    test('leader with only blanks is reported as blanks only', () {
      final attempt = attemptOf(questions: [...chapterOf('Goodwill', right: 4, blank: 5)]);
      final b = observedChapterBreakdown(attempt);
      expect(b.leader?.chapter, 'Goodwill');
      expect(b.leaderIsBlanksOnly, isTrue);
    });

    test('questions held for a key check are left out', () {
      final attempt = attemptOf(questions: [...chapterOf('A', right: 1, wrong: 3)]);
      final held = {attempt.questions[1].id, attempt.questions[2].id};
      final b = observedChapterBreakdown(attempt, excludeQuestionIds: held);
      expect(b.stats.single.questions, 2);
      expect(b.stats.single.wrong, 1);
    });

    test('a chapter that lost nothing is not a loss chapter', () {
      final attempt = attemptOf(questions: [...chapterOf('A', right: 3), ...chapterOf('B', right: 1, wrong: 2)]);
      final b = observedChapterBreakdown(attempt);
      expect([for (final s in b.lossChapters) s.chapter], ['B']);
    });
  });
}
