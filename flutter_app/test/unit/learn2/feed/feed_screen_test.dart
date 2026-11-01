// The Explore feed on the stage, over the recorded Learn server inside a real GoRouter: the keys of each state, the
// stop rule for Close and the system Back, "This feed", the end, the states without items, Free's day used, the
// haptics the app's grammar asks for, text scale 1.3 at 360 dp, 48 dp targets and one volt key per state.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/feed/feed_controller.dart';
import 'package:mockmob/features/learn2/feed/feed_model.dart';
import 'package:mockmob/features/learn2/feed/feed_parts.dart';
import 'package:mockmob/features/learn2/feed/feed_screen.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_states.dart';

import 'support/feed_harness.dart';

FeedController ctl(WidgetTester tester) => feedState(tester).controller;

/// The volt keys on screen (the stage's step keys and the feed's option keys).
int voltKeys(WidgetTester tester) =>
    tester.widgetList<StageStepKey>(find.byType(StageStepKey)).where((k) => k.tone == StageTone.volt).length +
    tester.widgetList<FeedOptionKey>(find.byType(FeedOptionKey)).where((k) => k.tone == StageTone.volt).length;

StageCounter counter(WidgetTester tester) => tester.widget<StageCounter>(find.byType(StageCounter).first);

/// Taps [f] as a student would: scrolled into view first (a long question's options, the end's lower keys).
Future<void> tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.pump();
  await tester.tap(f.first);
  await feedSettle(tester);
}

/// Goes to slot [i] as a key would.
Future<void> goTo(WidgetTester tester, int i) async {
  ctl(tester).go(i);
  await feedSettle(tester);
}

/// Leaves the test with nothing pending (the confirm haptic's second tap, the title's note).
Future<void> finish(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
}

void main() {
  group('the items', () {
    testWidgets('a card: Keep, Turn over (the one volt key) and Chapter; the counter 1 of 16', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      expect(find.text('Admission of a Partner'), findsOneWidget);
      expect(counter(tester).position, 1);
      expect(counter(tester).of, 16);
      expect(find.text('Turn over'), findsOneWidget);
      expect(find.text('Keep'), findsOneWidget);
      expect(find.text('Chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(find.byType(StageKeptCount), findsNothing);
      await finish(tester);
    });

    testWidgets('a turn then Next moves to the next card; no haptic from the step key on the turn', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      await tap(tester, find.text('Turn over'));
      expect(ctl(tester).stateOf(ctl(tester).items.first.id).turned, isTrue);
      expect(find.text('Next'), findsOneWidget);
      // The card's own turn gives the light haptic; the key gives none of its own.
      expect(haptics.calls, ['light']);
      await tap(tester, find.text('Next'));
      expect(ctl(tester).active, 1);
      expect(counter(tester).position, 2);
      expect(find.text('Turn over'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Keep: the stamp from the server, the kept count, Kept, and the confirm haptic after the 200', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      await tap(tester, find.text('Keep'));
      expect(find.text('Kept'), findsOneWidget);
      expect(find.text('In Revise'), findsOneWidget);
      expect(tester.widget<StageKeptCount>(find.byType(StageKeptCount)).count, 1);
      await tester.pump(const Duration(milliseconds: 200));
      expect(haptics.calls, ['medium', 'light']);
      await finish(tester);
    });

    testWidgets('Keep on a card that is on Pro: the stamp says so and the key reads Pro', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(failOn: {'keep': FixtureLearnApi.proRequired}));
      await tap(tester, find.text('Keep'));
      expect(find.text('This card is on Pro.'), findsOneWidget);
      expect(find.text('Pro'), findsOneWidget);
      expect(find.byType(StageKeptCount), findsNothing);
      await finish(tester);
    });

    testWidgets('a question: Save and Skip (a line key, no volt), then a right answer with its haptics', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, 4);
      expect(find.text('Question 1 of 3'), findsOneWidget);
      expect(find.text('Save'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      expect(voltKeys(tester), 0);
      await tap(tester, find.text('Save'));
      expect(find.text('Saved'), findsOneWidget);
      haptics.calls.clear();
      final q = (ctl(tester).slots[4] as FeedItemSlot).item as LearnQuestionItem;
      final right = q.question.options.indexWhere((o) => o.key == rightKey(q));
      await tap(tester, find.byType(StageOptionRow).at(right));
      expect(find.text('Right.'), findsOneWidget);
      expect(find.text('Next'), findsOneWidget);
      expect(find.text('Skip'), findsNothing);
      expect(voltKeys(tester), 1);
      // The option tap ticks; the server's right grade confirms.
      await tester.pump(const Duration(milliseconds: 200));
      expect(haptics.calls, ['selection', 'medium', 'light']);
      await finish(tester);
    });

    testWidgets('the streak shows from 3 in the verdict line', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      final c = ctl(tester);
      for (final i in [4, 7]) {
        c.go(i);
        final q = (c.slots[i] as FeedItemSlot).item as LearnQuestionItem;
        await c.choose(q, rightKey(q));
      }
      await goTo(tester, 10);
      final q = (c.slots[10] as FeedItemSlot).item as LearnQuestionItem;
      await tap(tester, find.byType(StageOptionRow).at(q.question.options.indexWhere((o) => o.key == rightKey(q))));
      expect(find.byWidgetPredicate((w) => w is Text && w.semanticsLabel == 'Right. 3 in a row.'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a wrong answer: nothing buzzes, the line opens in place, and the card comes back three on', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, 4);
      final q = (ctl(tester).slots[4] as FeedItemSlot).item as LearnQuestionItem;
      haptics.calls.clear();
      await tap(tester, find.byType(StageOptionRow).at(q.question.options.indexWhere((o) => o.key == wrongKey(q))));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.textContaining('Not quite. The answer is '), findsOneWidget);
      expect(find.text('The line you needed'), findsOneWidget);
      expect(haptics.calls, ['selection']);
      expect(ctl(tester).items, hasLength(17));
      expect(counter(tester).of, 17);
      await finish(tester);
    });

    testWidgets('Skip moves on and answers nothing', (tester) async {
      final api = FixtureLearnApi();
      await pumpFeed(tester, api);
      await goTo(tester, 4);
      await tap(tester, find.text('Skip'));
      expect(ctl(tester).active, 5);
      expect(api.answers, isEmpty);
      await finish(tester);
    });

    testWidgets('a left-out question (409) shows its line in place of the options; Next moves on', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(failOn: {'answer': FixtureLearnApi.questionChanged}));
      await goTo(tester, 4);
      await tap(tester, find.byType(StageOptionRow).first);
      expect(find.text('This question changed a moment ago, so it is left out.'), findsOneWidget);
      expect(find.byType(StageOptionRow), findsNothing);
      expect(find.text('Next'), findsOneWidget);
      expect(find.text('Save'), findsNothing);
      await finish(tester);
    });

    testWidgets('the checkpoint after 8: End here and Keep going share the bar; the volt is Keep going', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await goTo(tester, 8);
      expect(find.byType(StageCheckpoint), findsOneWidget);
      expect(find.text('1 card seen, 0 kept'), findsOneWidget);
      expect(find.textContaining('8 of 16 done. '), findsOneWidget);
      expect(find.text('Keep going, or end here.'), findsOneWidget);
      expect(find.text('End here'), findsOneWidget);
      expect(find.text('Keep going'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(find.text('Keep'), findsNothing);
      expect(find.text('Chapter'), findsNothing);
      await tap(tester, find.text('Keep going'));
      expect(ctl(tester).active, 9);
      await finish(tester);
    });
  });

  group('the stop rule', () {
    testWidgets('before any item is done, Close leaves', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('after one, Close asks: Keep going stays, End here goes to the end, Leave for now leaves', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Keep'));
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('Stop for now?'), findsOneWidget);
      expect(find.text('1 of 16 done. 1 kept in Revise. Everything you did is saved.'), findsOneWidget);
      await tap(tester, find.widgetWithText(StageStepKey, 'Keep going'));
      expect(find.text('Stop for now?'), findsNothing);
      expect(ctl(tester).mode, FeedMode.items);

      await tap(tester, find.bySemanticsLabel('Close the feed'));
      await tap(tester, find.text('End here, see how it went'));
      expect(ctl(tester).mode, FeedMode.end);
      expect(find.text('Another 10 minutes'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Leave for now goes back where the feed came from', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      await tap(tester, find.text('Leave for now, pick up later today'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('the system Back follows the same rule', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await systemBack(tester);
      expect(find.text('host'), findsOneWidget);

      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      await systemBack(tester);
      expect(find.text('Stop for now?'), findsOneWidget);
      // Back again closes the sheet, not the feed.
      await systemBack(tester);
      expect(find.text('Stop for now?'), findsNothing);
      expect(find.text('Next'), findsOneWidget);
      await finish(tester);
    });
  });

  group('This feed and the end', () {
    testWidgets('the counter opens "This feed"; a row goes there', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Keep'));
      await tap(tester, find.byType(StageCounter));
      expect(find.text('This feed'), findsOneWidget);
      expect(find.text('Now'), findsOneWidget);
      await tap(tester, find.bySemanticsLabel(RegExp(r'^5\. Question\. ')));
      expect(find.text('This feed'), findsNothing);
      expect(ctl(tester).active, 4);
      await finish(tester);
    });

    testWidgets('the end: the title, the done line, the kept fan, the lines and the keys; Another 10 minutes starts afresh', (tester) async {
      final api = FixtureLearnApi();
      await pumpFeed(tester, api);
      await tap(tester, find.text('Keep'));
      await goTo(tester, ctl(tester).endAt);
      expect(find.byType(StageEnd), findsOneWidget);
      expect(find.text('Admission of a Partner'), findsWidgets);
      expect(find.text('You stopped at 13 of 17.'), findsOneWidget);
      expect(find.text('1 kept'), findsOneWidget);
      expect(find.text('They are first in Revise.'), findsOneWidget);
      expect(find.text('Cards'), findsOneWidget);
      expect(find.text('1 seen, 1 kept'), findsOneWidget);
      expect(find.text('Questions'), findsOneWidget);
      expect(find.text('Old mistakes'), findsOneWidget);
      expect(find.text('Next chapter: Retirement and Death of a Partner'), findsOneWidget);
      expect(find.text('Back to Explore'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Another 10 minutes'));
      expect(api.starts.last.fresh, isTrue);
      expect(ctl(tester).mode, FeedMode.items);
      expect(counter(tester).position, 1);
      await finish(tester);
    });

    testWidgets('the end\'s Next chapter opens that chapter\'s feed in this one\'s place', (tester) async {
      final api = FixtureLearnApi();
      await pumpFeed(tester, api);
      await goTo(tester, ctl(tester).endAt);
      await tap(tester, find.text('Next chapter: Retirement and Death of a Partner'));
      expect(tester.widget<FeedScreen>(find.byType(FeedScreen)).launch.chapterKey, 'accountancy.retirement-and-death-of-partner');
      expect(api.starts.last.chapterKey, 'accountancy.retirement-and-death-of-partner');
      // In this feed's place: Close goes back to where the first one was opened from.
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('at the end, a drag down from its top goes back to the last item', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await goTo(tester, ctl(tester).endAt);
      expect(ctl(tester).mode, FeedMode.end);
      await tester.dragFrom(const Offset(180, 300), const Offset(0, 300));
      await feedSettle(tester);
      expect(ctl(tester).mode, FeedMode.items);
      expect(ctl(tester).active, ctl(tester).endAt - 1);
      // Up again: the end, read once (nothing changed since).
      await tap(tester, find.text('See how it went'));
      expect(ctl(tester).mode, FeedMode.end);
      await finish(tester);
    });

    testWidgets('with motion: the turn, the first feed\'s nudge, the Keep flight and the pager run without a fault', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(), reduced: false);
      await tester.tap(find.text('Turn over'));
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.text('Keep'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('Kept'), findsOneWidget);
      expect(tester.widget<StageKeptCount>(find.byType(StageKeptCount)).count, 1);
      await tester.tap(find.text('Next'));
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(ctl(tester).active, 1);
      // A drag up on the card moves one item.
      await tester.dragFrom(const Offset(180, 400), const Offset(0, -300));
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(ctl(tester).active, 2);
      expect(tester.takeException(), isNull);
      await finish(tester);
    });

    testWidgets('the Chapter key opens the chapter page', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Chapter'));
      expect(find.text('at ${Learn2Links.chapter(l2Aop)}'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Free after the claim: the server\'s line and See Pro, no Another 10 minutes', (tester) async {
      final api = FixtureLearnApi(pro: false);
      await pumpFeed(tester, api, proNudges: true);
      final c = ctl(tester);
      final q = (c.slots[1] as FeedItemSlot).item as LearnQuestionItem;
      c.go(1);
      await c.choose(q, rightKey(q));
      await goTo(tester, c.endAt);
      expect(find.textContaining('Your free Learn session for today is done.'), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      expect(find.text('Another 10 minutes'), findsNothing);
      expect(voltKeys(tester), 0);
      await finish(tester);
    });
  });

  group('states without items', () {
    testWidgets('loading: the stage skeleton, then "Taking longer than usual" after 8 s', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(slow: const Duration(seconds: 12)));
      expect(find.byType(StageSkeleton), findsOneWidget);
      expect(find.text('Taking longer than usual.'), findsNothing);
      await tester.pump(const Duration(seconds: 8));
      expect(find.text('Taking longer than usual.'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      await feedSettle(tester);
      expect(find.byType(StageSkeleton), findsNothing);
      await finish(tester);
    });

    testWidgets('the feed did not start: Try again and Back to Explore', (tester) async {
      final api = FixtureLearnApi(error: true);
      await pumpFeed(tester, api);
      expect(find.text('The feed did not start'), findsOneWidget);
      expect(find.text('Check your connection and try again.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      api.error = false;
      await tap(tester, find.text('Try again'));
      expect(find.text('Turn over'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('not found and empty', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(), launch: const FeedLaunch(chapterKey: l2Missing));
      expect(find.text('This chapter is not in your book list'), findsOneWidget);
      expect(find.text('Back to Explore'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
      await pumpFeed(tester, _EmptyApi());
      expect(find.text('Nothing to play here yet'), findsOneWidget);
      expect(find.text('Open the chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Free\'s day used: the line, the pick-up (volt), the options with their minutes, See Pro', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      expect(find.text("Today's free session is used"), findsOneWidget);
      expect(find.text('Pick up where you stopped, 2 of 12'), findsOneWidget);
      expect(find.text('Admission of a Partner'), findsOneWidget);
      expect(find.text('Revise 3 due cards'), findsOneWidget);
      expect(find.text('About 1 min.'), findsNWidgets(2));
      expect(find.text('Questions on this chapter in Explore'), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Questions on this chapter in Explore'));
      expect(find.textContaining('at /practice/stream'), findsOneWidget);
      await finish(tester);
    });
  });

  group('access', () {
    testWidgets('text scale 1.3 at 360 dp: the card, the question, the checkpoint and the end draw without overflow', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(), textScale: 1.3);
      expect(tester.takeException(), isNull);
      await tap(tester, find.text('Turn over'));
      expect(tester.takeException(), isNull);
      for (final i in [4, 8, 7]) {
        await goTo(tester, i);
        expect(tester.takeException(), isNull, reason: 'slot $i');
      }
      await goTo(tester, ctl(tester).endAt);
      expect(tester.takeException(), isNull);
      await finish(tester);
    });

    testWidgets('text scale 1.3: Free\'s day used and the error state', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), textScale: 1.3, proNudges: true);
      expect(tester.takeException(), isNull);
      await finish(tester);
      await pumpFeed(tester, FixtureLearnApi(error: true), textScale: 1.3);
      expect(tester.takeException(), isNull);
      await finish(tester);
    });

    testWidgets('48 dp targets on the card, a question, the checkpoint and the end', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpFeed(tester, FixtureLearnApi());
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      // A question whose options are in view (a long one's "Options below" chip is the stage's own, held by its tests).
      await goTo(tester, 16);
      expect(find.byType(StageOptionRow), findsWidgets);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await goTo(tester, 8);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await goTo(tester, ctl(tester).endAt);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
      await finish(tester);
    });
  });
}

class _EmptyApi extends FixtureLearnApi {
  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    return LearnRun.parse({...LearnFixtures.json('run_start_feed_aop_pro'), 'items': <Object>[]});
  }
}
