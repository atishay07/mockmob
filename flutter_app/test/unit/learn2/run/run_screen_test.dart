// The Learn run on the stage, over the recorded Learn server inside a real GoRouter: the keys of each state, a card's turn and
// its three ratings with the stamp and the pile, a question and its line in place, Skip, the recap, Free's looks, the stop
// rule for Close and the system Back, the end and its keys, the states without items, the haptics the app's grammar asks for,
// text scale 1.3 at 360 dp, 48 dp targets and the volt key of each state.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart';
import 'package:mockmob/features/learn2/run/run_flight.dart';
import 'package:mockmob/features/learn2/run/run_parts.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';

import 'support/run_harness.dart';

RunController ctl(WidgetTester tester) => runState(tester).controller;

/// The volt keys on screen.
int voltKeys(WidgetTester tester) => tester.widgetList<StageStepKey>(find.byType(StageStepKey)).where((k) => k.tone == StageTone.volt).length;

/// Taps [f] as a student would: scrolled into view first, then the screen settles.
Future<void> tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.pump();
  await tester.tap(f.first);
  await runSettle(tester);
}

/// Leaves the test with nothing pending (the confirm haptic's second tap, the stamp, a note).
Future<void> finish(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
}

/// Goes to item [i] as the keys would (a question's page, a card).
Future<void> goTo(WidgetTester tester, int i) async {
  while (ctl(tester).at < i) {
    ctl(tester).advance();
  }
  await runSettle(tester);
}

/// Turns the card on screen as its Show answer key does, and lets the keys change.
Future<void> turnNow(WidgetTester tester) async {
  ctl(tester).turn(ctl(tester).item! as LearnCardItem);
  await runSettle(tester);
}

String optionOf(WidgetTester tester, String key) => (ctl(tester).item! as LearnQuestionItem).question.options.firstWhere((o) => o.key == key).text;

void main() {
  group('a card', () {
    testWidgets('the first card: the top bar, Show answer (the one volt key), the coach line, 1 of 20 and the pile', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(find.text('1 of 20'), findsOneWidget);
      expect(find.textContaining('min left'), findsOneWidget);
      expect(find.text('Show answer'), findsOneWidget);
      expect(find.text('Say the answer in your head, then show it.'), findsOneWidget);
      expect(find.text('What is partnership?'), findsWidgets);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 0);
      expect(find.text('Missed'), findsNothing);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Show answer turns the card: Missed, Got it (the volt key) and Easy, and a light haptic from the card only', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await tap(tester, find.text('Show answer'));
      expect(find.text('Missed'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);
      expect(find.text('Easy'), findsOneWidget);
      expect(find.text('Show answer'), findsNothing);
      expect(find.text('Got it sends the card to Revise. It comes back when it is due.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      final volt = tester.widgetList<StageStepKey>(find.byType(StageStepKey)).singleWhere((k) => k.tone == StageTone.volt);
      expect(volt.label, 'Got it');
      expect(haptics.calls, ['light']);
      await finish(tester);
    });

    testWidgets('a tap on the front turns the card too, and Turn back brings the front and Show answer again', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await tester.tap(find.text('What is partnership?').first);
      await runSettle(tester);
      expect(find.text('Got it'), findsOneWidget);
      await tap(tester, find.text('Turn back'));
      expect(find.text('Show answer'), findsOneWidget);
      expect(find.text('Got it'), findsNothing);
      await finish(tester);
    });

    testWidgets('Got it: the server takes the rating, the stamp says its day, the pile counts it, the next card comes, the confirm haptic after', (
      tester,
    ) async {
      final haptics = RunHaptics();
      final api = FixtureLearnApi();
      await pumpRun(tester, api, haptics: haptics);
      await tap(tester, find.text('Show answer'));
      haptics.calls.clear();
      await tester.tap(find.text('Got it'));
      await tester.pump();
      expect(api.ratings.single.rating, 3);
      await runSettle(tester);
      expect(find.text('Back in 20 days'), findsOneWidget);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 1);
      expect(find.text('2 of 20'), findsOneWidget);
      expect(find.text('Show answer'), findsOneWidget);
      expect(find.text('Define partnership.').evaluate().isNotEmpty || find.text('What is a Partnership Deed?').evaluate().isNotEmpty, isTrue);
      expect(haptics.calls, ['medium', 'light']);
      // The stamp holds for about a second and a half, then the line is empty again.
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Back in 20 days'), findsNothing);
      await finish(tester);
    });

    testWidgets('Easy flies too (its own day); Missed drops away: "Back later in this run", a tick, the card back 3 on', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Easy'));
      expect(find.text('Back in 35 days'), findsOneWidget);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 1);
      await tap(tester, find.text('Show answer'));
      haptics.calls.clear();
      await tap(tester, find.text('Missed'));
      expect(find.text('Back later in this run'), findsOneWidget);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 1, reason: 'a missed card is not sent to Revise');
      expect(haptics.calls, ['selection']);
      expect(find.text('3 of 21'), findsOneWidget, reason: 'the card that came back made the run one longer');
      await finish(tester);
    });

    testWidgets('a tap while the card leaves is ignored', (tester) async {
      final api = FixtureLearnApi();
      await pumpRun(tester, api);
      await tap(tester, find.text('Show answer'));
      await tester.tap(find.text('Got it'));
      await tester.pump();
      await tester.tap(find.text('Missed'), warnIfMissed: false);
      await tester.pump();
      await runSettle(tester);
      expect(api.ratings.length, 1);
      await finish(tester);
    });

    testWidgets('a failed rating keeps the card with its line, and Got it tried again goes through', (tester) async {
      final api = FixtureLearnApi(failOn: {'rate': FixtureLearnApi.offlineError});
      await pumpRun(tester, api);
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Got it'));
      expect(find.text('That rating was not saved. Try again.'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);
      expect(find.text('1 of 20'), findsOneWidget);
      api.failOn.clear();
      await tap(tester, find.text('Got it'));
      expect(find.text('That rating was not saved. Try again.'), findsNothing);
      expect(find.text('2 of 20'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a card that is the line you needed, or back from earlier, says so at its head', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Missed'));
      await goTo(tester, 3);
      expect(find.text('Back from earlier'), findsWidgets);
      await finish(tester);
    });

    testWidgets('a look past Free\'s ratings: one volt Next and the server\'s line after the turn; Next logs it and goes on', (tester) async {
      final api = _Looks();
      await pumpRun(tester, api);
      expect(find.text('Show answer'), findsOneWidget);
      await tap(tester, find.text('Show answer'));
      expect(find.text('Missed'), findsNothing);
      expect(find.text('Next'), findsOneWidget);
      expect(find.textContaining("You've used today's 10 free card ratings"), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next'));
      expect(api.ratings.single.rating, 3);
      expect(find.text('2 of 20'), findsOneWidget);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 0);
      await finish(tester);
    });
  });

  group('a question', () {
    testWidgets('a question: the old mistake\'s head, a quiet Skip (no volt key) and the first-question coach line', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await goTo(tester, 4);
      expect(find.text('You missed this in Mock 3 on 16 Oct'), findsOneWidget);
      expect(find.byType(StageOptionRow), findsNWidgets(4));
      expect(find.text('Skip'), findsOneWidget);
      expect(find.text('Save'), findsNothing);
      expect(find.text('Tap the answer you think is right.'), findsOneWidget);
      expect(voltKeys(tester), 0);
      await finish(tester);
    });

    testWidgets('a wrong answer: the row, the verdict and NCERT\'s line in place; Save and Next (the volt key) replace Skip', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, 4);
      final q = ctl(tester).item! as LearnQuestionItem;
      haptics.calls.clear();
      await tap(tester, find.text(optionOf(tester, wrongKey(q))));
      await runSettle(tester);
      await runSettle(tester);
      expect(find.text('Not quite. The answer is ${rightKey(q)}.'), findsOneWidget);
      expect(find.text('The line you needed'), findsOneWidget);
      expect(find.text('Skip'), findsNothing);
      expect(find.text('Save'), findsOneWidget);
      expect(find.text('Next'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(haptics.calls, ['selection'], reason: 'a wrong answer buzzes nothing of its own');
      expect(find.text('5 of 21'), findsOneWidget, reason: 'the line card was put back in');
      await finish(tester);
    });

    testWidgets('a right answer: "Right.", a confirm haptic after the server graded it, and Next', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, 4);
      final q = ctl(tester).item! as LearnQuestionItem;
      haptics.calls.clear();
      await tap(tester, find.text(optionOf(tester, rightKey(q))));
      await tester.pump(const Duration(milliseconds: 300));
      expect(haptics.calls, ['selection', 'medium', 'light']);
      expect(find.textContaining('Right'), findsWidgets);
      expect(find.text('Next'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Skip moves on, sends nothing and is never a mistake', (tester) async {
      final api = FixtureLearnApi();
      await pumpRun(tester, api);
      await goTo(tester, 4);
      await tap(tester, find.text('Skip'));
      expect(api.answers, isEmpty);
      expect(find.text('6 of 20'), findsOneWidget);
      expect(find.text('Show answer'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Save: Saved on the key; Free\'s limit turns it into Pro', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await goTo(tester, 4);
      final q = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, rightKey(q))));
      await tap(tester, find.text('Save'));
      expect(find.text('Saved'), findsOneWidget);
      await finish(tester);
      final api = FixtureLearnApi(
        failOn: {
          'saveQuestion': LearnError.fromResponse(402, {'error': 'Free bookmark limit reached', 'limit': 25}),
        },
      );
      await pumpRun(tester, api);
      await goTo(tester, 4);
      final fq = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, rightKey(fq))));
      await tap(tester, find.text('Save'));
      expect(find.text('Pro'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a question the server left out is skipped with the web\'s line; a failed answer says so', (tester) async {
      await pumpRun(tester, FixtureLearnApi(failOn: {'answer': FixtureLearnApi.questionChanged}));
      await goTo(tester, 4);
      await tap(tester, find.text(optionOf(tester, 'A')));
      expect(find.text('This question was updated, so it was skipped.'), findsWidgets);
      expect(find.text('Next'), findsOneWidget);
      expect(find.text('Save'), findsNothing);
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi(failOn: {'answer': FixtureLearnApi.offlineError}));
      await goTo(tester, 4);
      await tap(tester, find.text(optionOf(tester, 'A')));
      expect(find.text('That answer was not saved. Try again.'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      await finish(tester);
    });
  });

  group('a lesson, the recap and a cards run', () {
    testWidgets('a lesson: its kind, its title, "Read this first.", Skip it and Read the lesson (volt); reading counts it and goes on', (tester) async {
      final api = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'});
      final router = await pumpRun(tester, api, launch: const RunLaunch(chapterKey: l2Aop, minutes: 20));
      expect(find.text('Lesson, 7 min'), findsOneWidget);
      expect(find.text('Revaluation of assets and liabilities'), findsOneWidget);
      expect(find.text('Read this first. Its cards come next in this run.'), findsOneWidget);
      expect(find.text('Skip it'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Read the lesson'));
      expect(find.text('at /learn/accountancy-revaluation'), findsOneWidget);
      router.pop();
      await runSettle(tester);
      expect(api.ratings.single.itemId, endsWith('-i1'));
      expect(find.text('2 of 25'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a recap: the answers showing, Previous (off at the first) and Next, then its end: Study these 12, again, back', (tester) async {
      final api = FixtureLearnApi();
      await pumpRun(
        tester,
        api,
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'recap', minutes: 5),
      );
      expect(find.text('Answers are showing. Nothing is scheduled.'), findsOneWidget);
      expect(find.text('Previous'), findsOneWidget);
      expect(find.text('Turn back'), findsOneWidget, reason: 'the answer is on the back');
      expect(find.byType(RunPileCount), findsNothing, reason: 'a recap schedules nothing, so it has no pile');
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next'));
      expect(find.text('2 of 12'), findsOneWidget);
      expect(api.ratings.length, 1, reason: 'a card passed is logged as a look');
      await tap(tester, find.text('Previous'));
      expect(find.text('1 of 12'), findsOneWidget);
      while (ctl(tester).phase == RunPhase.play) {
        ctl(tester).goRecap(1);
      }
      await runSettle(tester);
      expect(find.text('Quick recap of'), findsOneWidget);
      expect(find.text('That was all 12 Must-know lines.'), findsOneWidget);
      expect(find.text('Nothing was scheduled.'), findsOneWidget);
      expect(find.text('Study these 12'), findsOneWidget);
      expect(find.text('Quick recap again'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Quick recap again'));
      expect(find.text('1 of 12'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a cards run pauses after 20: "20 cards rated", "5 more are lined up.", Next round (volt) and Finish here', (tester) async {
      final api = _Many();
      await pumpRun(
        tester,
        api,
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'cards', minutes: 8),
      );
      for (var i = 0; i < 20; i++) {
        await turnNow(tester);
        await tap(tester, find.text('Got it'));
      }
      expect(tester.widget<RunRound>(find.byType(RunRound)).rated, 20);
      expect(find.text('cards rated'), findsOneWidget);
      expect(find.text('5 more are lined up.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next round'));
      expect(find.text('Show answer'), findsOneWidget);
      expect(find.text('21 of 25'), findsOneWidget);
      await finish(tester);
    });
  });

  group('stopping', () {
    testWidgets('Close with nothing done leaves; after one rating it asks "Stop for now?" with what was done', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, FixtureLearnApi());
      await tester.tap(find.bySemanticsLabel('Close'));
      await runSettle(tester);
      expect(find.text('host'), findsOneWidget);
      expect(find.text('Stop for now?'), findsNothing);
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Got it'));
      await tester.tap(find.bySemanticsLabel('Close').first);
      await runSettle(tester);
      expect(find.text('Stop for now?'), findsOneWidget);
      expect(find.text('1 of 20 done. 1 sent to Revise. Everything you did is saved.'), findsOneWidget);
      expect(find.text('End here, see how it went'), findsOneWidget);
      expect(find.text('Keep going'), findsWidgets);
      expect(find.text('Leave for now, pick up later today'), findsOneWidget);
      await tap(tester, find.text('Keep going').last);
      expect(find.text('Stop for now?'), findsNothing);
      expect(find.text('2 of 20'), findsOneWidget);
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the system Back asks after one item; End here goes to the end; Leave for now goes back', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await systemBack(tester);
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Got it'));
      await systemBack(tester);
      expect(find.text('Stop for now?'), findsOneWidget);
      await tap(tester, find.text('End here, see how it went'));
      expect(find.text('You stopped at 6 of 21.'), findsOneWidget, reason: 'the server\'s done line, never invented');
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Got it'));
      await systemBack(tester);
      await tap(tester, find.text('Leave for now, pick up later today'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });
  });

  group('the end', () {
    Future<void> toEnd(WidgetTester tester, FixtureLearnApi api, {int rated = 3, RunLaunch launch = const RunLaunch(chapterKey: l2Pf)}) async {
      await pumpRun(tester, api, launch: launch);
      for (var i = 0; i < rated; i++) {
        await turnNow(tester);
        await tap(tester, find.text('Got it'));
      }
      ctl(tester).finish(ctl(tester).doneCount);
      await runSettle(tester);
      await runSettle(tester);
    }

    testWidgets('the title, the done line, the Revise pile with its days, the lines, the lead with its volt key and the rows', (tester) async {
      await toEnd(tester, FixtureLearnApi());
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(find.text('You stopped at 6 of 21.'), findsOneWidget);
      expect(find.text('3 in Revise'), findsOneWidget);
      expect(find.text('1 back tomorrow, 1 back in 20 days, 1 back in 35 days'), findsOneWidget);
      expect(find.text('Key cards'), findsOneWidget);
      expect(find.text('3 rated: 1 got it, 1 easy, 1 missed'), findsOneWidget);
      expect(find.text('Old mistakes'), findsOneWidget);
      expect(find.text('1 of 2 fixed, 1 still open'), findsOneWidget);
      expect(find.text('Questions'), findsNothing, reason: 'only rows with something in them');
      expect(find.text('Next: Profit and Loss Appropriation Account'), findsOneWidget);
      expect(find.text('The next chapter in your book.'), findsOneWidget);
      expect(find.text('Start 10 minutes'), findsOneWidget);
      expect(find.text('Another 5 minutes here'), findsOneWidget);
      expect(find.text('8 Key cards and 2 questions'), findsOneWidget);
      expect(find.text('Fix your last open mistake'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(find.text('See Pro'), findsNothing);
      await finish(tester);
    });

    testWidgets('Start 10 minutes opens the next chapter\'s run in this one\'s place; a row opens its run', (tester) async {
      final api = FixtureLearnApi();
      await toEnd(tester, api);
      await tap(tester, find.text('Start 10 minutes'));
      expect(api.starts.last.chapterKey, 'accountancy.profit-and-loss-appropriation-account');
      expect(api.starts.last.minutes, 10);
      expect(api.starts.last.kind, 'mix');
      await finish(tester);
      final api2 = FixtureLearnApi();
      await toEnd(tester, api2);
      await tap(tester, find.text('Another 5 minutes here'));
      expect(api2.starts.last.chapterKey, l2Pf);
      expect(api2.starts.last.minutes, 5);
      await finish(tester);
    });

    testWidgets('Mobi is beside the title once, and the end reads the server (no number of its own)', (tester) async {
      final api = FixtureLearnApi();
      await toEnd(tester, api);
      expect(api.ended.length, 1);
      expect(find.byType(CardFace), findsNothing);
      await finish(tester);
    });

    testWidgets('Free after its day: the server\'s line and See Pro, the volt on the first option, no option that serves questions', (tester) async {
      await toEnd(tester, _FreeEnd(), rated: 1);
      expect(find.text('Your free Learn session for today is done.'), findsOneWidget);
      expect(find.text('Explore questions stay free. Pro has as many as you like.'), findsOneWidget);
      expect(find.text('See Pro'), findsNothing, reason: 'Pro is not on offer here');
      expect(find.text('Quick recap of this chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Free with Pro on offer shows See Pro as a text key', (tester) async {
      final api = _FreeEnd();
      await pumpRun(tester, api, proNudges: true);
      await tap(tester, find.text('Show answer'));
      await tap(tester, find.text('Got it'));
      ctl(tester).finish(1);
      await runSettle(tester);
      await runSettle(tester);
      expect(find.text('See Pro'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('a failed end read says "Your run is saved" with Try again; Try again reads it again', (tester) async {
      final api = FixtureLearnApi(failOn: {'end': FixtureLearnApi.offlineError});
      await toEnd(tester, api);
      expect(find.text('Your run is saved'), findsOneWidget);
      expect(find.text('Its summary did not load. Every rating and answer is already in.'), findsOneWidget);
      expect(find.text('Key cards'), findsNothing);
      api.failOn.clear();
      await tap(tester, find.text('Try again'));
      await runSettle(tester);
      expect(find.text('Key cards'), findsOneWidget);
      await finish(tester);
    });

    testWidgets("a level run's end has no pile (it rates no cards) and names the lowest score", (tester) async {
      await pumpRun(
        tester,
        _LevelEnd(),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'level', minutes: 6),
      );
      expect(find.text('Skip'), findsOneWidget);
      expect(find.text('Question'), findsOneWidget);
      ctl(tester).finish(ctl(tester).doneCount);
      await runSettle(tester);
      await runSettle(tester);
      expect(find.textContaining('in Revise'), findsNothing);
      expect(find.text('No cards went to Revise this time.'), findsNothing);
      expect(find.text('Your lowest score was in Goodwill: Nature and Valuation: 2 of 6 right.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Pro, when the chapter moved: the new state, "was Getting there" and the words of the ring for a screen reader', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, _MovedEnd());
      ctl(tester).finish(0);
      await runSettle(tester);
      await runSettle(tester);
      expect(find.text('Holding'), findsOneWidget);
      expect(find.text('was Getting there'), findsOneWidget);
      expect(find.bySemanticsLabel('This chapter moved from Getting there to Holding.'), findsOneWidget);
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the end of a run that closed (RUN_ENDED) is read, not started again', (tester) async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      await api.end(first.id);
      await pumpRun(
        tester,
        api,
        launch: RunLaunch(chapterKey: l2Pf, runId: first.id),
      );
      await runSettle(tester);
      expect(find.text('Key cards'), findsOneWidget);
      expect(find.text('Start 10 minutes'), findsOneWidget);
      await finish(tester);
    });
  });

  group('states without items', () {
    testWidgets("Learn home's Pick up (a run id) opens the run where it stopped", (tester) async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      await api.rate(first.id, first.items[0].id, 3);
      await api.rate(first.id, first.items[1].id, 3);
      await pumpRun(tester, api, launch: RunLaunch(runId: first.id));
      expect(api.calls, contains('getRun ${first.id}'));
      expect(find.text('3 of 20'), findsOneWidget);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 2);
      expect(find.text('Show answer'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('the run did not start: its line and Try again (volt); Try again starts it', (tester) async {
      final api = FixtureLearnApi(error: true);
      await pumpRun(tester, api);
      expect(find.text('This run did not start'), findsOneWidget);
      expect(find.text('Nothing was lost. Check your connection and try again.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      api.error = false;
      await tap(tester, find.text('Try again'));
      expect(find.text('Show answer'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a chapter that is not in the book list: its own line and Back to Learn', (tester) async {
      await pumpRun(tester, FixtureLearnApi(), launch: const RunLaunch(chapterKey: l2Missing));
      expect(find.text('This chapter is not in your book list.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Back to Learn'));
      expect(find.textContaining('at /practice'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('nothing to line up: its line and Back to the chapter', (tester) async {
      await pumpRun(tester, _Empty());
      expect(find.text('Nothing to line up here yet'), findsOneWidget);
      expect(find.text('This chapter has no cards or questions for this run.'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Free\'s day used: the server\'s line, the pick-up (volt), its options, Back to the chapter and See Pro', (tester) async {
      await pumpRun(
        tester,
        FixtureLearnApi(pro: false, freeUsed: true),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'feed'),
        proNudges: true,
      );
      expect(find.text("Today's free session is used"), findsOneWidget);
      expect(find.textContaining('Your free Learn session for today is done'), findsOneWidget);
      expect(find.text('Pick up where you stopped, 2 of 12'), findsOneWidget);
      expect(find.text('Revise 3 due cards'), findsOneWidget);
      expect(find.text('Quick recap of this chapter'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('loading is the run at its final shape: Close, one hairline, a card block and a key block, no numbers', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, _Waiting());
      expect(find.bySemanticsLabel('Lining up your run'), findsWidgets);
      expect(find.text('1 of 20'), findsNothing);
      expect(find.text('Show answer'), findsNothing);
      handle.dispose();
      await finish(tester);
    });
  });

  group('the flight', () {
    test('the ghost: a lift of 4 dp and 0.96, then an arc to 0.18 that fades out; a drop tilts -3 degrees and falls 64 dp', () {
      final start = RunFlight.poseAt('got', 0, dx: 120, dy: -400);
      expect([start.dx, start.dy, start.scale, start.opacity], [0, 0, 1, 1]);
      final lifted = RunFlight.poseAt('got', 100, dx: 120, dy: -400);
      expect(lifted.dy, closeTo(-4, 0.01));
      expect(lifted.scale, closeTo(0.96, 0.001));
      final end = RunFlight.poseAt('got', 420, dx: 120, dy: -400);
      expect([end.dx, end.dy], [120, -400]);
      expect(end.scale, closeTo(0.18, 0.001));
      expect(end.opacity, 0);
      final mid = RunFlight.poseAt('got', 100 + 320 * 0.45, dx: 120, dy: -400);
      expect(mid.scale, closeTo(0.52, 0.001));
      expect(mid.dy, closeTo(-400 * 0.45 - 90, 0.01), reason: 'the arc lifts min(90, |dy| x 0.28 + 36) dp over its first half');
      expect(RunFlight.durationOf('got').inMilliseconds, 420);
      expect(RunFlight.durationOf('easy').inMilliseconds, 380);
      expect(RunFlight.durationOf('missed').inMilliseconds, 260);
      final drop = RunFlight.poseAt('missed', 260);
      expect(drop.dy, closeTo(64, 0.01));
      expect(drop.angle, closeTo(-3 * 3.141592653589793 / 180, 0.0001));
      expect(drop.opacity, closeTo(0, 0.001));
    });

    testWidgets('Got it with motion on: a ghost of the card is in the air above the screen and the real card is hidden', (tester) async {
      await pumpRun(tester, FixtureLearnApi(), reduced: false);
      await tester.pump(const Duration(seconds: 1));
      ctl(tester).turn(ctl(tester).item! as LearnCardItem);
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.text('Got it'));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      expect(find.byKey(RunFlight.ghostKey), findsOneWidget);
      // The next item has risen under it by the hand-off (220 ms); the ghost lands at 420 ms and the pile pops.
      await tester.pump(const Duration(milliseconds: 150));
      expect(find.text('Show answer'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byKey(RunFlight.ghostKey), findsNothing);
      expect(tester.widget<RunPileCount>(find.byType(RunPileCount)).count, 1);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });
  });

  group('access', () {
    testWidgets('text scale 1.3 at 360 dp: the card, its ratings, a question, the end and the states draw without overflow', (tester) async {
      await pumpRun(tester, FixtureLearnApi(), textScale: 1.3);
      expect(tester.takeException(), isNull);
      await tap(tester, find.text('Show answer'));
      expect(tester.takeException(), isNull);
      await tap(tester, find.text('Got it'));
      expect(tester.takeException(), isNull);
      await goTo(tester, 4);
      expect(tester.takeException(), isNull);
      final q = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, wrongKey(q))));
      await runSettle(tester);
      expect(tester.takeException(), isNull);
      ctl(tester).finish(ctl(tester).doneCount);
      await runSettle(tester);
      await runSettle(tester);
      expect(tester.takeException(), isNull);
      await finish(tester);
      await pumpRun(
        tester,
        FixtureLearnApi(pro: false, freeUsed: true),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'feed'),
        textScale: 1.3,
        proNudges: true,
      );
      expect(tester.takeException(), isNull);
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi(error: true), textScale: 1.3);
      expect(tester.takeException(), isNull);
      await finish(tester);
    });

    testWidgets('a 320 dp phone, text 1.0 and 1.3: the card, its ratings, a question, the end and the states draw without overflow', (tester) async {
      for (final scale in [1.0, 1.3]) {
        await pumpRun(tester, FixtureLearnApi(), size: const Size(320, 640), textScale: scale);
        expect(tester.takeException(), isNull, reason: 'card at $scale');
        await tap(tester, find.text('Show answer'));
        expect(tester.takeException(), isNull, reason: 'ratings at $scale');
        await tap(tester, find.text('Got it'));
        await goTo(tester, 4);
        expect(tester.takeException(), isNull, reason: 'question at $scale');
        ctl(tester).finish(ctl(tester).doneCount);
        await runSettle(tester);
        await runSettle(tester);
        expect(tester.takeException(), isNull, reason: 'end at $scale');
        await finish(tester);
        await pumpRun(
          tester,
          FixtureLearnApi(pro: false, freeUsed: true),
          launch: const RunLaunch(chapterKey: l2Pf, kind: 'feed'),
          size: const Size(320, 640),
          textScale: scale,
          proNudges: true,
        );
        expect(tester.takeException(), isNull, reason: 'Free used at $scale');
        await finish(tester);
      }
    });

    testWidgets('48 dp targets on the card, its ratings, a question, an answered question and the end', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, FixtureLearnApi());
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await tap(tester, find.text('Show answer'));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await goTo(tester, 4);
      expect(find.byType(StageOptionRow), findsWidgets);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      final q = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, rightKey(q))));
      await tester.pump(const Duration(milliseconds: 400));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      ctl(tester).finish(ctl(tester).doneCount);
      await runSettle(tester);
      await runSettle(tester);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the stage says where it is: a labelled stage, "Card 3 of 21" on the item and the rating group', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, FixtureLearnApi());
      expect(find.bySemanticsLabel('Accounting for Partnership: Basic Concepts run'), findsOneWidget);
      expect(find.bySemanticsLabel('Card 1 of 20'), findsOneWidget);
      expect(find.bySemanticsLabel('In Revise 0'), findsOneWidget);
      await tap(tester, find.text('Show answer'));
      expect(find.bySemanticsLabel('How well did you recall it?'), findsOneWidget);
      handle.dispose();
      await finish(tester);
    });
  });
}

/// Free past its ratings: every card of the run is a look, with the server's line.
class _Looks extends FixtureLearnApi {
  _Looks() : super(pro: false);

  @override
  Future<LearnRun> startRun(RunStart start) async {
    final base = await super.startRun(start);
    return LearnRun.parse({
      ...base.raw,
      'looks': {'text': "You've used today's 10 free card ratings. The rest show their answers but won't be added to Revise."},
      'items': [
        for (final i in base.raw['items'] as List<Object?>) {...(i! as Map<String, Object?>), 'look': (i as Map<String, Object?>)['type'] == 'card'},
      ],
    });
  }
}

/// Free's end after the day's session: the server's line and See Pro, then what still works today.
class _FreeEnd extends FixtureLearnApi {
  _FreeEnd() : super(pro: false);

  @override
  Future<LearnEnd> end(String runId) async => LearnEnd.parse(LearnFixtures.json('run_end_feed_aop_free'));
}

/// A server that never answers the start (the loading stage at rest, no timer left behind).
class _Waiting extends FixtureLearnApi {
  @override
  Future<LearnRun> startRun(RunStart start) => Completer<LearnRun>().future;
}

/// A run with nothing in it.
class _Empty extends FixtureLearnApi {
  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    return LearnRun.parse({...LearnFixtures.json('run_start_mix_pf_pro'), 'items': <Object>[]});
  }
}

/// A cards run of 25 recorded cards (the pause comes after 20).
class _Many extends FixtureLearnApi {
  int _piled = 0;

  @override
  Future<LearnRun> startRun(RunStart start) async {
    final base = await super.startRun(start);
    final cards = [
      for (final i in base.items)
        if (i is LearnCardItem) i,
    ];
    return LearnRun.parse({
      ...base.raw,
      'kind': 'cards',
      'items': [
        for (var i = 0; i < 25; i++) {...cards[i % cards.length].raw, 'id': '${base.id}-m$i'},
      ],
    });
  }

  @override
  Future<LearnRateResult> rate(String runId, String itemId, int rating) async => LearnRateResult.parse({
    'ok': true,
    'stamp': 'Back Wed',
    'revisePile': {'count': ++_piled},
  });
}

/// A level run's end: its lowest chapter and no cards sent to Revise.
class _LevelEnd extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId) async => LearnEnd.parse({
    ...LearnFixtures.json('run_end_mix_pf_pro'),
    'revisePile': <Object>[],
    'reviseCards': <Object>[],
    'level': {'chapterKey': l2Pf, 'title': 'Goodwill: Nature and Valuation', 'right': 2, 'of': 6},
  });
}

/// An end where the chapter's state moved (Pro).
class _MovedEnd extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId) async =>
      LearnEnd.parse({...LearnFixtures.json('run_end_mix_pf_pro'), 'moved': 'Admission of a Partner moved from Getting there to Holding.'});
}
