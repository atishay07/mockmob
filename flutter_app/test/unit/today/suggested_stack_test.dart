// "Suggested for you" (D51, refined by SWIPE-V2-1018 for D90): the deck's cards and their words,
// the pass and its Undo, the first run (the intro, the coach line, the demo shown once in the
// phone's life and stopped by any touch, the visits it coaches on), what the deck learns, and the
// gestures: right past 30% (or a tap, or Up next) swaps the lead card and never starts or spends;
// left (or Not now) sends the card to the back; a short drag springs home; a vertical drag is the
// page's scroll. The row under the deck is the accessible path.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/copy.dart';
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

/// The words of the top card's stamp (the row's buttons sit outside the card).
Finder _stamp(String label) => _onTop(label);

String _heroTitle(WidgetTester tester) => tester.widget<MoveHeroCard>(find.byType(MoveHeroCard)).move.title!;

/// The coach line's words now (the last one in, while two overlap).
String _coach(WidgetTester tester) {
  final texts = find.descendant(of: find.byKey(SuggestedStack.coachKey).last, matching: find.byType(Text));
  // The held places of the other lines are laid out but never seen; a line that breaks between its
  // two sentences reads as one.
  return [
    for (final e in texts.evaluate())
      if (e.findAncestorWidgetOfExactType<Visibility>()?.visible ?? true) ((e.widget as Text).data ?? '').replaceAll('\n', ' '),
  ].join(' | ');
}

late MemoryPrefsStore _coachStore;
late MemoryPrefsStore _memoryStore;

Map<String, dynamic> _coachSaved() => jsonDecode(_coachStore.values[DeckCoach.key]! as String) as Map<String, dynamic>;

Future<List<Object>> _pump(WidgetTester tester, {bool animate = false, Size size = const Size(412, 2400)}) async {
  final events = <Object>[];
  await pumpMockmob(
    tester,
    TodayBody(
      view: _view(),
      skeletonDelay: Duration.zero,
      callbacks: TodayCallbacks(onAction: events.add, onTarget: events.add),
    ),
    size: size,
    disableAnimations: !animate,
    overrides: _overrides,
  );
  await tester.pumpAndSettle();
  return events;
}

/// Today with motion on, pumped without settling (the demo waits on timers a settle would race).
Future<List<Object>> _pumpLive(WidgetTester tester, {Size size = const Size(412, 2400)}) async {
  final events = <Object>[];
  await pumpMockmob(
    tester,
    TodayBody(view: _view(), skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: events.add, onTarget: events.add)),
    size: size,
    overrides: _overrides,
  );
  await tester.pump();
  return events;
}

/// Pumps in 50 ms steps for up to [within] until [seen] holds.
Future<bool> _until(WidgetTester tester, bool Function() seen, {Duration within = const Duration(seconds: 4)}) async {
  for (var t = Duration.zero; t < within; t += const Duration(milliseconds: 50)) {
    if (seen()) return true;
    await tester.pump(const Duration(milliseconds: 50));
  }
  return seen();
}

/// Drags the top card by [by] in small steps, then lets go.
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

/// Holds the top card dragged by [dx] (the finger stays down).
Future<TestGesture> _hold(WidgetTester tester, double dx) async {
  final g = await tester.startGesture(tester.getCenter(find.byKey(SuggestedStack.topKey)));
  await g.moveBy(Offset(dx.sign * 14, 0));
  await tester.pump();
  await g.moveBy(Offset(dx - dx.sign * 14, 0));
  await tester.pump();
  return g;
}

Future<void> _tap(WidgetTester tester, Key key) async {
  await tester.tap(find.byKey(key));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    debugResetTodayPicks();
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    _coachStore = MemoryPrefsStore();
    _memoryStore = MemoryPrefsStore();
    DeckCoach.store = _coachStore;
    DeckMemoryStore.store = _memoryStore;
    DeckMemoryStore.clock = () => _sunday;
  });
  tearDown(() {
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = null;
    DeckMemoryStore.store = null;
  });

  group('the deck', () {
    test('the lead\'s other moves, the weakest chapter first and the rest in the choices\' order, each with its cost, title, evidence and art', () {
      final view = _view();
      expect((view.hero! as MoveHero).kind, MoveKind.repair);
      expect(view.choices.length, inInclusiveRange(2, deckSize));
      final deck = buildSuggestedDeck(view.choices, glance: view.glance);
      expect(
        [for (final c in deck) c.key],
        [
          'weakest',
          for (final c in view.choices)
            if (c.key != 'weakest') c.key,
        ],
        reason: 'the approved deck opens on the weakest chapter',
      );
      expect(deck.any((c) => c.key == 'repair'), isFalse, reason: 'never the same kind as the lead');
      final revise = deck.firstWhere((c) => c.key == 'revise');
      final reviseHero = view.choices.firstWhere((c) => c.key == 'revise').hero!;
      final keyed = int.parse(TodayCopy.keyLength(reviseHero.primary.label)!.split(' ').first);
      expect(revise.cost, SuggestedCopy.costFree(keyed), reason: 'the minutes the key it would arm says');
      expect(revise.title, reviseHero.title, reason: 'the words the lead card shows once it swaps');
      expect(revise.line, SuggestedCopy.reviseLine(6));
      expect(revise.art, SuggestedArt.mobi);
      final weakest = deck.firstWhere((c) => c.key == 'weakest');
      final w = view.glance!.weak.rows.first;
      expect(weakest.cost, 'Accountancy, 10 questions');
      expect(weakest.title, GlanceCopy.titleWeakest);
      expect(weakest.line, SuggestedCopy.weakestLine(w.chapter, w.missed, w.asked, w.marks));
      expect(weakest.art, SuggestedArt.subject);
      for (final c in deck) {
        expect(c.title, isNot(contains('instead')));
        expect(c.title, isNot(GlanceCopy.titleOtherSubject), reason: 'the title names the move');
        expect(c.line, isNot(contains('·')));
        expect(c.line, isNot(contains('→')));
        expect(c.swipeable, isTrue);
      }
    });

    test('the pass: Not now sends the top card to the back, Undo brings it back on top, the end comes after every card', () {
      final pass = DeckPass(['a', 'b', 'c', 'd']);
      expect(pass.top, 'a');
      expect(pass.countLine, '3 more after this');
      pass.skip();
      expect(pass.order, ['b', 'c', 'd', 'a']);
      expect(pass.next, 'c');
      expect(pass.countLine, '2 more after this');
      pass.unskip();
      expect(pass.order, ['a', 'b', 'c', 'd'], reason: 'Undo puts the card back on top');
      expect(pass.skips, 0);
      pass
        ..skip()
        ..skip()
        ..skip();
      expect(pass.countLine, 'Last of 4');
      expect(pass.next, isNull);
      final before = pass.copy();
      pass.skip();
      expect(pass.ended, isTrue);
      expect(pass.top, isNull);
      expect(pass.countLine, SuggestedCopy.noneLeft);
      expect(before.ended, isFalse, reason: 'a copy keeps the pass as it was');
      pass.unskip();
      expect(pass.ended, isFalse);
      expect(pass.top, 'd', reason: 'Undo at the end brings the last card back');
      pass.again();
      expect(pass.order, ['a', 'b', 'c', 'd']);
      expect(pass.keys, ['a', 'b', 'c', 'd']);
      expect(pass.ended, isFalse);
    });

    test('after a pick the recommended move stays first, then the weakest chapter', () {
      final view = _view();
      final lead = view.hero! as MoveHero;
      final revise = view.choices.firstWhere((c) => c.key == 'revise');
      final picked = [
        MoveChoice(key: 'lead', title: lead.title!, line: lead.summary, hero: lead, suggested: true),
        for (final c in view.choices)
          if (c.key != revise.key) c,
      ];
      final deck = buildSuggestedDeck(picked, glance: view.glance);
      expect(deck.first.suggested, isTrue);
      expect(deck.first.title, lead.title);
      expect(deck[1].key, 'weakest');
    });

    test('the words: one name per direction, the end says today, every count has its unit, "Both" for two', () {
      expect(SuggestedCopy.upNext, 'Do this next');
      expect(SuggestedCopy.notNow, 'Not now');
      expect(SuggestedCopy.allSeen(4), "That's all four for today");
      expect(SuggestedCopy.allSeen(1), "That's the one for today");
      expect(SuggestedCopy.countFirst(4), '4 cards');
      expect(SuggestedCopy.moreAfter(2, 4), '2 more after this');
      expect(SuggestedCopy.moreAfter(0, 4), 'Last of 4');
      expect(SuggestedCopy.costRepair(15), '1 AI credit each, about 15 min');
      expect(SuggestedCopy.upNextSemantics('Revise what is due'), contains('Nothing starts until you tap Start'));
      for (final s in [
        SuggestedCopy.intro,
        SuggestedCopy.coachIdle,
        SuggestedCopy.coachRight,
        SuggestedCopy.coachLeft,
        SuggestedCopy.letGoRight,
        SuggestedCopy.letGoLeft,
        SuggestedCopy.learnedLeft,
        SuggestedCopy.barLineFirst,
        SuggestedCopy.allSeen(3),
        SuggestedCopy.endOurPick,
        SuggestedCopy.everyWay,
      ]) {
        expect(s, isNot(contains('tonight')));
        expect(s, isNot(contains('!')));
        expect(s, isNot(contains('instead')));
        expect(s, isNot(contains('Skip')));
      }
      final marked = DateTime(2026, 10, 16);
      expect(TodayCopy.tonightLine(2, 2, 'Mock 7', 'Partnership fundamentals', marked), startsWith('Both are from Mock 7'), reason: 'never "All two are"');
      expect(TodayCopy.tonightLine(4, 4, 'Mock 7', 'Partnership fundamentals', marked), startsWith('All four are from Mock 7'));
    });
  });

  group('the first run (DeckCoach)', () {
    Future<DeckCoachRun> visit() {
      DeckCoach.debugReset();
      DeckCoach.store = _coachStore;
      return DeckCoach.load();
    }

    test('a fresh phone coaches; one visit counts per run; both directions end it, persisted', () async {
      final run = await visit();
      expect(run.coaching, isTrue);
      expect(run.demoShown, isFalse);
      await DeckCoach.countVisit(run);
      await DeckCoach.countVisit(run);
      expect(_coachSaved()['visits'], 1, reason: 'one visit per app run');
      expect(identical(await DeckCoach.load(), run), isTrue, reason: 'the same run gets the same answer');
      await DeckCoach.demoDone(run);
      await DeckCoach.used(run, right: true);
      expect(run.coaching, isTrue, reason: 'this visit keeps coaching to its end: nothing leaves mid-visit');
      final second = await visit();
      expect(second.coaching, isTrue, reason: 'left is still untaught');
      expect(second.demoShown, isTrue, reason: 'the demo runs once in the phone\'s life');
      await DeckCoach.used(second, right: false);
      final third = await visit();
      expect(third.coaching, isFalse, reason: 'both directions used: coaching is over for good');
    });

    test('coaching ends after three visits even if a direction was never used', () async {
      for (var k = 0; k < DeckCoach.maxVisits; k++) {
        final run = await visit();
        expect(run.coaching, isTrue, reason: 'visit ${k + 1}');
        await DeckCoach.countVisit(run);
      }
      expect((await visit()).coaching, isFalse);
    });

    test('the old caption hint, seen twice, counts as taught; seen once, the phone starts fresh', () async {
      _coachStore.values[DeckCoach.oldHintKey] = 2;
      expect((await visit()).coaching, isFalse);
      expect(_coachStore.values[DeckCoach.key], isNotNull, reason: 'migrated once');
      _coachStore.values
        ..clear()
        ..[DeckCoach.oldHintKey] = 1;
      expect((await visit()).coaching, isTrue);
    });

    test('a store that fails reads as taught: never a half-shown coach', () async {
      DeckCoach.debugReset();
      DeckCoach.store = _FailingStore();
      expect((await DeckCoach.load()).coaching, isFalse);
    });
  });

  group('what the deck learns (DeckMemory)', () {
    final view = _view();
    final deck = buildSuggestedDeck(view.choices, glance: view.glance);
    final today = DeckMemory.dayOf(_sunday);
    List<String> keys(List<SuggestedCard> cards) => [for (final c in cards) c.key];

    test('two passes on separate days sink a kind to the end; two on one day do not', () {
      final once = DeckMemory()
        ..passed('weakest', today)
        ..passed('weakest', today);
      expect(keys(once.order(deck, today)), keys(deck));
      final twice = DeckMemory()
        ..passed('weakest', today - 3)
        ..passed('weakest', today);
      final ordered = twice.order(deck, today);
      expect(ordered.last.key, 'weakest');
      expect(ordered.length, deck.length, reason: 'nothing added or removed');
      expect(keys(ordered).toSet(), keys(deck).toSet());
      expect(keys(ordered.take(deck.length - 1).toList()), keys(deck.skip(1).toList()), reason: 'the rest keep their order');
    });

    test('a pick clears the passes; after seven days the kind returns to its place', () {
      final m = DeckMemory()
        ..passed('revise', today - 1)
        ..passed('revise', today);
      expect(m.sinks('revise', today), isTrue);
      expect(m.sinks('revise', today + 6), isFalse, reason: 'one pass left in the window');
      expect(m.sinks('revise', today + 7), isFalse);
      m.picked('revise');
      expect(m.sinks('revise', today), isFalse);
      expect(m.passesOf('revise'), isEmpty);
    });

    test('the recommended card never moves, and sunk kinds keep their own order', () {
      final lead = view.hero! as MoveHero;
      final picked = buildSuggestedDeck([
        MoveChoice(key: 'lead', title: lead.title!, line: lead.summary, hero: lead, suggested: true),
        ...view.choices.where((c) => c.key != 'revise'),
      ], glance: view.glance);
      final m = DeckMemory();
      for (final c in picked) {
        m
          ..passed(DeckMemory.kindOf(c), today - 2)
          ..passed(DeckMemory.kindOf(c), today);
      }
      final ordered = m.order(picked, today);
      expect(ordered.first.suggested, isTrue, reason: 'the recommended card stays first');
      expect(keys(ordered), keys(picked), reason: 'every other card sank, in its own order');
    });

    test('another subject is its own kind; the memory survives a round trip and keeps only a week', () {
      final m = DeckMemory()
        ..passed('weakest', today - 10)
        ..passed('weakest', today - 1)
        ..passed('weakest', today);
      expect(m.passesOf('weakest'), [today - 1, today], reason: 'older days are dropped');
      final back = DeckMemory.fromJson(jsonDecode(jsonEncode(m.toJson())));
      expect(back.passesOf('weakest'), [today - 1, today]);
      final other = deck.where((c) => c.key == 'other').firstOrNull;
      if (other != null) expect(DeckMemory.kindOf(other), 'other:${other.subjectId}');
      expect(DeckMemory.dayOf(DateTime.utc(2026, 10, 18, 19)), DeckMemory.dayOf(DateTime.utc(2026, 10, 19, 1)), reason: 'IST days: 00:30 and 06:30 on the 19th');
    });
  });

  group('the stack on Today', () {
    testWidgets('first run: the heading and "4 cards", the intro line, the coach line, and the row of three', (tester) async {
      await _pump(tester);
      final n = _view().choices.length;
      expect(find.text(SuggestedCopy.title), findsOneWidget);
      expect(find.text(SuggestedCopy.countFirst(n)), findsOneWidget);
      expect(find.text(SuggestedCopy.intro), findsOneWidget);
      expect(_coach(tester), '${SuggestedCopy.coachRight} | ${SuggestedCopy.coachLeft}', reason: 'reduced motion: both meanings at once, no demo');
      expect(find.byKey(SuggestedStack.notNowKey), findsOneWidget);
      expect(find.byKey(SuggestedStack.undoKey), findsOneWidget);
      expect(find.byKey(SuggestedStack.upNextKey), findsOneWidget);
      expect(find.descendant(of: find.byKey(SuggestedStack.topKey), matching: find.byKey(SuggestedStack.upNextKey)), findsNothing, reason: 'the controls left the card');
      final hero = tester.getRect(find.byType(MoveHeroCard));
      final stack = tester.getRect(find.byType(SuggestedStack));
      expect(stack.top, greaterThanOrEqualTo(hero.bottom), reason: 'the stack sits under the card, not in it');
      final card = tester.getRect(find.byKey(SuggestedStack.topKey));
      final row = tester.getRect(find.byKey(SuggestedStack.notNowKey));
      expect(row.top, greaterThan(card.bottom), reason: 'the row sits under the deck');
      expect(tester.getSize(find.byKey(SuggestedStack.upNextKey)).height, greaterThanOrEqualTo(48));
    });

    testWidgets('with motion on, the coach line says "Drag the card, or tap a button." at rest', (tester) async {
      SuggestedStack.debugCoachMotion = true;
      await _pump(tester);
      expect(_coach(tester), SuggestedCopy.coachIdle);
    });

    testWidgets('a returning phone: no intro, no coach line, the count of what is left', (tester) async {
      DeckCoach.debugRun = DeckCoachRun.taught();
      await _pump(tester);
      final n = _view().choices.length;
      expect(find.text(SuggestedCopy.intro), findsNothing);
      expect(find.byKey(SuggestedStack.coachKey), findsNothing);
      expect(find.text(SuggestedCopy.moreAfter(n - 1, n)), findsOneWidget);
    });

    testWidgets('a right swipe past 30% makes the card the lead, starts nothing, and the bar offers Undo', (tester) async {
      final events = await _pump(tester);
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      final g = await _hold(tester, 160);
      expect(_stamp(SuggestedCopy.upNext), findsOneWidget, reason: 'the stamp lands as the drag nears the threshold');
      expect(_coach(tester), SuggestedCopy.letGoRight);
      await g.up();
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      expect(events, isEmpty, reason: 'a swipe never starts a session or spends a credit');
      expect(_onTop(GlanceCopy.suggested), findsOneWidget, reason: 'the old lead is back in the deck, marked Suggested');
      expect(find.byKey(SuggestedStack.barKey), findsOneWidget);
      expect(find.text(SuggestedCopy.barLineFirst), findsOneWidget, reason: 'the first time, it says nothing starts');
      expect(_coachSaved()['right'], isTrue);

      await _tap(tester, SuggestedStack.barUndoKey);
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'Undo puts the old lead back');
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget, reason: 'and the card back on top of the deck');
      expect(events, isEmpty);
    });

    testWidgets('the row\'s Undo takes back an Up next too; the second Up next bar is the short line', (tester) async {
      await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      await _tap(tester, SuggestedStack.undoKey);
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      expect(find.byKey(SuggestedStack.barKey), findsNothing, reason: 'the bar leaves on the next action');
      await _tap(tester, SuggestedStack.upNextKey);
      expect(find.text(SuggestedCopy.barLine), findsOneWidget);
    });

    testWidgets('a short drag springs home; a fling commits even when short', (tester) async {
      await _pump(tester);
      await _drag(tester, const Offset(60, 0));
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget);
      await _drag(tester, const Offset(80, 0), fling: true);
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
    });

    testWidgets('a left swipe sends the card to the back; the first one says where it went; Undo brings it back and forgets the pass', (tester) async {
      final events = await _pump(tester);
      final n = _view().choices.length;
      final g = await _hold(tester, -160);
      expect(_stamp(SuggestedCopy.notNow), findsOneWidget);
      expect(_coach(tester), SuggestedCopy.letGoLeft);
      await g.up();
      await tester.pumpAndSettle();
      expect(_onTop(GlanceCopy.titleRevise), findsOneWidget);
      expect(_heroTitle(tester), GlanceCopy.titleRepair);
      expect(find.text(SuggestedCopy.moreAfter(n - 2, n)), findsOneWidget);
      expect(_coach(tester), SuggestedCopy.learnedLeft.replaceAll('\n', ' '));
      expect(_coachSaved()['left'], isTrue);
      final today = DeckMemory.dayOf(_sunday);
      expect(DeckMemoryStore.loaded!.passesOf('weakest'), [today], reason: 'the pass is remembered');
      expect(events, isEmpty);

      await _tap(tester, SuggestedStack.undoKey);
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget, reason: 'Undo brings the card back on top');
      expect(DeckMemoryStore.loaded!.passesOf('weakest'), isEmpty, reason: 'an undone pass is not remembered');
    });

    testWidgets('a kind passed on yesterday and today sits at the back of the next deck', (tester) async {
      final today = DeckMemory.dayOf(_sunday);
      _memoryStore.values[DeckMemoryStore.key] = jsonEncode({
        'weakest': [today - 1, today],
      });
      await _pump(tester);
      expect(_onTop(GlanceCopy.titleRevise), findsOneWidget, reason: 'the weakest chapter sank to the back');
      final n = _view().choices.length;
      for (var k = 0; k < n - 1; k++) {
        await _tap(tester, SuggestedStack.notNowKey);
      }
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget, reason: 'nothing is hidden for good');
    });

    testWidgets('a vertical drag scrolls the page and leaves the card where it is', (tester) async {
      await _pump(tester);
      final before = tester.getTopLeft(find.byKey(SuggestedStack.topKey));
      await _drag(tester, const Offset(10, -160));
      final after = tester.getTopLeft(find.byKey(SuggestedStack.topKey));
      expect(after.dx, closeTo(before.dx, 0.5), reason: 'no sideways move');
      expect(after.dy, lessThan(before.dy - 100), reason: 'the page scrolled');
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget);
    });

    testWidgets('a diagonal that starts on the deck is the page\'s scroll, not a swipe', (tester) async {
      await _pump(tester);
      final before = tester.getTopLeft(find.byKey(SuggestedStack.topKey));
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(SuggestedStack.topKey)));
      for (var k = 0; k < 12; k++) {
        await gesture.moveBy(const Offset(-12, -11));
        await tester.pump(const Duration(milliseconds: 16));
      }
      await gesture.up();
      await tester.pumpAndSettle();
      final after = tester.getTopLeft(find.byKey(SuggestedStack.topKey));
      expect(after.dx, closeTo(before.dx, 0.5), reason: 'the card never left its place');
      expect(after.dy, lessThan(before.dy - 60), reason: 'the page scrolled');
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget, reason: 'nothing was passed on');
    });

    for (final scale in [1.0, 1.3]) {
      for (final coaching in [true, false]) {
        testWidgets('the loading place is the landed stack\'s height at ${scale}x, ${coaching ? 'first run' : 'returning'}', (tester) async {
          // Coaching without the demo (its hold is a timer a settle would stop in the middle of).
          DeckCoach.debugRun = coaching ? DeckCoachRun(demoShown: true, rightDone: true) : DeckCoachRun.taught();
          Future<double> heightOf(Widget child) async {
            await pumpMockmob(tester, Padding(padding: const EdgeInsets.all(16), child: Align(alignment: Alignment.topCenter, child: child)), size: const Size(412, 900), textScale: scale);
            await tester.pumpAndSettle();
            return tester.getSize(find.byWidget(child)).height;
          }

          final view = _view();
          final landed = await heightOf(SuggestedStack(cards: buildSuggestedDeck(view.choices, glance: view.glance), onChoose: (_) {}, onMore: () {}));
          final loading = await heightOf(const SuggestedStackSkeleton(delay: Duration.zero));
          expect(loading, closeTo(landed, 1), reason: 'the week under it barely moves when Today lands');
        });
      }
    }

    testWidgets('the buttons do what the swipes do; a tap on the card is Up next', (tester) async {
      final events = await _pump(tester);
      await _tap(tester, SuggestedStack.notNowKey);
      expect(_onTop(GlanceCopy.titleRevise), findsOneWidget);
      await tester.tap(_onTop(GlanceCopy.titleRevise));
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleRevise);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'Up next on the Suggested card is the way back');
      expect(events, isEmpty);
    });

    testWidgets('after every card the end card says today, offers every way to practise, and the row offers Undo and them again', (tester) async {
      final events = await _pump(tester);
      final n = _view().choices.length;
      for (var k = 0; k < n; k++) {
        await _tap(tester, SuggestedStack.notNowKey);
      }
      expect(find.byKey(SuggestedStack.topKey), findsNothing);
      expect(find.text(SuggestedCopy.allSeen(n)), findsOneWidget);
      expect(find.text(SuggestedCopy.endOurPick), findsOneWidget);
      expect(find.text(SuggestedCopy.noneLeft), findsOneWidget);
      expect(find.byKey(SuggestedStack.coachKey), findsNothing, reason: 'no card, no coach');
      expect(find.byKey(SuggestedStack.againKey), findsOneWidget);
      await tester.tap(find.text(SuggestedCopy.everyWay));
      await tester.pump();
      expect(events.whereType<TodayAction>().single.target, isA<OpenAlternatives>());
      await _tap(tester, SuggestedStack.undoKey);
      expect(find.byKey(SuggestedStack.topKey), findsOneWidget, reason: 'Undo at the end brings the last card back');
      await _tap(tester, SuggestedStack.notNowKey);
      await _tap(tester, SuggestedStack.againKey);
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget);
    });

    testWidgets('after a pick the end card says the student\'s pick is ready above', (tester) async {
      await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      final n = _view().choices.length.clamp(1, deckSize);
      for (var k = 0; k < n; k++) {
        await _tap(tester, SuggestedStack.notNowKey);
      }
      expect(find.text(SuggestedCopy.endYourPick), findsOneWidget);
    });

    testWidgets('with motion on, the chosen card flies into the lead card and the swap lands', (tester) async {
      DeckCoach.debugRun = DeckCoachRun.taught();
      final events = await _pump(tester, animate: true);
      await tester.tap(find.byKey(SuggestedStack.upNextKey));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      expect(find.text(SuggestedCopy.upNext), findsWidgets, reason: 'the flying card carries its stamp');
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      expect(_onTop(GlanceCopy.suggested), findsOneWidget);
      expect(events, isEmpty);
      expect(tester.takeException(), isNull);
    });

    testWidgets('with motion on, Not now tucks the card in behind and Undo slides it back', (tester) async {
      DeckCoach.debugRun = DeckCoachRun.taught();
      await _pump(tester, animate: true);
      await tester.tap(find.byKey(SuggestedStack.notNowKey));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(GlanceCopy.titleWeakest), findsWidgets, reason: 'the passed card is still seen tucking in');
      await tester.pumpAndSettle();
      expect(_onTop(GlanceCopy.titleRevise), findsOneWidget);
      await tester.tap(find.byKey(SuggestedStack.undoKey));
      await tester.pumpAndSettle();
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the demo: once the deck is still on screen the card performs right; any touch stops it at once, and it never runs again', (tester) async {
      await _pumpLive(tester);
      expect(await _until(tester, () => _stamp(SuggestedCopy.upNext).evaluate().isNotEmpty), isTrue, reason: 'the card shows right by itself');
      expect(_coach(tester), SuggestedCopy.coachRight);
      expect(_coachSaved()['demo'], isFalse, reason: 'not spent until both halves play or the student touches it');
      expect(tester.getSize(find.byKey(SuggestedStack.upNextKey)).width, greaterThan(0));
      // A touch anywhere on the stack (here, its intro line) stops it.
      final g = await tester.startGesture(tester.getCenter(find.text(SuggestedCopy.intro)));
      await tester.pump();
      await g.up();
      expect(_coachSaved()['demo'], isTrue, reason: 'the student\'s own touch spends it, once in the life of the phone');
      for (var k = 0; k < 30; k++) {
        await tester.pump(const Duration(milliseconds: 100));
        expect(_stamp(SuggestedCopy.notNow), findsNothing, reason: 'the left half never runs after the touch');
      }
      await tester.pumpAndSettle();
      expect(_stamp(SuggestedCopy.upNext), findsNothing, reason: 'the card sprang home');
      expect(_coach(tester), SuggestedCopy.coachIdle);
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'the touch did not commit anything');
    });

    testWidgets('a tap on the card mid-demo only stops it: no Up next, no bar, the card home (round 1, item 1)', (tester) async {
      final events = await _pumpLive(tester);
      expect(await _until(tester, () => _stamp(SuggestedCopy.upNext).evaluate().isNotEmpty), isTrue, reason: 'the card shows right by itself');
      // A first-timer's reflex: touch the card that started moving, at its centre.
      final g = await tester.startGesture(tester.getCenter(find.byKey(SuggestedStack.topKey)));
      await tester.pump();
      await g.up();
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'the lead did not change');
      expect(find.byKey(SuggestedStack.barKey), findsNothing, reason: 'no bar inside the tutorial');
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget, reason: 'the card is still on top');
      expect(tester.getTopLeft(find.byKey(SuggestedStack.topKey)).dx, closeTo(tester.getTopLeft(find.byKey(SuggestedStack.notNowKey)).dx, 24), reason: 'and home');
      expect(events, isEmpty);
      // The next tap is a tap again.
      await tester.tap(find.byKey(SuggestedStack.topKey));
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleWeakest, reason: 'once the demo is over, a tap on the card is Up next');
    });

    testWidgets('a route over Today mid-demo stops it without spending it; back on Today it plays again (round 1, item 3)', (tester) async {
      await _pumpLive(tester);
      expect(await _until(tester, () => _stamp(SuggestedCopy.upNext).evaluate().isNotEmpty), isTrue);
      final nav = Navigator.of(tester.element(find.byType(SuggestedStack)));
      unawaited(nav.push(MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('session')))));
      await tester.pumpAndSettle();
      expect(_coachSaved()['demo'], isFalse, reason: 'unseen, so not spent');
      nav.pop();
      await tester.pump();
      expect(await _until(tester, () => _stamp(SuggestedCopy.upNext).evaluate().isNotEmpty), isTrue, reason: 'it replays at the next still moment');
      expect(await _until(tester, () => _stamp(SuggestedCopy.notNow).evaluate().isNotEmpty), isTrue, reason: 'then left');
      for (var k = 0; k < 30; k++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.pumpAndSettle();
      expect(_coachSaved()['demo'], isTrue, reason: 'both halves played: spent');
    });

    testWidgets('the Up next bar leaves when a route covers Today (round 1, item 2)', (tester) async {
      await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(find.byKey(SuggestedStack.barKey), findsOneWidget);
      final nav = Navigator.of(tester.element(find.byType(SuggestedStack)));
      unawaited(nav.push(MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('session')))));
      await tester.pumpAndSettle();
      expect(find.byKey(SuggestedStack.barKey), findsNothing, reason: 'never over the session');
      nav.pop();
      await tester.pumpAndSettle();
      expect(find.byKey(SuggestedStack.barKey), findsNothing, reason: 'and it does not come back');
      expect(_heroTitle(tester), GlanceCopy.titleWeakest, reason: 'the pick stands; the row still offers Undo');
    });

    testWidgets('the Up next bar leaves when the student starts the lead card (round 1, item 2)', (tester) async {
      final events = await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(find.byKey(SuggestedStack.barKey), findsOneWidget);
      final start = find.descendant(of: find.byType(MoveHeroCard), matching: find.textContaining('Start')).first;
      await tester.tap(start, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(events, isNotEmpty, reason: 'the lead card started');
      expect(find.byKey(SuggestedStack.barKey), findsNothing, reason: 'the bar left with that tap');
    });

    testWidgets('once the student starts the pick, the Undo in the row no longer swaps it away (round 2, item 5)', (tester) async {
      await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      final start = find.descendant(of: find.byType(MoveHeroCard), matching: find.textContaining('Start')).first;
      await tester.tap(start, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel(SuggestedCopy.undoNone), findsOneWidget, reason: 'the row says there is nothing to undo');
      await tester.tap(find.byKey(SuggestedStack.undoKey));
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleWeakest, reason: 'the started pick stays the lead');
    });

    testWidgets('with a screen reader on, the Up next bar has no clock: its Undo waits for the student (round 2, item 4)', (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(accessibleNavigation: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(find.byKey(SuggestedStack.barKey), findsOneWidget);
      await tester.pump(deckBarHold + const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(find.byKey(SuggestedStack.barUndoKey), findsOneWidget, reason: 'still there long after 5 s');
      await tester.tap(find.byKey(SuggestedStack.barUndoKey));
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'and it still undoes');
    });

    testWidgets('without a screen reader the Up next bar leaves after its 5 s', (tester) async {
      await _pump(tester);
      await _tap(tester, SuggestedStack.upNextKey);
      expect(find.byKey(SuggestedStack.barKey), findsOneWidget);
      await tester.pump(deckBarHold + const Duration(milliseconds: 100));
      await tester.pumpAndSettle();
      expect(find.byKey(SuggestedStack.barKey), findsNothing);
    });

    testWidgets('Up next tapped before the demo begins: the demo never plays on the new top card (round 2, item 1)', (tester) async {
      await _pumpLive(tester);
      // A first-timer acts at once, inside the demo's 0.9 s wait.
      await tester.tap(find.byKey(SuggestedStack.upNextKey));
      await tester.pump();
      expect(_coachSaved()['demo'], isTrue, reason: 'using the deck taught the gesture');
      for (var k = 0; k < 30; k++) {
        await tester.pump(const Duration(milliseconds: 100));
        expect(_stamp(SuggestedCopy.upNext), findsNothing, reason: 'no "Do this next" stamp under the bar that says it is done');
      }
      await tester.pumpAndSettle();
      final home = tester.getTopLeft(find.byKey(SuggestedStack.topKey)).dx;
      for (var k = 0; k < 20; k++) {
        await tester.pump(const Duration(milliseconds: 100));
        expect(tester.getTopLeft(find.byKey(SuggestedStack.topKey)).dx, closeTo(home, 0.5), reason: 'the new top card never moves by itself');
      }
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
    });

    testWidgets('on a 360 dp phone the demo never moves the row: the coach line holds its tallest line, broken between sentences (round 2, item 3)', (tester) async {
      await _pumpLive(tester, size: const Size(360, 2400));
      await tester.pump(const Duration(milliseconds: 200));
      final rowAt = tester.getTopLeft(find.byKey(SuggestedStack.notNowKey)).dy;
      expect(await _until(tester, () => _stamp(SuggestedCopy.upNext).evaluate().isNotEmpty), isTrue);
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.getTopLeft(find.byKey(SuggestedStack.notNowKey)).dy, closeTo(rowAt, 0.5), reason: 'the row holds still while the card performs');
      final right = find.descendant(of: find.byKey(SuggestedStack.coachKey).last, matching: find.textContaining('Right:'));
      final shown = right.evaluate().where((e) => e.findAncestorWidgetOfExactType<Visibility>()?.visible ?? true).map((e) => (e.widget as Text).data).toList();
      expect(shown, ['Right: do this next.\nIt moves into the card above.'], reason: 'two clean lines, never "above." alone');
      expect(await _until(tester, () => _stamp(SuggestedCopy.notNow).evaluate().isNotEmpty), isTrue);
      expect(tester.getTopLeft(find.byKey(SuggestedStack.notNowKey)).dy, closeTo(rowAt, 0.5), reason: 'nor on the left half');
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });

    testWidgets('a drag that springs home before the demo begins also spends it (round 2, item 1)', (tester) async {
      await _pumpLive(tester);
      final g = await tester.startGesture(tester.getCenter(find.byKey(SuggestedStack.topKey)));
      await g.moveBy(const Offset(20, 0));
      await tester.pump();
      await g.moveBy(const Offset(20, 0));
      await tester.pump();
      await g.up();
      expect(_coachSaved()['demo'], isTrue);
      // The card springs home (its own drag stamp fades with it); from then on nothing moves.
      await tester.pumpAndSettle();
      for (var k = 0; k < 30; k++) {
        await tester.pump(const Duration(milliseconds: 100));
        expect(_stamp(SuggestedCopy.upNext), findsNothing);
        expect(_stamp(SuggestedCopy.notNow), findsNothing);
      }
      await tester.pumpAndSettle();
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'the short drag committed nothing');
    });

    testWidgets('Today in an offstage tab is not "seen": no visit counted, no demo (round 1, item 3)', (tester) async {
      await pumpMockmob(
        tester,
        TickerMode(
          enabled: false,
          child: TodayBody(view: _view(), skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
        ),
        size: const Size(412, 2400),
        overrides: _overrides,
      );
      await tester.pump(const Duration(seconds: 3));
      expect(_coachStore.values[DeckCoach.key], isNull, reason: 'nothing counted or spent while off screen');
      expect(_stamp(SuggestedCopy.upNext), findsNothing);
    });

    testWidgets('the demo runs right then left when nothing touches it, and starts nothing', (tester) async {
      final events = await _pumpLive(tester);
      expect(await _until(tester, () => _stamp(SuggestedCopy.upNext).evaluate().isNotEmpty), isTrue);
      expect(await _until(tester, () => _stamp(SuggestedCopy.notNow).evaluate().isNotEmpty), isTrue, reason: 'then left');
      expect(_coach(tester), SuggestedCopy.coachLeft);
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(_coach(tester), SuggestedCopy.coachIdle);
      expect(_heroTitle(tester), GlanceCopy.titleRepair, reason: 'the demo never commits');
      expect(_onTop(GlanceCopy.titleWeakest), findsOneWidget);
      expect(events, isEmpty);
    });

    testWidgets('a second visit that never swiped gets one silent nudge, never the demo', (tester) async {
      DeckCoach.debugRun = DeckCoachRun(demoShown: true, visits: 1);
      await _pump(tester, animate: true);
      await tester.pump(const Duration(milliseconds: 1200));
      expect(_stamp(SuggestedCopy.upNext), findsNothing, reason: 'a nudge carries no stamp');
      expect(_coach(tester), isNot(SuggestedCopy.coachRight), reason: 'and no words');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('every card of the pass is one height, the evidence at its foot; nothing under the deck moves on a pass', (tester) async {
      DeckCoach.debugRun = DeckCoachRun.taught();
      await _pump(tester);
      final view = _view();
      final deck = buildSuggestedDeck(view.choices, glance: view.glance);
      double bottom() => tester.getRect(find.byType(SuggestedStack)).bottom;
      final height = tester.getSize(find.byKey(SuggestedStack.topKey)).height;
      final bottomAt = bottom();
      for (var k = 0; k < deck.length; k++) {
        final card = deck[k];
        final top = tester.getRect(find.byKey(SuggestedStack.topKey));
        expect(top.height, closeTo(height, 0.5), reason: '${card.title}: one height for the pass');
        final line = tester.getRect(_onTop(card.line));
        expect(top.bottom - line.bottom, closeTo(18, 2), reason: '${card.title}: the evidence sits on the foot');
        expect(bottom(), closeTo(bottomAt, 0.5), reason: '${card.title}: nothing under the deck moved');
        if (k < deck.length - 1) {
          final g = await _hold(tester, -90);
          expect(bottom(), closeTo(bottomAt, 0.5), reason: 'mid-drag the stack stays still');
          await g.moveBy(const Offset(90, 0));
          await g.up();
          await tester.pumpAndSettle();
          await _tap(tester, SuggestedStack.notNowKey);
        }
      }
    });

    testWidgets('cards already passed on leave the deck: the last card has nothing behind it', (tester) async {
      await _pump(tester);
      final n = _view().choices.length;
      for (var k = 0; k < n - 1; k++) {
        await _tap(tester, SuggestedStack.notNowKey);
      }
      expect(find.text(SuggestedCopy.moreAfter(0, n)), findsOneWidget);
      final last = buildSuggestedDeck(_view().choices, glance: _view().glance).last;
      expect(find.text(last.title), findsOneWidget, reason: 'no card peeks behind the last one');
    });

    testWidgets('Up next with the lead card scrolled away brings it back into view', (tester) async {
      await _pump(tester, size: const Size(412, 915));
      final stack = tester.getRect(find.byKey(SuggestedStack.topKey));
      await tester.drag(find.text(SuggestedCopy.title), Offset(0, -(stack.top - 120)));
      await tester.pumpAndSettle();
      expect(tester.getRect(find.byType(MoveHeroCard)).top, lessThan(0), reason: 'the lead card\'s top is scrolled away');
      await _tap(tester, SuggestedStack.upNextKey);
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      expect(tester.getRect(find.byType(MoveHeroCard)).top, greaterThanOrEqualTo(0), reason: 'the swap is made in sight');
    });

    testWidgets('Up next from far down the page, where the list let the lead card go, still lands the student on it', (tester) async {
      await _pump(tester, size: const Size(412, 915));
      await tester.ensureVisible(find.byKey(SuggestedStack.upNextKey));
      await tester.pumpAndSettle();
      expect(find.byType(MoveHeroCard), findsNothing, reason: 'the lead card is out of the lazy list');
      await _tap(tester, SuggestedStack.upNextKey);
      expect(_heroTitle(tester), GlanceCopy.titleWeakest);
      expect(tester.getRect(find.byType(MoveHeroCard)).top, greaterThanOrEqualTo(0), reason: 'the swap is made in sight');
    });

    testWidgets('a screen reader hears the top card with its two actions, and three buttons that say what they do', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester);
      final n = _view().choices.length;
      final weakest = buildSuggestedDeck(_view().choices, glance: _view().glance).first;
      final label = SuggestedCopy.cardSemantics(1, n, weakest.cost, weakest.title, weakest.line, suggested: false);
      expect(label, startsWith('Card 1 of $n. Practise your weakest chapter.'));
      final card = find.bySemanticsLabel(label);
      expect(card, findsOneWidget);
      final data = tester.getSemantics(card).getSemanticsData();
      expect(data.customSemanticsActionIds, hasLength(2), reason: 'Up next and Not now act from the card');
      expect(find.bySemanticsLabel(SuggestedCopy.upNextSemantics(GlanceCopy.titleWeakest)), findsOneWidget);
      expect(find.bySemanticsLabel(SuggestedCopy.notNowSemantics(GlanceCopy.titleWeakest)), findsOneWidget);
      expect(find.bySemanticsLabel(SuggestedCopy.undoNone), findsOneWidget);
      expect(find.bySemanticsLabel(SuggestedCopy.upNextSemantics(GlanceCopy.titleRevise)), findsNothing, reason: 'not the cards behind');
      await _tap(tester, SuggestedStack.notNowKey);
      expect(find.bySemanticsLabel(SuggestedCopy.undoSemantics(GlanceCopy.titleWeakest)), findsOneWidget);
      handle.dispose();
    });

    testWidgets('a screen reader\'s Not now action on the card passes it on', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester);
      final n = _view().choices.length;
      final weakest = buildSuggestedDeck(_view().choices, glance: _view().glance).first;
      final node = tester.getSemantics(find.bySemanticsLabel(SuggestedCopy.cardSemantics(1, n, weakest.cost, weakest.title, weakest.line, suggested: false)));
      final notNow = CustomSemanticsAction.getIdentifier(const CustomSemanticsAction(label: SuggestedCopy.notNow));
      node.owner!.performAction(node.id, SemanticsAction.customAction, notNow);
      await tester.pumpAndSettle();
      expect(_onTop(GlanceCopy.titleRevise), findsOneWidget);
      handle.dispose();
    });

    for (final (size, scale) in [(const Size(360, 800), 1.3), (const Size(412, 915), 1.3), (const Size(360, 800), 1.0)]) {
      testWidgets('at ${scale}x text on ${size.width.toInt()} dp the row keeps one line', (tester) async {
        await pumpMockmob(
          tester,
          TodayBody(view: _view(), skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
          size: Size(size.width, 2600),
          textScale: scale,
          disableAnimations: true,
          overrides: _overrides,
        );
        await tester.pumpAndSettle();
        final no = tester.getRect(find.byKey(SuggestedStack.notNowKey));
        final up = tester.getRect(find.byKey(SuggestedStack.upNextKey));
        final undo = tester.getRect(find.byKey(SuggestedStack.undoKey));
        expect(no.center.dy, closeTo(up.center.dy, 0.5));
        expect(undo.center.dy, closeTo(up.center.dy, 0.5));
        expect(no.right, lessThanOrEqualTo(undo.left + 0.5));
        expect(undo.right, lessThanOrEqualTo(up.left + 0.5));
        for (final words in [SuggestedCopy.notNow, SuggestedCopy.upNext]) {
          final text = tester.renderObject<RenderParagraph>(find.descendant(of: find.byKey(words == SuggestedCopy.notNow ? SuggestedStack.notNowKey : SuggestedStack.upNextKey), matching: find.text(words)));
          expect(text.didExceedMaxLines, isFalse, reason: '"$words" is whole, never cut with an ellipsis');
        }
        // Undo keeps its word whenever the row can hold it: the outer icons go first (round 2, item 2).
        final undoWord = find.descendant(of: find.byKey(SuggestedStack.undoKey), matching: find.text(SuggestedCopy.undo));
        expect(undoWord, scale == 1.0 ? findsOneWidget : anything, reason: 'Undo is a word, not a bare glyph, at ${size.width.toInt()} dp and 1.0x');
        if (size.width >= 412) expect(undoWord, findsOneWidget, reason: '412 dp holds every word at 1.3x');
        expect(tester.takeException(), isNull);
      });
    }
  });
}

class _FailingStore extends MemoryPrefsStore {
  @override
  Future<String?> getString(String key) => Future.error(StateError('no store'));
}
