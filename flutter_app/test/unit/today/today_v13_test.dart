// Today v13 (TODAY-1017): the greeting handle rule, the returning, sparse, done and first-week
// moves, the week's caption table, the road strip's arithmetic, and the move card's pills.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/road_weeks.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/golden_harness.dart';
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
  group('greeting', () {
    test('a handle is never read out as a name', () {
      expect(TodayCopy.isHandleName('app-e2e-student'), isTrue);
      expect(TodayCopy.isHandleName('asha_v'), isTrue);
      expect(TodayCopy.isHandleName('asha07'), isTrue);
      expect(TodayCopy.isHandleName('asha', email: 'asha@example.com'), isTrue);
      expect(TodayCopy.isHandleName('Asha', email: 'asha.verma@example.com'), isFalse);
      final v = buildToday(ashaInputs(now: saturday, week: threeOfFour, firstName: 'app-e2e-student'));
      expect(v.header.greeting, 'Good evening');
    });

    test('after midnight the greeting follows the clock (D28) and the object stays (no sleepy Mobi)', () {
      final v = buildToday(ashaInputs(now: DateTime.utc(2026, 10, 17, 18, 40), attempts: ashaRecord(saturday), week: threeOfFour));
      expect(v.header.greeting, 'Hello, Asha');
      // 2:41 AM IST, the hour the owner saw "Good evening" on v13.
      final late = buildToday(ashaInputs(now: DateTime.utc(2026, 10, 17, 21, 11), attempts: ashaRecord(saturday), week: threeOfFour));
      expect(late.header.greeting, 'Hello, Asha');
      expect(moveOf(v).art.isMobi, isFalse);
      expect(v.header.mobi, isNull);
    });
  });

  group('the move', () {
    test('active: four mistakes, the why names the paper, date and chapter, one volt key and two pills', () {
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: ashaRecord(tuesdayEvening), week: threeOfFour)));
      expect(m.number, '4');
      expect(m.meaning, contains('Mock 7 on 11 Oct'));
      expect(m.primary.label, 'Start repair, 15 min');
      expect(TodayCopy.keyLength(m.primary.label), '15 min');
      expect(m.canChangeLength, isTrue);
      expect(m.secondary!.label, TodayCopy.somethingElse);
    });

    test('returning after a week: the warm-up leads, the repair and Revise wait as choices, Welcome back', () {
      final v = buildToday(ashaInputs(now: DateTime.utc(2026, 10, 23, 14, 40), attempts: ashaRecord(tuesdayEvening), week: threeOfFour, reviseDue: 14));
      final m = moveOf(v);
      // TODAY-1018 section 5, Returning: "Find your footing again", ten warm-up questions.
      expect(m.kind, MoveKind.warmUp);
      expect(m.title, GlanceCopy.titleFooting);
      expect(m.number, '10');
      expect(m.art.isMobi, isTrue);
      expect(v.header.greeting, 'Welcome back, Asha');
      // The open mistakes are one tap away, still three first when the card swaps to them.
      final repair = v.choices.firstWhere((c) => c.key == 'repair');
      expect(repair.title, GlanceCopy.choiceRepair);
      expect(repair.line, startsWith('6 open from '));
      expect(repair.hero!.kind, MoveKind.returning);
      expect(repair.hero!.number, '3');
      expect(repair.hero!.whyLink, 'See all 6');
      expect(v.choices.map((c) => c.key), contains('revise'));
    });

    test('sparse: one paper says so and offers the full mock', () {
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: [ashaRecord(tuesdayEvening).first], week: threeOfFour)));
      expect(m.meaning, startsWith('From your one paper so far, Mock'));
      expect(m.secondary!.label, TodayCopy.fullMockInstead);
    });

    test('done for today: of 4 repaired tonight, Practise more, Open the repair', () {
      final record = ashaRecord(tuesdayEvening);
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: record, week: threeOfFour, repaired: repairedAll(record), repairedToday: 4)));
      expect(m.kind, MoveKind.done);
      expect(m.numberLabel, 'of 4 repaired\ntonight');
      // TODAY-1018 section 5, Done: the key shows tonight's repairs; more practice stays a tap away.
      expect(m.primary.label, TodayCopy.seeTonightsRepairs);
      expect(m.primary.startsSession, isFalse);
      expect(m.alternate!.label, startsWith(TodayCopy.practiseMore));
      expect(m.canChangeLength, isFalse);
    });

    test('first week, day 2 with Revise due: Revise is the move', () {
      final q = paper(id: 'q1', completedAt: daysBefore(saturday, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 8), ('Partnership fundamentals', V.wrong, 2)]);
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: [q], week: threeOfFour, reviseDue: 2, repaired: const {'q1': {'q1-q9', 'q1-q10'}})));
      expect(m.kind, MoveKind.revise);
      expect(m.overline, 'Day 2 of your first week');
    });

    test('day one: the first move with Mobi and the full mock instead', () {
      final m = moveOf(buildToday(ashaInputs(now: saturday, attempts: const [], week: threeOfFour)));
      expect(m.kind, MoveKind.dayOne);
      expect(m.art.isMobi, isTrue);
      expect(m.secondary!.label, TodayCopy.fullMockInstead);
    });
  });

  group('this week', () {
    test('three of four with tonight planned: Tonight makes 4.', () {
      final w = buildToday(ashaInputs(now: saturday, week: threeOfFour)).header.week!;
      expect(w.done, 3);
      expect(w.goal, 4);
      expect(w.caption, 'Mon, Tue and Thu counted. Tonight makes 4.');
      expect(w.captionKey, 'Tonight makes 4.');
    });

    test('day one: the days before the account are dashes and today is the first of the plan', () {
      final w = buildToday(ashaInputs(now: saturday, attempts: const [], week: const TodayWeek(studied: [false, false, false, false, false, false, false], todayIndex: 5, label: '0 of 4', goal: 4, dates: [12, 13, 14, 15, 16, 17, 18]))).header.week!;
      expect(w.beforeAccount, {0, 1, 2, 3, 4});
      expect(w.caption, 'Your plan is 4 days a week. Today is the first.');
      expect(w.captionKey, 'Today is the first.');
    });
  });

  test('the strip: the pips add up to the study days the heading counts', () {
    final today = DateTime(2026, 10, 17);
    final exam = DateTime(2027, 5, 1);
    for (final goal in [2, 4, 6]) {
      final weeks = buildRoadWeeks(today: today, examDate: exam, goal: goal);
      expect(plannedTotal(weeks), sessionsUntil(today, exam, daysPerWeek: goal));
      expect(weeks.last.exam, isTrue);
    }
  });

  testWidgets('the length token ("about 15 min") opens the lengths panel', (tester) async {
    await pumpMockmob(
      tester,
      PhoneFrame(
        child: TodayBody(
          view: buildToday(ashaInputs(now: saturday, attempts: ashaRecord(tuesdayEvening), week: threeOfFour)),
          callbacks: noopCallbacks,
          skeletonDelay: Duration.zero,
        ),
      ),
      brightness: Brightness.dark,
      size: const Size(412, 915),
      disableAnimations: true,
      overrides: todayOverrides,
    );
    await tester.tap(find.text(GlanceCopy.lengthToken(15)));
    await tester.pumpAndSettle();
    expect(find.text(TodayCopy.repairLength), findsOneWidget);
  });
}
