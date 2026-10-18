// The richer Today (D52, TODAY-SWIPE-1018): Mobi back in the header (Ask Mobi), The weeks ahead from
// the plan's own arithmetic (suggested mocks, expected dates, Rest week, milestones only without a
// plan), Your marks (the trend merged with Last paper, Last paper alone under two full mocks), and
// Weak chapters as ordered bars with the whole row as the one target.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/art/art.dart' show HybridStopwatch;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/theme/theme.dart' show MmColors;
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
import 'package:mockmob/features/today/widgets/reveal_once.dart';
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

    testWidgets('a week row opens the plain Change plan: the plan is one rhythm, so the title names no week', (tester) async {
      final view = buildToday(_inputs());
      await _pump(tester, TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})), size: const Size(412, 4200));
      expect(find.text(AheadCopy.title), findsOneWidget);
      expect(find.text(AheadCopy.nextWeek), findsOneWidget);
      expect(find.text('4 study days and a full mock'), findsOneWidget);
      expect(find.text('CUET UG expected'), findsOneWidget);
      expect(find.text('Sat 1 May'), findsOneWidget);
      final before = find.text(GlanceCopy.planTitle).evaluate().length;
      await tester.tap(find.text('4 study days and a full mock'));
      await tester.pumpAndSettle();
      expect(find.text(GlanceCopy.planTitle), findsNWidgets(before + 1));
      expect(find.textContaining('week of', findRichText: true), findsNothing);
      expect(find.text(GlanceCopy.askDays), findsOneWidget);
    });
  });

  test('a high goal with few weeks left: no two mocks share a day, a week never holds more than its study days, and every mock is named', () {
    final i = _inputs();
    final board = buildToday(i).road!.board!.withTarget(60);
    final a = buildWeeksAhead(i, board: board);
    final all = [for (final w in a.weeks) ...w.mocks];
    expect(all, isNotEmpty);
    expect(all.map((m) => m.on).toSet(), hasLength(all.length));
    for (final w in a.weeks) {
      expect(w.mocks.length, lessThanOrEqualTo(w.studyDays));
      for (final m in w.mocks) {
        expect(sundayWeek.planned, contains(m.on.weekday - 1));
      }
    }
    for (var k = 1; k < all.length; k++) {
      expect(all[k].number, all[k - 1].number + 1);
      expect(all[k].on.isAfter(all[k - 1].on), isTrue);
    }
    final many = a.weeks.firstWhere((w) => w.mocks.length > 1);
    final line = AheadCopy.mocksLine([for (final m in many.mocks) m.number], 60, [for (final m in many.mocks) m.on]);
    for (final m in many.mocks) {
      expect(line, contains(const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][m.on.weekday - 1]));
    }
    expect(AheadCopy.mocksLine([8], 21, [DateTime.utc(2026, 10, 29)]), 'Full mock 8 of 21, suggested for Thu, 60 minutes.');
    expect(AheadCopy.mocksLine([8, 9], 21, [DateTime.utc(2026, 10, 26), DateTime.utc(2026, 10, 29)]), 'Full mocks 8 and 9 of 21, suggested for Mon and Thu, 60 minutes each.');
    expect(
      AheadCopy.mocksLine([8, 9, 10], 21, [DateTime.utc(2026, 10, 26), DateTime.utc(2026, 10, 29), DateTime.utc(2026, 10, 31)]),
      'Full mocks 8 to 10 of 21, suggested for Mon, Thu and Sat, 60 minutes each.',
    );
  });

  test('in the board weeks the suggested mocks keep to the two study days', () {
    final feb = DateTime.utc(2027, 2, 14, 14, 10);
    final i = ashaInputs(now: feb, attempts: ashaRecord(feb), week: sundayWeek, reviseDue: 6);
    final board = buildToday(i).road!.board!.withTarget(40);
    final a = buildWeeksAhead(i, board: board);
    final boards = a.weeks.where((w) => w.boards).toList();
    expect(boards, isNotEmpty);
    for (final w in boards) {
      expect(w.studyDays, 2);
      expect(w.mocks.length, lessThanOrEqualTo(2));
    }
  });

  test('each full mock keeps the pace from the day the one before lands on, so the rhythm holds', () {
    final i = ashaInputs(now: sunday, attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: sundayWeek, reviseDue: 6);
    final a = buildToday(i).glance!.ahead!;
    final all = [for (final w in a.weeks) ...w.mocks];
    expect(all.first.on, DateTime.utc(2026, 10, 22));
    // Thu 22 Oct, then 13 days on (Wed 4 Nov) to the next planned day, Thu 5 Nov: a fortnight, not 11 days.
    expect(all[1].on, DateTime.utc(2026, 11, 5));
  });

  group('the week rows share one layout', () {
    for (final (width, scale) in const [(412.0, 1.3), (360.0, 1.05), (360.0, 1.1), (360.0, 1.3), (360.0, 1.0), (412.0, 1.0)]) {
      testWidgets('at $width dp and ${scale}x every week row is stacked or every one is beside', (tester) async {
        final i = ashaInputs(now: sunday, attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: sundayWeek, reviseDue: 6);
        final a = buildToday(i).glance!.ahead!;
        await pumpMockmob(
          tester,
          SingleChildScrollView(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: WeeksAheadBlock(ahead: a, onWeek: (_) {}))),
          size: Size(width, 2400),
          textScale: scale,
          disableAnimations: true,
          overrides: _overrides,
        );
        // Each week row: its "Next week" or "Week of" line against its title. Beside means the title
        // starts to the right of the when column; stacked means they share a left edge.
        final whens = [...find.text(AheadCopy.nextWeek).evaluate(), ...find.text(AheadCopy.weekOf).evaluate()];
        expect(whens, hasLength(a.weeks.length));
        final titleLefts = <double>[];
        for (final w in a.weeks) {
          final title = AheadCopy.weekTitle(days: w.studyDays, mocks: w.mocks.length, revise: w.reviseBack);
          for (final e in find.text(title).evaluate()) {
            titleLefts.add(tester.getTopLeft(find.byWidget(e.widget).first).dx);
          }
        }
        final whenLefts = [for (final e in whens) tester.getTopLeft(find.byWidget(e.widget).first).dx];
        final beside = {for (final x in titleLefts) x > whenLefts.first + 20};
        expect(beside, hasLength(1), reason: 'mixed layouts at $width x $scale');
        expect(tester.takeException(), isNull);
      });
    }
  });

  test('a suggested mock lands on a planned day, the same day Road to CUET names', () {
    // Last full mock 11 days ago (Wed 7 Oct): the pace says Tue 20 Oct, a day Asha leaves free, so
    // the mock is suggested for her next planned day, Thu 22 Oct, in both places.
    final i = ashaInputs(now: sunday, attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: sundayWeek, reviseDue: 6);
    final v = buildToday(i);
    final next = v.glance!.ahead!.weeks.first;
    expect(next.mocks.single.on, DateTime.utc(2026, 10, 22));
    expect(next.days, contains(next.mocks.single.on.weekday - 1));
    expect(v.glance!.road!.nextMockOn, DateTime.utc(2026, 10, 22));
    expect(snapToPlan(DateTime.utc(2026, 10, 20), {0, 3, 5, 6}), DateTime.utc(2026, 10, 22));
    expect(snapToPlan(DateTime.utc(2026, 10, 22), {0, 3, 5, 6}), DateTime.utc(2026, 10, 22));
    expect(snapToPlan(DateTime.utc(2026, 10, 20), null), DateTime.utc(2026, 10, 20));
  });

  testWidgets('every week row with planned days shows them; next week holds the mock and the stopwatch', (tester) async {
    final i = ashaInputs(now: sunday, attempts: ashaRecord(DateTime.utc(2026, 10, 9, 14, 10)), week: sundayWeek, reviseDue: 6);
    final a = buildToday(i).glance!.ahead!;
    await _pump(tester, SingleChildScrollView(child: WeeksAheadBlock(ahead: a, onWeek: (_) {})));
    // As the approved mock: full mock 8 next week, a bare week of 26 Oct, full mock 9 the week of 2 Nov.
    expect([for (final w in a.weeks) w.mocks.map((m) => m.number).toList()], [[8], <int>[], [9]]);
    expect(find.text('4 study days and a full mock'), findsNWidgets(2));
    // Seven letters a week, on all three weeks.
    expect(find.text('M'), findsNWidgets(3));
    expect(find.byType(HybridStopwatch), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  group('the reveal', () {
    Widget block(List<double> seen) => RevealOnce(
          id: 'test-block',
          length: const Duration(milliseconds: 200),
          builder: (context, p) => AnimatedBuilder(
            animation: p,
            builder: (context, _) {
              seen.add(p.value);
              return const SizedBox(height: 100);
            },
          ),
        );

    testWidgets('a block that played is in place when the lazy list builds it again', (tester) async {
      final seen = <double>[];
      final scroll = ScrollController();
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: ListView(controller: scroll, children: [block(seen), const SizedBox(height: 4000)]))));
      await tester.pumpAndSettle();
      expect(seen.last, 1);
      scroll.jumpTo(3000);
      await tester.pump();
      expect(find.byType(RevealOnce), findsNothing);
      seen.clear();
      scroll.jumpTo(0);
      await tester.pump();
      expect(find.byType(RevealOnce), findsOneWidget);
      expect(seen, isNotEmpty);
      expect(seen.every((v) => v == 1), isTrue);
    });

    testWidgets('it plays when a block above shrinks it into view with no scroll', (tester) async {
      final seen = <double>[];
      var tall = true;
      late StateSetter set;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(builder: (context, s) {
            set = s;
            return SingleChildScrollView(child: Column(children: [SizedBox(height: tall ? 2000 : 10), block(seen)]));
          }),
        ),
      ));
      await tester.pumpAndSettle();
      expect(seen.last, 0);
      set(() => tall = false);
      await tester.pumpAndSettle();
      expect(seen.last, 1);
    });
  });

  group('your marks', () {
    test('the last six full mocks in the move\'s subject, oldest first, with the newest lit', () {
      final t = buildToday(_inputs()).glance!.marks!;
      expect(t.subject, 'Accountancy');
      expect(t.points.map((p) => p.label), ['Mock 2', 'Mock 3', 'Mock 4', 'Mock 5', 'Mock 6', 'Mock 7']);
      expect(t.ofSubject, 7);
      expect(t.outOf, 250);
      expect(AheadCopy.marksSub(6, 7, 'Accountancy'), 'Newest 6 of your 7 Accountancy full mocks');
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

    test('a best shared by two or more papers names every one of them, never "your best" for one (final walk, low)', () {
      TrendPoint pt(int k, int marks) => TrendPoint(attemptId: 'm$k', label: 'Mock $k', date: '', marks: marks, outOf: 250, target: const GoTo('/r'));
      MarksTrend trend(List<int> marks) =>
          MarksTrend(subject: 'Accountancy', ofSubject: marks.length, outOf: 250, points: [for (var k = 0; k < marks.length; k++) pt(k + 3, marks[k])]);
      // The walk: Mock 3 to Mock 8 scored 0, 5, 4, 5, 4, 5.
      expect(marksHead(trend([0, 5, 4, 5, 4, 5])), '5 on Mock 8. Your best of these 6 is 5, on Mock 4, Mock 6 and Mock 8.');
      expect(marksHead(trend([0, 5, 4, 5, 4, 3])), '3 on Mock 8. Your best of these 6 is 5, on Mock 4 and Mock 6.');
      expect(marksHead(trend([0, 5, 4, 2, 4, 6])), '6 on Mock 8, your best of these 6.');
      expect(marksHead(trend([0, 7, 4])), '4 on Mock 5. Your best of these 3 is 7, on Mock 4.');
    });

    testWidgets('equal marks on two mocks in a row say "Level with", never "0 on", which reads as a zero score', (tester) async {
      expect(AheadCopy.marksChange(0, 'Mock 6'), 'Level with Mock 6.');
      TrendPoint pt(int k, int marks) => TrendPoint(attemptId: 'm$k', label: 'Mock $k', date: '$k Oct', marks: marks, outOf: 250, target: const GoTo('/r'));
      final t = MarksTrend(points: [pt(2, 178), pt(3, 182), pt(4, 171), pt(5, 182), pt(6, 204), pt(7, 204)], subject: 'Accountancy', ofSubject: 6, outOf: 250);
      await _pump(tester, SingleChildScrollView(child: YourMarksBlock(trend: t, onOpen: (_) {})));
      // Mock 6 and Mock 7 share the best, so both are named (final walk, low).
      expect(find.text('204 on Mock 7. Your best of these 6 is 204, on Mock 6 and Mock 7. Level with Mock 6.', findRichText: true), findsOneWidget);
      expect(find.textContaining('0 on Mock 6', findRichText: true), findsNothing);
    });

    test('no value on the chart sits on the dashed reference: it moves under its point, or the dashes break', () {
      for (final (marks, size) in const [
        ([178, 182, 171, 182, 171, 204], Size(304, 132)),
        ([178, 182, 171, 192, 171, 204], Size(304, 132)),
        ([199, 182, 171, 182, 171, 204], Size(352, 132)),
        ([195, 201, 196, 199, 197, 204], Size(304, 132)),
      ]) {
        for (final scale in const [1.0, 1.15]) {
          final painter = MarksPainter(
            marks: marks,
            labels: [for (var i = 2; i < 8; i++) 'Mock $i'],
            outOf: 250,
            colors: MmColors.dark,
            draw: const AlwaysStoppedAnimation(1),
            label: const TextStyle(fontSize: 11),
            newestFigure: const TextStyle(fontSize: 18),
            textScaler: TextScaler.linear(scale),
          );
          final refY = MarksPainter.yFor(size, marks, 250, MarksPainter.referenceFor(marks)!.toDouble());
          final rects = painter.valueRectsFor(size);
          var moved = 0;
          for (var i = 0; i < marks.length; i++) {
            final r = rects[i];
            final p = MarksPainter.point(size, marks, 250, i);
            if (r.top > p.dy) moved++;
            // A value still on the line is one with no room under its point: the dashes break there.
            if (refY >= r.top - 2 && refY <= r.bottom + 2) expect(r.bottom, lessThan(p.dy), reason: 'value $i of $marks at $scale');
          }
          if (marks[3] == 192) expect(moved, greaterThan(0), reason: '$marks at $scale');
          // The reference's number touches no value and sits off its own line.
          final refRect = painter.referenceLabelRect(size, rects)!;
          for (final r in rects) {
            expect(r.overlaps(refRect), isFalse, reason: '$marks at $scale');
          }
          expect(refY >= refRect.top && refY <= refRect.bottom, isFalse);
        }
      }
    });

    testWidgets('the trend sits over Last paper in one block; with one mock Last paper stands alone', (tester) async {
      final view = buildToday(_inputs());
      await _pump(tester, SingleChildScrollView(child: YourMarksBlock(trend: view.glance!.marks, paper: view.glance!.paper, onOpen: (_) {})));
      expect(find.text(AheadCopy.marksTitle), findsOneWidget);
      expect(find.text(GlanceCopy.paperTitle), findsOneWidget);
      // The change on the one before is said once, on the marks line; Last paper keeps its date.
      final change = view.glance!.paper!.paper.change!;
      expect(find.textContaining(change, findRichText: true), findsOneWidget);
      await _pump(tester, SingleChildScrollView(child: YourMarksBlock(paper: view.glance!.paper, onOpen: (_) {})));
      expect(find.text(AheadCopy.marksTitle), findsNothing);
      expect(find.text(GlanceCopy.paperTitle), findsOneWidget);
      expect(find.textContaining(change, findRichText: true), findsOneWidget);
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
      expect(find.text(GlanceCopy.marksLost), findsNWidgets(weak.rows.length));
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
