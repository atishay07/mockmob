import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/launch_flow.dart';
import 'package:mockmob/features/practice/model/cost_line.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import 'support/harness.dart';

// Owner, 18 Oct 4 pm (D65): "5, 10, 15, 20, like as many questions, that many credits." A Free student's Quick practice costs a
// credit a question, a 50-question full mock stays 50, Pro stays included. The server's quote for the chosen count is the only
// source of every figure the app shows; nothing is read from the count.

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/practice'),
];

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 350));
  await tester.pump(const Duration(milliseconds: 400));
}

/// A Free student's quote under per-question pricing: [count] questions cost [count] credits.
PracticeQuote perQuestion(int count, {int balance = 100}) => creditsQuote(cost: count, balance: balance, count: count);

/// Pro: practice is included, the balance is null and the cost is zero.
PracticeQuote proQuote(int count) => quoteOf(cost: 0, balance: null, entitlement: 'access', count: count, durationSec: count * 60);

void main() {
  setUpAll(loadAppFonts);

  group('the cost line of every length comes from that length\'s quote', () {
    for (final n in practiceCounts) {
      test('$n questions: $n credits', () {
        final line = costLineFor(perQuestion(n));
        expect(line.kind, CostKind.credits);
        expect(line.text, '$n credits. You have 100.');
      });
    }

    test('one question of credit is singular', () {
      expect(costLineFor(creditsQuote(cost: 1, balance: 1, count: 5)).text, '1 credit. You have 1.');
    });

    test('a full mock stays 50', () {
      final line = costLineFor(creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50));
      expect(line.text, '50 credits. You have 120.');
    });

    test('Pro has no price line, whatever the length', () {
      for (final n in practiceCounts) {
        expect(costLineFor(proQuote(n)).kind, CostKind.none, reason: '$n questions on Pro');
      }
    });

    test('today\'s included set is free, and a longer set beside it is not', () {
      final daily = dailyFree();
      expect(costLineFor(daily).text, PracticeCopy.freeToday);
      // The same day, 15 questions: the quote carries no allowance, so it is the ordinary 15.
      expect(costLineFor(perQuestion(15)).text, '15 credits. You have 100.');
      // A used allowance falls back to the cost of that length.
      final used = quoteOf(cost: 10, allowance: {'kind': 'daily_practice', 'state': 'used'}, count: 10);
      expect(costLineFor(used).text, '10 credits. You have 100.');
    });

    test('a free first set stays free at its own length', () {
      final first = quoteOf(cost: 0, allowance: {'kind': 'baseline:accountancy', 'state': 'available'}, count: 10);
      expect(costLineFor(first).text, PracticeCopy.freeFirstIn('Accountancy'));
    });

    test('an unknown cost on a quote that is not free is not a number', () {
      // Nothing in the cost line is invented: with no creditCost and the balance known there is no figure to print.
      final line = costLineFor(quoteOf(balance: 100, count: 15));
      expect(line.text, isNull);
    });
  });

  group('credits low, per length', () {
    test('a longer set says a shorter one takes fewer', () {
      final low = creditsLowFor(lowCredits(cost: 15, balance: 8, count: 15))!;
      expect(low.message(PracticeMode.quick), 'You have 8 credits, and this takes 15. A shorter set takes fewer.');
      expect(low.message(PracticeMode.chapter), low.message(PracticeMode.quick));
    });

    test('the shortest set gives no advice to shorten it', () {
      final low = creditsLowFor(lowCredits(cost: 5, balance: 3, count: 5))!;
      expect(low.message(PracticeMode.quick), 'You have 3 credits, and this takes 5.');
    });

    test('smart practice starts at 10, so only a longer one can be shortened', () {
      expect(creditsLowFor(lowCredits(cost: 10, balance: 3, count: 10))!.message(PracticeMode.smart), 'You have 3 credits, and this takes 10.');
      expect(
        creditsLowFor(lowCredits(cost: 20, balance: 3, count: 20))!.message(PracticeMode.smart),
        'You have 3 credits, and this takes 20. A shorter set takes fewer.',
      );
    });

    test('a full mock keeps its own sentence', () {
      final low = creditsLowFor(lowCredits(cost: 50, balance: 8, count: 50))!;
      expect(low.message(PracticeMode.full), 'You have 8 credits, and a Full mock takes 50.');
    });

    test('the dead Start key names what that length needs', () {
      expect(PracticeCopy.creditsNeeded(15, 8), 'Needs 15 credits. You have 8.');
    });
  });

  group('the quote shown against the fresh one', () {
    test('only a dearer fresh quote counts as a change at the same length', () {
      expect(costWentUp(perQuestion(10), perQuestion(10)), isFalse);
      expect(costWentUp(perQuestion(10), creditsQuote(cost: 12, balance: 100, count: 10)), isTrue);
      expect(costWentUp(dailyFree(), perQuestion(10)), isTrue);
    });

    test('a quote for another length is not the quote for this one', () {
      final fifteen = PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 15);
      expect(quoteIsForOtherCount(perQuestion(5), fifteen), isTrue);
      expect(quoteIsForOtherCount(perQuestion(15), fifteen), isFalse);
      // A quote that does not state its count cannot be shown wrong.
      expect(quoteIsForOtherCount(PracticeQuote.fromJson({'launchable': true}), fifteen), isFalse);
      // A mock is always 50.
      final mock = PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy');
      expect(quoteIsForOtherCount(creditsQuote(cost: 50, mode: 'full', count: 50), mock), isFalse);
    });

    test('the effective cost is zero under an allowance and the quoted figure otherwise', () {
      expect(effectiveCreditCost(dailyFree()), 0);
      expect(effectiveCreditCost(perQuestion(20)), 20);
      expect(effectiveCreditCost(proQuote(20)), 0);
    });

    Future<LaunchResult> launch(
      WidgetTester tester, {
      required PracticeSelection selection,
      required PracticeQuote shown,
      required FakeQuoteRepository quotes,
      required FakeStarter starter,
    }) async {
      late WidgetRef captured;
      await pumpRouted(
        tester,
        location: '/x',
        routes: [
          GoRoute(
            path: '/x',
            builder: (c, s) => Consumer(
              builder: (context, ref, _) {
                captured = ref;
                return const SizedBox();
              },
            ),
          ),
        ],
        overrides: practiceOverrides(quotes: quotes, starter: starter),
      );
      late LaunchResult result;
      await tester.runAsync(() async {
        result = await launchPractice(captured, selection, shown);
      });
      return result;
    }

    testWidgets('a quote shown for 5 is never launched as 15: the fresh price is shown again, nothing starts', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => perQuestion(c ?? 10));
      final starter = FakeStarter();
      final result = await launch(
        tester,
        selection: PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 15),
        shown: perQuestion(5),
        quotes: quotes,
        starter: starter,
      );
      expect(result, isA<LaunchNeedsLook>());
      expect((result as LaunchNeedsLook).costChanged, isTrue);
      expect(result.quote.creditCost, 15);
      expect(quotes.calls.single.count, 15, reason: 'the fresh quote is for the length being started');
      expect(starter.started, isEmpty, reason: 'nothing was started or charged');
    });

    testWidgets('a quote shown for the same length and still fresh launches without asking again', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => perQuestion(c ?? 10));
      final starter = FakeStarter();
      final result = await launch(
        tester,
        selection: PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 15),
        shown: perQuestion(15),
        quotes: quotes,
        starter: starter,
      );
      expect(result, isA<LaunchStarted>());
      expect(quotes.calls, isEmpty);
      expect(starter.started.single.effectiveCount, 15);
    });

    testWidgets('a quote shown for another length that comes back the same price starts at the length chosen', (tester) async {
      // 10 shown as free today, 5 chosen and the server quotes 5 free as well: nothing changed for the student.
      final quotes = FakeQuoteRepository((s, m, c, p) => dailyFree(count: c ?? 10));
      final starter = FakeStarter();
      final result = await launch(
        tester,
        selection: PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 5),
        shown: dailyFree(),
        quotes: quotes,
        starter: starter,
      );
      expect(result, isA<LaunchStarted>());
      expect(quotes.calls.single.count, 5);
      expect(starter.started.single.effectiveCount, 5);
    });
  });

  group('the setup sheet shows the price of the length chosen', () {
    Finder text(String s) => find.text(s);

    for (final n in practiceCounts) {
      testWidgets('$n questions: the Cost row is that length\'s quote', (tester) async {
        final quotes = FakeQuoteRepository((s, m, c, p) => perQuestion(c ?? 10));
        await pumpRouted(
          tester,
          location: '/practice/setup/quick?subject=accountancy&count=$n',
          routes: _routes(),
          overrides: practiceOverrides(quotes: quotes),
        );
        await _settle(tester);
        expect(quotes.calls.last.count, n);
        expect(text('$n credits. You have 100.'), findsOneWidget);
        expect(find.textContaining('$n questions'), findsWidgets);
      });
    }

    testWidgets('tapping another length moves the figure with it, and never shows the old one beside the new length', (tester) async {
      final gate = Completer<PracticeQuote>();
      var held = false;
      final quotes = FakeQuoteRepository((s, m, c, p) {
        if (c == 20 && held) return gate.future;
        return perQuestion(c ?? 10);
      });
      await pumpRouted(
        tester,
        location: '/practice/setup/quick?subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: quotes),
      );
      await _settle(tester);
      expect(text('10 credits. You have 100.'), findsOneWidget);

      await tester.tap(text('15'));
      await _settle(tester);
      expect(quotes.calls.last.count, 15);
      expect(text('15 credits. You have 100.'), findsOneWidget);
      expect(text('10 credits. You have 100.'), findsNothing);

      // The next quote is slow: the old price is not left standing beside the new length.
      held = true;
      await tester.tap(text('20'));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump(const Duration(milliseconds: 100));
      expect(text('15 credits. You have 100.'), findsNothing, reason: 'the 15 price is not the 20 price');
      expect(text('20 credits. You have 100.'), findsNothing);
      expect(text(PracticeCopy.costChecking), findsOneWidget);
      expect(find.textContaining('20 questions'), findsWidgets);
      expect(text(PracticeCopy.checkingCost), findsWidgets, reason: 'Start says why it waits');

      gate.complete(perQuestion(20));
      await _settle(tester);
      expect(text('20 credits. You have 100.'), findsOneWidget);
      expect(text(PracticeCopy.costChecking), findsNothing);
    });

    testWidgets('Pro: every length is included, with no credits and no balance', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => proQuote(c ?? 10));
      await pumpRouted(
        tester,
        location: '/practice/setup/quick?subject=accountancy&count=15',
        routes: _routes(),
        overrides: practiceOverrides(quotes: quotes),
      );
      await _settle(tester);
      expect(text(PracticeCopy.costIncluded), findsOneWidget);
      expect(find.textContaining('credit'), findsNothing);
    });

    testWidgets('today\'s included set is free and the longer one beside it shows its credits', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => c == 10 ? dailyFree() : perQuestion(c ?? 10));
      await pumpRouted(
        tester,
        location: '/practice/setup/quick?subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: quotes),
      );
      await _settle(tester);
      expect(text(PracticeCopy.freeToday), findsOneWidget);
      await tester.tap(text('15'));
      await _settle(tester);
      expect(text(PracticeCopy.freeToday), findsNothing);
      expect(text('15 credits. You have 100.'), findsOneWidget);
    });

    testWidgets('credits short for 15: its own cost, a way to a shorter set and the free ones', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) {
        if (c == 10) return dailyFree();
        return lowCredits(cost: c ?? 10, balance: 8, count: c ?? 10);
      });
      await pumpRouted(
        tester,
        location: '/practice/setup/quick?subject=accountancy&count=15',
        routes: _routes(),
        overrides: practiceOverrides(quotes: quotes),
      );
      await _settle(tester);
      expect(text('You have 8 credits, and this takes 15. A shorter set takes fewer.'), findsOneWidget);
      expect(text('Needs 15 credits. You have 8.'), findsOneWidget);
      expect(text(PracticeCopy.freeDaily), findsOneWidget);
    });

    testWidgets('a full mock is 50, and is not read from the quick count', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50));
      await pumpRouted(
        tester,
        location: '/practice/setup/full?subject=accountancy',
        routes: _routes(),
        overrides: practiceOverrides(quotes: quotes, catalog: FakeCatalog(mocks: 6)),
      );
      await _settle(tester);
      expect(quotes.calls.last.count, 50);
      expect(text('50 credits. You have 120.'), findsOneWidget);
    });
  });
}
