// Mobi beside the week ring: the pure choice (`mobiForWeek`), the date a pause ends, the dial's
// timing for a day counted on a ring that is already on screen, and the hero's live answer to a
// counted day (only when the screen is open, fresh and not reduced).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/rhythm/logic/week_mobi.dart';
import 'package:mockmob/features/rhythm/logic/week_outlook.dart';
import 'package:mockmob/features/rhythm/logic/week_view.dart';
import 'package:mockmob/core/widgets/widgets.dart' show StudyWeek;
import 'package:mockmob/features/rhythm/widgets/rhythm_body.dart';
import 'package:mockmob/features/rhythm/widgets/week_dial.dart';
import 'package:mockmob/features/rhythm/widgets/week_mobi_slot.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'fixtures.dart';

WeekView weekOf(List<String> days, {int goal = 4, bool met = false, bool paused = false}) =>
    buildWeekView(rhythmFixture(studyDayDates: days, goal: goal, met: met, paused: paused), today: DateTime.utc(2026, 10, 14));

WeekOutlook? outlookOf(WeekView w, {Set<int>? planned, bool paused = false}) => weekOutlook(
      studied: [for (final d in w.days) d.studyDay],
      todayIndex: w.days.indexWhere((d) => d.isToday) < 0 ? null : w.days.indexWhere((d) => d.isToday),
      goal: w.goal,
      paused: paused,
      planned: planned,
    );

void main() {
  setUpAll(loadAppFonts);
  tearDown(MobiRation.reset);

  final afternoon = DateTime(2026, 10, 14, 15);

  group('mobiForWeek', () {
    test('a paused week rests and says the run is kept', () {
      final w = weekOf(['2026-10-12'], paused: true);
      final m = mobiForWeek(w, outlookOf(w, paused: true), afternoon);
      expect(m.kind, WeekMobiKind.rest);
      expect(m.act, MobiAct.rest);
      expect(m.line, 'Paused. Your run is kept.');
      expect(m.lineIsState, isTrue);
    });

    test('a paused week rests even in the middle of the night', () {
      final w = weekOf(['2026-10-12'], paused: true);
      expect(mobiForWeek(w, outlookOf(w, paused: true), DateTime(2026, 10, 14, 2)).kind, WeekMobiKind.rest);
    });

    test('a met week is proud, with no line (the status already says it)', () {
      final w = weekOf(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'], met: true);
      final m = mobiForWeek(w, outlookOf(w), afternoon);
      expect(m.kind, WeekMobiKind.proud);
      expect(m.act, MobiAct.proud);
      expect(m.line, isNull);
    });

    test('one study day short with today planned nudges toward it', () {
      final w = weekOf(['2026-10-12', '2026-10-13']);
      final m = mobiForWeek(w, outlookOf(w, planned: {0, 1, 2, 4}), afternoon);
      // Two short: nobody yet.
      expect(m.kind, WeekMobiKind.none);
      final w3 = weekOf(['2026-10-12', '2026-10-13', '2026-10-15']);
      final one = mobiForWeek(w3, outlookOf(w3, planned: {0, 1, 2, 3}), afternoon);
      expect(one.kind, WeekMobiKind.nudge);
      expect(one.act, MobiAct.nudge);
      expect(one.line, RhythmCopy.mobiOneShort);
    });

    test('one short with today not planned stays quiet', () {
      final w = weekOf(['2026-10-12', '2026-10-13', '2026-10-15']);
      expect(mobiForWeek(w, outlookOf(w, planned: {0, 1, 4}), afternoon).kind, WeekMobiKind.none);
    });

    test('a week that cannot reach the goal is encouraged, never scolded', () {
      // Thursday evening with one study day and a goal of 6: three days left cannot make it.
      final w = buildWeekView(rhythmFixture(studyDayDates: ['2026-10-12'], goal: 6), today: DateTime.utc(2026, 10, 15));
      final o = outlookOf(w);
      expect(o!.kind, OutlookKind.outOfReach);
      final m = mobiForWeek(w, o, afternoon);
      expect(m.kind, WeekMobiKind.encourage);
      expect(m.act, MobiAct.encourage);
      expect(m.line, RhythmCopy.mobiOutOfReach);
      expect(m.line!.toLowerCase(), isNot(contains('behind')));
    });

    test('an open week sleeps from 23:00 to 05:00, and a tap wakes him with one line', () {
      final w = weekOf(['2026-10-12']);
      for (final hour in [23, 0, 1, 4]) {
        final m = mobiForWeek(w, outlookOf(w), DateTime(2026, 10, 14, hour));
        expect(m.kind, WeekMobiKind.sleep, reason: 'hour $hour');
        expect(m.act, MobiAct.sleep);
        expect(m.tapWakes, isTrue);
        expect(m.line, isNull);
        expect(m.wakeLine, 'Sleep well. Tomorrow counts.');
      }
      for (final hour in [5, 9, 15, 22]) {
        expect(mobiForWeek(w, outlookOf(w), DateTime(2026, 10, 14, hour)).kind, isNot(WeekMobiKind.sleep), reason: 'hour $hour');
      }
    });

    test('a returning student is greeted, but not asleep at night', () {
      final w = weekOf(['2026-10-12']);
      final m = mobiForWeek(w, outlookOf(w), afternoon, returning: true);
      expect(m.kind, WeekMobiKind.hello);
      expect(m.act, MobiAct.hello);
      expect(m.line, RhythmCopy.mobiReturning);
      expect(mobiForWeek(w, outlookOf(w), DateTime(2026, 10, 14, 2), returning: true).kind, WeekMobiKind.sleep);
    });

    test('a cached week from another week has no outlook and gets nobody', () {
      final w = buildWeekView(rhythmFixture(), today: DateTime.utc(2026, 10, 26));
      expect(mobiForWeek(w, outlookOf(w), afternoon).kind, WeekMobiKind.none);
      expect(WeekMobi.none.present, isFalse);
    });

    test('every line is plain: no exclamation marks, no emoji', () {
      for (final line in [
        RhythmCopy.mobiPaused,
        RhythmCopy.mobiResumed,
        RhythmCopy.mobiSleep,
        RhythmCopy.mobiOneShort,
        RhythmCopy.mobiOutOfReach,
        RhythmCopy.mobiReturning,
      ]) {
        expect(line, isNot(contains('!')));
        expect(line.runes.every((r) => r < 0x2190), isTrue, reason: line);
      }
    });
  });

  group('pauseBackOn', () {
    // Wednesday 14 October 2026; its Monday is 12 October.
    final w = weekOf(['2026-10-12']);

    test('this week is back on the Monday after, 2 weeks a week later', () {
      expect(pauseBackOn(PauseOption.thisWeek, w), DateTime.utc(2026, 10, 19));
      expect(pauseBackOn(PauseOption.twoWeeks, w), DateTime.utc(2026, 10, 26));
    });

    test('3 months is the day after the 100 day limit', () {
      expect(pauseBackOn(PauseOption.threeMonths, w), DateTime.utc(2026, 10, 14).add(const Duration(days: 101)));
    });

    test('a stale week gives no date rather than a guess', () {
      final stale = buildWeekView(rhythmFixture(), today: DateTime.utc(2026, 10, 26));
      expect(pauseBackOn(PauseOption.thisWeek, stale), isNull);
    });
  });

  group('WeekDial timing', () {
    test('a day counted on a ring on screen starts sooner and is shorter than the first draw', () {
      final first = WeekDial.settleAfter(done: 3, goal: 4);
      final live = WeekDial.settleAfter(done: 3, goal: 4, from: 2);
      expect(live, lessThan(first));
      expect(live.inMilliseconds, 40 + 260 + 120);
    });

    test('the day that meets the goal adds the closing sweep', () {
      final live = WeekDial.settleAfter(done: 4, goal: 4, from: 3, sweep: true);
      expect(live.inMilliseconds, 40 + 260 + 420);
    });

    test('first draw is unchanged', () {
      expect(WeekDial.settleAfter(done: 3, goal: 4).inMilliseconds, 80 + 260 + 70 * 2 + 120);
    });
  });

  group('the hero answers a counted day', () {
    Widget host(ValueNotifier<WeekView> week, {bool stale = false}) => ValueListenableBuilder<WeekView>(
          valueListenable: week,
          builder: (context, w, _) => SingleChildScrollView(child: WeekHero(week: w, stale: stale)),
        );

    testWidgets('a new day brings Mobi for 1.2 s, and the first load brings nobody', (tester) async {
      MobiRation.now = () => DateTime(2026, 10, 14, 15);
      final week = ValueNotifier(weekOf(['2026-10-12', '2026-10-13']));
      await pumpMockmob(tester, host(week));
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.byType(MobiCharacter), findsNothing);

      week.value = weekOf(['2026-10-12', '2026-10-13', '2026-10-14']);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.byType(WeekMobiSlot), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 1500));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(MobiCharacter), findsNothing);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a stale cache that changes is not a counted day', (tester) async {
      MobiRation.now = () => DateTime(2026, 10, 14, 15);
      final week = ValueNotifier(weekOf(['2026-10-12', '2026-10-13']));
      await pumpMockmob(tester, host(week, stale: true));
      week.value = weekOf(['2026-10-12', '2026-10-13', '2026-10-14']);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(MobiCharacter), findsNothing);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('under reduced motion nothing is played', (tester) async {
      MobiRation.now = () => DateTime(2026, 10, 14, 15);
      final week = ValueNotifier(weekOf(['2026-10-12', '2026-10-13']));
      await pumpMockmob(tester, host(week), disableAnimations: true);
      week.value = weekOf(['2026-10-12', '2026-10-13', '2026-10-14']);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(MobiCharacter), findsNothing);
    });

    testWidgets('pausing shows the line of the pause and Mobi resting; resuming says he is back on', (tester) async {
      MobiRation.now = () => DateTime(2026, 10, 14, 15);
      final week = ValueNotifier(weekOf(['2026-10-12', '2026-10-13']));
      await pumpMockmob(tester, host(week), disableAnimations: true);
      expect(find.text('Paused. Your run is kept.'), findsNothing);
      week.value = weekOf(['2026-10-12', '2026-10-13'], paused: true);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Paused. Your run is kept.'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsOneWidget);
      week.value = weekOf(['2026-10-12', '2026-10-13']);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Paused. Your run is kept.'), findsNothing);
    });

    testWidgets('the Resume key unfolds as the pause lands and folds away on resume, never jumping', (tester) async {
      MobiRation.now = () => DateTime(2026, 10, 14, 15);
      final week = ValueNotifier(weekOf(['2026-10-12', '2026-10-13']));
      await pumpMockmob(
        tester,
        ValueListenableBuilder<WeekView>(
          valueListenable: week,
          builder: (context, w, _) => SingleChildScrollView(child: WeekHero(week: w, onResume: () {})),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.text('Resume rhythm'), findsNothing);
      final legendTop = tester.getTopLeft(find.byType(StudyWeek)).dy;

      week.value = weekOf(['2026-10-12', '2026-10-13'], paused: true);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 140));
      // Half way: the key is on its way in, and the week card is part of the way down.
      expect(find.text('Resume rhythm'), findsOneWidget);
      expect(tester.getTopLeft(find.byType(StudyWeek)).dy, greaterThan(legendTop));
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      final pausedTop = tester.getTopLeft(find.byType(StudyWeek)).dy;
      expect(pausedTop, greaterThan(legendTop + 40), reason: 'the 48 dp key is now in the column');

      week.value = weekOf(['2026-10-12', '2026-10-13']);
      await tester.pump();
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('Resume rhythm'), findsNothing);
      // His "Back on" line stays 4 s, then the page is exactly where it was.
      await tester.pump(const Duration(seconds: 5));
      // A fold finishes over a few frames (the line fades, then its space goes).
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(tester.getTopLeft(find.byType(StudyWeek)).dy, closeTo(legendTop, 1.5), reason: 'the page comes back to where it was');
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a sleeping Mobi wakes on a tap and the line appears', (tester) async {
      MobiRation.now = () => DateTime(2026, 10, 14, 2);
      final week = ValueNotifier(weekOf(['2026-10-12', '2026-10-13']));
      await pumpMockmob(tester, host(week), disableAnimations: true);
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.text('Sleep well. Tomorrow counts.'), findsNothing);
      await tester.tap(find.byType(MobiCharacter), warnIfMissed: false);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Sleep well. Tomorrow counts.'), findsOneWidget);
    });
  });
}
