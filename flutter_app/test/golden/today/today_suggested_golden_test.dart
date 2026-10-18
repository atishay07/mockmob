// "Suggested for you" (D51, TODAY-SWIPE-1018): the card stack under the lead card at rest, held
// mid-swipe right ("Do this instead") and left ("Skip"), at the end of the deck, and after a card
// was chosen (the lead swapped, the old move back in the deck as Suggested). Night and Day, at
// 412 x 915 and 360 x 800, and 1.3x text. Judged against tmp/design-1018/v15-feedback/shots/d51-*.
// Each image was opened and looked at.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import 'today_1018_golden_test.dart' show activeView, fixturePrices;
import 'today_golden_support.dart';

const Size _phone = Size(412, 915);
const Size _small = Size(360, 800);

/// Where the stack sits under the lead card on the first screen once the page has scrolled.
const double _toStack = 420;

Finder _onTop(String text) => find.descendant(of: find.byKey(SuggestedStack.topKey), matching: find.text(text));

Future<void> _hold(WidgetTester tester, double dx) async {
  final at = tester.getCenter(_onTop(SuggestedCopy.titleRevise));
  final g = await tester.startGesture(at);
  await g.moveBy(Offset(dx.sign * 14, 0));
  await tester.pump();
  await g.moveBy(Offset(dx - dx.sign * 14, 0));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

Future<void> _skipAll(WidgetTester tester) async {
  for (var k = 0; k < 4; k++) {
    final skip = _onTop(SuggestedCopy.skip);
    if (skip.evaluate().isEmpty) break;
    await tester.tap(skip);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }
}

Future<void> _doThis(WidgetTester tester) async {
  await tester.tap(_onTop(SuggestedCopy.doThis));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUp(() {
    debugResetTodayPicks();
    SuggestedHint.debugReset();
    SuggestedHint.debugShow = true;
  });
  tearDown(SuggestedHint.debugReset);

  // At rest (d51-stack-rest): the first card on top, two behind, the count, the dots, the hint.
  todayGolden('today_suggested_rest', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices);
  todayGolden('today_suggested_rest_360', activeView, size: _small, scrollTo: _toStack, prices: fixturePrices);
  todayGolden('today_suggested_rest_text130', activeView, size: _phone, scrollTo: _toStack + 160, textScale: 1.3, prices: fixturePrices);
  todayGolden('today_suggested_rest_360_text130', activeView, size: _small, scrollTo: _toStack + 160, textScale: 1.3, prices: fixturePrices);

  // Held past the threshold: right stamps "Do this instead", left stamps "Skip".
  todayGolden('today_suggested_right', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _hold(t, 150));
  todayGolden('today_suggested_left', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: (t) => _hold(t, -150));

  // Every card skipped once: the dashed end card with Mobi thinking.
  todayGolden('today_suggested_end', activeView, size: _phone, scrollTo: _toStack, prices: fixturePrices, act: _skipAll);

  // Do this instead: the lead card swaps to Revise; the repair comes back on top marked Suggested.
  todayGolden('today_suggested_chosen', activeView, size: const Size(412, 1300), dock: false, prices: fixturePrices, act: _doThis);
}
