// The final walk's "How many questions?" sheet listed 5, 10, 15, 20 and the full mock with no price on any
// row (47-length); the price showed only on the card after a pick. Each row now says what it costs, from its
// own quote when the server has answered and from the per-question rule (owner D65) until then; Pro reads
// "Included"; a row the student cannot afford says so on the row.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/quote_repository.dart' show quoteRepositoryProvider;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/credits/data/length_cost.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart' show QuoteQuery;
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/length_pill.dart';

import '../practice/support/harness.dart' show FakeQuoteRepository, creditsQuote, dailyFree, lowCredits, quoteOf;

const _base = QuoteQuery(subject: 'accountancy', apiMode: 'quick', count: 10);

const _rows = [
  DurationChoice(minutes: 5, questions: 5),
  DurationChoice(minutes: 10, questions: 10),
  DurationChoice(minutes: 15, questions: 15),
  DurationChoice(minutes: 20, questions: 20),
  DurationChoice.fullMock(questions: 50),
];

void main() {
  group('the price of a row', () {
    test('before a quote answers: a credit a question, the full mock 50', () {
      expect(lengthCostFor(questions: 5, fullMock: false, isPro: false, balance: 390), const LengthCost('5 credits'));
      expect(lengthCostFor(questions: 20, fullMock: false, isPro: false, balance: 390), const LengthCost('20 credits'));
      expect(lengthCostFor(questions: 50, fullMock: true, isPro: false, balance: 390), const LengthCost('50 credits'));
    });

    test('a row the student cannot afford says so', () {
      expect(lengthCostFor(questions: 20, fullMock: false, isPro: false, balance: 12), const LengthCost('20 credits', short: 'You have 12'));
      expect(const LengthCost('20 credits', short: 'You have 12').spoken, '20 credits. You have 12, not enough');
      expect(lengthCostFor(questions: 20, fullMock: false, isPro: false), const LengthCost('20 credits'), reason: 'no balance known: no claim');
    });

    test('Pro: practice uses no credits, and no upsell', () {
      expect(lengthCostFor(questions: 15, fullMock: false, isPro: true, balance: 0), const LengthCost('Included'));
    });

    test('the quote wins: its cost, a free allowance, a refusal for credits', () {
      expect(lengthCostFor(questions: 10, fullMock: false, isPro: false, balance: 390, quote: creditsQuote(cost: 10, balance: 390)), const LengthCost('10 credits'));
      final free = dailyFree();
      expect(lengthCostFor(questions: 10, fullMock: false, isPro: false, balance: 390, quote: free), const LengthCost('Free'));
      expect(lengthCostFor(questions: 20, fullMock: false, isPro: false, quote: lowCredits(cost: 20, balance: 8, count: 20)), const LengthCost('20 credits', short: 'You have 8'));
    });

    test('a full mock row asks for the full mock quote, a set row keeps the card\'s mode', () {
      expect(lengthQuoteQuery(_base, questions: 50, fullMock: true), const QuoteQuery(subject: 'accountancy', apiMode: 'full', count: 50));
      expect(lengthQuoteQuery(_base, questions: 15, fullMock: false), const QuoteQuery(subject: 'accountancy', apiMode: 'quick', count: 15));
      expect(lengthQuoteQuery(null, questions: 15, fullMock: false), isNull, reason: 'a repair or a free check has no price');
    });
  });

  group('the sheet', () {
    Future<void> pumpPanel(WidgetTester tester, {required FakeQuoteRepository quotes, bool pro = false}) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authSnapshotProvider.overrideWithBuild((ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', isPro: pro)),
            quoteRepositoryProvider.overrideWithValue(quotes),
          ],
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            home: Scaffold(
              body: LengthPanel(title: 'How many questions?', durations: _rows, selected: 10, quote: _base, inSheet: true, onPick: (_) {}),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('every row says what it costs, from its own quote', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: m == 'full' ? 50 : c ?? 10, balance: 390, mode: m, count: c ?? 10));
      await pumpPanel(tester, quotes: quotes);
      for (final price in ['5 credits', '10 credits', '15 credits', '20 credits', '50 credits']) {
        expect(find.text(price), findsOneWidget, reason: price);
      }
      expect(find.textContaining('You have'), findsNothing);
      expect(quotes.calls.map((c) => '${c.mode}:${c.count}').toSet(), {'quick:5', 'quick:10', 'quick:15', 'quick:20', 'full:50'});
      expect(find.bySemanticsLabel(RegExp(r'^Full mock: 50 questions, 60 min, 50 credits$')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a student with 12 credits sees which lengths are out of reach', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) {
        final cost = m == 'full' ? 50 : c ?? 10;
        return cost > 12 ? lowCredits(cost: cost, balance: 12, count: c ?? 10) : creditsQuote(cost: cost, balance: 12, mode: m, count: c ?? 10);
      });
      await pumpPanel(tester, quotes: quotes);
      expect(find.text('You have 12'), findsNWidgets(3), reason: '15, 20 and the full mock');
      expect(find.text('5 credits'), findsOneWidget);
    });

    testWidgets('Pro: every row is Included, with no upsell', (tester) async {
      final quotes = FakeQuoteRepository((s, m, c, p) => quoteOf(cost: 0, count: c ?? 10, mode: m, entitlement: 'access'));
      await pumpPanel(tester, quotes: quotes, pro: true);
      expect(find.text('Included'), findsNWidgets(5));
      expect(find.textContaining('Pro'), findsNothing);
    });
  });
}
