// The Explore feed on the stage, over the recorded Learn server inside a real GoRouter: the keys of each state (Revise later with
// its card-stack glyph, Save, Skip, the checkpoint's two), the first visit's Mobi chip (once per student, taken away by the first
// move), the card edge that names what comes next, the stop rule and its sheet ("Stop here", "Back to it"), "This feed", the one end
// screen (the server's own key and link, the stopped end and its Continue), the states without items, Free's day used, the
// haptics the app's grammar asks for, text scale 1.3 at 360 dp, 48 dp targets and one volt key per state.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/feed/feed_controller.dart';
import 'package:mockmob/features/learn2/feed/feed_model.dart';
import 'package:mockmob/features/learn2/feed/feed_screen.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_cue.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';
import 'package:mockmob/features/learn2/stage/stage_states.dart';

import '../../../helpers/fonts.dart';
import 'support/feed_harness.dart';

FeedController ctl(WidgetTester tester) => feedState(tester).controller;

/// The volt keys on screen: the step keys of the action bar, the end's main key, See Pro and Try again are all `StageStepKey`.
int voltKeys(WidgetTester tester) => tester.widgetList<StageStepKey>(find.byType(StageStepKey)).where((k) => k.tone == StageTone.volt).length;

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

/// A store in which this student has already seen the first visit's cue (so no chip draws over what a test looks at).
MemoryPrefsStore seenCue() => MemoryPrefsStore()..values[LearnPrefs.coachKey] = <String>[FeedController.cueId(null)];

/// The cue's id as the store holds it after the first move.
bool cueMarked(MemoryPrefsStore store) => ((store.values[LearnPrefs.coachKey] as List<String>?) ?? const <String>[]).contains(FeedController.cueId(null));

void main() {
  setUpAll(loadAppFonts);

  group('the items', () {
    testWidgets('a card: Revise later, Turn over (the one volt key) and Chapter; the counter 1 of 16 and no kept count', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      expect(find.text('Admission of a Partner'), findsOneWidget, reason: 'the chapter as the quiet line under the top bar');
      expect(counter(tester).position, 1);
      expect(counter(tester).of, 16);
      expect(find.text('Turn over'), findsOneWidget);
      expect(find.text('Revise later'), findsOneWidget);
      expect(find.byType(StageCardStack), findsOneWidget, reason: 'the card-stack glyph, not a bookmark');
      expect(find.text('Chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(find.text('Keep'), findsNothing);
      expect(find.text('Kept'), findsNothing);
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

    testWidgets('Revise later: the key turns to a check and "In Revise" once the server has it, the stamp says so, then the confirm haptic', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      final id = ctl(tester).items.first.id;
      final key = find.byKey(ValueKey('keep-$id'));
      expect(find.descendant(of: key, matching: find.text('Revise later')), findsOneWidget);
      await tap(tester, find.text('Revise later'));
      expect(find.descendant(of: key, matching: find.text('In Revise')), findsOneWidget);
      expect(find.descendant(of: key, matching: find.byIcon(LucideIcons.check)), findsOneWidget);
      expect(find.descendant(of: key, matching: find.byType(StageCardStack)), findsNothing);
      expect(find.descendant(of: find.byType(CardFace).first, matching: find.text('In Revise')), findsOneWidget, reason: 'the stamp line under the card');
      expect(find.text('Revise later'), findsNothing);
      await tester.pump(const Duration(milliseconds: 200));
      expect(haptics.calls, ['medium', 'light']);
      await finish(tester);
    });

    testWidgets('Revise later on a card that is on Pro: the stamp says so and the key reads Pro', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(failOn: {'keep': FixtureLearnApi.proRequired}));
      await tap(tester, find.text('Revise later'));
      expect(find.text('This card is on Pro.'), findsOneWidget);
      expect(find.text('Pro'), findsOneWidget);
      expect(find.text('In Revise'), findsNothing);
      await finish(tester);
    });

    testWidgets('Revise later that fails: "Not added. Try again." in the stamp line and nothing is claimed', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(failOn: {'keep': FixtureLearnApi.offlineError}));
      await tap(tester, find.text('Revise later'));
      expect(find.text('Not added. Try again.'), findsOneWidget);
      expect(find.text('In Revise'), findsNothing);
      expect(ctl(tester).numbers.kept, 0);
      await finish(tester);
    });

    testWidgets('a question: Save and Skip (a line key, no volt), then a right answer with its haptics', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, 4);
      expect(counter(tester).position, 5, reason: 'one counter only: the top bar\'s');
      expect(find.text('Question 1 of 3'), findsNothing);
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

    testWidgets('the streak shows from 3 in the verdict line, open mistakes counting', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      final c = ctl(tester);
      // Slots 4, 7 and 10 are a plain question and two open mistakes (answered right, an open mistake says its fixed line);
      // the fourth right answer in a row, a plain question again, says the streak.
      for (final i in [4, 7, 10]) {
        c.go(i);
        final q = (c.slots[i] as FeedItemSlot).item as LearnQuestionItem;
        await c.choose(q, rightKey(q));
      }
      await goTo(tester, 13);
      final q = (c.slots[13] as FeedItemSlot).item as LearnQuestionItem;
      await tap(tester, find.byType(StageOptionRow).at(q.question.options.indexWhere((o) => o.key == rightKey(q))));
      expect(find.byWidgetPredicate((w) => w is Text && w.semanticsLabel == 'Right. 4 in a row.'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a wrong answer: nothing buzzes, "Not quite. It’s C." with the line opening in place, and the card comes back three on', (tester) async {
      final haptics = FeedHaptics();
      await pumpFeed(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, 4);
      final q = (ctl(tester).slots[4] as FeedItemSlot).item as LearnQuestionItem;
      haptics.calls.clear();
      await tap(tester, find.byType(StageOptionRow).at(q.question.options.indexWhere((o) => o.key == wrongKey(q))));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.textContaining('Not quite. It’s '), findsOneWidget);
      expect(find.textContaining('The answer is'), findsNothing);
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

    testWidgets('the checkpoint after 8: one headline, one line and the small fan; Stop here and Keep going share the bar, the volt is Keep going', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Revise later'));
      await goTo(tester, 8);
      expect(find.byType(StageCheckpoint), findsOneWidget);
      expect(find.text('1 for Revise'), findsOneWidget, reason: 'never a zero first');
      expect(find.textContaining('8 of 16 done, '), findsOneWidget);
      expect(find.byType(StageKeptFan), findsOneWidget, reason: 'the card sent to Revise, as the small fan');
      expect(find.text('Stop here'), findsOneWidget);
      expect(find.text('Keep going'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(find.text('Revise later'), findsNothing);
      expect(find.text('Chapter'), findsNothing);
      await tap(tester, find.text('Keep going'));
      expect(ctl(tester).active, 9);
      await finish(tester);
    });

    testWidgets('the checkpoint\'s Stop here shows the end and keeps the feed open', (tester) async {
      final api = FixtureLearnApi();
      await pumpFeed(tester, api);
      await goTo(tester, 8);
      await tap(tester, find.text('Stop here'));
      expect(ctl(tester).mode, FeedMode.end);
      expect(ctl(tester).stoppedHere, isTrue);
      expect(api.stops, [true]);
      expect(find.byType(EndScreen), findsOneWidget);
      await finish(tester);
    });
  });

  group('the first visit\'s chip and the card edge', () {
    testWidgets('a student\'s first feed: a Mobi chip says "Swipe up for the next one" until the first move, which takes it away and marks it seen', (tester) async {
      final store = MemoryPrefsStore();
      await pumpFeed(tester, FixtureLearnApi(), store: store);
      expect(find.byType(StageCue), findsOneWidget);
      expect(find.text('Swipe up for the next one'), findsOneWidget);
      expect(cueMarked(store), isFalse, reason: 'showing it marks nothing');
      // A turn is not a move: the chip stays.
      await tap(tester, find.text('Turn over'));
      expect(find.byType(StageCue), findsOneWidget);
      expect(cueMarked(store), isFalse);
      await tap(tester, find.text('Next'));
      expect(ctl(tester).active, 1);
      expect(find.byType(StageCue), findsNothing);
      expect(cueMarked(store), isTrue, reason: 'marked only by the move');
      // The same student moves on: no chip again.
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Next'));
      expect(find.byType(StageCue), findsNothing);
      await finish(tester);
    });

    testWidgets('a student who has seen it never gets it again; a drag up is a move too', (tester) async {
      final store = seenCue();
      await pumpFeed(tester, FixtureLearnApi(), store: store);
      expect(find.byType(StageCue), findsNothing);
      expect(find.text('Swipe up for the next one'), findsNothing);
      await finish(tester);

      final fresh = MemoryPrefsStore();
      await pumpFeed(tester, FixtureLearnApi(), store: fresh);
      expect(find.byType(StageCue), findsOneWidget);
      await tester.dragFrom(const Offset(180, 400), const Offset(0, -300));
      await feedSettle(tester);
      expect(ctl(tester).active, 1);
      expect(find.byType(StageCue), findsNothing);
      expect(cueMarked(fresh), isTrue);
      await finish(tester);
    });

    testWidgets('the card edge names what comes next: a card\'s kind, "Question", the mistake\'s own line, "So far"', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(), store: seenCue());
      final pager = tester.widget<StagePager>(find.byType(StagePager));
      final context = tester.element(find.byType(StagePager));
      String? cap(int i) => pager.pageBuilder(context, i).cap;
      expect(cap(0), 'Definition');
      expect(cap(1), 'Key line');
      expect(cap(4), 'Question');
      expect(cap(7), 'You missed this in Mock 4 on 24 Oct', reason: 'a mistake says where it was missed');
      expect(cap(8), 'So far', reason: 'the checkpoint');
      expect(find.text('Definition'), findsWidgets);
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

    testWidgets('after one, Close asks "Stop for now?": Back to it stays, Stop here goes to the end and the server keeps the feed open', (tester) async {
      final api = FixtureLearnApi();
      await pumpFeed(tester, api);
      await tap(tester, find.text('Revise later'));
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Next'));
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('Stop for now?'), findsOneWidget);
      expect(find.text('1 of 16 done. It’s all saved.'), findsOneWidget, reason: 'one item is done: the card kept and read');
      expect(find.text('Leave for now, pick up later today'), findsNothing);
      await tap(tester, find.text('Back to it'));
      expect(find.text('Stop for now?'), findsNothing);
      expect(ctl(tester).mode, FeedMode.items);
      expect(api.stops, isEmpty);

      await tap(tester, find.bySemanticsLabel('Close the feed'));
      await tap(tester, find.text('Stop here'));
      expect(ctl(tester).mode, FeedMode.end);
      expect(api.stops, [true], reason: 'end?stop=1: the feed stays open to pick up today');
      expect(find.text('1 of 16 done'), findsOneWidget, reason: 'the place of the last item the server holds an event for (the card kept); the card only turned over holds none');
      await finish(tester);
    });

    testWidgets('the end\'s Close goes back where the feed came from', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Revise later'));
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      await tap(tester, find.text('Stop here'));
      expect(ctl(tester).mode, FeedMode.end);
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('the system Back follows the same rule', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await systemBack(tester);
      expect(find.text('host'), findsOneWidget);

      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Revise later'));
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
    testWidgets('the counter opens "This feed"; a row goes there; Stop here at its foot', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.text('Revise later'));
      await tap(tester, find.byType(StageCounter));
      expect(find.text('This feed'), findsOneWidget);
      expect(find.text('Now'), findsOneWidget);
      expect(find.text('Stop here'), findsOneWidget);
      await tap(tester, find.bySemanticsLabel(RegExp(r'^5\. Question\. ')));
      expect(find.text('This feed'), findsNothing);
      expect(ctl(tester).active, 4);

      await tap(tester, find.byType(StageCounter));
      await tap(tester, find.text('Stop here'));
      expect(ctl(tester).mode, FeedMode.end);
      expect(ctl(tester).stoppedHere, isTrue);
      await finish(tester);
    });

    testWidgets('the mistakes in "This feed" are called open mistakes', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await tap(tester, find.byType(StageCounter));
      expect(find.bySemanticsLabel(RegExp(r'^8\. Open mistake\. ')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'Old mistake')), findsNothing);
      await finish(tester);
    });

    testWidgets('the end: the chapter, the headline, the fan, the numbers, the bar, then the server\'s one key and one link; Keep going starts afresh', (tester) async {
      final api = FixtureLearnApi();
      await pumpFeed(tester, api);
      await tap(tester, find.text('Revise later'));
      await goTo(tester, ctl(tester).endAt);
      expect(find.byType(EndScreen), findsOneWidget);
      expect(find.text('Admission of a Partner'), findsWidgets);
      expect(find.text('16 done'), findsOneWidget);
      expect(find.byType(StageKeptFan), findsOneWidget);
      expect(find.text('in Revise'), findsOneWidget, reason: 'the number\'s label; "kept" is not a word of the end');
      expect(find.text('1 of 60 cards seen'), findsOneWidget);
      // The server's words, one key and one link: no "Another 10 minutes", no "Back to Explore", no lines table.
      expect(find.text('Keep going · 10 min'), findsOneWidget);
      expect(find.text('Fix 2 open mistakes · 2 min'), findsOneWidget);
      expect(find.text('Another 10 minutes'), findsNothing);
      expect(find.text('Back to Explore'), findsNothing);
      expect(find.text('Old mistakes'), findsNothing);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Keep going · 10 min'));
      expect(api.starts.last.fresh, isTrue);
      expect(ctl(tester).mode, FeedMode.items);
      expect(counter(tester).position, 1);
      await finish(tester);
    });

    testWidgets('the end\'s quiet link opens the mistakes run in this one\'s place of the stack', (tester) async {
      await pumpFeed(tester, FixtureLearnApi());
      await goTo(tester, ctl(tester).endAt);
      await tap(tester, find.text('Fix 2 open mistakes · 2 min'));
      expect(find.textContaining('at /learn/session'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('the end that leads with the next chapter: the key carries the chapter\'s name and opens that feed in this one\'s place', (tester) async {
      final api = _NextChapterApi();
      await pumpFeed(tester, api);
      await goTo(tester, ctl(tester).endAt);
      expect(find.text('Next chapter · 10 min'), findsOneWidget);
      expect(find.text('Retirement and Death of a Partner'), findsOneWidget, reason: 'the second line inside the key');
      expect(find.text('Keep going · 10 min'), findsOneWidget, reason: 'the quiet link');
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next chapter · 10 min'));
      expect(tester.widget<FeedScreen>(find.byType(FeedScreen)).launch.chapterKey, 'accountancy.retirement-and-death-of-partner');
      expect(api.starts.last.chapterKey, 'accountancy.retirement-and-death-of-partner');
      // In this feed's place: Close goes back to where the first one was opened from.
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a stopped feed\'s end: "N of 16 done", Continue picks the same feed up by its id, the fix link starts a new run', (tester) async {
      final api = _StoppedFeedApi();
      await pumpFeed(tester, api);
      await tap(tester, find.text('Revise later'));
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Next'));
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      await tap(tester, find.text('Stop here'));
      expect(api.stops, [true]);
      expect(find.text('1 of 16 done'), findsOneWidget);
      expect(find.text('Continue · 6 min'), findsOneWidget);
      expect(find.text('Fix 2 open mistakes · 2 min'), findsOneWidget);
      expect(voltKeys(tester), 1);
      final starts = api.starts.length;
      await tap(tester, find.text('Continue · 6 min'));
      expect(api.starts, hasLength(starts), reason: 'it reads the run again, it never starts another');
      expect(ctl(tester).mode, FeedMode.items);
      expect(ctl(tester).stoppedHere, isFalse);
      await finish(tester);
    });

    testWidgets('an end that did not load: "Your feed is saved", Try again, Back to Explore; never a number of its own', (tester) async {
      final api = FixtureLearnApi(failOn: {'end': FixtureLearnApi.offlineError});
      await pumpFeed(tester, api);
      await tap(tester, find.text('Revise later'));
      await goTo(tester, ctl(tester).endAt);
      expect(find.text('Your feed is saved'), findsOneWidget);
      expect(find.text('Its summary did not load.'), findsOneWidget);
      expect(find.text('Back to Explore'), findsOneWidget);
      expect(find.text('16 done'), findsNothing);
      expect(voltKeys(tester), 1);
      api.failOn.remove('end');
      await tap(tester, find.text('Try again'));
      expect(find.text('Your feed is saved'), findsNothing);
      expect(find.text('Keep going · 10 min'), findsOneWidget);
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
      // Up again ("See how it went": the end was read, so the feed is closed and the last question is not counted): the end,
      // read once (nothing changed since).
      await tap(tester, find.text('See how it went'));
      expect(ctl(tester).mode, FeedMode.end);
      await finish(tester);
    });

    testWidgets('with motion: the turn, the chip leaving, the Revise later pop and the pager run without a fault', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(), reduced: false);
      expect(find.byType(StageCue), findsOneWidget);
      await tester.tap(find.text('Turn over'));
      for (var i = 0; i < 12; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.text('Revise later'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text('In Revise'), findsWidgets);
      await tester.tap(find.text('Next'));
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(ctl(tester).active, 1);
      expect(find.byType(StageCue), findsNothing);
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

    testWidgets('Free after the claim: the server\'s one line above Quick recap, See Pro as the quiet link, no Keep going', (tester) async {
      final api = FixtureLearnApi(pro: false);
      await pumpFeed(tester, api, proNudges: true);
      final c = ctl(tester);
      final q = (c.slots[1] as FeedItemSlot).item as LearnQuestionItem;
      c.go(1);
      await c.choose(q, rightKey(q));
      await goTo(tester, c.endAt);
      expect(find.text('That was today\'s free session. Questions come back tomorrow.'), findsOneWidget);
      expect(find.text('Quick recap · 1 min'), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      expect(find.text('Keep going · 10 min'), findsNothing);
      expect(find.text('Another 10 minutes'), findsNothing);
      expect(voltKeys(tester), 1, reason: 'Quick recap is the one volt key; See Pro is a quiet link');
      await finish(tester);
    });

    testWidgets('a build with no Pro nudges leaves See Pro out of the end', (tester) async {
      final api = FixtureLearnApi(pro: false);
      await pumpFeed(tester, api);
      final c = ctl(tester);
      final q = (c.slots[1] as FeedItemSlot).item as LearnQuestionItem;
      c.go(1);
      await c.choose(q, rightKey(q));
      await goTo(tester, c.endAt);
      expect(find.text('Quick recap · 1 min'), findsOneWidget);
      expect(find.text('See Pro'), findsNothing);
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

    testWidgets('Free\'s day used: the headline, the line, See Pro (the one volt key), then the Or rows the server accepts today', (tester) async {
      final api = FixtureLearnApi(pro: false, freeUsed: true);
      await pumpFeed(tester, api, launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      expect(find.text('That was today\'s free session.'), findsOneWidget);
      expect(find.text('Questions come back tomorrow. Your Key cards stay open.'), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      expect(find.text('Or'), findsOneWidget);
      expect(find.text('Continue · 8 min'), findsOneWidget);
      expect(find.text('Revise 8 due cards · 2 min'), findsOneWidget);
      expect(find.text('Answer single questions'), findsNothing, reason: 'two Or rows at most, in the server\'s order');
      expect(find.text('Today\'s free session is used'), findsNothing);
      expect(find.text('Learn opens again tomorrow'), findsNothing);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Free\'s day used with nothing to continue: Revise and Answer single questions, which opens Explore\'s question stream', (tester) async {
      await pumpFeed(tester, _FreeNoRunApi(), launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      expect(find.text('Continue · 8 min'), findsNothing);
      expect(find.text('Revise 8 due cards · 2 min'), findsOneWidget);
      expect(find.text('Answer single questions'), findsOneWidget);
      await tap(tester, find.text('Answer single questions'));
      expect(find.textContaining('at /practice/stream'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Free\'s day used: Continue picks today\'s own feed up, Revise starts a Key cards run, Close goes back', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      await tap(tester, find.text('Revise 8 due cards · 2 min'));
      expect(find.textContaining('at /learn/session'), findsOneWidget);
      await finish(tester);

      final api = FixtureLearnApi(pro: false, freeUsed: true);
      await pumpFeed(tester, api, launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      await tap(tester, find.text('Continue · 8 min'));
      expect(tester.widget<FeedScreen>(find.byType(FeedScreen)).launch.chapterKey, 'accountancy.admission-of-partner');
      expect(tester.widget<FeedScreen>(find.byType(FeedScreen)).launch.runId, isNotNull);
      await finish(tester);

      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a build with no Pro nudges leaves See Pro out of Free\'s day used', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), launch: const FeedLaunch(chapterKey: l2Pf));
      expect(find.text('See Pro'), findsNothing);
      expect(find.text('Continue · 8 min'), findsOneWidget);
      expect(voltKeys(tester), 0);
      await finish(tester);
    });
  });

  group('access', () {
    testWidgets('text scale 1.3 at 360 dp: the card, the question, the checkpoint and the end draw without overflow', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(), textScale: 1.3);
      expect(tester.takeException(), isNull);
      expect(find.byType(StageCue), findsOneWidget);
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

    testWidgets('text scale 1.3: Free\'s day used, the stopped end and the error state', (tester) async {
      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), textScale: 1.3, proNudges: true);
      expect(tester.takeException(), isNull);
      await finish(tester);
      await pumpFeed(tester, FixtureLearnApi(error: true), textScale: 1.3);
      expect(tester.takeException(), isNull);
      await finish(tester);
      await pumpFeed(tester, _StoppedFeedApi(), textScale: 1.3);
      await tap(tester, find.text('Revise later'));
      await tap(tester, find.bySemanticsLabel('Close the feed'));
      expect(tester.takeException(), isNull);
      await tap(tester, find.text('Stop here'));
      expect(tester.takeException(), isNull);
      await finish(tester);
    });

    testWidgets('48 dp targets on the card, a question, the checkpoint, the end and Free\'s day used', (tester) async {
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
      await finish(tester);
      await pumpFeed(tester, FixtureLearnApi(pro: false, freeUsed: true), launch: const FeedLaunch(chapterKey: l2Pf), proNudges: true);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the labelled text on the card, the end and Free\'s day used keeps its contrast in both themes', (tester) async {
      final handle = tester.ensureSemantics();
      for (final brightness in [Brightness.dark, Brightness.light]) {
        await pumpFeed(tester, FixtureLearnApi(), brightness: brightness);
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        await goTo(tester, ctl(tester).endAt);
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        await finish(tester);
      }
      handle.dispose();
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

/// Free's day used with no run of today's to continue: the 402 without its resume.
class _FreeNoRunApi extends FixtureLearnApi {
  _FreeNoRunApi() : super(pro: false, freeUsed: true);

  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    throw LearnError.fromResponse(402, LearnFixtures.json('error_402_free_session_used')..remove('resume'));
  }
}

/// A server whose end leads with the next chapter, as `endOptions` answers once every card of the chapter has been seen: the lead
/// is the next chapter (with its title for the key's second line) and the quiet link is "Keep going".
class _NextChapterApi extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async {
    await super.end(runId, stop: stop);
    final body = LearnFixtures.json('run_end_feed_aop_pro');
    final keep = body['lead'];
    body['lead'] = {
      'kind': 'next',
      'title': 'Next chapter · 10 min',
      'minutes': 10,
      'label': 'Next chapter · 10 min',
      'chapterTitle': 'Retirement and Death of a Partner',
      'evidence': 'Retirement and Death of a Partner',
      'place': {'n': 6, 'of': 14},
      'run': {'chapterKey': 'accountancy.retirement-and-death-of-partner', 'minutes': 10, 'leaveOut': <Object>[], 'kind': 'feed'},
    };
    body['options'] = [keep];
    return LearnEnd.parse(body);
  }
}

/// A server whose end of a stopped feed offers to continue it: the lead resumes the run by its id, the link fixes the open mistakes.
/// A stop (`end?stop=1`) leaves the run open, as the server does (the recorded server closes a run at any end), so Continue can read it.
class _StoppedFeedApi extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async {
    if (stop) {
      calls.add('end $runId');
      stops.add(true);
      ended.add(runId);
    } else {
      await super.end(runId, stop: stop);
    }
    final body = LearnFixtures.json('run_end_feed_aop_pro');
    final fix = (body['options'] as List).first;
    body['stopped'] = stop;
    body['lead'] = {
      'kind': 'continue',
      'title': 'Continue · 6 min',
      'minutes': 6,
      'label': 'Continue · 6 min',
      'evidence': null,
      'run': {'chapterKey': 'accountancy.admission-of-partner', 'minutes': 6, 'leaveOut': <Object>[], 'kind': 'feed', 'resume': runId},
    };
    body['options'] = [fix];
    return LearnEnd.parse(body);
  }
}
