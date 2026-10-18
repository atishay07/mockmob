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

  group('missedMarksDenominator (the one rule for "47 of the 245 marks you missed")', () {
    test('a chapter is shown against what the whole paper missed', () {
      expect(missedMarksDenominator(chapterMissed: 47, paperMissed: 245, paperMax: 250), 245);
      expect(missedMarksDenominator(chapterMissed: 245, paperMissed: 245, paperMax: 250), 245, reason: 'one chapter can be all of it');
      expect(missedMarksDenominator(chapterMissed: 12, paperMissed: 30), 30, reason: 'no known paper maximum');
    });

    test('a negative score has no denominator: the paper missed more than it holds', () {
      expect(missedMarksDenominator(chapterMissed: 21, paperMissed: 51, paperMax: 50), isNull);
      expect(missedMarksDenominator(chapterMissed: 21, paperMissed: 50, paperMax: 50), 50, reason: 'a zero score misses exactly the paper');
    });

    test('a chapter that claims more than the paper missed gets no fraction', () {
      expect(missedMarksDenominator(chapterMissed: 47, paperMissed: 45, paperMax: 250), isNull);
    });
  });
}
