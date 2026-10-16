import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/again/review_again_data.dart';
import 'package:mockmob/features/review/again/review_again_local.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';

import 'support/review_fixtures.dart';

RepairLocalRecord _repaired(String attempt, String qid, DateTime at) =>
    RepairLocalRecord(attemptId: attempt, questionId: qid, requestId: 'req-$qid-000000000000', status: 'explained', ackedAt: at);

void main() {
  final mockSix = allAttempts.firstWhere((a) => a.id == 'm6');
  final mockSeven = allAttempts.firstWhere((a) => a.id == 'm7');

  ReviewIndex indexWith(List<RepairLocalRecord> records) => buildReviewIndex(allAttempts, records);

  AttemptDetail detail(Attempt a, {Map<String, AnswerReview> reviews = const {}}) => AttemptDetail(attempt: a, answerReviews: reviews);

  group('the set', () {
    test('only repaired mistakes: an open one belongs to the repair', () {
      final index = indexWith([_repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 13))]);
      final candidates = reviewAgainCandidates(index);
      expect(candidates.map((i) => i.key), ['m7/m7-q0']);
    });

    test('the oldest repair comes first', () {
      final index = indexWith([
        _repaired('m7', 'm7-q10', DateTime.utc(2026, 10, 14)),
        _repaired('m6', 'm6-q5', DateTime.utc(2026, 10, 4)),
        _repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 13)),
      ]);
      expect(reviewAgainCandidates(index).map((i) => i.key), ['m6/m6-q5', 'm7/m7-q0', 'm7/m7-q10']);
    });

    test('questions missed in the last Review again come first', () {
      final index = indexWith([
        _repaired('m6', 'm6-q5', DateTime.utc(2026, 10, 4)),
        _repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 13)),
        _repaired('m7', 'm7-q10', DateTime.utc(2026, 10, 14)),
      ]);
      final ordered = reviewAgainCandidates(index, missed: {'m7/m7-q10'});
      expect(ordered.first.key, 'm7/m7-q10');
      expect(ordered.skip(1).map((i) => i.key), ['m6/m6-q5', 'm7/m7-q0']);
    });

    test('a seed (the run just finished) narrows the set to those mistakes', () {
      final index = indexWith([
        _repaired('m6', 'm6-q5', DateTime.utc(2026, 10, 4)),
        _repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 13)),
      ]);
      expect(reviewAgainCandidates(index, seed: {'m7/m7-q0'}).map((i) => i.key), ['m7/m7-q0']);
    });

    test('a question without a cached detail is left out, never shown broken', () {
      final index = indexWith([
        _repaired('m6', 'm6-q5', DateTime.utc(2026, 10, 4)),
        _repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 13)),
      ]);
      final set = buildReviewAgainSet(
        candidates: reviewAgainCandidates(index),
        attemptOf: index.attempt,
        detailOf: (id) => id == 'm7' ? detail(mockSeven) : null,
      );
      expect(set.map((q) => q.key), ['m7/m7-q0']);
    });

    test('a key held under review is never shown: that question is left out', () {
      final index = indexWith([_repaired('m7', 'm7-q0', DateTime.utc(2026, 10, 13))]);
      final set = buildReviewAgainSet(
        candidates: reviewAgainCandidates(index),
        attemptOf: index.attempt,
        detailOf: (id) => detail(mockSeven, reviews: {'m7-q0': const AnswerReview(state: AnswerReview.underReview)}),
      );
      expect(set, isEmpty);
    });

    test('each question carries the key and the free explanation from the phone', () {
      final index = indexWith([_repaired('m6', 'm6-q5', DateTime.utc(2026, 10, 4))]);
      final set = buildReviewAgainSet(candidates: reviewAgainCandidates(index), attemptOf: index.attempt, detailOf: (_) => detail(mockSix));
      expect(set.single.keyIndex, 1);
      expect(set.single.explanation, isNotNull);
    });

    test('the set holds at most ten, filled past the ones that were left out', () {
      final records = [for (var i = 0; i < 5; i++) _repaired('m7', 'm7-q${[0, 10, 30, 6, 13][i]}', DateTime.utc(2026, 10, 13, i))];
      final index = indexWith(records);
      final set = buildReviewAgainSet(candidates: reviewAgainCandidates(index), attemptOf: index.attempt, detailOf: (_) => detail(mockSeven), limit: 3);
      expect(set, hasLength(3));
    });
  });

  group('how it went', () {
    test('three quarters or more held is proud, half is a nod, fewer is encouragement', () {
      expect(const AgainResult(held: 6, total: 8, missedKeys: []).tone, AgainTone.proud);
      expect(const AgainResult(held: 4, total: 8, missedKeys: []).tone, AgainTone.nod);
      expect(const AgainResult(held: 1, total: 8, missedKeys: []).tone, AgainTone.encourage);
    });
  });

  group('the missed keys on the phone', () {
    test('an unreadable store is an empty set, never an error', () {
      expect(decodeMissed(null), isEmpty);
      expect(decodeMissed('not json'), isEmpty);
      expect(decodeMissed('{"a":1}'), isEmpty);
      expect(decodeMissed('["m7/m7-q0", 4]'), {'m7/m7-q0'});
    });
  });
}
