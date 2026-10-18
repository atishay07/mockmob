// "Suggested for you" (D51, TODAY-SWIPE-1018): the deck's cards and their words, the pass through
// them, the hint's two visits, and the gestures: right past 30% (or a tap, or the button) swaps
// the lead card and never starts or spends; left sends the card to the back; a short drag springs
// home; a vertical drag is the page's scroll.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart' show MoveHeroCard;
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek _week = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

TodayView _view() => buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _week, reviseDue: 6));

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

Finder _onTop(String text) => find.descendant(of: find.byKey(SuggestedStack.topKey), matching: find.text(text));

String _heroTitle(WidgetTester tester) => tester.widget<MoveHeroCard>(find.byType(MoveHeroCard)).move.title!;

Future<List<Object>> _pump(WidgetTester tester, {bool animate = false}) async {
  final events = <Object>[];
  await pumpMockmob(
    tester,
    TodayBody(view: _view(), skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: events.add, onTarget: events.add)),
    size: const Size(412, 2400),
    disableAnimations: !animate,
    overrides: _overrides,
  );
  await tester.pumpAndSettle();
  return events;
}

/// Drags the top card by [dx] (and [dy]) in small steps, then lets go.
Future<void> _drag(WidgetTester tester, Offset by, {bool fling = false}) async {
  final at = tester.getCenter(find.byKey(SuggestedStack.topKey));
  final g = await tester.startGesture(at);
  const steps = 10;
  for (var k = 0; k < steps; k++) {
    await g.moveBy(by / steps.toDouble(), timeStamp: Duration(milliseconds: fling ? 4 * k : 40 * k));
    await tester.pump(const Duration(milliseconds: 16));
  }
  await g.up();
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    debugResetTodayPicks();
    SuggestedHint.debugReset();
    SuggestedHint.store = MemoryPrefsStore();
  });
  tearDown(() {
    SuggestedHint.debugReset();
    SuggestedHint.store = null;
  });

  group('the deck', () {
    test('the lead\'s other moves in the choices\' own order, each with its cost, title, evidence and art', () {
      final view = _view();
      expect((view.hero! as MoveHero).kind, MoveKind.repair);
      expect(view.choices.length, inInclusiveRange(2, deckSize));
      final deck = buildSuggestedDeck(view.choices, glance: view.glance);
      expect([for (final c in deck) c.key], [for (final c in view.choices) c.key]);
      expect(deck.any((c) => c.key == 'repair'), isFalse, reason: 'never the same kind as the lead');
      final revise = deck.firstWhere((c) => c.key == 'revise');
      expect(revise.cost, SuggestedCopy.costFree(10));
      expect(revise.title, SuggestedCopy.titleRevise);
      expect(revise.line, SuggestedCopy.reviseLine(6));
      expect(revise.art, SuggestedArt.mobi);
      final weakest = deck.firstWhere((c) => c.key == 'weakest');
      final w = view.glance!.weak.rows.first;
      expect(weakest.cost, 'Accountancy, 10 questions');
      expect(weakest.title, SuggestedCopy.titleWeakest);
      expect(weakest.line, SuggestedCopy.weakestLine(w.chapter, w.missed, w.asked, w.marks));
      expect(weakest.line, contains(' of '), reason: 'every count has its denominator');
      expect(weakest.art, SuggestedArt.subject);
      for (final c in deck) {
        expect(c.line, isNot(contains('·')));
        expect(c.line, isNot(contains('→')));
        expect(c.swipeable, isTrue);
      }
    });

    test('the pass: skip sends the top card to the back, the count and the dots follow, the end comes after every card', () {
      final pass = DeckPass(['a', 'b', 'c', 'd']);
      expect(pass.top, 'a');
      expect(pass.countLine, '3 more after this');
      expect(pass.dots, [DotState.on, DotState.ahead, DotState.ahead, DotState.ahead]);
      pass.skip();
      expect(pass.order, ['b', 'c', 'd', 'a']);
      expect(pass.next, 'c');
      expect(pass.countLine, '2 more after this');
      expect(pass.dots, [DotState.seen, DotState.on, DotState.ahead, DotState.ahead]);
      pass
        ..skip()
        ..skip();
      expect(pass.countLine, 'Last of 4');
      expect(pass.next, isNull);
      pass.skip();
      expect(pass.ended, isTrue);
      expect(pass.top, isNull);
      expect(pass.countLine, SuggestedCopy.noneLeft);
      expect(pass.dots, everyElement(DotState.seen));
      pass.again();
      expect(pass.order, ['a', 'b', 'c', 'd']);
      expect(pass.ended, isFalse);
    });

    test('the end card counts the deck in words', () {
      expect(SuggestedCopy.allSeen(4), 'That was all four for tonight');
      expect(SuggestedCopy.allSeen(3), 'That was all three for tonight');
      expect(SuggestedCopy.allSeen(1), 'That was the one for tonight');
    });

    test('the hint shows on the first two visits only, and never after a swipe', () async {
      final store = MemoryPrefsStore();
      SuggestedHint.store = store;
      Future<bool> visit() {
        SuggestedHint.debugReset();
        return SuggestedHint.claim();
      }

      expect(await visit(), isTrue);
      expect(await SuggestedHint.claim(), isTrue, reason: 'the same visit gets the same answer');
      expect(await visit(), isTrue);
      expect(await visit(), isFalse);
      store.values.clear();
      expect(await visit(), isTrue);
      await SuggestedHint.learned();
      expect(await visit(), isFalse);
    });
  });

  group('the stack on Today', () {
    testWidgets('the hero ends at its price line; the stack follows with the count, the dots and the hint', (tester) async {
      await _pump(tester);
      expect(find.text(GlanceCopy.moreWays), findsNothing, reason: 'More ways leaves the card');
      expect(find.text(SuggestedCopy.title), findsOneWidget);
      final n = _view().choices.length;
      expect(find.text(SuggestedCopy.moreAfter(n - 1, n)), findsOneWidget);
      expect(find.text(SuggestedCopy.hint), findsOneWidget);
      final hero = tester.getRect(find.byType(MoveHeroCard));
      final stack = tester.getRect(find.byType(SuggestedStack));
      expect(stack.top, greaterThanOrEqualTo(hero.bottom), reason: 'the stack sits under the card, not in it');
    });

    testWidgets('a right swipe past 30% makes the card the lead and starts nothing', (tester) async {
      final events = await _pump(tester);
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      await _drag(tester, const Offset(200, 0));
      expect(_heroTitle(tester), GlanceCopy.titleRevise);
      expect(events, isEmpty, reason: 'a swipe never starts a session or spends a credit');
      expect(_onTop(GlanceCopy.suggested), findsOneWidget, reason: 'the old lead is back in the deck, marked Suggested');
      expect(find.text(SuggestedCopy.hint), findsNothing, reason: 'a swipe means the hint has done its job');
    });

    testWidgets('a short drag springs home; a fling commits even when short', (tester) async {
      await _pump(tester);
      await _drag(tester, const Offset(60, 0));
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      expect(_onTop(SuggestedCopy.titleRevise), findsOneWidget);
      await _drag(tester, const Offset(80, 0), fling: true);
      expect(_heroTitle(tester), GlanceCopy.titleRevise);
    });

    testWidgets('a left swipe sends the card to the back; the next one comes up', (tester) async {
      final events = await _pump(tester);
      await _drag(tester, const Offset(-200, 0));
      expect(_onTop(SuggestedCopy.titleWeakest), findsOneWidget);
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      expect(events, isEmpty);
    });

    testWidgets('a vertical drag scrolls the page and leaves the card where it is', (tester) async {
      await _pump(tester);
      final before = tester.getTopLeft(find.byKey(SuggestedStack.topKey));
      await _drag(tester, const Offset(10, -160));
      final after = tester.getTopLeft(find.byKey(SuggestedStack.topKey));
      expect(after.dx, closeTo(before.dx, 0.5), reason: 'no sideways move');
      expect(after.dy, lessThan(before.dy - 100), reason: 'the page scrolled');
      expect(_onTop(SuggestedCopy.titleRevise), findsOneWidget);
    });

    testWidgets('the buttons do what the swipes do; a tap on the card is right', (tester) async {
      final events = await _pump(tester);
      await tester.tap(_onTop(SuggestedCopy.skip));
      await tester.pumpAndSettle();
      expect(_onTop(SuggestedCopy.titleWeakest), findsOneWidget);
      await tester.tap(_onTop(SuggestedCopy.titleWeakest));
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      await tester.tap(_onTop(SuggestedCopy.doThis));
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'Do this instead on the Suggested card is the way back');
      expect(events, isEmpty);
    });

    testWidgets('after every card the end card offers them again and every way to practise', (tester) async {
      final events = await _pump(tester);
      final n = _view().choices.length;
      for (var k = 0; k < n; k++) {
        await tester.tap(_onTop(SuggestedCopy.skip));
        await tester.pumpAndSettle();
      }
      expect(find.byKey(SuggestedStack.topKey), findsNothing);
      expect(find.text(SuggestedCopy.allSeen(n)), findsOneWidget);
      expect(find.text(SuggestedCopy.noneLeft), findsOneWidget);
      await tester.tap(find.text(SuggestedCopy.everyWay));
      await tester.pump();
      expect(events.whereType<TodayAction>().single.target, isA<OpenAlternatives>());
      await tester.tap(find.text(SuggestedCopy.again));
      await tester.pumpAndSettle();
      expect(_onTop(SuggestedCopy.titleRevise), findsOneWidget);
    });

    testWidgets('with motion on, the chosen card flies into the lead card and the swap lands', (tester) async {
      final events = await _pump(tester, animate: true);
      await tester.tap(_onTop(SuggestedCopy.doThis));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      expect(find.text(SuggestedCopy.doThis), findsWidgets, reason: 'the flying card is still on its way');
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleRevise);
      expect(_onTop(GlanceCopy.suggested), findsOneWidget);
      expect(events, isEmpty);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a screen reader hears the top card and its two buttons, not the cards behind', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester);
      expect(find.bySemanticsLabel(SuggestedCopy.doThisSemantics(SuggestedCopy.titleRevise)), findsOneWidget);
      expect(find.bySemanticsLabel(SuggestedCopy.skipSemantics(SuggestedCopy.titleRevise)), findsOneWidget);
      expect(find.bySemanticsLabel(SuggestedCopy.doThisSemantics(SuggestedCopy.titleWeakest)), findsNothing);
      handle.dispose();
    });
  });
}
