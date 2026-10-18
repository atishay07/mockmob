// The richer Today (D52, TODAY-SWIPE-1018): Mobi back in the header (Ask Mobi), The weeks ahead from
// the plan's own arithmetic (suggested mocks, expected dates, Rest week, milestones only without a
// plan), Your marks (the trend merged with Last paper, Last paper alone under two full mocks), and
// Weak chapters as ordered bars with the whole row as the one target.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/widgets.dart' show Mobi;
import 'package:mockmob/features/today/copy_ahead.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/marks_trend.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/weeks_ahead.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/today_header.dart';
import 'package:mockmob/features/today/widgets/weak_chapters.dart';
import 'package:mockmob/features/today/widgets/weeks_ahead.dart';
import 'package:mockmob/features/today/widgets/your_marks.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

/// Sunday 18 October 2026, 7:40 PM IST.
final DateTime sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek sundayWeek = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

TodayInputs _inputs({TodayWeek week = sundayWeek, List<({String attemptId, DateTime receivedAt})> unopened = const []}) =>
    ashaInputs(now: sunday, attempts: ashaRecord(sunday), week: week, reviseDue: 6, unopened: unopened);

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

Future<void> _pump(WidgetTester tester, Widget child, {Size size = const Size(412, 2400)}) =>
    pumpMockmob(tester, child, size: size, disableAnimations: true, overrides: _overrides);

void main() {
  setUpAll(loadAppFonts);
  setUp(debugResetTodayPicks);

  group('the weeks ahead', () {
    test('three dated weeks from the plan, the pace\'s mock suggested on its own day, then the milestones', () {
      final a = buildToday(_inputs()).glance!.ahead!;
      expect(a.perWeek, 4);
      expect(a.weeks, hasLength(3));
      expect(a.weeks.first.next, isTrue);
      expect(a.weeks.first.monday, DateTime.utc(2026, 10, 19));
      expect(AheadCopy.range(a.weeks.first.monday, a.weeks.first.sunday), '19 to 25 Oct');
      expect([for (final w in a.weeks) w.studyDays], [4, 4, 4]);
      expect(a.weeks.first.days, {0, 3, 5, 6});
      // 7 of 21 full mocks, the rest spread to Sat 1 May from Fri 16 Oct: every 13 days, so the
      // next is Thu 29 Oct, full mock 8.
      expect(a.mockTarget, 21);
      expect(a.weeks[0].mocks, isEmpty);
      expect(a.weeks[1].mocks.single.number, 8);
      expect(a.weeks[1].mocks.single.on, DateTime.utc(2026, 10, 29));
      expect(a.weeks[2].mocks, isEmpty);
      // Revise's due dates are not on the phone: nothing is guessed.
      expect(a.weeks.every((w) => w.reviseBack == null), isTrue);
      // Half the goal lands in early December; registration, the boards, then the exam.
      expect([for (final m in a.milestones) m.kind], [AheadMilestoneKind.halfGoal, AheadMilestoneKind.registration, AheadMilestoneKind.boards, AheadMilestoneKind.exam]);
      final half = a.milestones.first;
      expect(half.number, 11);
      expect(AheadCopy.about(half.from), 'early Dec');
      expect(AheadCopy.halfGoal(11, 21), 'Full mock 11 of 21, half your goal');
      expect(AheadCopy.registrationLine(a.milestones[1].daysAway), "In 15 weeks, as expected from last year's dates.");
      expect(AheadCopy.span(a.milestones[2].from, a.milestones[2].to!), 'mid-Feb to early Apr');
      expect(AheadCopy.examLine(days: a.daysToExam, studyDays: a.studyDaysLeft, mocksLeft: a.mocksLeft), '27 weeks, ${a.studyDaysLeft} study days and 14 more full mocks between now and then.');
    });

    test('the week titles say each count with its unit, a mock is suggested, and an empty week is a Rest week', () {
      expect(AheadCopy.weekTitle(days: 4, mocks: 0), '4 study days');
      expect(AheadCopy.weekTitle(days: 4, mocks: 1), '4 study days and a full mock');
      expect(AheadCopy.weekTitle(days: 4, mocks: 0, revise: 23), '4 study days, 23 back in Revise');
      expect(AheadCopy.weekTitle(days: 4, mocks: 1, revise: 23), '4 study days, a full mock and 23 back in Revise');
      expect(AheadCopy.weekTitle(days: 0, mocks: 0), 'Rest week');
      expect(AheadCopy.weekTitle(days: 0, mocks: 1), 'A full mock');
      expect(AheadCopy.mockLine(8, 21, DateTime.utc(2026, 10, 29)), 'Full mock 8 of 21, suggested for Thu, 60 minutes.');
      expect(AheadCopy.range(DateTime.utc(2026, 10, 26), DateTime.utc(2026, 11, 1)), '26 Oct to 1 Nov');
    });

    test('Revise counts show only when the server gives them', () {
      final i = _inputs();
      final board = buildToday(i).road!.board!;
      final a = buildWeeksAhead(i, board: board, reviseByWeek: {DateTime.utc(2026, 10, 26): 23});
      expect(a.weeks[1].reviseBack, 23);
      expect(a.weeks[0].reviseBack, isNull);
    });

    test('without a plan there are no week rows, only the milestones', () {
      const paused = TodayWeek(studied: [false, false, false, false, false, false, false], todayIndex: 6, label: 'Paused', paused: true);
      final a = buildToday(_inputs(week: paused)).glance!.ahead!;
      expect(a.planned, isFalse);
      expect(a.weeks, isEmpty);
      expect(a.milestones.map((m) => m.kind), isNot(contains(AheadMilestoneKind.halfGoal)));
      expect(a.milestones.last.kind, AheadMilestoneKind.exam);
      expect(a.studyDaysLeft, isNull);
    });

    testWidgets('a week row opens Change plan for that week', (tester) async {
      final view = buildToday(_inputs());
      await _pump(tester, TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})), size: const Size(412, 4200));
      expect(find.text(AheadCopy.title), findsOneWidget);
      expect(find.text(AheadCopy.nextWeek), findsOneWidget);
      expect(find.text('4 study days and a full mock'), findsOneWidget);
      expect(find.text('CUET UG expected'), findsOneWidget);
      expect(find.text('Sat 1 May'), findsOneWidget);
      await tester.tap(find.text('4 study days and a full mock'));
      await tester.pumpAndSettle();
      expect(find.text(AheadCopy.planTitle(DateTime.utc(2026, 10, 26))), findsOneWidget);
      expect(find.text(GlanceCopy.askDays), findsOneWidget);
    });
  });

  test("a mock keeps the pace's own day, the one Road to CUET names, even on a day not planned", () {
    // Last full mock 11 days ago (Wed 7 Oct): the next is due Tue 20 Oct, which Asha does not plan.
    final i = ashaInputs(now: sunday, attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: sundayWeek, reviseDue: 6);
    final v = buildToday(i);
    final next = v.glance!.ahead!.weeks.first;
    expect(next.mocks.single.on, DateTime.utc(2026, 10, 20));
    expect(v.glance!.road!.nextMockOn, DateTime.utc(2026, 10, 20));
  });

  group('your marks', () {
    test('the last six full mocks in the move\'s subject, oldest first, with the newest lit', () {
      final t = buildToday(_inputs()).glance!.marks!;
      expect(t.subject, 'Accountancy');
      expect(t.points.map((p) => p.label), ['Mock 2', 'Mock 3', 'Mock 4', 'Mock 5', 'Mock 6', 'Mock 7']);
      expect(t.ofSubject, 7);
      expect(t.outOf, 250);
      expect(AheadCopy.marksSub(6, 7, 'Accountancy'), 'Newest 6 of your 7 Accountancy mocks');
    });

    test('a sealed paper is never on the line, and under two full mocks there is no line', () {
      final sealed = buildToday(_inputs(unopened: [(attemptId: 'm7', receivedAt: sunday)])).glance!.marks!;
      expect(sealed.points.map((p) => p.attemptId), isNot(contains('m7')));
      final one = ashaInputs(now: sunday, attempts: ashaRecord(sunday).where((a) => a.id == 'm7' || a.id == 'q1').toList(), week: sundayWeek);
      expect(buildMarksTrend(one, subject: 'accountancy'), isNull);
    });

    test('the words: best of these, and the change on the one before in the true sign', () {
      expect(AheadCopy.marksBest(204, 'Mock 7', 6), '204 on Mock 7, your best of these 6.');
      expect(AheadCopy.marksNotBest(171, 'Mock 7', 6, 204, 'Mock 5'), '171 on Mock 7. Your best of these 6 is 204, on Mock 5.');
      expect(AheadCopy.marksChange(33, 'Mock 6'), '+33 on Mock 6.');
      expect(AheadCopy.marksChange(-12, 'Mock 6'), '−12 on Mock 6.');
    });

    testWidgets('the trend sits over Last paper in one block; with one mock Last paper stands alone', (tester) async {
      final view = buildToday(_inputs());
      await _pump(tester, SingleChildScrollView(child: YourMarksBlock(trend: view.glance!.marks, paper: view.glance!.paper, onOpen: (_) {})));
      expect(find.text(AheadCopy.marksTitle), findsOneWidget);
      expect(find.text(GlanceCopy.paperTitle), findsOneWidget);
      await _pump(tester, SingleChildScrollView(child: YourMarksBlock(paper: view.glance!.paper, onOpen: (_) {})));
      expect(find.text(AheadCopy.marksTitle), findsNothing);
      expect(find.text(GlanceCopy.paperTitle), findsOneWidget);
    });
  });

  group('weak chapters as ordered bars', () {
    testWidgets('no Practise pill on the rows; the row opens to a 10-question set and its mistakes', (tester) async {
      final weak = buildToday(_inputs()).glance!.weak;
      final events = <TodayTarget>[];
      await _pump(tester, SingleChildScrollView(child: WeakChaptersBlock(weak: weak, onOpen: events.add)));
      expect(find.text(GlanceCopy.practise), findsNothing);
      expect(find.text(AheadCopy.practiseSet), findsNothing);
      expect(find.text(AheadCopy.weakHint), findsOneWidget);
      expect(find.text(AheadCopy.marksOpen), findsNWidgets(weak.rows.length));
      await tester.tap(find.text(weak.rows.first.chapter));
      await tester.pumpAndSettle();
      expect(find.text(AheadCopy.practiseSet), findsOneWidget);
      await tester.tap(find.text(AheadCopy.practiseSet));
      expect(events.single, isA<GoTo>());
      expect((events.single as GoTo).location, contains('count=10'));
    });
  });

  group('Mobi in the header', () {
    testWidgets('he is back at the top right and a tap opens Ask Mobi', (tester) async {
      final view = buildToday(_inputs());
      final targets = <TodayTarget>[];
      await _pump(tester, TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: targets.add)), size: const Size(360, 800));
      final header = find.byType(TodayHeader);
      expect(find.descendant(of: header, matching: find.byType(Mobi)), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(AheadCopy.askMobi));
      expect(targets.whereType<GoTo>().map((g) => g.location), contains(AppRoutes.ask));
    });

    testWidgets('when the card holds Mobi (day one) the header leaves him out', (tester) async {
      final view = buildToday(ashaInputs(now: sunday, attempts: const [], week: sundayWeek, profile: const TodayProfile(weakestSubject: 'accountancy')));
      await _pump(tester, TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})), size: const Size(412, 915));
      expect(find.descendant(of: find.byType(TodayHeader), matching: find.byType(Mobi)), findsNothing);
    });

    testWidgets('the greeting keeps one line beside him at 360 dp and 1.3x text', (tester) async {
      final view = buildToday(_inputs());
      await pumpMockmob(
        tester,
        TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
        size: const Size(360, 800),
        textScale: 1.3,
        disableAnimations: true,
        overrides: _overrides,
      );
      final greeting = tester.widget<Text>(find.text(view.header.greeting));
      expect(greeting.maxLines, 1);
      expect(tester.takeException(), isNull);
    });
  });

  test('the weeks ahead block keeps its rail constants', () {
    expect(WeeksAheadBlock.rail, 28);
    expect(WeeksAheadBlock.stagger, const Duration(milliseconds: 40));
    expect(WeeksAheadBlock.rowLength, const Duration(milliseconds: 220));
    expect(YourMarksBlock.drawLength, const Duration(milliseconds: 600));
  });
}
