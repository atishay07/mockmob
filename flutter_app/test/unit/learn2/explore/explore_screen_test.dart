// Explore (the chapter feed covers) as a student meets it: the head and the length, the row and its one volt key, the pager,
// every length and plan the recordings hold, the states, where a tap goes, and text 1.3 times larger at 360 dp.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/explore/cover_card.dart';
import 'package:mockmob/features/learn2/explore/covers_row.dart';
import 'package:mockmob/features/learn2/explore/explore_copy.dart';

import '../../../helpers/fonts.dart';
import 'explore_support.dart';

/// A phone whose kept values come back only when [gate] completes.
class _SlowPrefs extends MemoryPrefsStore {
  _SlowPrefs(this.gate);

  final Future<void> gate;

  @override
  Future<int?> getInt(String key) async {
    await gate;
    return super.getInt(key);
  }
}

final _next = find.byWidgetPredicate((w) => w is MmPressable && w.semanticsLabel == ExploreCopy.next);
final _previous = find.byWidgetPredicate((w) => w is MmPressable && w.semanticsLabel == ExploreCopy.previous);

/// Pages with the pager's next key, [times] times.
Future<void> pageNext(WidgetTester tester, [int times = 1]) async {
  for (var i = 0; i < times; i++) {
    await tester.tap(_next);
    await settleExplore(tester);
  }
}

List<CoverKeyFace> keyFaces(WidgetTester tester) => tester.widgetList<CoverKeyFace>(find.byType(CoverKeyFace)).toList();

/// The key of the cover at [position]: its face.
CoverKeyFace keyOf(WidgetTester tester, int position) {
  final card = find.byWidgetPredicate((w) => w is CoverCard && w.position == position);
  return tester.widget<CoverKeyFace>(find.descendant(of: card, matching: find.byType(CoverKeyFace)));
}

/// The row's scroll controller, and how many covers it has moved (a cover and its gap are 1).
ScrollController rowOf(WidgetTester tester) => tester.widget<ListView>(find.byKey(ExploreCovers.rowKey)).controller!;

double pagedOf(WidgetTester tester) => rowOf(tester).offset / (CoverLayout.coverWidth(360) + CoverLayout.gap);

void main() {
  setUpAll(loadAppFonts);
  setUp(FixedSubject.picked.clear);

  group('the head', () {
    testWidgets('names the page, the feeds and how many chapters, and offers 5, 10 and 20 minutes', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.text(ExploreCopy.title), findsOneWidget);
      expect(find.text('Chapter feeds'), findsOneWidget);
      // The phone band, as the web's covers.css under 768 px: no chapter count (the pager says it) and no general line.
      expect(find.text('14 chapters'), findsNothing);
      expect(find.text(ExploreCopy.feedsNote), findsNothing);
      // On a narrow row the first two drop "min" (the web's 5 | 10 | 20 min).
      expect(find.text('5'), findsOneWidget);
      expect(find.text('10'), findsOneWidget);
      expect(find.text('20 min'), findsOneWidget);
      expect(find.text('5 min'), findsNothing);
    });

    testWidgets('spells every length out when the row is wide', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)), size: const Size(480, 900));
      expect(find.text('5 min'), findsOneWidget);
      expect(find.text('10 min'), findsOneWidget);
      expect(find.text('20 min'), findsOneWidget);
    });

    testWidgets('keeps the length on this phone: the one picked before, and the one picked now', (tester) async {
      final prefs = MemoryPrefsStore();
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), minutes: 20, prefs: prefs));
      expect(find.text('Start · 20 min'), findsWidgets);
      await tester.tap(find.text('5'));
      await settleExplore(tester);
      expect(prefs.values[LearnPrefs.feedMinutesKey], 5);
      expect(find.text('Start · 5 min'), findsWidgets);
    });

    testWidgets('waits for the kept length before it draws the control, so it never opens on 10 and slides to 20', (tester) async {
      final gate = Completer<void>();
      final prefs = _SlowPrefs(gate.future)..values[LearnPrefs.feedMinutesKey] = 20;
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), prefs: prefs));
      expect(find.byType(MmSegmented<int>), findsNothing);
      expect(find.text('Chapter feeds'), findsOneWidget);
      gate.complete();
      await settleExplore(tester);
      expect(tester.widget<MmSegmented<int>>(find.byType(MmSegmented<int>)).value, 20);
      expect(find.text('Start · 20 min'), findsWidgets);
    });

    testWidgets('a length that was never picked is 10', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.text('Start · 10 min'), findsWidgets);
    });
  });

  group('the covers', () {
    testWidgets('a cover is the chapter\'s own: its ref line, its first card, its title, its line, its mix and its key', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.text('Chapter 1'), findsWidgets);
      // The line on a cover is a card a student can read cold: the first card of its feed that is short and not a blank.
      expect(find.textContaining('Name the 6 essential features of partnership.'), findsOneWidget);
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(find.text('For you: 3 open mistakes to fix'), findsOneWidget);
      expect(find.text('10 Key cards, 6 questions'), findsOneWidget);
      expect(find.text('Start · 10 min'), findsWidgets);
      // The second cover has its own and no due count; its line is the state.
      expect(find.text('Profit and Loss Appropriation Account'), findsOneWidget);
      // "Too few answers" is not a verdict a cover shows (the only one is "Needs work"), so this cover has no line.
      expect(find.text('Too few answers'), findsNothing);
      expect(find.textContaining('due'), findsNothing);
    });

    testWidgets('at the usual text size a cover is the web\'s 338 dp tall and, at 360 dp, 272 dp wide', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      for (var i = 0; i < 2; i++) {
        final size = tester.getSize(find.byWidgetPredicate((w) => w is CoverCard && w.position == i));
        expect(size.height, greaterThanOrEqualTo(CoverLayout.baseHeight), reason: 'the floor; a cover is as tall as its fullest neighbour');
        expect(size.width, 272);
      }
    });

    testWidgets('the first visit nudge: the row slides 24 dp toward the next cover once, and settles', (tester) async {
      final prefs = MemoryPrefsStore();
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), prefs: prefs, nudged: false), disableAnimations: false);
      final controller = tester.widget<ListView>(find.byKey(ExploreCovers.rowKey)).controller!;
      expect(controller.offset, 0);
      await tester.pump(ExploreCovers.nudgeDelay);
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump(ExploreCovers.nudgeOut ~/ 2);
      expect(controller.offset, greaterThan(0));
      expect(controller.offset, lessThanOrEqualTo(ExploreCovers.nudgePx));
      await tester.pump(ExploreCovers.nudgeOut);
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump(ExploreCovers.nudgeBack);
      await tester.pump(const Duration(milliseconds: 50));
      expect(controller.offset, 0);
      expect(prefs.values[LearnPrefs.coversNudgeKey], isTrue, reason: 'once per phone');
    });

    testWidgets('a finger on the row first ends the nudge; under reduced motion it never plays', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), nudged: false), disableAnimations: false);
      final controller = tester.widget<ListView>(find.byKey(ExploreCovers.rowKey)).controller!;
      final touch = await tester.startGesture(tester.getCenter(find.byKey(ExploreCovers.rowKey)));
      await tester.pump(ExploreCovers.nudgeDelay + ExploreCovers.nudgeOut);
      expect(controller.offset, 0, reason: 'a finger on the row ends the nudge');
      await touch.up();
      await tester.pump();
    });

    testWidgets('reduced motion: the nudge never plays and is not used up', (tester) async {
      final prefs = MemoryPrefsStore();
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), prefs: prefs, nudged: false));
      final controller = tester.widget<ListView>(find.byKey(ExploreCovers.rowKey)).controller!;
      await tester.pump(ExploreCovers.nudgeDelay);
      await tester.pump(ExploreCovers.nudgeOut);
      expect(controller.offset, 0);
      expect(prefs.values.containsKey(LearnPrefs.coversNudgeKey), isFalse);
    });

    testWidgets('only the For you cover\'s key is volt, and it stays on that cover while the row is paged', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(keyFaces(tester).where((k) => k.volt), hasLength(1));
      expect(keyOf(tester, 0).volt, isTrue);
      expect(keyOf(tester, 1).volt, isFalse);
      for (var i = 1; i <= 5; i++) {
        await pageNext(tester);
        final volt = keyFaces(tester).where((k) => k.volt);
        expect(volt.length, lessThanOrEqualTo(1), reason: 'at cover ${i + 1}');
        expect(keyOf(tester, i).volt, isFalse, reason: 'the cover in view, ${i + 1}');
      }
      // Back on the first one it is the same key, still the only one.
      await tester.tap(_previous);
      await settleExplore(tester);
      for (var i = 0; i < 5; i++) {
        await tester.tap(_previous);
        await settleExplore(tester);
      }
      expect(keyOf(tester, 0).volt, isTrue);
      expect(keyFaces(tester).where((k) => k.volt), hasLength(1));
    });

    testWidgets('the key says what a tap does: play, or pick up, with a play glyph before it', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.proOpen)));
      expect(find.text('Continue · 7 min'), findsOneWidget);
      expect(find.text('You stopped at 3 of 17'), findsNothing, reason: 'the lead cover says why instead');
      expect(find.text('For you: pick up where you stopped'), findsOneWidget);
      expect(find.text('About 7 minutes left'), findsNothing, reason: 'the key carries the time; the mix line is empty on a resume');
      expect(keyOf(tester, 0).play, isTrue);
      expect(keyOf(tester, 0).volt, isTrue);
      expect(find.text('Start · 10 min'), findsWidgets, reason: 'the next cover plays a new feed');
    });

    testWidgets('a new student: Start here, never For you, and no cover says New to you', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.newPro)));
      expect(find.text('Start here: first in the syllabus'), findsOneWidget);
      expect(find.textContaining('For you'), findsNothing);
      for (var i = 0; i < 13; i++) {
        expect(find.text('New to you'), findsNothing, reason: 'cover ${i + 1}');
        await pageNext(tester);
      }
      expect(find.textContaining('For you'), findsNothing);
    });

    testWidgets('a locked card, and a chapter with only questions, have their own faces', (tester) async {
      final api = CoversApi(() {
        final json = CoversFixture.json(CoversFixture.pro);
        final covers = (json['covers'] as List).cast<Map<String, dynamic>>();
        // The covers also send their hooks (up to 5 fronts in feed order): a locked or questions-only face has none.
        covers[0]
          ..['hook'] = {'id': 'x', 'front': null, 'kind': 'definition', 'locked': true}
          ..['hooks'] = <Object?>[];
        for (final c in (covers[0]['counts'] as Map<String, dynamic>).values) {
          (c as Map<String, dynamic>)
            ..['hooks'] = <Object?>[]
            ..['hook'] = {'id': 'x', 'front': null, 'kind': 'definition', 'locked': true};
        }
        covers[1]
          ..['hook'] = null
          ..['hooks'] = <Object?>[]
          ..['due'] = 0
          ..['kept'] = 0
          ..['counts'] = {'10': {'cards': 0, 'questions': 8, 'minutes': 10}};
        covers[2]
          ..['hook'] = null
          ..['hooks'] = <Object?>[]
          ..['kept'] = 2
          ..['counts'] = {'10': {'cards': 0, 'questions': 4, 'minutes': 10}};
        return json;
      });
      await pumpExplore(tester, exploreOverrides(api));
      expect(find.text('Definition'), findsOneWidget);
      expect(find.text('Opens with a Pro card'), findsOneWidget);
      await pageNext(tester);
      expect(find.text('8 questions'), findsWidgets);
      expect(find.text('No Key cards here yet.'), findsOneWidget);
      await pageNext(tester);
      expect(find.text('Your cards here are in Revise.'), findsOneWidget);
    });
  });

  group('the length', () {
    testWidgets('rewrites every cover\'s mix line and key', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.text('10 Key cards, 6 questions'), findsOneWidget);
      expect(find.text('27 Key cards, 1 question'), findsOneWidget);
      expect(find.text('Start · 10 min'), findsWidgets);

      await tester.tap(find.text('5'));
      await settleExplore(tester);
      expect(find.text('5 Key cards, 3 questions'), findsOneWidget);
      expect(find.text('12 Key cards, 1 question'), findsOneWidget);
      expect(find.text('10 Key cards, 6 questions'), findsNothing);
      expect(find.text('27 Key cards, 1 question'), findsNothing);
      expect(find.text('Start · 5 min'), findsWidgets);
      expect(find.text('Start · 10 min'), findsNothing);

      await tester.tap(find.text('20 min'));
      await settleExplore(tester);
      expect(find.text('23 Key cards, 10 questions'), findsOneWidget);
      // A chapter that has less than that says so: its own minutes, and what it has today.
      expect(find.text("37 Key cards, 1 question, that's all for today"), findsOneWidget);
      expect(find.text('Start · 20 min'), findsOneWidget);
      expect(find.text('Start · 13 min'), findsOneWidget);
    });

    testWidgets('nothing but the numbers move: the same covers stay in view', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      await pageNext(tester, 2);
      final before = rowOf(tester).offset;
      await tester.tap(find.text('5'));
      await settleExplore(tester);
      expect(rowOf(tester).offset, before);
      expect(find.text('3 of 14'), findsOneWidget);
    });

    testWidgets('Free\'s capped line shows only with 20 picked', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.free)));
      expect(find.text(ExploreCopy.freeCapped), findsNothing);
      expect(find.text(ExploreCopy.feedsNote), findsNothing);
      await tester.tap(find.text('20 min'));
      await settleExplore(tester);
      expect(find.text(ExploreCopy.freeCapped), findsOneWidget);
      expect(find.text(ExploreCopy.feedsNote), findsNothing);
      // The keys say what is really composed.
      expect(find.text('Start · 10 min'), findsWidgets);
      await tester.tap(find.text('5'));
      await settleExplore(tester);
      expect(find.text(ExploreCopy.freeCapped), findsNothing);
    });

    testWidgets('Pro at 20 minutes has no capped line', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), minutes: 20));
      expect(find.text(ExploreCopy.freeCapped), findsNothing);
      expect(find.text(ExploreCopy.feedsNote), findsNothing);
    });

    testWidgets('is said aloud when it is picked', (tester) async {
      final said = <String>[];
      tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler<dynamic>(SystemChannels.accessibility, (message) async {
        final data = (message as Map?)?['data'];
        if (data is Map && data['message'] is String) said.add(data['message'] as String);
        return null;
      });
      addTearDown(() => tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler<dynamic>(SystemChannels.accessibility, null));
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      await tester.tap(find.text('5'));
      await settleExplore(tester);
      expect(said, contains(ExploreCopy.showing(5)));
    });
  });

  group('the pager', () {
    testWidgets('counts the covers, and its keys move one cover at a time', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.text('1 of 14'), findsOneWidget);
      await pageNext(tester);
      expect(find.text('2 of 14'), findsOneWidget);
      expect(pagedOf(tester), closeTo(1, 0.001));
      await pageNext(tester);
      expect(find.text('3 of 14'), findsOneWidget);
      await tester.tap(_previous);
      await settleExplore(tester);
      expect(find.text('2 of 14'), findsOneWidget);
    });

    testWidgets('its keys are off at the ends', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(tester.widget<MmPressable>(_previous).onTap, isNull);
      expect(tester.widget<MmPressable>(_next).onTap, isNotNull);
      await tester.tap(_previous);
      await settleExplore(tester);
      expect(find.text('1 of 14'), findsOneWidget);
      await pageNext(tester, 13);
      expect(find.text('14 of 14'), findsOneWidget);
      expect(tester.widget<MmPressable>(_next).onTap, isNull);
      expect(tester.widget<MmPressable>(_previous).onTap, isNotNull);
      await tester.tap(_next);
      await settleExplore(tester);
      expect(find.text('14 of 14'), findsOneWidget);
    });

    testWidgets('a swipe moves it too, and the last cover sits on the gutter', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      for (var i = 0; i < 16; i++) {
        await tester.drag(find.byKey(ExploreCovers.rowKey), const Offset(-400, 0));
        await tester.pump(const Duration(milliseconds: 300));
      }
      await settleExplore(tester);
      expect(find.text('14 of 14'), findsOneWidget);
      final last = find.byWidgetPredicate((w) => w is CoverCard && w.position == 13);
      expect(tester.getTopRight(last).dx, closeTo(360 - CoverLayout.gutter, 0.6));
    });

    testWidgets('the first cover starts on the gutter, with the next one showing 60 dp of itself', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      final first = find.byWidgetPredicate((w) => w is CoverCard && w.position == 0);
      final second = find.byWidgetPredicate((w) => w is CoverCard && w.position == 1);
      expect(tester.getTopLeft(first).dx, closeTo(CoverLayout.gutter, 0.6));
      expect(tester.getSize(first).width, closeTo(272, 0.6));
      expect(tester.getTopLeft(second).dx - tester.getTopRight(first).dx, closeTo(CoverLayout.gap, 0.6));
      expect(360 - tester.getTopLeft(second).dx, closeTo(60, 1.2));
    });

    testWidgets('moves on the paging curve in 320 ms, and at once when motion is reduced', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)), disableAnimations: false);
      await tester.tap(_next);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      expect(pagedOf(tester), allOf(greaterThan(0), lessThan(1)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(pagedOf(tester), closeTo(1, 0.001));
    });

    testWidgets('jumps when motion is reduced', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      await tester.tap(_next);
      await tester.pump();
      expect(pagedOf(tester), closeTo(1, 0.001));
    });
  });

  group('where a tap goes', () {
    testWidgets('a cover opens its feed and says where it came from, with a selection tick', (tester) async {
      final driver = CountingHaptics();
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), driver: driver));
      await tester.tap(find.text('Accounting for Partnership: Basic Concepts'));
      await settleExplore(tester);
      expect(whereIs(router), '/explore/feed?chapter=accountancy.partnership-fundamentals&min=10&src=explore_cover&fy=1&pos=0');
      expect(driver.selection, 1);
      expect(find.textContaining('A feed:'), findsOneWidget);
    });

    testWidgets('another cover opens its own at its position, not as For you, at the picked length', (tester) async {
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), minutes: 5));
      await pageNext(tester, 2);
      await tester.tap(find.text('Change in Profit Sharing Ratio'));
      await settleExplore(tester);
      expect(whereIs(router), '/explore/feed?chapter=accountancy.change-in-profit-sharing-ratio&min=5&src=explore_cover&pos=2');
    });

    testWidgets('the key is part of the cover: a tap on it opens the feed too', (tester) async {
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      await tester.tap(find.text('Start · 10 min').first);
      await settleExplore(tester);
      expect(whereIs(router), startsWith('/explore/feed?chapter=accountancy.partnership-fundamentals'));
    });

    testWidgets('a feed to pick up opens that run by its id, whatever the cover was', (tester) async {
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.proOpen)));
      await tester.tap(find.text('Continue · 7 min'));
      await settleExplore(tester);
      expect(whereIs(router), startsWith('/explore/feed?chapter=accountancy.admission-of-partner&min=10&run=lr_'));
    });

    testWidgets('Free with the day used: keys read Questions on this chapter and open that chapter\'s questions', (tester) async {
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.freeUsed)));
      // The cover that holds the day's feed still picks it up.
      expect(find.text('Continue · 8 min'), findsOneWidget);
      expect(keyOf(tester, 0).play, isTrue);
      await pageNext(tester);
      expect(find.text('Questions on this chapter'), findsWidgets);
      expect(keyOf(tester, 1).play, isFalse);
      expect(keyOf(tester, 1).volt, isFalse);
      // No mix line where the key opens the questions.
      expect(find.text('5 Key cards'), findsNothing);
      await tester.tap(find.text('Questions on this chapter').first);
      await settleExplore(tester);
      expect(whereIs(router), '/practice/stream?subject=accountancy&chapter=Retirement+%26+Death+of+Partner');
    });

    testWidgets('the untimed questions are one row under the covers, on the same subject', (tester) async {
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.text(ExploreCopy.questionsHeading), findsOneWidget);
      await tester.tap(find.text('Untimed questions'));
      await settleExplore(tester);
      expect(whereIs(router), '/practice/stream?subject=accountancy');
    });

    testWidgets('Back goes to Practice when nothing is under the page', (tester) async {
      final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      await tester.tap(find.byWidgetPredicate((w) => w is MmPressable && w.semanticsLabel == 'Back'));
      await settleExplore(tester);
      expect(whereIs(router), '/practice');
    });

    testWidgets('coming back from a feed reads the covers again, keeping the row on screen', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      final router = await pumpExplore(tester, exploreOverrides(api));
      expect(api.asked, hasLength(1));
      await pageNext(tester, 2);
      await tester.tap(find.text('Change in Profit Sharing Ratio'));
      await settleExplore(tester);
      router.pop();
      await settleExplore(tester);
      expect(api.asked, hasLength(2));
      expect(find.text('3 of 14'), findsOneWidget);
      expect(find.byType(CoverSkeleton), findsNothing);
    });
  });

  group('the subject', () {
    testWidgets('chips show when the student has more than one subject, and a tap picks the shared one', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      await pumpExplore(tester, exploreOverrides(api, subjects: const ['accountancy', 'business_studies', 'economics']));
      expect(find.byType(ChipRail), findsOneWidget);
      expect(find.text('Accountancy'), findsOneWidget);
      expect(find.text('Business Studies'), findsOneWidget);
      await tester.tap(find.text('Business Studies'));
      await settleExplore(tester);
      expect(FixedSubject.picked, ['business_studies']);
      expect(api.asked, ['accountancy', 'business_studies']);
      expect(find.text('1 of 14'), findsOneWidget, reason: 'a new subject starts at its first cover');
    });

    testWidgets('one subject needs no chips', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      expect(find.byType(ChipRail), findsNothing);
    });

    testWidgets('a link that names a subject shows it at once, and makes it the shared one', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      await pumpExplore(tester, exploreOverrides(api), location: '/explore?subject=economics');
      expect(api.asked, ['economics']);
      expect(FixedSubject.picked, ['economics']);
    });

    testWidgets('a subject that is not an id is ignored', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      await pumpExplore(tester, exploreOverrides(api), location: '/explore?subject=Econ%20omics%21');
      expect(api.asked, ['accountancy']);
      expect(FixedSubject.picked, isEmpty);
    });
  });

  group('the states', () {
    testWidgets('loading: covers at their real size as placeholders, the head and the way to the questions are there', (tester) async {
      final hold = Completer<void>();
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro, hold: hold)));
      expect(find.byType(CoverSkeleton), findsWidgets);
      expect(find.byType(CoverCard), findsNothing);
      expect(find.text('Chapter feeds'), findsOneWidget);
      expect(find.text('14 chapters'), findsNothing);
      expect(find.text('Untimed questions'), findsOneWidget);
      final height = tester.getSize(find.byType(CoverSkeleton).first).height;
      hold.complete();
      await settleExplore(tester);
      expect(find.byType(CoverSkeleton), findsNothing);
      // The skeleton is the web's floor (292); a fuller cover stretches the row by a few dp, as the web's does.
      expect(tester.getSize(find.byType(CoverCard).first).height, closeTo(height, 8), reason: 'the page does not move when the covers land');
      expect(find.text('14 chapters'), findsNothing);
    });

    testWidgets('error: one line with Try again, and Try again reads them again', (tester) async {
      final api = CoversApi.of(CoversFixture.pro, fail: const LearnError(kind: LearnErrorKind.error, status: 500), failOnce: true);
      await pumpExplore(tester, exploreOverrides(api));
      expect(find.text(ExploreCopy.loadFailed), findsOneWidget);
      expect(find.text(ExploreCopy.tryAgain), findsOneWidget);
      expect(find.byType(CoverCard), findsNothing);
      expect(find.text(ExploreCopy.feedsNote), findsNothing);
      expect(find.text('Untimed questions'), findsOneWidget);
      await tester.tap(find.text(ExploreCopy.tryAgain));
      await settleExplore(tester);
      expect(api.asked, hasLength(2));
      expect(find.text(ExploreCopy.loadFailed), findsNothing);
      expect(find.byType(CoverCard), findsWidgets);
    });

    testWidgets('error, offline: the same line', (tester) async {
      final api = CoversApi.of(CoversFixture.pro, fail: const LearnError(kind: LearnErrorKind.error, offline: true));
      await pumpExplore(tester, exploreOverrides(api));
      expect(find.text(ExploreCopy.loadFailed), findsOneWidget);
    });

    testWidgets('empty: no feeds for the subject, and you can still answer the questions below', (tester) async {
      final api = CoversApi(() => {'subject': {'id': 'accountancy', 'name': 'Accountancy'}, 'covers': <dynamic>[]});
      await pumpExplore(tester, exploreOverrides(api));
      expect(find.text('No chapter feeds for Accountancy yet. You can still answer the questions below.'), findsOneWidget);
      expect(find.byType(CoverCard), findsNothing);
      expect(find.text('Untimed questions'), findsOneWidget);
    });

    testWidgets('Free with the day used: the line, See Pro, and no See Pro where Pro cannot be bought', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.freeUsed)));
      expect(find.text(ExploreCopy.freeDone), findsOneWidget);
      expect(find.text(ExploreCopy.seePro), findsOneWidget);
      expect(find.text(ExploreCopy.feedsNote), findsNothing);
    });

    testWidgets('Free with the day used where Play Billing is off: the line alone', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.freeUsed), upgrade: false));
      expect(find.text(ExploreCopy.freeDone), findsOneWidget);
      expect(find.text(ExploreCopy.seePro), findsNothing);
    });
  });

  group('words', () {
    testWidgets('the copy keeps the owner\'s rules: no exclamation marks, arrows, emoji or mastery', (tester) async {
      final api = CoversApi.of(CoversFixture.freeUsed);
      await pumpExplore(tester, exploreOverrides(api, subjects: const ['accountancy', 'economics']));
      // An exclamation mark, an arrow, a play sign, an emoji, or the word mastery (the middle dot is allowed: a time after a label is " · N min").
      final bad = RegExp(r'[!←-⇿▶\u{1F300}-\u{1FAFF}]|mastered|mastery', unicode: true);
      for (var i = 0; i < 14; i++) {
        for (final w in tester.widgetList<Text>(find.byType(Text))) {
          final text = w.data ?? w.textSpan?.toPlainText() ?? '';
          expect(bad.hasMatch(text), isFalse, reason: 'cover ${i + 1}: "$text"');
        }
        if (i < 13) await pageNext(tester);
      }
    });
  });

  group('text 1.3 times larger at 360 dp', () {
    for (final (name, fixture) in const [
      ('Pro', CoversFixture.pro),
      ('Free at 20', CoversFixture.free),
      ('Free with the day used', CoversFixture.freeUsed),
      ('a new student', CoversFixture.newPro),
      ('a feed to pick up', CoversFixture.proOpen),
    ]) {
      testWidgets('$name: every cover fits its words, whole, and as tall as its neighbours', (tester) async {
        await pumpExplore(tester, exploreOverrides(CoversApi.of(fixture), minutes: fixture == CoversFixture.free ? 20 : 10, subjects: const ['accountancy', 'economics']), textScale: 1.3);
        var height = 0.0;
        for (var i = 0; i < 14; i++) {
          final card = find.byWidgetPredicate((w) => w is CoverCard && w.position == i);
          expect(card, findsOneWidget);
          height = height == 0 ? tester.getSize(card).height : height;
          expect(tester.getSize(card).height, height, reason: 'cover ${i + 1}');
          expect(tester.takeException(), isNull, reason: 'cover ${i + 1}');
          if (i < 13) await pageNext(tester);
        }
        expect(height, greaterThan(CoverLayout.baseHeight));
      });
    }

    testWidgets('a long title and the longest hook keep every word, and the key wraps to two lines before it clips', (tester) async {
      final api = CoversApi(() {
        final json = CoversFixture.json(CoversFixture.freeUsed);
        final covers = (json['covers'] as List).cast<Map<String, dynamic>>();
        covers[1]['title'] = 'Development Experiences of India: A Comparison with Neighbours';
        covers[1]['hook'] = {'id': 'y', 'front': 'Which Article requires the government to present its estimated receipts and expenditures to Parliament every year?', 'kind': 'definition'};
        return json;
      });
      await pumpExplore(tester, exploreOverrides(api), textScale: 1.3);
      await pageNext(tester);
      expect(find.text('Development Experiences of India: A Comparison with Neighbours'), findsOneWidget);
      expect(find.text('Questions on this chapter'), findsWidgets);
      expect(tester.takeException(), isNull);
      final key = find.descendant(of: find.byWidgetPredicate((w) => w is CoverCard && w.position == 1), matching: find.byType(CoverKeyFace));
      expect(tester.getSize(key).height, greaterThanOrEqualTo(CoverLayout.keyHeight));
    });
  });

  group('every target is 48 dp, and every one has its name', () {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('the Pro page with two subjects, $tag', (tester) async {
        final handle = tester.ensureSemantics();
        await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro), subjects: const ['accountancy', 'economics']), brightness: brightness);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });

      testWidgets('Free with the day used, $tag', (tester) async {
        final handle = tester.ensureSemantics();
        await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.freeUsed)), brightness: brightness);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });
    }

    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('the error line with Try again, $tag', (tester) async {
        final handle = tester.ensureSemantics();
        final api = CoversApi.of(CoversFixture.pro, fail: const LearnError(kind: LearnErrorKind.error, status: 500));
        await pumpExplore(tester, exploreOverrides(api), brightness: brightness);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });

      testWidgets('while the covers load, $tag', (tester) async {
        final handle = tester.ensureSemantics();
        await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro, hold: Completer<void>())), brightness: brightness);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        handle.dispose();
      });
    }

    testWidgets('the pager keys are 48 dp, and a cover is far more', (tester) async {
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      for (final key in [_previous, _next]) {
        final size = tester.getSize(key);
        expect(size.width, greaterThanOrEqualTo(48));
        expect(size.height, greaterThanOrEqualTo(48));
      }
      expect(tester.getSize(find.byType(CoverCard).first).height, greaterThanOrEqualTo(CoverLayout.baseHeight));
    });

    testWidgets('a cover is one thing to a screen reader: its title and key as its name, the rest as what it adds', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
      final node = tester.getSemantics(find.bySemanticsLabel('Accounting for Partnership: Basic Concepts, Start · 10 min').first);
      expect(node.value, '1 of 14');
      expect(node.hint, startsWith('For you: 3 open mistakes to fix. 10 Key cards, 6 questions. Name the 6 essential features of partnership.'));
      handle.dispose();
    });
  });

  testWidgets('the pager and the row survive a change of width', (tester) async {
    await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
    await pageNext(tester, 2);
    tester.view.physicalSize = const Size(412, 892) * 2;
    await settleExplore(tester);
    expect(find.text('3 of 14'), findsOneWidget);
    final first = find.byWidgetPredicate((w) => w is CoverCard && w.position == 2);
    expect(tester.getSize(first).width, closeTo(320, 0.6));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a root page over the shell: no dock', (tester) async {
    final router = await pumpExplore(tester, exploreOverrides(CoversApi.of(CoversFixture.pro)));
    expect(find.byType(MmBottomBar), findsNothing);
    expect(router.routerDelegate.currentConfiguration.uri.path, '/explore');
  });
}
