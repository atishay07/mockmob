import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/copy.dart' show PracticeCopy;
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show settleImages;
import '../../unit/practice/support/harness.dart';

/// Per-question prices (owner, 18 Oct, D65): the setup sheet at the lengths a student picks, at the two phones the owner
/// and the Play review use (360 and 412 wide), Night and Day. The ticket's Cost row is the quote for the length chosen;
/// while a new length is quoted the row says it is checking and the old price is not left beside the new length.

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/practice'),
];

const _sizes = <(String, Size)>[('360', Size(360, 800)), ('412', Size(412, 915))];

PracticeQuote _perQuestion(int count, {int balance = 100}) => creditsQuote(cost: count, balance: balance, count: count);

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 350));
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
  await settleImages(tester);
}

Future<void> _shot(WidgetTester tester, String name, Brightness b) {
  final tag = b == Brightness.dark ? 'night' : 'day';
  return expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_$tag.png'));
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final (label, size) in _sizes) {
      group('per-question price, $label, ${b.name}', () {
        testWidgets('15 questions, 15 credits', (tester) async {
          final quotes = FakeQuoteRepository((s, m, c, p) => _perQuestion(c ?? 10));
          await pumpRouted(
            tester,
            location: '/practice/setup/quick?subject=accountancy&count=15',
            routes: _routes(),
            brightness: b,
            size: size,
            overrides: practiceOverrides(quotes: quotes),
          );
          await _settle(tester);
          expect(find.text('15 credits. You have 100.'), findsOneWidget);
          await _shot(tester, 'perq_15_credits_$label', b);
        });

        testWidgets('a new length being quoted: the cost row says checking', (tester) async {
          final gate = Completer<PracticeQuote>();
          final quotes = FakeQuoteRepository((s, m, c, p) => c == 20 ? gate.future : _perQuestion(c ?? 10));
          await pumpRouted(
            tester,
            location: '/practice/setup/quick?subject=accountancy&count=15',
            routes: _routes(),
            brightness: b,
            size: size,
            overrides: practiceOverrides(quotes: quotes),
          );
          await _settle(tester);
          await tester.tap(find.text('20'));
          await tester.pump(const Duration(milliseconds: 350));
          await tester.pump(const Duration(milliseconds: 500));
          expect(find.text(PracticeCopy.costChecking), findsOneWidget);
          await _shot(tester, 'perq_checking_$label', b);
          gate.complete(_perQuestion(20));
          await _settle(tester);
        });

        testWidgets('credits short for 15: its own price and the way to a shorter set', (tester) async {
          final quotes = FakeQuoteRepository((s, m, c, p) => c == 10 ? dailyFree() : lowCredits(cost: c ?? 10, balance: 8, count: c ?? 10));
          await pumpRouted(
            tester,
            location: '/practice/setup/quick?subject=accountancy&count=15',
            routes: _routes(),
            brightness: b,
            size: size,
            overrides: practiceOverrides(quotes: quotes),
          );
          await _settle(tester);
          expect(find.text('You have 8 credits, and this takes 15. A shorter set takes fewer.'), findsOneWidget);
          await _shot(tester, 'perq_low_$label', b);
        });
      });
    }
  }
}
