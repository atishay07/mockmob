// Today v14 (TODAY-1017 follow-ups from walk 1, the critic and the ledger pre-check): an honest
// first-week label, Change length on day one, See why on every Revise move, NTA mode in Something
// else, the week caption without "more by Sunday", the road's save receipts, and the skeleton that
// holds the student's own card height (L03).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/links.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/widgets/today_skeleton.dart';

import 'support/today_fixtures.dart';

final DateTime saturday = DateTime.utc(2026, 10, 17, 14, 40);

const TodayWeek threeOfFour = TodayWeek(
  studied: [true, true, false, true, false, false, false],
  todayIndex: 5,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 5},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

MoveHero moveOf(TodayView v) => v.hero! as MoveHero;

void main() {
  group('first-week label', () {
    test('a first week of one paper with 2 due keeps "Day 2 of your first week"', () {
      final q = paper(id: 'q1', completedAt: daysBefore(saturday, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 8), ('Partnership fundamentals', V.wrong, 2)]);
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: [q], week: threeOfFour, reviseDue: 2, repaired: const {'q1': {'q1-q9', 'q1-q10'}})));
      expect(m.kind, MoveKind.revise);
      expect(m.overline, 'Day 2 of your first week');
    });

    test('92 due under a first-week calendar never reads "first week": the round is 10 of 92', () {
      final q = paper(id: 'q1', completedAt: daysBefore(saturday, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 8), ('Partnership fundamentals', V.wrong, 2)]);
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: [q], week: threeOfFour, reviseDue: 92, repaired: const {'q1': {'q1-q9', 'q1-q10'}})));
      expect(m.kind, MoveKind.revise);
      expect(m.overline, isNot(contains('first week')));
      expect(m.number, '10');
      expect(m.numberLabel, 'of 92 due\ntoday');
      expect(m.primary.label, 'Start Revise, 10 min');
    });

    test('more papers than a first week makes never reads "first week"', () {
      final papers = [
        for (var k = 0; k < 7; k++)
          paper(id: 'p$k', completedAt: daysBefore(saturday, 1 + (k % 5)), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 9), ('Partnership fundamentals', V.wrong, 1)]),
      ];
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: papers, week: threeOfFour, reviseDue: 3)));
      expect(m.overline, isNot(contains('first week')));
    });
  });

  group('the move card', () {
    test('Revise with no matching paper on this phone still shows See why, opening Revise', () {
      final q = paper(id: 'q1', completedAt: daysBefore(saturday, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 8), ('Partnership fundamentals', V.wrong, 2)]);
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: [q], week: threeOfFour, reviseDue: 2, repaired: const {'q1': {'q1-q9', 'q1-q10'}})));
      expect(m.whyLink, TodayCopy.seeWhy);
      expect(m.evidenceId, isNull);
      expect(m.whyAction, isNotNull);
      expect((m.whyAction!.target as GoTo).location, TodayLinks.revise);
    });

    test('day one offers Change length beside Full mock instead, 10 by default', () {
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: const [], week: threeOfFour)));
      expect(m.kind, MoveKind.dayOne);
      expect(m.canChangeLength, isTrue);
      expect(m.number, '10');
      expect(m.primary.label, 'Start now, 10 min');
      expect(m.secondary!.label, TodayCopy.fullMockInstead);
    });

    test('day one at 20: the number, the why and the key all follow the length', () {
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: const [], week: threeOfFour, selectedMinutes: 20)));
      expect(m.number, '20');
      expect(m.meaning, startsWith('Twenty CUET-style'));
      expect(m.primary.label, 'Start now, 20 min');
      expect((m.primary.target as GoTo).location, contains('count=20'));
    });
  });

  group('Something else', () {
    test('a full mock on record adds NTA mode with its own glyph and a reason; Review ends the list', () {
      final rows = alternativeRows(ashaInputs(attempts: [accountancyMock('m1', daysBefore(tuesdayEvening, 1))]), moveSubject: 'accountancy');
      final nta = rows.where((r) => r.kind == AlternativeKind.nta).toList();
      expect(nta, hasLength(1));
      expect(nta.single.glyph, ChoiceGlyphKind.nta);
      expect(nta.single.note, contains('exam-day screen'));
      expect(nta.single.note, contains('Comes with Pro.'));
      expect(rows.last.kind, AlternativeKind.review);
      // Every row has its own glyph and a reason with a unit or a source.
      expect({for (final r in rows) r.glyph}.length, rows.length);
      for (final r in rows) {
        expect(r.note.trim(), isNotEmpty);
      }
    });

    test('Pro students see NTA mode without the Pro note', () {
      final rows = alternativeRows(ashaInputs(attempts: [accountancyMock('m1', daysBefore(tuesdayEvening, 1))], isPro: true), moveSubject: 'accountancy');
      expect(rows.firstWhere((r) => r.kind == AlternativeKind.nta).note, isNot(contains('Pro')));
    });

    test('no full mock on record: no NTA row', () {
      final q = paper(id: 'q1', completedAt: daysBefore(tuesdayEvening, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 9), ('Partnership fundamentals', V.wrong, 1)]);
      final rows = alternativeRows(ashaInputs(attempts: [q]), moveSubject: 'accountancy');
      expect(rows.where((r) => r.kind == AlternativeKind.nta), isEmpty);
    });
  });

  group('this week caption', () {
    test('today counted names the next planned day, never "more by Sunday"', () {
      const week = TodayWeek(
        studied: [true, false, false, false, false, true, false],
        todayIndex: 5,
        label: '2 of 4 study days',
        goal: 4,
        planned: {0, 1, 5, 6},
        dates: [12, 13, 14, 15, 16, 17, 18],
      );
      final w = buildToday(ashaInputs(now: saturday, week: week)).header.week!;
      expect(w.caption, 'Mon and Sat counted. Next: Sun.');
      expect(w.caption, isNot(contains('by Sunday')));
    });

    test('a rest day says so', () {
      const week = TodayWeek(
        studied: [true, false, false, false, false, false, false],
        todayIndex: 5,
        label: '1 of 4 study days',
        goal: 4,
        planned: {0, 1, 3, 6},
        dates: [12, 13, 14, 15, 16, 17, 18],
      );
      final w = buildToday(ashaInputs(now: saturday, week: week)).header.week!;
      expect(w.caption, 'Mon counted. Today is a rest day.');
    });
  });

  group('road receipts', () {
    test('saves say where they are kept', () {
      expect(TodayCopy.savedWhere(account: true), 'Saved to your account.');
      expect(TodayCopy.savedWhere(account: false), 'Saved on this phone.');
      expect(TodayCopy.dateReceipt('Sat 8 May', saved: true, account: true), 'Your date: Sat 8 May. Saved to your account.');
      expect(TodayCopy.mocksBefore(7, suggested: true), 'suggested, 7 taken');
    });
  });

  group('skeleton height (L03)', () {
    tearDown(resetHeroHeight);

    test('the next skeleton is the last card height, within a real card range', () {
      expect(lastHeroHeight, heroSkeletonHeight);
      rememberHeroHeight(454);
      expect(lastHeroHeight, 454);
      rememberHeroHeight(12);
      expect(lastHeroHeight, 454);
    });
  });
}
