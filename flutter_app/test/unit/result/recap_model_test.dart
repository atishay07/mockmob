import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/platform/review_prompt.dart' show ReviewMoment;
import 'package:mockmob/core/widgets/bubbles/bubble_painter.dart';
import 'package:mockmob/features/result/model/answer_items.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/result/model/recap_variant.dart';

import 'support/fixtures.dart';

void main() {
  group('the spec fixture (26 correct, 15 wrong, 9 not attempted)', () {
    final m = mock7();

    test('marks are 115 out of 250 and the four parts add up', () {
      expect(m.marks, 115);
      expect(m.maxMarks, 250);
      final b = m.breakdown;
      expect(b.parts, [115, 15, 75, 45]);
      expect(b.parts.reduce((a, c) => a + c), 250);
      expect(b.lost, 135);
      expect(b.takenOff + b.notEarnedOnWrong + b.notEarnedOnBlank, 135);
    });

    test('it is Mock 7, the third full paper this month, saved at 10:44 PM local', () {
      expect(m.ordinal, 7);
      expect(m.mockLabel, 'Mock 7');
      expect(m.title, 'Mock 7, Accountancy');
      expect(m.monthMockCount, 3);
      expect(m.receivedAt, DateTime.utc(2026, 10, 12, 17, 14).toLocal());
    });

    test('one bubble per question; wrong and blank are never merged', () {
      expect(m.cells.length, 50);
      expect(m.cells.where((c) => c == BubbleState.filled).length, 26);
      expect(m.cells.where((c) => c == BubbleState.wrong).length, 15);
      expect(m.cells.where((c) => c == BubbleState.blank).length, 9);
    });

    test('the first thing to fix is the chapter that lost the most, from this mock only', () {
      final leader = m.chapters.leader!;
      expect(leader.chapter, 'Admission of a partner');
      expect((leader.questions, leader.correct, leader.wrong, leader.unattempted), (9, 3, 4, 2));
      expect(leader.marksLost, 34);
    });

    test('repair candidates are the wrong answers only', () {
      expect(m.candidates.length, 15);
      expect(m.blankCount, 9);
      expect(m.defaultRepairMinutes, 10);
    });

    test('a repaired answer is no longer a candidate', () {
      final first = mock7().candidates.first.questionId;
      expect(mock7(repaired: {first}).candidates.length, 14);
    });
  });

  group('variants', () {
    test('held marks win over everything, and held questions leave the chapter breakdown', () {
      final d = detail(
        reviews: {
          'q1': {'state': 'under_review'},
        },
        recap: {'tone': 'higher'},
      );
      final m = mock7(withDetail: d);
      expect(m.variant, RecapVariant.held);
      expect(m.heldCount, 1);
      expect(m.cells.first, BubbleState.marked);
      expect(m.chapters.stats.fold<int>(0, (n, s) => n + s.questions), 49);
      expect(m.variant.celebratory, isFalse);
      expect(m.variant.allowsTokens, isFalse);
    });

    test('the first mock in a subject is first_mock, even with quick practice in the list', () {
      final d = detail();
      final quick = attempt(id: 'qp', mode: 'quick', completedAt: DateTime.utc(2026, 10, 1));
      final m = mock7(withDetail: d, attempts: [quick, d.attempt]);
      expect(m.ordinal, 1);
      expect(m.variant, RecapVariant.firstMock);
      expect(m.monthMockCount, 1);
    });

    test('tone comes from the server only', () {
      RecapVariant tone(String? t) => mock7(withDetail: detail(recap: {'tone': ?t})).variant;
      expect(tone('lower'), RecapVariant.lower);
      expect(tone('higher'), RecapVariant.higher);
      expect(tone('neutral'), RecapVariant.standard);
      expect(tone(null), RecapVariant.standard);
      expect(RecapVariant.lower.celebratory, isFalse);
      expect(RecapVariant.higher.celebratory, isTrue);
    });

    test('the comparison names the earlier mock when it is on this phone', () {
      final m = mock7(
        withDetail: detail(
          recap: {
            'previousComparable': {'marks': 92, 'max': 250, 'attemptId': 'p5'},
          },
        ),
      );
      expect(m.previous!.label, 'Mock 6');
      expect((m.previous!.marks, m.previous!.max), (92, 250));
      expect(mock7().previous, isNull);
    });

    test('keys unavailable is a flag, not a variant', () {
      final m = mock7(withDetail: detail(state: 'unavailable'));
      expect(m.keysUnavailable, isTrue);
      expect(m.variant, RecapVariant.standard);
    });
  });

  group('the store review moment', () {
    const previous = {'marks': 100, 'max': 250, 'attemptId': 'p5'};

    ReviewMoment? moment({String? tone, bool withPrevious = true, String mode = 'full', Map<String, Map<String, dynamic>> reviews = const {}, String state = 'ready', bool first = false}) {
      final d = detail(
        attemptBody: attemptJson(mode: mode),
        reviews: reviews,
        state: state,
        recap: {'tone': ?tone, if (withPrevious) 'previousComparable': previous},
      );
      return mock7(withDetail: d, attempts: first ? [d.attempt] : null).reviewMoment;
    }

    test('an improved full mock is a moment, and so is one that held steady against the last', () {
      expect(moment(tone: 'higher'), ReviewMoment.resultImproved);
      expect(moment(tone: 'neutral'), ReviewMoment.resultHeld);
      expect(moment(tone: 'neutral', withPrevious: false), isNull, reason: 'nothing to hold steady against');
    });

    test('a lower result, a first mock and a result with no tone are not', () {
      expect(moment(tone: 'lower'), isNull);
      expect(moment(tone: 'higher', first: true), isNull);
      expect(moment(withPrevious: false), isNull);
    });

    test('NTA mode and quick practice never are', () {
      expect(moment(tone: 'higher', mode: 'nta'), isNull);
      expect(moment(tone: 'neutral', mode: 'nta'), isNull);
      expect(mock7(withDetail: detail(attemptBody: attemptJson(mode: 'nta'))).isNta, isTrue);
      expect(moment(tone: 'higher', mode: 'quick'), isNull);
    });

    test('a figure that is not final or not whole never is', () {
      expect(
        moment(tone: 'higher', reviews: {'q1': {'state': 'under_review'}}),
        isNull,
        reason: 'answer keys on hold',
      );
      expect(moment(tone: 'higher', state: 'unavailable'), isNull, reason: 'keys unavailable');
    });
  });

  group('the first-mock token', () {
    final milestone = RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 10, 12, 17, 12));

    test('shows only for the server milestone on the only mock', () {
      final d = detail();
      expect(mock7(withDetail: d, attempts: [d.attempt], milestones: [milestone]).firstMockTokenAt, isNotNull);
      expect(mock7(withDetail: d, attempts: [d.attempt]).firstMockTokenAt, isNull);
      expect(mock7(milestones: [milestone]).firstMockTokenAt, isNull);
    });
  });

  group("the student's own day, not the phone's (result-review-07)", () {
    // 18:00 UTC on 31 October is 11:30 PM in India (UTC+5:30) and already 1 November at UTC+6.
    DateTime ist(DateTime t) => t.toUtc().add(const Duration(hours: 5, minutes: 30));
    DateTime plusSix(DateTime t) => t.toUtc().add(const Duration(hours: 6));
    final earlier = attempt(id: 'b', completedAt: DateTime.utc(2026, 10, 30, 10));
    final late = attempt(id: 'a', completedAt: DateTime.utc(2026, 10, 31, 18));

    test('the month a mock belongs to follows the zone it is read in', () {
      expect(monthMockCount([earlier, late], late, toLocal: ist), 2);
      expect(monthMockCount([earlier, late], late, toLocal: plusSix), 1);
    });

    test('submitted and received times are converted with the same zone', () {
      final m = buildRecapModel(
        attempt: late,
        attempts: [earlier, late],
        receivedAt: DateTime.utc(2026, 10, 31, 18, 2),
        toLocal: ist,
      );
      expect(m.submittedAt.hour, 23);
      expect(m.submittedAt.minute, 30);
      expect(m.receivedAt!.minute, 32);
      expect(m.monthMockCount, 2);
    });
  });

  test('quick practice takes no number and no effort count', () {
    final a = attempt(mode: 'quick');
    final m = buildRecapModel(attempt: a, attempts: [a]);
    expect(m.ordinal, isNull);
    expect(m.mockLabel, 'Quick practice');
    expect(m.monthMockCount, 0);
  });

  group('answer groups and the key rule', () {
    test('wrong lead, then held, then blank, then correct', () {
      final d = detail(
        reviews: {
          'q1': {'state': 'withdrawn'},
        },
      );
      final g = buildAnswerGroups(d.attempt, detail: d);
      expect(g.held.single.number, 1);
      expect(g.wrong.length + g.held.length + g.blank.length + g.correct.length, 50);
      expect(g.held.single.keyIndex, isNull);
      expect(g.held.single.explanation, isNull);
    });

    test('a corrected review shows its current key; unavailable shows none at all', () {
      final d = detail(
        reviews: {
          'q2': {'state': 'corrected', 'currentIndex': 3, 'explanation': 'Corrected.'},
        },
      );
      final item = buildAnswerGroups(d.attempt, detail: d).all.firstWhere((a) => a.number == 2);
      expect(item.keyIndex, 3);
      expect(item.explanation, 'Corrected.');
      final off = detail(state: 'unavailable');
      expect(buildAnswerGroups(off.attempt, detail: off).all.every((a) => a.keyIndex == null && a.explanation == null), isTrue);
    });

    test('without the detail read no key is shown', () {
      final a = attempt();
      expect(buildAnswerGroups(a).all.every((x) => x.keyIndex == null), isTrue);
    });
  });

  group('blanks in Review', () {
    test('only the newest paper with blanks has its blanks kept in Review', () {
      final older = attempt(id: 'a6', completedAt: DateTime.utc(2026, 10, 5, 17));
      final newer = attempt(id: 'a7', completedAt: DateTime.utc(2026, 10, 12, 17));
      final both = [older, newer];
      expect(buildRecapModel(attempt: newer, attempts: both).blanksInReview, isTrue);
      expect(buildRecapModel(attempt: older, attempts: both).blanksInReview, isFalse, reason: 'a replayed older result');
    });
  });
}
