// The Learn run on the stage, over the recorded Learn server inside a real GoRouter: the keys of each state, a card's turn and
// its three ratings with the stamp and the flight into the counter, a question and its line in place, Skip, the first question's
// hint, the recap, Free's looks, the stop rule for Close and the system Back and its sheet ("Stop here", "Back to it"), the one
// end screen (the server's own key and link, the stopped end, Free's line), the states without items, Free's day used, the
// haptics the app's grammar asks for, text scale 1.3 at 360 dp, 48 dp targets and the volt key of each state.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart';
import 'package:mockmob/features/learn2/run/run_flight.dart';
import 'package:mockmob/features/learn2/run/run_parts.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/end_form.dart';
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';

import '../../../helpers/fonts.dart';
import 'support/run_harness.dart';

RunController ctl(WidgetTester tester) => runState(tester).controller;

/// The items of the recorded mix (a chapter run of Partnership Fundamentals) and where its first open mistake sits.
final List<Object?> _mix = LearnFixtures.json('run_start_mix_pf_pro')['items'] as List<Object?>;
final int n = _mix.length;
final int firstMistake = _mix.indexWhere((x) => x is Map && x['type'] == 'question');

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

/// Turns the card on screen as its Turn over key does, and lets the keys change.
Future<void> turnNow(WidgetTester tester) async {
  ctl(tester).turn(ctl(tester).item! as LearnCardItem);
  await runSettle(tester);
}

String optionOf(WidgetTester tester, String key) => (ctl(tester).item! as LearnQuestionItem).question.options.firstWhere((o) => o.key == key).text;

/// The counter in the top bar, "3 of 18".
Finder counterAt(int position, int of) => find.text('$position of $of');

void main() {
  setUpAll(loadAppFonts);

  group('round 5: the keys say when the card comes back; a run over several chapters is Revise', () {
    testWidgets('each rating key says when the card would come back under its name, in the words of the server, and the three keys are one height', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      final item = ctl(tester).item! as LearnCardItem;
      final words = item.returns!;
      expect(find.text('back ${words.missed}'), findsOneWidget);
      expect(find.text('back ${words.got}'), findsOneWidget);
      expect(find.text('back ${words.easy}'), findsOneWidget);
      expect(find.text('Missed it'), findsOneWidget);
      final keys = tester.widgetList<StageStepKey>(find.byType(StageStepKey)).toList();
      expect(keys, hasLength(3));
      final heights = [for (final k in find.byType(StageStepKey).evaluate()) tester.getSize(find.byWidget(k.widget)).height];
      expect(heights.toSet(), hasLength(1), reason: 'Missed it wraps to two lines; the three keys stay one height');
      expect(heights.first, greaterThanOrEqualTo(RunRateKeys.tallest));
      await finish(tester);
    });

    testWidgets('a rating stamp is the promise of the key: "Back " and the same words', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      final item = ctl(tester).item! as LearnCardItem;
      await tap(tester, find.text('Got it'));
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('Back ${item.returns!.got}'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a card with no words has no second line (a look, a recap)', (tester) async {
      await pumpRun(tester, FixtureLearnApi(startFixtures: {'recap': 'run_start_recap_pf_pro'}), launch: const RunLaunch(chapterKey: l2Pf, kind: 'recap', minutes: 5));
      expect(find.textContaining('back in'), findsNothing);
      expect(find.textContaining('back tomorrow'), findsNothing);
      await finish(tester);
    });

    for (final scale in [1.0, 1.3]) {
      testWidgets('at 360 by 800 dp, text $scale: the keys fit, no overflow, one height, no label cut mid-word', (tester) async {
        await pumpRun(tester, FixtureLearnApi(), textScale: scale);
        await tap(tester, find.text('Turn over'));
        expect(tester.takeException(), isNull);
        final item = ctl(tester).item! as LearnCardItem;
        for (final s in ['Missed it', 'Got it', 'Easy', 'back ${item.returns!.missed}', 'back ${item.returns!.got}', 'back ${item.returns!.easy}']) {
          expect(find.text(s), findsOneWidget, reason: s);
          expect(tester.getRect(find.text(s)).right, lessThanOrEqualTo(360));
          final paragraph = tester.renderObject<RenderParagraph>(find.text(s));
          expect(paragraph.didExceedMaxLines, isFalse, reason: '"$s" is whole, never cut with an ellipsis');
        }
        final heights = {for (final e in find.byType(StageStepKey).evaluate()) tester.getSize(find.byWidget(e.widget)).height};
        expect(heights, hasLength(1));
        // Nothing is under the dock: the keys end inside the 800 dp screen.
        expect(tester.getRect(find.byType(RunRateKeys)).bottom, lessThanOrEqualTo(800));
        await finish(tester);
      });
    }

    testWidgets('a run over several chapters is headed Revise, with no place; its Close goes to Learn home, not to a chapter', (tester) async {
      final api = FixtureLearnApi(startFixtures: {'cards': 'run_start_cards_span_pro'});
      await pumpRun(tester, api, launch: const RunLaunch(chapterKey: l2Pf, kind: 'cards', minutes: 5), pushed: false);
      expect(find.text('Revise'), findsOneWidget, reason: 'the head line under the bar');
      expect(find.textContaining('Chapter '), findsNothing);
      await tap(tester, find.bySemanticsLabel('Close'));
      expect(find.textContaining('at /practice'), findsOneWidget, reason: 'Learn home, never the chapter of the first card');
      await finish(tester);
    });

    testWidgets('a run of one chapter keeps its name, and its Close without a page under it goes to the chapter', (tester) async {
      await pumpRun(tester, FixtureLearnApi(), pushed: false);
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget);
      await tap(tester, find.bySemanticsLabel('Close'));
      expect(find.text('at /learn/c/$l2Pf'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('the stop sheet counts as the end does: a card only turned over holds no event, a rated one does', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.bySemanticsLabel('Close'));
      expect(find.text('Stop for now?'), findsNothing, reason: 'nothing is done yet: Close leaves');
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Got it'));
      await tap(tester, find.bySemanticsLabel('Close'));
      expect(find.text('Stop for now?'), findsOneWidget);
      expect(find.text('1 of $n done. It’s all saved.'), findsOneWidget);
      await finish(tester);
    });
  });

  group('a card', () {
    testWidgets('R8: the card sits on a deck, two card edges 7 and 14 dp down and 10 and 20 dp in, that stay put while it turns', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      final deck = find.byType(RunDeck);
      expect(deck, findsOneWidget);
      final card = tester.getRect(find.descendant(of: deck, matching: find.byType(CardFace)));
      final edges = find.descendant(of: deck, matching: find.byType(Positioned));
      Rect edge(int i) => tester.getRect(edges.at(i));
      final far = edge(0), near = edge(1);
      expect(far.bottom - card.bottom, closeTo(14, 0.5));
      expect(far.left - card.left, closeTo(20, 0.5));
      expect(card.right - far.right, closeTo(20, 0.5));
      expect(near.bottom - card.bottom, closeTo(7, 0.5));
      expect(near.left - card.left, closeTo(10, 0.5));
      expect(find.ancestor(of: edges.at(0), matching: find.byType(CardFace)), findsNothing, reason: 'the edges are not part of the turning card');
      await turnNow(tester);
      // The rating keys are taller than Turn over, so the item area (and the card) is shorter; the deck stays under the card.
      final turned = tester.getRect(find.descendant(of: deck, matching: find.byType(CardFace)));
      expect(edge(0).bottom - turned.bottom, closeTo(14, 0.5));
      expect(edge(1).bottom - turned.bottom, closeTo(7, 0.5));
      await finish(tester);
    });

    testWidgets('the first card: one top bar, Turn over (the one volt key), the turn cue, "1 of 18" and no pile or time left', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget, reason: 'the chapter as the quiet line under the bar');
      expect(counterAt(1, n), findsOneWidget);
      expect(find.textContaining('min left'), findsNothing);
      expect(find.textContaining('In Revise'), findsNothing, reason: 'a phone\'s bar has no pile: a card flies into the counter');
      expect(find.text('Turn over'), findsOneWidget);
      expect(find.text('Show answer'), findsNothing);
      expect(find.text('Tap the card to turn it over'), findsOneWidget);
      expect(find.textContaining('Define partnership'), findsWidgets);
      expect(find.text('Missed it'), findsNothing);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Turn over turns the card: Missed it, Got it (the volt key) and Easy, and a light haptic from the card only', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await tap(tester, find.text('Turn over'));
      expect(find.text('Missed it'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);
      expect(find.text('Easy'), findsOneWidget);
      expect(find.text('Turn over'), findsNothing);
      expect(find.text('How well did you know it? Missed it brings the card back soon. Got it, in a few days. Easy, much later.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      final volt = tester.widgetList<StageStepKey>(find.byType(StageStepKey)).singleWhere((k) => k.tone == StageTone.volt);
      expect(volt.label, 'Got it');
      expect(haptics.calls, ['light']);
      await finish(tester);
    });

    testWidgets('a tap on the card turns it too, and a tap on its back brings the front and Turn over again', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      // The front's words sit under its tap target (a button over the face), as a finger meets them.
      await tester.tap(find.bySemanticsLabel(RegExp(r'^Turn over: Define partnership')));
      await runSettle(tester);
      expect(find.text('Got it'), findsOneWidget);
      await tester.tap(find.byType(CardFace).first);
      await runSettle(tester);
      expect(find.text('Turn over'), findsOneWidget);
      expect(find.text('Got it'), findsNothing);
      await finish(tester);
    });

    testWidgets('Got it: the server takes the rating, the stamp says its day, the counter moves on, the confirm haptic after', (tester) async {
      final haptics = RunHaptics();
      final api = FixtureLearnApi();
      await pumpRun(tester, api, haptics: haptics);
      await tap(tester, find.text('Turn over'));
      final first = ctl(tester).item! as LearnCardItem;
      haptics.calls.clear();
      await tester.tap(find.text('Got it'));
      await tester.pump();
      expect(api.ratings.single.rating, 3);
      await runSettle(tester);
      final day = 'Back ${first.returns!.got}';
      expect(find.text(day), findsOneWidget, reason: 'what the key promised, under the keys');
      expect(counterAt(2, n), findsOneWidget);
      expect(find.text('Turn over'), findsOneWidget);
      expect(haptics.calls, ['medium', 'light']);
      // The stamp holds for about a second and a half, then the line is empty again.
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(day), findsNothing);
      await finish(tester);
    });

    testWidgets('Easy flies too (its own day); Missed drops away: "Back in this run, then tomorrow", a tick, the card back 3 on', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await tap(tester, find.text('Turn over'));
      final first = ctl(tester).item! as LearnCardItem;
      await tap(tester, find.text('Easy'));
      expect(find.text('Back ${first.returns!.easy}'), findsOneWidget);
      await tap(tester, find.text('Turn over'));
      haptics.calls.clear();
      await tap(tester, find.text('Missed it'));
      expect(find.text('Back in this run, then tomorrow'), findsOneWidget);
      expect(haptics.calls, ['selection']);
      expect(counterAt(3, n + 1), findsOneWidget, reason: 'the card that came back made the run one longer');
      await finish(tester);
    });

    testWidgets('a tap while the card leaves is ignored', (tester) async {
      final api = FixtureLearnApi();
      await pumpRun(tester, api);
      await tap(tester, find.text('Turn over'));
      await tester.tap(find.text('Got it'));
      await tester.pump();
      await tester.tap(find.text('Missed it'), warnIfMissed: false);
      await tester.pump();
      await runSettle(tester);
      expect(api.ratings.length, 1);
      await finish(tester);
    });

    testWidgets('a failed rating keeps the card with its line, and Got it tried again goes through', (tester) async {
      final api = FixtureLearnApi(failOn: {'rate': FixtureLearnApi.offlineError});
      await pumpRun(tester, api);
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Got it'));
      expect(find.text('That rating wasn\'t saved. Try again.'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);
      expect(counterAt(1, n), findsOneWidget);
      api.failOn.clear();
      await tap(tester, find.text('Got it'));
      expect(find.text('That rating wasn\'t saved. Try again.'), findsNothing);
      expect(counterAt(2, n), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a card that is back from earlier says so at its head', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Missed it'));
      await goTo(tester, 3);
      expect(find.text('Back from earlier'), findsWidgets);
      await finish(tester);
    });

    testWidgets('a look past Free\'s ratings: one volt Next and the server\'s line after the turn; Next logs it and goes on', (tester) async {
      final api = _Looks();
      await pumpRun(tester, api);
      expect(find.text('Turn over'), findsOneWidget);
      await tap(tester, find.text('Turn over'));
      expect(find.text('Missed it'), findsNothing);
      expect(find.text('Next'), findsOneWidget);
      expect(find.textContaining("You've used today's 10 free card ratings"), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next'));
      expect(api.ratings.single.rating, 3);
      expect(counterAt(2, n), findsOneWidget);
      await finish(tester);
    });
  });

  group('a question', () {
    testWidgets('the first question is an open mistake: its head, a quiet Skip (no volt key) and no hint, since it is not a first', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await goTo(tester, firstMistake);
      expect(find.text('You missed this in Mock 3 on 16 Oct'), findsOneWidget);
      expect(find.byType(StageOptionRow), findsNWidgets(4));
      expect(find.text('Skip'), findsOneWidget);
      expect(find.text('Save'), findsNothing);
      expect(find.text('Pick the answer you think is right.'), findsNothing);
      expect(voltKeys(tester), 0);
      await finish(tester);
    });

    testWidgets('a new student\'s first question: the hint reads above the options until it is answered', (tester) async {
      final api = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'});
      await pumpRun(tester, api, launch: const RunLaunch(chapterKey: l2Aop, minutes: 20));
      final first = ctl(tester).items.indexWhere((i) => i is LearnQuestionItem);
      await goTo(tester, first);
      final hint = find.text('Pick the answer you think is right.');
      expect(hint, findsOneWidget);
      expect(tester.getRect(hint).bottom, lessThanOrEqualTo(tester.getTopLeft(find.byType(StageOptionRow).first).dy), reason: 'read before the options');
      final q = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, rightKey(q))));
      expect(hint, findsNothing);
      await finish(tester);
    });

    testWidgets('a wrong answer: the row, "Not quite. The answer is C." and NCERT\'s line in place; Save and Next (the volt key) replace Skip', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, firstMistake);
      final q = ctl(tester).item! as LearnQuestionItem;
      haptics.calls.clear();
      await tap(tester, find.text(optionOf(tester, wrongKey(q))));
      await runSettle(tester);
      await runSettle(tester);
      expect(find.text('Not quite. The answer is ${rightKey(q)}.'), findsOneWidget);
      expect(find.textContaining(RegExp(r'The answer is [A-D],')), findsNothing, reason: 'the long form with the option is for a screen reader only');
      expect(find.text('The line you needed'), findsOneWidget);
      expect(find.text('Skip'), findsNothing);
      expect(find.text('Save'), findsOneWidget);
      expect(find.text('Next'), findsOneWidget);
      expect(voltKeys(tester), 1);
      expect(haptics.calls, ['selection'], reason: 'a wrong answer buzzes nothing of its own');
      expect(counterAt(firstMistake + 1, n + 1), findsOneWidget, reason: 'the card was put back in');
      await finish(tester);
    });

    testWidgets('a right answer: the server\'s line, a confirm haptic after it graded, and Next', (tester) async {
      final haptics = RunHaptics();
      await pumpRun(tester, FixtureLearnApi(), haptics: haptics);
      await goTo(tester, firstMistake);
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
      await goTo(tester, firstMistake);
      await tap(tester, find.text('Skip'));
      expect(api.answers, isEmpty);
      expect(counterAt(firstMistake + 2, n), findsOneWidget);
      expect(find.text('Turn over'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Save: Saved on the key; Free\'s limit turns it into Pro', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await goTo(tester, firstMistake);
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
      await goTo(tester, firstMistake);
      final fq = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, rightKey(fq))));
      await tap(tester, find.text('Save'));
      expect(find.text('Pro'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a question the server left out is skipped with the web\'s line; a failed answer says so', (tester) async {
      await pumpRun(tester, FixtureLearnApi(failOn: {'answer': FixtureLearnApi.questionChanged}));
      await goTo(tester, firstMistake);
      await tap(tester, find.text(optionOf(tester, 'A')));
      expect(find.text('This question was just updated, so we skipped it.'), findsWidgets);
      expect(find.text('Next'), findsOneWidget);
      expect(find.text('Save'), findsNothing);
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi(failOn: {'answer': FixtureLearnApi.offlineError}));
      await goTo(tester, firstMistake);
      await tap(tester, find.text(optionOf(tester, 'A')));
      expect(find.text('That answer wasn\'t saved. Try again.'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      await finish(tester);
    });
  });

  group('a lesson, the recap and a cards run', () {
    testWidgets('a lesson: its kind, its title, "Read this first.", Skip it and Read the lesson (volt); reading counts it and goes on', (tester) async {
      final api = FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'});
      final router = await pumpRun(tester, api, launch: const RunLaunch(chapterKey: l2Aop, minutes: 20));
      expect(find.text('Lesson, 7 min'), findsOneWidget);
      expect(find.byType(RunDeck), findsNothing, reason: 'a lesson has no deck under it');
      expect(find.text('Revaluation of assets and liabilities'), findsOneWidget);
      expect(find.text('Read this first. Its cards come next.'), findsOneWidget);
      expect(find.text('Skip it'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Read the lesson'));
      expect(find.text('at /learn/accountancy-revaluation'), findsOneWidget);
      router.pop();
      await runSettle(tester);
      expect(api.ratings.single.itemId, endsWith('-i1'));
      expect(counterAt(2, 25), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a recap: the answers showing, Previous (off at the first) and Next, then its end: Study these 12, again, and the X', (tester) async {
      final api = FixtureLearnApi();
      await pumpRun(
        tester,
        api,
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'recap', minutes: 5),
      );
      expect(find.text('Answers are shown. This won\'t change when your cards come back.'), findsOneWidget);
      expect(find.text('Previous'), findsOneWidget);
      expect(find.text('Turn over'), findsNothing, reason: 'a recap shows its answers');
      expect(find.textContaining('In Revise'), findsNothing, reason: 'a recap schedules nothing, so nothing flies to Revise');
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next'));
      expect(counterAt(2, 12), findsOneWidget);
      expect(api.ratings.length, 1, reason: 'a card passed is logged as a look');
      await tap(tester, find.text('Previous'));
      expect(counterAt(1, 12), findsOneWidget);
      while (ctl(tester).phase == RunPhase.play) {
        ctl(tester).goRecap(1);
      }
      await runSettle(tester);
      expect(find.byType(EndScreen), findsOneWidget);
      expect(find.text('That was all 12 Must-know lines'), findsOneWidget);
      expect(find.text('Study these 12'), findsOneWidget);
      expect(find.text('Quick recap again'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsNothing, reason: 'the X is the other way out');
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Quick recap again'));
      expect(counterAt(1, 12), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a cards run pauses after 20: "20 cards rated", "5 more to go.", Next round (volt) and Finish here', (tester) async {
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
      expect(find.text('5 more to go.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Next round'));
      expect(find.text('Turn over'), findsOneWidget);
      expect(counterAt(21, 25), findsOneWidget);
      await finish(tester);
    });
  });

  group('stopping', () {
    testWidgets('Close with nothing done leaves; after one rating it asks "Stop for now?" with what was done: Stop here, Back to it', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, FixtureLearnApi());
      await tester.tap(find.bySemanticsLabel('Close'));
      await runSettle(tester);
      expect(find.text('host'), findsOneWidget);
      expect(find.text('Stop for now?'), findsNothing);
      await finish(tester);
      await pumpRun(tester, FixtureLearnApi());
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Got it'));
      await tester.tap(find.bySemanticsLabel('Close').first);
      await runSettle(tester);
      expect(find.text('Stop for now?'), findsOneWidget);
      expect(find.text('1 of $n done. It’s all saved.'), findsOneWidget);
      expect(find.text('Stop here'), findsOneWidget);
      expect(find.text('Back to it'), findsOneWidget);
      expect(find.text('Leave for now, pick up later today'), findsNothing);
      expect(find.text('End here, see how it went'), findsNothing);
      await tap(tester, find.text('Back to it'));
      expect(find.text('Stop for now?'), findsNothing);
      expect(counterAt(2, n), findsOneWidget);
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the system Back asks after one item; Stop here shows the end and the server keeps the run open', (tester) async {
      await pumpRun(tester, FixtureLearnApi());
      await systemBack(tester);
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
      final api = FixtureLearnApi();
      await pumpRun(tester, api);
      await tap(tester, find.text('Turn over'));
      await tap(tester, find.text('Got it'));
      await systemBack(tester);
      expect(find.text('Stop for now?'), findsOneWidget);
      await tap(tester, find.text('Stop here'));
      expect(api.stops, [true], reason: 'end?stop=1');
      expect(find.byType(EndScreen), findsOneWidget);
      expect(find.text('Continue · 8 min'), findsOneWidget, reason: 'the stopped run is offered back in the server\'s words');
      await finish(tester);
    });
  });

  group('the end', () {
    Future<void> toEnd(
      WidgetTester tester,
      FixtureLearnApi api, {
      int rated = 3,
      bool stop = false,
      RunLaunch launch = const RunLaunch(chapterKey: l2Pf),
      bool proNudges = false,
    }) async {
      await pumpRun(tester, api, launch: launch, proNudges: proNudges);
      for (var i = 0; i < rated; i++) {
        await turnNow(tester);
        await tap(tester, find.text('Got it'));
      }
      if (stop) {
        ctl(tester).finish(ctl(tester).doneCount);
      } else {
        ctl(tester).finish();
      }
      await runSettle(tester);
      await runSettle(tester);
    }

    testWidgets('the chapter, the headline, the fan, the numbers, the bar, then the server\'s one key and one link', (tester) async {
      await toEnd(tester, FixtureLearnApi());
      expect(find.byType(EndScreen), findsOneWidget);
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsWidgets);
      expect(find.text('6 of 19 done'), findsOneWidget, reason: 'the server\'s done line, never invented');
      expect(find.byType(StageKeptFan), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('in Revise, back tomorrow'), findsOneWidget);
      expect(find.text('open mistake fixed'), findsOneWidget);
      expect(find.text('14 of 45 cards seen'), findsOneWidget);
      expect(find.text('Keep going · 10 min'), findsOneWidget);
      expect(find.text('Fix 2 open mistakes · 2 min'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsNothing);
      expect(find.text('Key cards'), findsNothing, reason: 'no table of lines: the numbers carry it');
      expect(find.text('Old mistakes'), findsNothing);
      expect(voltKeys(tester), 1);
      expect(find.text('See Pro'), findsNothing);
      await finish(tester);
    });

    testWidgets('Keep going starts a fresh run of this chapter in this one\'s place; the fix link starts the mistakes-only run', (tester) async {
      final api = FixtureLearnApi();
      await toEnd(tester, api);
      await tap(tester, find.text('Keep going · 10 min'));
      expect(api.starts.last.chapterKey, l2Pf);
      expect(api.starts.last.minutes, 10);
      expect(api.starts.last.kind, 'mix');
      expect(api.starts.last.fresh, isTrue);
      expect(counterAt(1, n), findsOneWidget);
      await finish(tester);
      final api2 = FixtureLearnApi();
      await toEnd(tester, api2);
      await tap(tester, find.text('Fix 2 open mistakes · 2 min'));
      expect(api2.starts.last.chapterKey, l2Pf);
      expect(api2.starts.last.minutes, 2);
      expect(api2.starts.last.leaveOut, ['questions', 'cards', 'lesson']);
      expect(api2.starts.last.fresh, isTrue);
      await finish(tester);
    });

    testWidgets('a stopped run\'s end: Continue picks the run up by its id; the fix link starts a new run, never a resume', (tester) async {
      final api = FixtureLearnApi();
      await toEnd(tester, api, stop: true);
      expect(api.stops, [true]);
      expect(find.text('Continue · 8 min'), findsOneWidget);
      expect(find.text('Fix 2 open mistakes · 2 min'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Fix 2 open mistakes · 2 min'));
      expect(api.starts.last.fresh, isTrue);
      await finish(tester);
    });

    testWidgets('the end reads the server once (no number of its own); the end\'s X leaves', (tester) async {
      final api = FixtureLearnApi();
      await toEnd(tester, api);
      expect(api.ended.length, 1);
      expect(find.byType(CardFace), findsNothing);
      // The end's own X, the one a finger reaches (a covered one stays in the tree under it).
      await tap(tester, find.bySemanticsLabel('Close').hitTestable());
      expect(find.text('host'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('Free after its day: the server\'s one line above Quick recap, no option that serves questions, See Pro only when it is on offer', (tester) async {
      await toEnd(tester, _FreeEnd(), rated: 1);
      expect(find.text('That was today\'s free session. Questions come back tomorrow.'), findsOneWidget);
      expect(find.text('Quick recap · 1 min'), findsOneWidget);
      expect(find.text('See Pro'), findsNothing, reason: 'Pro is not on offer here');
      expect(voltKeys(tester), 1);
      await finish(tester);
      await toEnd(tester, _FreeEnd(), rated: 1, proNudges: true);
      expect(find.text('See Pro'), findsOneWidget);
      expect(voltKeys(tester), 1, reason: 'Quick recap is the one volt key; See Pro is a quiet link');
      await finish(tester);
    });

    testWidgets('Free after its day: the volt key starts its recap in this run\'s place', (tester) async {
      final api = _FreeEnd();
      await toEnd(tester, api, rated: 1);
      await tap(tester, find.text('Quick recap · 1 min'));
      expect(api.starts.last.kind, 'recap');
      expect(api.starts.last.chapterKey, 'accountancy.admission-of-partner');
      await finish(tester);
    });

    testWidgets('a failed end read says "Your session is saved" with Try again; Try again reads it again', (tester) async {
      final api = FixtureLearnApi(failOn: {'end': FixtureLearnApi.offlineError});
      await toEnd(tester, api);
      expect(find.text('Your session is saved'), findsOneWidget);
      expect(find.text('The summary didn\'t load, but every rating and answer is saved.'), findsOneWidget);
      expect(find.text('Keep going · 10 min'), findsNothing);
      expect(voltKeys(tester), 1);
      api.failOn.clear();
      await tap(tester, find.text('Try again'));
      await runSettle(tester);
      expect(find.text('Keep going · 10 min'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('a level run\'s end has no fan or numbers of cards (it rates none) and its key names the lowest score', (tester) async {
      await pumpRun(
        tester,
        _LevelEnd(),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'level', minutes: 6),
      );
      expect(find.text('Skip'), findsOneWidget);
      ctl(tester).finish();
      await runSettle(tester);
      await runSettle(tester);
      expect(find.byType(StageKeptFan), findsNothing);
      expect(find.text('in Revise'), findsNothing);
      expect(find.text('Your weakest part: 2 of 6 right'), findsOneWidget, reason: 'the second line inside the key');
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('the end of a run that closed (RUN_ENDED) is read, not started again', (tester) async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      await api.end(first.id);
      final starts = api.starts.length;
      await pumpRun(
        tester,
        api,
        launch: RunLaunch(chapterKey: l2Pf, runId: first.id),
      );
      await runSettle(tester);
      expect(find.text('Keep going · 10 min'), findsOneWidget);
      expect(api.starts, hasLength(starts), reason: 'it reads the end, it never starts a run');
      await finish(tester);
    });
  });

  group('states without items', () {
    testWidgets('Learn home\'s Pick up (a run id) opens the run where it stopped', (tester) async {
      final api = FixtureLearnApi();
      final first = await api.startRun(const RunStart(chapterKey: l2Pf));
      await api.rate(first.id, first.items[0].id, 3);
      await api.rate(first.id, first.items[1].id, 3);
      await pumpRun(tester, api, launch: RunLaunch(runId: first.id));
      expect(api.calls, contains('getRun ${first.id}'));
      expect(counterAt(3, n), findsOneWidget);
      expect(find.text('Turn over'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('the run did not start: its line and Try again (volt); Try again starts it', (tester) async {
      final api = FixtureLearnApi(error: true);
      await pumpRun(tester, api);
      expect(find.text('This session didn\'t start'), findsOneWidget);
      expect(find.text('Nothing was lost. Check your connection and try again.'), findsOneWidget);
      expect(voltKeys(tester), 1);
      api.error = false;
      await tap(tester, find.text('Try again'));
      expect(find.text('Turn over'), findsOneWidget);
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
      expect(find.text('Nothing here yet'), findsOneWidget);
      expect(find.text('This chapter has no cards or questions for this session.'), findsOneWidget);
      expect(find.text('Back to the chapter'), findsOneWidget);
      expect(voltKeys(tester), 1);
      await finish(tester);
    });

    testWidgets('Free\'s day used (a second tab): the headline, the line, See Pro (the one volt key), then the Or rows', (tester) async {
      await pumpRun(
        tester,
        FixtureLearnApi(pro: false, freeUsed: true),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'feed'),
        proNudges: true,
      );
      expect(find.text('That was today\'s free session.'), findsOneWidget);
      expect(find.text('Questions come back tomorrow. Your Key cards stay open.'), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      expect(find.text('Or'), findsOneWidget);
      expect(find.text('Continue · 8 min'), findsOneWidget);
      expect(find.text('Revise 8 due cards · 2 min'), findsOneWidget);
      expect(find.text('Today\'s free session is used'), findsNothing);
      expect(voltKeys(tester), 1);
      await tap(tester, find.text('Continue · 8 min'));
      expect(find.textContaining('at /explore/feed'), findsOneWidget, reason: 'today\'s own feed, picked up by its id');
      await finish(tester);
    });

    testWidgets('loading is the run at its final shape: Close, one hairline, a card block and a key block, no numbers', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, _Waiting());
      expect(find.bySemanticsLabel('Getting your session ready'), findsWidgets);
      expect(counterAt(1, n), findsNothing);
      expect(find.text('Turn over'), findsNothing);
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

    testWidgets('Got it with motion on: a ghost of the card is in the air above the screen, the real card is hidden, and it lands on the counter', (tester) async {
      await pumpRun(tester, FixtureLearnApi(), reduced: false);
      await tester.pump(const Duration(seconds: 1));
      ctl(tester).turn(ctl(tester).item! as LearnCardItem);
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.text('Got it'));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      expect(find.byKey(RunFlight.ghostKey), findsOneWidget);
      // The next item has risen under it by the hand-off (220 ms); the ghost lands at 420 ms.
      await tester.pump(const Duration(milliseconds: 150));
      expect(find.text('Turn over'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byKey(RunFlight.ghostKey), findsNothing);
      expect(counterAt(2, n), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });
  });

  group('access', () {
    testWidgets('text scale 1.3 at 360 dp: the card, its ratings, a question, the end and the states draw without overflow', (tester) async {
      await pumpRun(tester, FixtureLearnApi(), textScale: 1.3);
      expect(tester.takeException(), isNull);
      await tap(tester, find.text('Turn over'));
      expect(tester.takeException(), isNull);
      await tap(tester, find.text('Got it'));
      expect(tester.takeException(), isNull);
      await goTo(tester, firstMistake);
      expect(tester.takeException(), isNull);
      final q = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, wrongKey(q))));
      await runSettle(tester);
      expect(tester.takeException(), isNull);
      ctl(tester).finish();
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
        await tap(tester, find.text('Turn over'));
        expect(tester.takeException(), isNull, reason: 'ratings at $scale');
        await tap(tester, find.text('Got it'));
        await goTo(tester, firstMistake);
        expect(tester.takeException(), isNull, reason: 'question at $scale');
        ctl(tester).finish();
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

    testWidgets('48 dp targets on the card, its ratings, a question, an answered question, the end and Free\'s day used', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, FixtureLearnApi());
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await tap(tester, find.text('Turn over'));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await goTo(tester, firstMistake);
      expect(find.byType(StageOptionRow), findsWidgets);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      final q = ctl(tester).item! as LearnQuestionItem;
      await tap(tester, find.text(optionOf(tester, rightKey(q))));
      await tester.pump(const Duration(milliseconds: 400));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      ctl(tester).finish();
      await runSettle(tester);
      await runSettle(tester);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await finish(tester);
      await pumpRun(
        tester,
        FixtureLearnApi(pro: false, freeUsed: true),
        launch: const RunLaunch(chapterKey: l2Pf, kind: 'feed'),
        proNudges: true,
      );
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the stage says where it is: a labelled stage, "Card 1 of 18" on the item and the rating group', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpRun(tester, FixtureLearnApi());
      expect(find.bySemanticsLabel('Accounting for Partnership: Basic Concepts session'), findsOneWidget);
      expect(find.bySemanticsLabel('Card 1 of $n'), findsOneWidget);
      expect(find.bySemanticsLabel('1 of $n'), findsOneWidget, reason: 'the counter, as a screen reader says it');
      await tap(tester, find.text('Turn over'));
      expect(find.bySemanticsLabel('How well did you know it?'), findsOneWidget);
      handle.dispose();
      await finish(tester);
    });

    testWidgets('the labelled text on the card and the end keeps its contrast in both themes', (tester) async {
      final handle = tester.ensureSemantics();
      for (final brightness in [Brightness.dark, Brightness.light]) {
        await pumpRun(tester, FixtureLearnApi(), brightness: brightness);
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        ctl(tester).finish();
        await runSettle(tester);
        await runSettle(tester);
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        await finish(tester);
      }
      handle.dispose();
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

/// Free's end after the day's session: the server's one line over Quick recap, See Pro as the quiet link.
class _FreeEnd extends FixtureLearnApi {
  _FreeEnd() : super(pro: false);

  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async => LearnEnd.parse(LearnFixtures.json('run_end_feed_aop_free'));
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
    'stamp': 'Back in 3 days',
    'revisePile': {'count': ++_piled},
  });
}

/// A level run's end: its lowest chapter and no cards sent to Revise; the key's second line names the score.
class _LevelEnd extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async => LearnEnd.parse({
    ...LearnFixtures.json('run_end_mix_pf_pro'),
    'kind': 'level',
    'revisePile': <Object>[],
    'reviseCards': <Object>[],
    'level': {'chapterKey': l2Pf, 'title': 'Goodwill: Nature and Valuation', 'right': 2, 'of': 6},
  });
}
