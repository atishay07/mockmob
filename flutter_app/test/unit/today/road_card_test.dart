// V15 section 2: "Your road to CUET" and the Adjust plan sheet. The plan arithmetic (three mock
// plans with computed totals, the weeks, the one milestone), the card's states and the sheet that
// replaces every slider.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmSelectRow;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/road_builder.dart';
import 'package:mockmob/features/today/logic/road_card.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/adjust_plan_sheet.dart';
import 'package:mockmob/features/today/widgets/road_actions.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

/// Tuesday 13 October 2026, 28 weeks (200 days) before 1 May 2027.
RoadBoard board({int? taken = 0, int? target, List<DateTime> mockDays = const [], int? goal = 4, int weekDone = 1}) => RoadBoard(
      today: DateTime.utc(2026, 10, 13),
      examDate: DateTime.utc(2027, 5, 1),
      ownDate: false,
      daysToExam: 200,
      mocksTaken: taken,
      mockTarget: target,
      goal: goal,
      weekDone: weekDone,
      mockDays: mockDays,
    );

void main() {
  setUpAll(loadAppFonts);

  group('the three mock plans', () {
    test('Light, Steady and Intense carry computed totals to the date', () {
      final plans = mockPlanChoices(board());
      expect([for (final p in plans) p.name], ['Light', 'Steady', 'Intense']);
      expect([for (final p in plans) p.total], [14, 28, 56]);
      expect(plans.where((p) => p.recommended).single.name, 'Steady');
      expect(plans[0].line, 'One every two weeks');
      expect(plans[1].line, 'One a week');
      expect(plans[2].line, 'Two a week');
    });

    test('the mocks already taken are in every total', () {
      expect([for (final p in mockPlanChoices(board(taken: 6))) p.total], [20, 34, 62]);
    });

    test('Steady is selected until the student picks; a saved target reads as the nearest plan', () {
      expect(selectedMockPace(board()), MockPace.steady);
      expect(selectedMockPace(board(taken: 3, target: 31)), MockPace.steady);
      expect(selectedMockPace(board(taken: 3, target: 17)), MockPace.light);
      expect(selectedMockPace(board(taken: 0, target: 60)), MockPace.intense);
      expect(selectedMockPace(board(taken: 12, target: 12)), isNull, reason: 'a met target selects nothing');
    });
  });

  group('the weeks', () {
    test('the first week is this one, from its Monday, and the study days are the goal', () {
      final weeks = buildPlanWeeks(board());
      expect(weeks.first.current, isTrue);
      expect(weeks.first.monday, DateTime.utc(2026, 10, 12));
      expect(weeks.first.days, 4);
      expect(weeks.first.daysDone, 1);
      expect(weeks.where((w) => w.current), hasLength(1));
      expect(weeks, hasLength(28));
    });

    test('Steady plans one full mock every week and the total lands exactly', () {
      final weeks = buildPlanWeeks(board());
      expect(weeks.every((w) => w.mocks == 1), isTrue);
      expect(weeks.fold<int>(0, (a, w) => a + w.mocks), 28);
    });

    test('Light plans one every other week, starting this week', () {
      final weeks = buildPlanWeeks(board(target: 14));
      expect([for (final w in weeks.take(6)) w.mocks], [1, 0, 1, 0, 1, 0]);
      expect(weeks.fold<int>(0, (a, w) => a + w.mocks), 14);
    });

    test('Intense plans two a week, never more', () {
      final weeks = buildPlanWeeks(board(target: 56));
      expect(weeks.every((w) => w.mocks == 2), isTrue);
      expect(buildPlanWeeks(board(target: 200)).every((w) => w.mocks <= 2), isTrue);
    });

    test('boards weeks hold two study days at most and say so', () {
      final weeks = buildPlanWeeks(board(goal: 5));
      final boards = weeks.where((w) => w.boards).toList();
      expect(boards, isNotEmpty);
      expect(boards.every((w) => w.days == 2), isTrue);
      expect(weeks.where((w) => !w.boards).every((w) => w.days == 5), isTrue);
    });

    test('past weeks show only mocks that really happened, dimmed', () {
      final weeks = buildPlanWeeks(board(taken: 3, mockDays: [DateTime.utc(2026, 10, 8), DateTime.utc(2026, 10, 6), DateTime.utc(2026, 9, 30)]));
      final past = weeks.where((w) => w.past).toList();
      expect([for (final w in past) w.mocksDone], [1, 2]);
      expect(past.first.monday, DateTime.utc(2026, 9, 28));
      expect(weeks.indexWhere((w) => w.current), past.length);
    });

    test('weeks group under their month, in order', () {
      final groups = groupByMonth(buildPlanWeeks(board()));
      expect(groups.first.$1, 'October 2026');
      expect([for (final g in groups.take(3)) g.$1], ['October 2026', 'November 2026', 'December 2026']);
    });

    test('a mock taken this week counts toward this week, not the next', () {
      final weeks = buildPlanWeeks(board(taken: 1, mockDays: [DateTime.utc(2026, 10, 13)], target: 28));
      expect(weeks.first.mocksDone, 1);
      expect(weeks.first.mocks, 1, reason: '28 to take from this week on, over 28 weeks');
    });
  });

  group('the one milestone', () {
    String line(RoadBoard b, {bool known = true}) => milestoneLine(b, buildPlanWeeks(b, stops: roadStops), roadStops, mocksKnown: known);

    test('no mock yet: your first full mock, by this Sunday', () {
      expect(line(board()), 'Next: your first full mock by Sun 18 Oct');
    });

    test('with mocks on the record it names the next number', () {
      expect(line(board(taken: 7)), 'Next: Mock 8 by Sun 18 Oct');
    });

    test('this week done: the next one is next week', () {
      final b = board(taken: 8, mockDays: [DateTime.utc(2026, 10, 13)], target: 35);
      expect(line(b), 'Next: Mock 9 by Sun 25 Oct');
    });

    test('a Sunday says tonight', () {
      final b = RoadBoard(today: DateTime.utc(2026, 10, 18), examDate: DateTime.utc(2027, 5, 1), ownDate: false, daysToExam: 195, mocksTaken: 2, goal: 4, weekDone: 1);
      expect(milestoneLine(b, buildPlanWeeks(b), const []), 'Next: Mock 3 by tonight');
    });

    test('a met target falls back to the next stop on the calendar, with its dates', () {
      final text = line(board(taken: 12, target: 12));
      expect(text, startsWith('Next: CUET registration.'));
      expect(text, contains('February to March 2027'));
    });

    test('with the papers unknown it never invents a mock', () {
      expect(line(board(taken: null), known: false), startsWith('Next: CUET registration'));
    });
  });

  group('the card', () {
    TodayView view(TodayInputs i) => buildToday(i);

    test('counts weeks to CUET and says the window it counts to', () {
      final card = view(ashaInputs()).card!;
      expect(card.count, 28);
      expect(card.countsDays, isFalse);
      expect(card.windowLine, 'Expected window: May 2027');
      expect(card.goal, 4);
      expect(card.daysDone, 1);
      expect(card.dayDots, 4);
    });

    test('a date of their own is said as theirs', () {
      final card = view(TodayInputs(
        now: tuesdayEvening,
        firstName: 'Asha',
        attempts: ashaRecord(tuesdayEvening),
        week: tuesdayWeek,
        roadPlan: RoadPlan(examDate: DateTime.utc(2027, 4, 20)),
      )).card!;
      expect(card.ownDate, isTrue);
      expect(card.windowLine, 'Your date: 20 April 2027');
    });

    test('today ring: on the next dot to fill, on the last filled once today counted, none on a rest day', () {
      expect(view(ashaInputs()).card!.ringAt, 1, reason: 'Monday counted, today is the second study day');
      const counted = TodayWeek(studied: [true, true, false, false, false, false, false], todayIndex: 1, label: '2 of 4 study days', goal: 4, planned: {0, 1, 3, 5}, dates: [12, 13, 14, 15, 16, 17, 18]);
      expect(view(ashaInputs(week: counted)).card!.ringAt, 1);
      const rest = TodayWeek(studied: [true, false, false, false, false, false, false], todayIndex: 2, label: '1 of 4 study days', goal: 4, planned: {0, 1, 3, 5}, dates: [12, 13, 14, 15, 16, 17, 18]);
      expect(view(ashaInputs(now: DateTime.utc(2026, 10, 14, 15, 10), week: rest)).card!.ringAt, isNull);
    });

    test('this week: one planned mock, none taken, and the milestone names the next', () {
      final card = view(ashaInputs()).card!;
      expect(card.mocksPlanned, 1);
      expect(card.mocksDone, 0);
      expect(card.milestone, 'Next: Mock 8 by Sun 18 Oct');
    });

    test('no goal: no dots, the days are counted in words', () {
      final card = view(ashaInputs(week: noGoalWeek)).card!;
      expect(card.goal, isNull);
      expect(card.dayDots, 0);
    });

    test('under a week it counts days; once the window is open it says so', () {
      final days = view(ashaInputs(now: DateTime.utc(2027, 4, 26, 8))).card!;
      expect(days.countsDays, isTrue);
      expect(days.count, 5);
      final open = view(ashaInputs(now: DateTime.utc(2027, 5, 10, 8))).card!;
      expect(open.phase, RoadPhase.window);
      expect(open.windowLine, TodayCopy.windowOpen);
    });

    test('while the papers load the card has no mock line to invent', () {
      final v = buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', week: tuesdayWeek));
      expect(v.mocksLoading, isTrue);
      expect(v.card!.mocksPlanned, isNull);
      expect(v.card!.milestone, isNull, reason: 'no milestone is claimed before the papers are known');
    });
  });

  group('the card on screen', () {
    final overrides = [
      authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha')),
    ];

    Future<void> pumpCard(WidgetTester tester, TodayView v, {double scale = 1}) => pumpMockmob(
          tester,
          TodayBody(view: v, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
          size: const Size(384, 1900),
          textScale: scale,
          disableAnimations: true,
          overrides: overrides,
        );

    testWidgets('three blocks: Up next, the road card, then the record rows; no strip, no slider', (tester) async {
      await pumpCard(tester, buildToday(ashaInputs()));
      expect(find.text(TodayCopy.roadCardTitle), findsOneWidget);
      expect(find.text('28'), findsWidgets);
      expect(find.text(TodayCopy.weeksToCuet(28)), findsOneWidget);
      expect(find.text('Expected window: May 2027'), findsOneWidget);
      expect(find.byType(Slider), findsNothing);
      expect(find.text('Road to May'), findsNothing, reason: 'the old strip heading is gone');
      expect(find.text(TodayCopy.lastPaperTitle), findsOneWidget);
      expect(find.text(TodayCopy.collegesRowTitle), findsOneWidget);
    });

    testWidgets('the study days and the mocks are dots with their words; today is ringed', (tester) async {
      await pumpCard(tester, buildToday(ashaInputs()));
      expect(find.bySemanticsLabel('This week: 1 of 4 study days'), findsOneWidget);
      expect(find.bySemanticsLabel('0 of 1 full mock'), findsOneWidget);
      expect(find.text('Next: Mock 8 by Sun 18 Oct'), findsOneWidget);
      expect(find.byKey(const ValueKey('road-adjust')), findsOneWidget);
      expect(find.byKey(const ValueKey('road-change-date')), findsOneWidget);
    });

    testWidgets('Change opens the sheet at the exam date', (tester) async {
      await pumpCard(tester, buildToday(ashaInputs()));
      final change = find.byKey(const ValueKey('road-change-date'));
      await tester.ensureVisible(change);
      await tester.tap(change);
      await tester.pumpAndSettle();
      expect(find.text(TodayCopy.adjustDateTitle), findsOneWidget);
      expect(find.byKey(const ValueKey('date-pick')), findsOneWidget);
    });

    testWidgets('while the week and the papers load, the card still counts the weeks', (tester) async {
      await pumpCard(tester, buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', weekLoading: true)));
      expect(find.text(TodayCopy.weeksToCuet(28)), findsOneWidget);
      expect(find.byKey(const ValueKey('road-days')), findsNothing);
      expect(find.byKey(const ValueKey('road-mocks')), findsNothing);
    });

    testWidgets('a failed week says so and offers Try again inside the card', (tester) async {
      await pumpCard(tester, buildToday(ashaInputs(weekFailed: true)));
      expect(find.text(TodayCopy.weekNotRead), findsOneWidget);
    });
  });

  group('Adjust plan', () {
    RoadModel roadFor({bool onAccount = false, int? target}) {
      final inputs = ashaInputs(week: tuesdayWeek);
      final plan = RoadPlan(mockTarget: target, onAccount: onAccount);
      return buildRoad(TodayInputs(
        now: inputs.now,
        firstName: 'Asha',
        attempts: ashaRecord(inputs.now),
        week: tuesdayWeek,
        roadPlan: plan,
      ))!;
    }

    final saved = <String>[];

    Future<void> pumpSheet(
      WidgetTester tester, {
      RoadModel? road,
      RoadActions? actions,
      bool weeksOpen = false,
      Future<DateTime?> Function(BuildContext, RoadBoard)? pick,
    }) {
      saved.clear();
      return pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: AdjustPlanBody(
            road: road ?? roadFor(),
            actions: actions ??
                RoadActions(
                  savePace: (days) async => saved.add('days:${(days.toList()..sort()).join(',')}'),
                  setExamDate: (d) async => saved.add('date:${d == null ? 'expected' : d.toIso8601String().substring(0, 10)}'),
                  setMockTarget: (n) async => saved.add('mocks:$n'),
                ),
            weeksOpen: weeksOpen,
            pickDate: pick,
          ),
        ),
        size: const Size(390, 1800),
        disableAnimations: true,
        overrides: [authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha'))],
      );
    }

    testWidgets('has no slider: days 3 4 5 6, three named plans with totals, the date', (tester) async {
      await pumpSheet(tester);
      expect(find.byType(Slider), findsNothing);
      for (final n in [3, 4, 5, 6]) {
        expect(find.byKey(ValueKey('days-$n')), findsOneWidget);
      }
      expect(find.text('Light'), findsOneWidget);
      expect(find.text('Steady'), findsOneWidget);
      expect(find.text('Intense'), findsOneWidget);
      // Totals: 7 taken plus 14, 28 and 56.
      expect(find.text('21'), findsOneWidget);
      expect(find.text('35'), findsOneWidget);
      expect(find.text('63'), findsOneWidget);
      expect(find.text('You have taken 7.'), findsOneWidget);
      expect(find.text('Expected May 2027'), findsOneWidget);
      expect(find.text('Pick my date'), findsOneWidget);
    });

    testWidgets('Steady is pre-selected and says it is recommended', (tester) async {
      await pumpSheet(tester);
      bool selected(String key) => tester.widget<MmSelectRow>(find.byKey(ValueKey(key))).selected;
      expect(selected('plan-steady'), isTrue);
      expect(selected('plan-light'), isFalse);
      expect(selected('plan-intense'), isFalse);
      expect(find.text('One a week. Recommended.'), findsOneWidget);
    });

    testWidgets('the days control has one indicator, which moves with the choice', (tester) async {
      await pumpSheet(tester);
      expect(find.byKey(const ValueKey('days-indicator')), findsOneWidget);
      final before = tester.getCenter(find.byKey(const ValueKey('days-indicator')));
      await tester.tap(find.byKey(const ValueKey('days-6')));
      await tester.pumpAndSettle();
      final after = tester.getCenter(find.byKey(const ValueKey('days-indicator')));
      expect(find.byKey(const ValueKey('days-indicator')), findsOneWidget, reason: 'one indicator, never two boxes');
      expect(after.dx, greaterThan(before.dx));
      expect(saved, ['days:0,1,2,3,4,5']);
    });

    testWidgets('a plan row saves its total as the mock target', (tester) async {
      await pumpSheet(tester);
      await tester.tap(find.byKey(const ValueKey('plan-intense')));
      await tester.pumpAndSettle();
      expect(saved, ['mocks:63']);
      await tester.tap(find.byKey(const ValueKey('plan-light')));
      await tester.pumpAndSettle();
      expect(saved, ['mocks:63', 'mocks:21']);
    });

    testWidgets('choosing Steady while nothing is saved saves it', (tester) async {
      await pumpSheet(tester);
      await tester.tap(find.byKey(const ValueKey('plan-steady')));
      await tester.pumpAndSettle();
      expect(saved, ['mocks:35']);
    });

    testWidgets('the account says where it saved; the phone says so when the account does not hold it', (tester) async {
      await pumpSheet(tester, road: roadFor(onAccount: true));
      await tester.tap(find.byKey(const ValueKey('days-5')));
      await tester.pumpAndSettle();
      expect(find.text('Saved to your account'), findsOneWidget);
      await pumpSheet(tester, road: roadFor());
      await tester.tap(find.byKey(const ValueKey('days-5')));
      await tester.pumpAndSettle();
      expect(find.text('Saved on this phone'), findsOneWidget);
    });

    testWidgets('the save line never moves what is under it', (tester) async {
      await pumpSheet(tester, road: roadFor(onAccount: true));
      final before = tester.getTopLeft(find.byKey(const ValueKey('adjust-weeks')));
      await tester.tap(find.byKey(const ValueKey('days-5')));
      await tester.pump();
      expect(tester.getTopLeft(find.byKey(const ValueKey('adjust-weeks'))), before);
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byKey(const ValueKey('adjust-weeks'))), before);
    });

    testWidgets('a save that fails puts the choice back and says so', (tester) async {
      await pumpSheet(
        tester,
        actions: RoadActions(savePace: (_) async => throw StateError('offline'), setExamDate: (_) async {}, setMockTarget: (_) async {}),
      );
      await tester.tap(find.byKey(const ValueKey('days-6')));
      await tester.pumpAndSettle();
      expect(find.text(TodayCopy.savePlanFailed), findsOneWidget);
      expect(find.textContaining('Saved'), findsNothing);
      // Back on 4: tapping 4 again does nothing (it is the selected one), tapping 6 tries again.
      await tester.tap(find.byKey(const ValueKey('days-6')));
      await tester.pumpAndSettle();
      expect(find.text(TodayCopy.savePlanFailed), findsOneWidget);
    });

    testWidgets('Pick my date saves the day and shows it; Expected goes back', (tester) async {
      await pumpSheet(tester, pick: (context, board) async => DateTime(2027, 4, 20));
      await tester.tap(find.byKey(const ValueKey('date-pick')));
      await tester.pumpAndSettle();
      expect(saved, ['date:2027-04-20']);
      expect(find.text('20 April 2027'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('date-expected')));
      await tester.pumpAndSettle();
      expect(saved, ['date:2027-04-20', 'date:expected']);
      expect(find.text('Pick my date'), findsOneWidget);
    });

    testWidgets('See all weeks opens the whole road by month: this week lifted, past weeks dimmed', (tester) async {
      await pumpSheet(tester);
      expect(find.byKey(const ValueKey('all-weeks')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('adjust-weeks')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('all-weeks')), findsOneWidget);
      expect(find.text('October 2026'), findsOneWidget);
      expect(find.text('Week of 12 Oct, this week'), findsOneWidget);
      expect(find.text('1 of 4 days, 0 of 1 mock'), findsOneWidget);
      expect(find.text('Week of 19 Oct'), findsOneWidget);
      expect(find.text('4 study days, 1 full mock'), findsWidgets);
      // The stops that used to be chips on the strip: every one with its dates.
      for (final s in roadStops) {
        expect(find.text(s.title), findsWidgets);
      }
      await tester.tap(find.byKey(const ValueKey('adjust-weeks')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('all-weeks')), findsNothing);
    });

    testWidgets('without a way to save, nothing claims it saved', (tester) async {
      await pumpMockmob(
        tester,
        SingleChildScrollView(padding: const EdgeInsets.all(20), child: AdjustPlanBody(road: roadFor())),
        size: const Size(390, 1800),
        disableAnimations: true,
        overrides: [authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u'))],
      );
      await tester.tap(find.byKey(const ValueKey('days-6')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Saved'), findsNothing);
    });
  });
}
