import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/widgets/repair_entry_view.dart';

import 'support/review_fixtures.dart';

RepairLocalRecord record(String attempt, String qid, String status, {DateTime? at}) =>
    RepairLocalRecord(attemptId: attempt, questionId: qid, requestId: 'req-$qid-000000000000', status: status, ackedAt: at);

void main() {
  group('buildReviewIndex', () {
    test('groups wrong answers by subject and chapter, open chapters first', () {
      final index = buildReviewIndex(allAttempts, const []);
      final partnership = index.groups.firstWhere((g) => g.chapter.startsWith('Partnership'));
      expect(partnership.items.map((i) => i.key), containsAll(['m7/m7-q0', 'm7/m7-q10', 'm7/m7-q30', 'm6/m6-q5', 'm6/m6-q20']));
      expect(partnership.subjectId, 'accountancy');
      expect(index.openCount, 8);
      expect(index.groups.map((g) => g.chapter), contains('Money and banking'));
    });

    test('blanks are never mistakes and come from the newest attempt with any', () {
      final index = buildReviewIndex(allAttempts, const []);
      expect(index.blanks!.attemptId, 'm7');
      expect(index.blanks!.items.map((b) => b.number), [10, 29, 48]);
      for (final g in index.groups) {
        expect(g.items.any((i) => i.questionId == 'm7-q9'), isFalse);
      }
    });

    test("tonight is the newest attempt's largest open chapter, in question order", () {
      final tonight = buildReviewIndex(allAttempts, const []).tonight!;
      expect(tonight.attemptId, 'm7');
      expect(tonight.chapter, startsWith('Partnership'));
      expect(tonight.items.map((i) => i.number), [1, 11, 31]);
      expect(tonight.source, 'Mock 2');
    });

    test('local records set the stage; not_a_mistake hides the item', () {
      final at = DateTime.utc(2026, 10, 12, 17, 40);
      final index = buildReviewIndex(allAttempts, [
        record('m7', 'm7-q0', RepairLocalStatus.explained, at: at),
        record('m7', 'm7-q10', RepairLocalStatus.notAMistake, at: at),
        record('m7', 'm7-q30', RepairLocalStatus.heldForRecheck, at: at),
        record('m7', 'm7-q6', RepairLocalStatus.reviewed),
        record('m7', 'm7-q13', RepairLocalStatus.pending),
      ]);
      expect(index.item('m7', 'm7-q0')!.stage, MistakeStage.repaired);
      expect(index.item('m7', 'm7-q0')!.stageAt, at);
      expect(index.item('m7', 'm7-q10'), isNull);
      expect(index.item('m7', 'm7-q30')!.stage, MistakeStage.setAside);
      expect(index.item('m7', 'm7-q6')!.stage, MistakeStage.reviewed);
      expect(index.item('m7', 'm7-q6')!.stage.isOpen, isTrue, reason: 'a key review is not a repair');
      expect(index.item('m7', 'm7-q13')!.stage, MistakeStage.found);
    });

    test('nextAfter prefers the same attempt, then any other open chapter', () {
      final index = buildReviewIndex(allAttempts, const []);
      final tonight = index.tonight!;
      final next = index.nextAfter('m7', {for (final i in tonight.items) i.key})!;
      expect(next.attemptId, 'm7');
      expect(next.chapter, isNot(tonight.chapter));
      final rest = index.nextAfter('m7', {
        for (final g in index.groups)
          for (final i in g.items)
            if (i.attemptId == 'm7') i.key,
      })!;
      expect(rest.attemptId, isNot('m7'));
    });

    test('an attempt with no mistakes gives no tonight pick', () {
      final index = buildReviewIndex([quick], [record('q1', 'q1-q3', RepairLocalStatus.explained, at: DateTime.utc(2026, 10, 8))]);
      expect(index.tonight, isNull);
      expect(index.openGroups, isEmpty);
      expect(index.hasAnyMistake, isTrue);
    });
  });

  group('copy', () {
    test('short chapter and the Hinglish caption', () {
      expect(ReviewCopy.shortChapter('Partnership: admission of a partner'), 'Partnership');
      expect(ReviewCopy.aajKaRepair(10, 'Partnership: admission of a partner'), 'Aaj ka repair: 10 minutes, Partnership.');
    });

    test('the spoken label over the wrong bubbles is singular for one question', () {
      expect(ReviewCopy.wrongQuestionsSpoken([3]), 'Question 3, answered wrong');
      expect(ReviewCopy.wrongQuestionsSpoken([3, 5]), 'Questions 3 and 5, answered wrong');
      expect(ReviewCopy.wrongQuestionsSpoken([3, 5, 9]), 'Questions 3, 5 and 9, answered wrong');
    });

    test('ending lines count only what happened', () {
      final night = DateTime(2026, 10, 13, 21, 30);
      expect(ReviewCopy.endingLine('Partnership: x', 3, 3, now: night), 'Partnership: all 3 repaired tonight.');
      expect(
        ReviewCopy.endingLine('Partnership', 2, 3, now: night, setAside: 1),
        'Partnership: 2 of 3 repaired tonight. 1 set aside while its key is checked.',
      );
      // In the morning it is "today", never "tonight".
      expect(ReviewCopy.endingLine('Partnership', 1, 1, now: DateTime(2026, 10, 13, 7, 34)), 'Partnership: the mistake repaired today.');
      expect(ReviewCopy.finishFor(DateTime(2026, 10, 13, 7, 34)), 'Finish for today');
      expect(ReviewCopy.tonightOverline(DateTime(2026, 10, 13, 16), 'Accountancy'), "Tonight's repair, Accountancy");
      expect(ReviewCopy.nothingRepaired(0, 0), contains('Nothing was charged'));
    });

    test('no banned vocabulary anywhere in the copy', () {
      final all = [
        ReviewCopy.allClearMessage,
        ReviewCopy.lifeCaption,
        ReviewCopy.checkedLater,
        ReviewCopy.endingLine('Partnership', 1, 1, now: DateTime(2026, 10, 13, 22)),
        ReviewCopy.firstRepair,
        ReviewCopy.tonightCount(3, 'Mock 2', 5),
      ].join(' ').toLowerCase();
      for (final word in ['fixed', 'mastered', 'forever', '!']) {
        expect(all.contains(word), isFalse, reason: word);
      }
    });
  });

  group('EntryPlan', () {
    final clock = ReviewClock('Asia/Kolkata', () => eveningUtc);
    AiCredits credits(Object? spendable, {bool known = true, String state = 'available'}) => AiCredits.fromJson({
      'state': state,
      'wallet': {'known': known, 'spendable': spendable, 'resetAt': '2026-10-31T18:30:00Z'},
    });

    test('an unknown balance shows no line and never counts as zero', () {
      final plan = EntryPlan.of(3, credits(null, known: false), clock);
      expect(plan.line, isNull);
      expect(plan.primary, ReviewCopy.begin);
      expect(plan.keyOnly, isFalse);
    });

    test('enough credits: the credit line and Begin', () {
      final plan = EntryPlan.of(3, credits(9), clock);
      expect(plan.line, 'Uses 1 explanation credit for each mistake. You have 9.');
      expect(plan.limit, isNull);
    });

    test('a short wallet starts with what it covers, or reads the keys', () {
      final plan = EntryPlan.of(3, credits(2), clock);
      expect(plan.line, 'This repair needs 3 explanation credits. You have 2. Start with 2 mistakes, or read the key explanations.');
      expect(plan.limit, 2);
      expect(plan.offerKeys, isTrue);
    });

    test('an empty wallet reads the keys, with the renewal date', () {
      final plan = EntryPlan.of(3, credits(0), clock);
      expect(plan.keyOnly, isTrue);
      expect(plan.line, "You have used this month's explanation credits. Explanation credits renew on 1 November.");
    });

    test('paused explanations read the keys', () {
      final plan = EntryPlan.of(3, credits(5, state: 'paused'), clock);
      expect(plan.keyOnly, isTrue);
      expect(plan.line, ReviewCopy.pausedLine);
    });
  });
}
