// "Suggested for you", swipe v2 (SWIPE-V2-1018, D90): the deck that teaches itself. Each frame of
// the first run (fr1 rest, fr2 and fr3 the demo held at its peak, fr4 and fr6 the student's drag
// at the threshold, fr5 Up next with its bar, fr7 Not now with its line), the reduced-motion first
// run, a returning visit, the last card, the end of the pass, loading and offline. Night and Day,
// at 412 x 915 and 360 x 800, and 1.3x text. Judged against
// tmp/design-1018/swipe-v2/shots/{fr1..fr7,st-*}-{night,day}.png. Each image was opened and looked at.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart' show MmDragSide;
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import 'today_1018_golden_test.dart' show activeInputs, activeView, fixturePrices;
import 'today_golden_support.dart';

const Size _phone = Size(412, 915);
const Size _small = Size(360, 800);

/// Where the stack sits under the lead card on the first screen once the page has scrolled: the
/// lead card's key above the deck, the row and the week's heading under it (the mock's framing).
const double _toStack = 400;

Finder _onTop(String text) => find.descendant(of: find.byKey(SuggestedStack.topKey), matching: find.text(text));

/// Holds the top card dragged by [dx], past the threshold (the finger stays down).
Future<void> _hold(WidgetTester tester, double dx) async {
  final at = tester.getCenter(_onTop(GlanceCopy.titleWeakest));
  final g = await tester.startGesture(at);
  await g.moveBy(Offset(dx.sign * 14, 0));
  await tester.pump();
  await g.moveBy(Offset(dx - dx.sign * 14, 0));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

Future<void> _tap(WidgetTester tester, Key key) async {
  await tester.tap(find.byKey(key));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

/// Passes on every card, or all but the last [leave].
Future<void> _passAll(WidgetTester tester, {int leave = 0}) async {
  final n = activeView().choices.length.clamp(1, deckSize);
  for (var k = 0; k < n - leave; k++) {
    await _tap(tester, SuggestedStack.notNowKey);
  }
}

/// A first run, pinned: a fresh phone, the coach drawn as with motion on.
void _firstRun() {
  DeckCoach.debugRun = DeckCoachRun.fresh();
  SuggestedStack.debugCoachMotion = true;
}

void main() {
  setUp(() {
    debugResetTodayPicks();
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.debugRun = DeckCoachRun.taught();
  });
  tearDown(() {
    DeckCoach.debugReset();
    SuggestedStack.debugReset();
  });

  group('first run', () {
    setUp(_firstRun);
    // fr1: the intro line, "4 cards", the coach line, the row with Undo at 38%.
    todayGolden('today_suggested_fr1', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices);
    todayGolden('today_suggested_fr1_360', activeView, size: _small, scrollTo: _toStack, prices: fixturePrices);
    todayGolden('today_suggested_fr1_text130', activeView, size: _phone, scrollTo: _toStack + 180, textScale: 1.3, prices: fixturePrices);
    todayGolden('today_suggested_fr1_360_text130', activeView, size: _small, scrollTo: _toStack + 200, textScale: 1.3, prices: fixturePrices);
    // fr4 and fr6: the student's drag past the threshold, the accent edge, the button lit, "Let go".
    todayGolden('today_suggested_fr4', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _hold(t, 150));
    todayGolden('today_suggested_fr4_360', activeView, size: _small, scrollTo: _toStack, prices: fixturePrices, act: (t) => _hold(t, 130));
    todayGolden('today_suggested_fr6', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _hold(t, -150));
    // fr5: Up next. The page followed the card up; the lead card took it; the glass bar offers Undo.
    todayGolden('today_suggested_fr5', activeView, size: _phone, prices: fixturePrices, act: (t) async {
      await t.ensureVisible(find.byKey(SuggestedStack.upNextKey));
      await t.pump();
      await _tap(t, SuggestedStack.upNextKey);
    });
    todayGolden('today_suggested_fr5_360_text130', activeView, size: _small, textScale: 1.3, prices: fixturePrices, act: (t) async {
      // The deck sits under the fold at 1.3x on a small phone: the list builds it once it is scrolled near.
      await t.scrollUntilVisible(find.byKey(SuggestedStack.upNextKey), 200, scrollable: find.byType(Scrollable).first);
      await t.ensureVisible(find.byKey(SuggestedStack.upNextKey));
      await t.pump();
      await _tap(t, SuggestedStack.upNextKey);
    });
    // fr7: Not now. The next card on top, "2 more after this", Undo lit, the learning line.
    todayGolden('today_suggested_fr7', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _tap(t, SuggestedStack.notNowKey));
    todayGolden('today_suggested_fr7_360', activeView, size: _small, scrollTo: _toStack, prices: fixturePrices, act: (t) => _tap(t, SuggestedStack.notNowKey));
  });

  group('the demo held at its peak', () {
    setUp(_firstRun);
    // fr2: the card performs right: the Up next stamp, the button lit, the coach line with its chip.
    group('right', () {
      setUp(() => SuggestedStack.debugDemoPeak = MmDragSide.right);
      todayGolden('today_suggested_fr2', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices);
      todayGolden('today_suggested_fr2_360', activeView, size: _small, scrollTo: _toStack, prices: fixturePrices);
    });
    // fr3: the card performs left: the Not now stamp, Not now lit.
    group('left', () {
      setUp(() => SuggestedStack.debugDemoPeak = MmDragSide.left);
      todayGolden('today_suggested_fr3', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices);
    });
  });

  group('reduced motion first run', () {
    // No demo: the coach line shows both meanings at once, each with its chip.
    setUp(() => DeckCoach.debugRun = DeckCoachRun.fresh());
    todayGolden('today_suggested_fr1_reduced', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices);
  });

  // A returning visit: the heading and the count, the card, the row; no intro, no coach line.
  todayGolden('today_suggested_returning', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices);
  todayGolden('today_suggested_returning_360', activeView, size: _small, scrollTo: _toStack, prices: fixturePrices);
  todayGolden('today_suggested_returning_text130', activeView, size: _phone, scrollTo: _toStack + 160, textScale: 1.3, prices: fixturePrices);
  todayGolden('today_suggested_returning_360_text130', activeView, size: _small, scrollTo: _toStack + 180, textScale: 1.3, prices: fixturePrices);

  // The last card of the pass: the cards already passed on have left, so nothing peeks behind it.
  todayGolden('today_suggested_last', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _passAll(t, leave: 1));

  // Every card passed on once: the dashed end card ("That's all four for today"), Undo and Go
  // through them again.
  todayGolden('today_suggested_end', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: _passAll);
  todayGolden('today_suggested_end_360_text130', activeView, size: _small, scrollTo: _toStack + 180, textScale: 1.3, prices: fixturePrices, act: _passAll);

  // Loading: the skeleton holds the heading, the card with its peek bands, and the row.
  todayGolden('today_suggested_loading', () => buildToday(TodayInputs(now: DateTime.utc(2026, 10, 18, 14, 10), firstName: 'Asha', weekLoading: true)), size: _phone, scrollTo: _toStack);

  // Offline: the deck works unchanged (picks, passes and Undo are all local).
  todayGolden('today_suggested_offline', () => buildToday(activeInputs(offline: true)), size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _tap(t, SuggestedStack.notNowKey));
}
