import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';

import 'support/fixtures.dart';

void main() {
  group('markBreakdown', () {
    test('fixture 26 correct, 15 wrong, 9 not attempted gives 115 scored and 135 lost', () {
      final b = markBreakdown(26, 15, 9);
      expect(b.scored, 115);
      expect(b.takenOff, 15);
      expect(b.notEarnedOnWrong, 75);
      expect(b.notEarnedOnBlank, 45);
      expect(b.lost, 135);
      expect(b.max, 250);
      expect(b.questions, 50);
    });

    test('the four parts always sum to n * 5', () {
      for (var c = 0; c <= 12; c++) {
        for (var w = 0; w <= 12; w++) {
          for (var u = 0; u <= 12; u++) {
            final b = markBreakdown(c, w, u);
            final n = c + w + u;
            expect(b.parts.reduce((a, x) => a + x), n * 5, reason: '$c/$w/$u');
            expect(b.scored + b.lost, b.max);
          }
        }
      }
    });

    test('negative inputs count as zero', () {
      final b = markBreakdown(-3, 2, -1);
      expect(b.correct, 0);
      expect(b.unattempted, 0);
      expect(b.scored, -2);
      expect(b.max, 10);
    });

    test('markBreakdownOf reads the attempt counts', () {
      final attempt = attemptOf(questions: [...chapterOf('A', right: 2, wrong: 1, blank: 1)]);
      final b = markBreakdownOf(attempt);
      expect(b.scored, 9);
      expect(b.max, 20);
      expect(attempt.marks, 9);
    });
  });
}
