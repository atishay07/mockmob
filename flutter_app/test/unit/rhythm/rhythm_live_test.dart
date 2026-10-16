// The live parts of the rhythm screens: the study days editor (quick choices, the ring above the
// days), the milestone steps (exact progress only, one key for the next step) and the run ribbon.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/rhythm/logic/milestone_progress.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/widgets/goal_editor.dart';
import 'package:mockmob/features/rhythm/widgets/medal.dart';
import 'package:mockmob/features/rhythm/widgets/run_ribbon.dart';
import 'package:mockmob/features/rhythm/widgets/step_sheet.dart';
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

    test('a step the app cannot count has no fraction, so no arc is ever drawn on a guess', () {
      expect(milestoneFraction('repairs_5', {'repairs_5': 3}), isNull);
      expect(milestoneFraction('first_repair', const {}), isNull);
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
        expect(stepAction(s), isNotNull, reason: s.id);
      }
    });

    test('sets go to Practice, repairs to the mistakes, weeks to rhythm', () {
      expect(stepAction(step('sessions_10'))!.location, AppRoutes.practiceStart);
      expect(stepAction(step('first_full_mock'))!.label, 'Start a full mock');
      expect(stepAction(step('repairs_10'))!.location, AppRoutes.reviewMistakes);
      expect(stepAction(step('weeks_met_4'))!.location, AppRoutes.youRhythm);
    });
  });

  group('the step sheet', () {
    StepView view(String id, StepStatus status, {DateTime? at}) => StepView(milestoneSteps.firstWhere((s) => s.id == id), status, at);

    Future<void> open(WidgetTester tester, StepSheetBody body) async {
      await pumpMockmob(tester, SingleChildScrollView(child: body), disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('a landed step says the date and closes with Done', (tester) async {
      await open(
        tester,
        StepSheetBody(view: view('first_repair', StepStatus.earned, at: DateTime(2026, 10, 9)), dateOf: (d) => '9 October', onAction: (_) {}),
      );
      expect(find.text('Earned on 9 October'), findsOneWidget);
      expect(find.text('Lands when you finish your first repair.'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
      expect(find.byType(Medal), findsOneWidget);
      expect(tester.getSize(find.byType(Medal)), const Size.square(96));
    });

    testWidgets('the next step shows the exact count and one key that goes to its place', (tester) async {
      String? went;
      await open(
        tester,
        StepSheetBody(view: view('sessions_10', StepStatus.next), dateOf: (d) => '', count: 4, onAction: (l) => went = l),
      );
      expect(find.text('4 of 10 so far'), findsOneWidget);
      expect(find.text('Start a quick practice'), findsOneWidget);
      await tester.tap(find.text('Start a quick practice'));
      expect(went, AppRoutes.practiceStart);
    });

    testWidgets('a next step the app cannot count shows no count', (tester) async {
      await open(tester, StepSheetBody(view: view('repairs_5', StepStatus.next), dateOf: (d) => '', onAction: (_) {}));
      expect(find.textContaining('so far'), findsNothing);
      expect(find.text('Open your mistakes'), findsOneWidget);
    });

    testWidgets('a later step names what comes first and offers no key', (tester) async {
      await open(
        tester,
        StepSheetBody(view: view('repairs_10', StepStatus.later), previous: view('repairs_5', StepStatus.next), dateOf: (d) => '', onAction: (_) {}),
      );
      expect(find.text('Not yet'), findsOneWidget);
      expect(find.text('Comes after 5 repairs.'), findsOneWidget);
      expect(find.text('Lands with your 10th finished repair.'), findsOneWidget);
      expect(find.text('Open your mistakes'), findsOneWidget, reason: 'a badge not earned always has the key that earns it');
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
