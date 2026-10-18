// The live parts of the rhythm screens: the study days editor (quick choices, the ring above the
// days), the milestone steps (exact progress only, one key for the next step) and the run ribbon.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/badge_record.dart';
import 'package:mockmob/features/rhythm/logic/badge_shelf.dart';
import 'package:mockmob/features/rhythm/logic/milestone_progress.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/widgets/goal_editor.dart';
import 'package:mockmob/features/rhythm/widgets/medal.dart';
import 'package:mockmob/features/rhythm/widgets/run_ribbon.dart';
import 'package:mockmob/features/rhythm/widgets/badge_sheet.dart';
import 'package:mockmob/features/rhythm/widgets/week_dial.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  group('exact progress only', () {
    test('a count toward a counted step is a fraction of its target', () {
      expect(milestoneFraction('sessions_10', {'sessions_10': 4}), 0.4);
      expect(milestoneFraction('weeks_met_4', {'weeks_met_4': 3}), 0.75);
    });

    test('a step with no exact count has no fraction, so no arc is ever drawn on a guess', () {
      expect(milestoneFraction('repairs_5', const {}), isNull, reason: 'an unknown count is not zero');
      expect(milestoneFraction('first_repair', {'first_repair': 1}), isNull, reason: 'a single-event badge has no count');
      expect(milestoneFraction('sessions_10', const {}), isNull);
    });

    test('a count past the target stays at one', () {
      expect(milestoneFraction('sessions_10', {'sessions_10': 12}), 1.0);
    });
  });

  group('the key of a next step', () {
    MilestoneStep step(String id) => milestoneSteps.firstWhere((s) => s.id == id);

    test('every step of the three paths has a place to go', () {
      for (final s in milestoneSteps) {
        expect(badgeAction(s), isNotNull, reason: s.id);
      }
    });

    test('sets go to Practice, repairs to the mistakes, weeks to rhythm', () {
      expect(badgeAction(step('sessions_10'))!.location, AppRoutes.practiceStart);
      expect(badgeAction(step('first_full_mock'))!.label, 'Start a full mock');
      expect(badgeAction(step('repairs_10'))!.location, AppRoutes.reviewMistakes);
      expect(badgeAction(step('weeks_met_4'))!.location, AppRoutes.youRhythm);
    });
  });

  group('the badge sheet', () {
    StepView view(String id, StepStatus status, {DateTime? at}) => StepView(milestoneSteps.firstWhere((s) => s.id == id), status, at);

    /// A board where [earned] have dates and the rest follow the path rules.
    List<TrackView> board(Map<String, DateTime> earned) => milestoneTracks([for (final e in earned.entries) RhythmMilestone(id: e.key, achievedAt: e.value), const RhythmMilestone(id: 'first_hold'), const RhythmMilestone(id: 'run_weeks_3')]);

    Future<void> open(WidgetTester tester, BadgeDetail detail, {ValueChanged<String>? onGo}) async {
      await pumpMockmob(tester, SingleChildScrollView(child: BadgeSheetBody(detail: detail, onGo: onGo ?? (_) {}, onClose: () {})), disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('an earned badge says the day and the 12-hour time, what lands it, and what comes next', (tester) async {
      final tracks = board({'first_repair': DateTime.utc(2026, 10, 17, 15, 42), 'first_scored_session': DateTime.utc(2026, 10, 1)});
      await open(tester, detailOf(tracks, 'first_repair', progress: const {'repairs_5': 3})!);
      expect(find.text('Earned Sat 17 Oct, 9:12 PM'), findsOneWidget);
      expect(find.text('Lands when you finish your first repair.'), findsOneWidget);
      expect(find.text('Next on this path: 5 repairs'), findsOneWidget);
      expect(find.text('2 more repairs to go.'), findsOneWidget);
      expect(find.byType(Medal), findsOneWidget);
      expect(tester.getSize(find.byType(Medal)), const Size.square(96));
    });

    testWidgets('a badge earned by a paper names it and opens it', (tester) async {
      final at = DateTime.utc(2026, 10, 17, 15, 42);
      final tracks = board({'clean_set': at});
      final records = {'clean_set': BadgeRecord(attemptId: 'a1', subject: 'accountancy', mode: 'full', at: at.subtract(const Duration(hours: 2)), marks: 152, max: 250)};
      String? went;
      await open(tester, detailOf(tracks, 'clean_set', records: records)!, onGo: (l) => went = l);
      expect(find.text('From Accountancy full mock, Sat 17 Oct, 7:12 PM'), findsOneWidget);
      expect(find.text('152 of 250 marks'), findsOneWidget);
      await tester.tap(find.text('Open that paper'));
      expect(went, AppRoutes.result('a1'));
    });

    testWidgets('a badge not earned says not yet, its exact count with the denominator, and one key that goes to its place', (tester) async {
      final tracks = board({'first_scored_session': DateTime.utc(2026, 10, 1)});
      String? went;
      await open(tester, detailOf(tracks, 'sessions_10', progress: const {'sessions_10': 4})!, onGo: (l) => went = l);
      expect(find.text('Not yet'), findsOneWidget);
      expect(find.text('4 of 10 scored sets so far'), findsOneWidget);
      await tester.tap(find.text('Start a quick practice'));
      expect(went, AppRoutes.practiceStart);
    });

    testWidgets('a badge with no exact count shows no count', (tester) async {
      final tracks = board({'first_scored_session': DateTime.utc(2026, 10, 1)});
      await open(tester, detailOf(tracks, 'repairs_5')!);
      expect(find.textContaining('so far'), findsNothing);
      expect(find.text('Open your mistakes'), findsOneWidget);
    });

    testWidgets('a later badge names what comes first and still has the key that earns it', (tester) async {
      final tracks = board({'first_scored_session': DateTime.utc(2026, 10, 1)});
      await open(tester, detailOf(tracks, 'repairs_10')!);
      expect(find.text('Not yet'), findsOneWidget);
      expect(find.text('Comes after 5 repairs.'), findsOneWidget);
      expect(find.text('Lands with your 10th finished repair.'), findsOneWidget);
      expect(find.text('Open your mistakes'), findsOneWidget);
    });

    testWidgets('a badge that could not be read says so, is not "not yet", and offers only Done', (tester) async {
      final tracks = milestoneTracks(const [], unreadable: const {'clean_set'});
      await open(tester, detailOf(tracks, 'clean_set')!);
      expect(find.text('This one could not be checked just now.'), findsOneWidget);
      expect(find.text('Not yet'), findsNothing);
      expect(find.text('Done'), findsOneWidget);
    });
  });

  group('the study days editor', () {
    testWidgets('a quick choice sets the days and the summary, and inks its own chip', (tester) async {
      await pumpMockmob(tester, SingleChildScrollView(child: GoalEditor(initialDays: 4, done: 2, onSave: (_) async {})), disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('4 study days a week.'), findsOneWidget);
      await tester.tap(find.text('Weekdays'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('5 study days a week.'), findsOneWidget);
      expect(find.text('Rest on Saturday and Sunday.'), findsOneWidget);
      await tester.tap(find.text('3 days'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('3 study days a week.'), findsOneWidget);
    });

    testWidgets('the ring above the days shows this week\'s real count against the new goal', (tester) async {
      await pumpMockmob(tester, SingleChildScrollView(child: GoalEditor(initialDays: 4, done: 2, onSave: (_) async {})), disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
      final dial = tester.widget<WeekDial>(find.byType(WeekDial));
      expect(dial.done, 2);
      expect(dial.goal, 4);
      expect(dial.size, 112);
      // L06: the ring says what it counts, inside the ring.
      expect(find.text('of 4 study days'), findsOneWidget);
      await tester.tap(find.text('Weekdays'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.widget<WeekDial>(find.byType(WeekDial)).goal, 5);
      expect(find.text('of 5 study days'), findsOneWidget);
    });

    test('the quick choices are real sets of weekdays, with distinct 5 days and weekdays', () {
      expect(studyDayPresets['3 days']!.length, 3);
      expect(studyDayPresets['4 days']!.length, 4);
      expect(studyDayPresets['5 days']!.length, 5);
      expect(studyDayPresets['Weekdays'], {0, 1, 2, 3, 4});
      expect(studyDayPresets['5 days'], isNot(studyDayPresets['Weekdays']));
    });
  });

  group('the run ribbon', () {
    RibbonWeek week(bool met, {bool paused = false, bool current = false}) => RibbonWeek(
          studyDays: met ? 4 : 1,
          goal: 4,
          met: met,
          paused: paused,
          current: current,
          words: met ? 'Goal met.' : 'Not met.',
          label: 'w',
        );

    testWidgets('holding and sliding along it reads each week in words', (tester) async {
      final weeks = [
        RibbonWeek(studyDays: 4, goal: 4, met: true, words: 'First week, met.', label: '5 Oct'),
        RibbonWeek(studyDays: 4, goal: 4, met: true, words: 'Second week, met.', label: '12 Oct'),
        RibbonWeek(studyDays: 1, goal: 4, met: false, words: 'Third week, not met.', label: '19 Oct'),
      ];
      await pumpMockmob(tester, Padding(padding: const EdgeInsets.all(16), child: RunRibbon(weeks: weeks)), disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
      final box = tester.getTopLeft(find.byType(RunRibbon));
      final gesture = await tester.startGesture(box + const Offset(20, 40));
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('First week, met.'), findsWidgets);
      await gesture.moveBy(const Offset(46, 0));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Second week, met.'), findsWidgets);
      await gesture.up();
      await tester.pump(const Duration(milliseconds: 300));
    });

    testWidgets('it builds with a run of met weeks, an unmet one and a paused one', (tester) async {
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: RunRibbon(weeks: [week(true), week(true), week(true), week(false), week(true, paused: true), week(true, current: true)])),
        disableAnimations: true,
      );
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull);
      expect(find.byType(RunRibbon), findsOneWidget);
    });
  });

  group('copy', () {
    test('the new lines are plain', () {
      for (final line in [
        RhythmCopy.stepLandedOn('9 October'),
        RhythmCopy.stepAfter('5 repairs'),
        RhythmCopy.backOn('26 Oct'),
        RhythmCopy.pauseKey,
        RhythmCopy.stepActionRepair,
      ]) {
        expect(line, isNot(contains('!')));
      }
    });
  });
}
