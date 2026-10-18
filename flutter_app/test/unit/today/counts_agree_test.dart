// M6 of the v15 emulator walk: one thing, one number, on every screen. The Revise tile said "92 due today" under a lead
// that said "10 of 92"; Today's Repairs said 110, Review 123 and the lead 1 with no word about what it counted; and one
// paper had a "biggest leak" on Today that was not the chapter its result named as the costliest. Every count now has one
// source and says what it is.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/result/model/next_move.dart' show MoveAnalysis, MoveRow, RowVerdict, costliestLine;
import 'package:mockmob/features/review/data/mistake_index.dart' show buildReviewIndex;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/glance_builder.dart';
import 'package:mockmob/features/today/logic/move_builder.dart' show reviseMoveFor, reviseRoundOf;
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/glance_rows.dart' show QueueTilesBlock;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final saturday = DateTime.utc(2026, 10, 17, 14, 40);

  group('the Revise tile and the lead card say the same round', () {
    test('92 due: the lead names the round (10), as the Revise page does, and the tile says the same figure', () {
      final i = ashaInputs(now: saturday, reviseDue: 92);
      final lead = reviseMoveFor(i)!;
      expect(lead.number, '10');
      expect(lead.numberLabel, TodayCopy.reviseLabel(10));
      final queue = buildQueue(i);
      expect(queue.reviseDue, 92);
      expect(queue.reviseRound, 10);
    });

    test('the student\'s cap of 5 changes both together', () {
      final i = ashaInputs(now: saturday, reviseDue: 92, reviseCap: 5);
      expect(reviseMoveFor(i)!.number, '5');
      expect(buildQueue(i).reviseRound, 5);
      expect(buildQueue(i).reviseMinutes, 5);
    });

    test('fewer due than the round: the whole of them, with no "of"', () {
      final i = ashaInputs(now: saturday, reviseDue: 7);
      expect(reviseMoveFor(i)!.number, '7');
      expect(reviseMoveFor(i)!.numberLabel, TodayCopy.reviseLabel(7));
      expect(buildQueue(i).reviseRound, 7);
    });

    test('the server showing fewer than are due shrinks the round on both', () {
      final i = ashaInputs(now: saturday, reviseDue: 92, reviseShown: 4);
      expect(reviseRoundOf(i), (due: 92, remaining: 4, size: 4));
      expect(reviseMoveFor(i)!.number, '4');
      expect(buildQueue(i).reviseRound, 4);
    });

    test('nothing due, or unknown, has no round: never zero for unknown', () {
      expect(buildQueue(ashaInputs(now: saturday, reviseDue: 0)).reviseRound, isNull);
      expect(buildQueue(ashaInputs(now: saturday)).reviseDue, isNull);
    });

    testWidgets('on screen the tile reads "10 due today" for the round, and "7 due today" when the round is all of them', (tester) async {
      Future<void> pump(int due) => pumpMockmob(
            tester,
            Padding(padding: const EdgeInsets.all(16), child: QueueTilesBlock(queue: buildQueue(ashaInputs(now: saturday, reviseDue: due)))),
            disableAnimations: true,
          );
      await pump(92);
      expect(find.text('10'), findsOneWidget);
      expect(find.text('due today'), findsOneWidget);
      expect(find.text('of 92 due today'), findsNothing);
      await pump(7);
      expect(find.text('7'), findsOneWidget);
      expect(find.text('due today'), findsOneWidget);
    });
  });

  group('open repairs: one count, and the lead says what part it names', () {
    test('the Repairs tile is the account\'s count (Review\'s index), not a second count of the papers on hand', () {
      final i = ashaInputs(now: saturday, openRepairs: 123);
      expect(buildQueue(i).repairsOpen, 123);
    });

    test('with Review\'s count not built yet the tile counts the papers on hand, as before', () {
      expect(buildQueue(ashaInputs(now: saturday)).repairsOpen, greaterThan(0));
    });

    test('the tile is the very figure Review prints for the same record', () {
      final attempts = ashaRecord(saturday);
      final index = buildReviewIndex(attempts, const []);
      expect(index.openCount, greaterThan(0));
      expect(buildQueue(ashaInputs(now: saturday, attempts: attempts, openRepairs: index.openCount)).repairsOpen, index.openCount);
    });

    MoveHero lead(int? openRepairs) {
      final hero = buildToday(ashaInputs(now: saturday, openRepairs: openRepairs)).hero;
      expect(hero, isA<MoveHero>());
      return hero! as MoveHero;
    }

    test('the lead names its batch and the whole: "... in Partnership fundamentals. 123 open in all."', () {
      final m = lead(123);
      expect(m.kind, MoveKind.repair);
      expect(m.meaning, endsWith(' 123 open in all.'));
      expect(m.meaning, startsWith('All four are from Mock 7 on 15 Oct, in Partnership fundamentals.'));
    });

    test('a part of the chapter says so and still names the whole', () {
      expect(TodayCopy.tonightLine(3, 4, 'Mock 7', 'Admission of a partner', DateTime(2026, 10, 11), allOpen: 123), '3 of the 4 open mistakes in Admission of a partner, from Mock 7 on 11 Oct. 123 open in all.');
    });

    test('when the batch is everything open, nothing is added; with no count, the line is as it was', () {
      expect(TodayCopy.tonightLine(4, 4, 'Mock 7', 'Partnership', DateTime(2026, 10, 11), allOpen: 4), 'All four are from Mock 7 on 11 Oct, in Partnership.');
      expect(TodayCopy.tonightLine(4, 4, 'Mock 7', 'Partnership', DateTime(2026, 10, 11)), 'All four are from Mock 7 on 11 Oct, in Partnership.');
      expect(lead(null).meaning, 'All four are from Mock 7 on 15 Oct, in Partnership fundamentals.');
    });

    test('coming back after a week names the whole too', () {
      expect(TodayCopy.returningWhy('Mock 7', DateTime(2026, 10, 3), 8, 3, allOpen: 123), 'Your last paper was Mock 7 on 3 Oct. Its eight open mistakes are still here; start with three. 123 open in all.');
    });
  });

  group('the biggest leak is the chapter the result names as costliest', () {
    // Chapter A (first in the paper): 1 wrong + 1 blank = 11 marks over 2 misses. Chapter B: 2 wrong = 12 marks over 2
    // misses. By count they tie and the first wins (the old Today); by marks B costs more (the result).
    Attempt tiePaper() => paper(
          id: 'q1',
          completedAt: saturday.subtract(const Duration(hours: 3)),
          mode: 'quick',
          runs: const [
            ('Analysis of Financial Statements', V.right, 3),
            ('Analysis of Financial Statements', V.wrong, 1),
            ('Analysis of Financial Statements', V.blank, 1),
            ('Change in Profit Sharing Ratio', V.right, 2),
            ('Change in Profit Sharing Ratio', V.wrong, 2),
          ],
        );

    test('Today names the chapter the result names, not the first with the most misses', () {
      final a = tiePaper();
      // What the result builds for this paper: its rows, by the same rule it prints "cost N of the M marks you missed".
      final rows = MoveAnalysis([
        for (var k = 0; k < a.questions.length; k++)
          MoveRow(
            qid: a.questions[k].id,
            number: k + 1,
            chapter: a.questions[k].chapter,
            verdict: switch (a.detailFor(a.questions[k].id)?.isCorrect) {
              true => RowVerdict.correct,
              false => RowVerdict.wrong,
              null => RowVerdict.skipped,
            },
          ),
      ]);
      final result = costliestLine(rows);
      expect(result.chapter, 'Change in Profit Sharing Ratio');
      final detail = buildPaperDetail(ashaInputs(now: saturday, attempts: [a]))!;
      expect(detail.leakChapter, result.chapter);
    });

    test('and says its figure the way the result does: marks, against what the paper missed', () {
      final detail = buildPaperDetail(ashaInputs(now: saturday, attempts: [tiePaper()]))!;
      // 1 wrong x 6 + 1 blank x 5 + 2 wrong x 6 = 23 marks missed; the chapter cost 12 of them.
      expect(detail.leak, 'Biggest leak: Change in Profit Sharing Ratio, 12 of the 23 marks you missed: 2 wrong.');
    });

    test('the repair this leak opens is that chapter\'s', () {
      final detail = buildPaperDetail(ashaInputs(now: saturday, attempts: [tiePaper()]))!;
      expect(detail.leakTarget, isNotNull);
    });

    test('a paper with a negative score names the marks alone, never a fraction above the paper', () {
      final bad = paper(
        id: 'q2',
        completedAt: saturday.subtract(const Duration(hours: 3)),
        mode: 'quick',
        runs: const [('Ratio analysis', V.wrong, 10)],
      );
      final detail = buildPaperDetail(ashaInputs(now: saturday, attempts: [bad]))!;
      expect(detail.leak, 'Biggest leak: Ratio analysis, 60 marks: 10 wrong.');
    });
  });
}
