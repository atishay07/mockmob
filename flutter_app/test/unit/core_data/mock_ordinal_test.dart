import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';

import 'support/fixtures.dart';

void main() {
  final q = chapterOf('A', right: 1);

  test('counts only full and nta attempts in the same subject, by completion time', () {
    final a1 = attemptOf(id: 'a1', mode: 'full', completedAt: 100, questions: q);
    final quick = attemptOf(id: 'quick', mode: 'quick', completedAt: 150, questions: q);
    final a2 = attemptOf(id: 'a2', mode: 'nta', completedAt: 200, questions: q);
    final other = attemptOf(id: 'econ', subject: 'economics', mode: 'full', completedAt: 250, questions: q);
    final a3 = attemptOf(id: 'a3', mode: 'full', completedAt: 300, questions: q);
    final all = [a3, other, a2, quick, a1];
    expect(mockOrdinal(all, a1), 1);
    expect(mockOrdinal(all, a2), 2);
    expect(mockOrdinal(all, a3), 3);
    expect(mockOrdinal(all, other), 1);
  });

  test('quick practice never takes a number', () {
    final quick = attemptOf(id: 'quick', mode: 'quick', questions: q);
    expect(mockOrdinal([quick], quick), isNull);
  });

  test('first mock is ordinal 1 even when the list holds quick practice', () {
    final quick1 = attemptOf(id: 'q1', mode: 'quick', completedAt: 10, questions: q);
    final quick2 = attemptOf(id: 'q2', mode: 'quick', completedAt: 20, questions: q);
    final mock = attemptOf(id: 'm1', mode: 'full', completedAt: 30, questions: q);
    expect(isFirstMock([quick1, quick2, mock], mock), isTrue);
  });

  test('an attempt not yet in the list is placed after earlier ones', () {
    final a1 = attemptOf(id: 'a1', mode: 'full', completedAt: 100, questions: q);
    final fresh = attemptOf(id: 'a2', mode: 'full', completedAt: 200, questions: q);
    expect(mockOrdinal([a1], fresh), 2);
  });

  test('equal completion times fall back to id order', () {
    final a = attemptOf(id: 'a', mode: 'full', completedAt: 100, questions: q);
    final b = attemptOf(id: 'b', mode: 'full', completedAt: 100, questions: q);
    expect(mockOrdinal([b, a], a), 1);
    expect(mockOrdinal([b, a], b), 2);
  });

  test('nextMockNumber is finished mocks in the subject plus one', () {
    final a1 = attemptOf(id: 'a1', mode: 'full', questions: q);
    final quick = attemptOf(id: 'q', mode: 'quick', questions: q);
    final other = attemptOf(id: 'o', subject: 'economics', mode: 'nta', questions: q);
    expect(nextMockNumber([a1, quick, other], 'accountancy'), 2);
    expect(nextMockNumber(const [], 'accountancy'), 1);
  });

  test('the top-level mode wins over selectionMeta.mode', () {
    final json = attemptJson(id: 'x', mode: 'quick', questions: q)..['mode'] = 'full';
    expect(attemptOfJson(json).isMock, isTrue);
  });
}
