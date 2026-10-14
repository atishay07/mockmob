import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/models/attempt.dart';

import 'support/fixtures.dart';

void main() {
  final attempt = attemptOf(questions: [
    ('Goodwill', V.right),
    ('Goodwill', V.wrong),
    ('Ratios', V.blank),
    ('Ratios', V.wrong),
    ('Ratios', V.wrong),
    ('Ratios', V.wrong),
  ]);
  String id(int n) => attempt.questions[n - 1].id;

  test('wrong answers only, never blanks', () {
    final c = repairCandidates(attempt);
    expect([for (final x in c) x.number], [2, 4, 5, 6]);
    expect(c.first.chapter, 'Goodwill');
    expect(c.first.givenIndex, 1);
  });

  test('held review states are excluded, a corrected review is not', () {
    final reviews = {
      id(2): const AnswerReview(state: AnswerReview.withdrawn),
      id(4): const AnswerReview(state: AnswerReview.underReview),
      id(5): const AnswerReview(state: AnswerReview.contentChanged),
      id(6): const AnswerReview(state: AnswerReview.keyChangedUnverified),
    };
    expect(repairCandidates(attempt, reviews: reviews), isEmpty);
    final corrected = {id(2): const AnswerReview(state: AnswerReview.corrected, currentIndex: 1)};
    expect(repairCandidates(attempt, reviews: corrected).length, 4);
  });

  test('already repaired and not_a_mistake ids are excluded', () {
    final c = repairCandidates(attempt, repairedIds: {id(2)}, notAMistakeIds: {id(4)});
    expect([for (final x in c) x.number], [5, 6]);
  });

  group('repair time', () {
    test('3 minutes per mistake rounded up to 5', () {
      expect(repairMinutes(0), isNull);
      expect(repairMinutes(1), 5);
      expect(repairMinutes(2), 10);
      expect(repairMinutes(3), 10);
      expect(repairMinutes(4), 15);
      expect(repairMinutes(5), 15);
      expect(repairMinutes(6), 20);
    });
  });

  group('duration chips', () {
    test('none with 2 or fewer candidates', () {
      expect(repairDurationOptions(0), isEmpty);
      expect(repairDurationOptions(2), isEmpty);
    });

    test('chips that exceed the candidates are hidden', () {
      expect([for (final o in repairDurationOptions(3)) o.minutes], [5, 10]);
      // 4 or 5 mistakes: a last chip holds the whole chapter, as Review offers it.
      expect([for (final o in repairDurationOptions(4)) o.minutes], [5, 10, 15]);
      expect(repairDurationOptions(4).last.mistakes, 4);
      expect([for (final o in repairDurationOptions(5)) o.minutes], [5, 10, 15]);
      expect([for (final o in repairDurationOptions(6)) o.minutes], [5, 10, 20]);
      expect(repairDurationOptions(6).last.mistakes, 6);
    });
  });

  group('wallet shortfall', () {
    test('null when the balance covers the task or is unknown', () {
      expect(repairWalletShortfall(mistakes: 3, balance: 3), isNull);
      expect(repairWalletShortfall(mistakes: 3, balance: null), isNull);
    });

    test('reports needed and balance when short', () {
      final s = repairWalletShortfall(mistakes: 3, balance: 2)!;
      expect(s.needed, 3);
      expect(s.balance, 2);
      expect(s.coveredMistakes, 2);
    });
  });
}
