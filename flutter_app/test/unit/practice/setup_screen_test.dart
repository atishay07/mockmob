import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/practice'),
];

/// Lets the 300 ms re-quote debounce and the quote itself settle.
Future<void> settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 350));
  await tester.pump(const Duration(milliseconds: 50));
}

Finder text(String s) => find.text(s);

void main() {
  setUpAll(loadAppFonts);

  testWidgets('Start is disabled with its reason until the quote for this selection arrives', (tester) async {
    final gate = Completer<PracticeQuote>();
    final quotes = FakeQuoteRepository((s, m, c, p) => gate.future);
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(text('Checking what this costs.'), findsOneWidget);
    expect(quotes.calls, hasLength(1));
    // The controls stay usable while the quote is slow.
    await tester.tap(text('English'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.bySemanticsLabel('More questions'), findsOneWidget);
    gate.complete(dailyFree());
    await settle(tester);
    // The quote for the first subject finished, but the selection changed: the new one is asked.
    expect(quotes.calls.last.subject, 'english');
  });

  testWidgets('a quick practice starts once however many times Start is tapped, and opens the runner', (tester) async {
    final starter = FakeStarter()..hold = Completer<void>();
    final quotes = FakeQuoteRepository((s, m, c, p) => dailyFree());
    final router = await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, starter: starter),
    );
    await settle(tester);
    expect(text('Free today'), findsOneWidget);
    await tester.tap(text('Start practice'));
    await tester.pump();
    await tester.tap(text('Start practice'), warnIfMissed: false);
    await tester.pump();
    starter.hold!.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(starter.started, hasLength(1));
    expect(starter.started.single.mode, PracticeMode.quick);
    expect(starter.started.single.effectiveCount, 10);
    expect(router.state.uri.path, '/run/sess-1');
  });

  testWidgets('the count steps through 5, 10, 15 and 20 only', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote(count: c ?? 10));
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy&count=15',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await settle(tester);
    expect(text('15'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('More questions'));
    await tester.pump();
    expect(text('20'), findsOneWidget);
    // At the top the plus key is disabled.
    await tester.tap(find.bySemanticsLabel('More questions'), warnIfMissed: false);
    await tester.pump();
    expect(text('20'), findsOneWidget);
    for (var i = 0; i < 3; i++) {
      await tester.tap(find.bySemanticsLabel('Fewer questions'));
      await tester.pump(const Duration(milliseconds: 300));
    }
    expect(text('5'), findsOneWidget);
    await settle(tester);
    expect(quotes.calls.map((c) => c.count).toSet(), contains(5));
  });

  testWidgets('chapter practice needs a chapter, sends the single chapter, and costs like Quick practice', (tester) async {
    final starter = FakeStarter();
    final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote());
    await pumpRouted(
      tester,
      location: '/practice/setup/chapter?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, starter: starter),
    );
    await settle(tester);
    expect(text('Choose a chapter first.'), findsOneWidget);
    // The quote is the Quick practice quote: chapter practice has no price of its own.
    expect(quotes.calls.every((c) => c.mode == 'quick'), isTrue);
    await tester.tap(text('Choose a chapter').first);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(text('Partnership accounts'), findsOneWidget);
    await tester.tap(text('Admission of a partner'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(text('Choose a chapter first.'), findsNothing);
    await tester.tap(text('Start chapter practice'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(starter.started.single.chapter, 'Admission of a partner');
    expect(starter.started.single.mode, PracticeMode.chapter);
  });

  testWidgets('changing the subject forgets the chapter', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice/setup/chapter?subject=accountancy&chapter=Goodwill',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote())),
    );
    await settle(tester);
    expect(text('Goodwill'), findsOneWidget);
    await tester.tap(text('English'));
    await tester.pump(const Duration(milliseconds: 100));
    expect(text('Goodwill'), findsNothing);
    expect(text('Choose a chapter first.'), findsOneWidget);
  });

  testWidgets('credits low names the free paths, and the daily practice only when the quote confirms it', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => c == 10 ? dailyFree() : lowCredits());
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy&count=15',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await settle(tester);
    expect(text('You have 8 credits. A Quick practice costs 10, and chapter practice costs the same.'), findsOneWidget);
    expect(text('Free right now'), findsOneWidget);
    expect(text('Learn'), findsOneWidget);
    expect(text('Review your answers and keys, explanations included'), findsOneWidget);
    expect(text('Today’s free 10-question practice'), findsOneWidget);
    expect(find.textContaining('still open'), findsNothing);
  });

  testWidgets('credits low does not list the daily practice when it is not available', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => lowCredits());
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy&count=15',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await settle(tester);
    expect(text('Free right now'), findsOneWidget);
    expect(text('Today’s free 10-question practice'), findsNothing);
    expect(text('Learn'), findsOneWidget);
  });

  testWidgets('a blocked quote shows its reason text only', (tester) async {
    final quotes = FakeQuoteRepository(
      (s, m, c, p) => quoteOf(
        state: 'unavailable',
        launchable: false,
        reasonCode: 'inventory_insufficient',
        reason: 'Economics has 3 usable questions, fewer than this 10-question Quick Practice. Choose fewer questions or another subject.',
      ),
    );
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=economics',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await settle(tester);
    expect(find.textContaining('Economics has 3 usable questions'), findsOneWidget);
  });

  testWidgets('offline shows the exact offline line and does not start', (tester) async {
    final starter = FakeStarter();
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(starter: starter, network: NetworkStatus.offline),
    );
    await settle(tester);
    expect(text('Connect to start. Your downloaded reviews still work.'), findsOneWidget);
    await tester.tap(text('Start practice'), warnIfMissed: false);
    await tester.pump();
    expect(starter.started, isEmpty);
  });

  testWidgets('INSUFFICIENT_PRACTICE_CONTENT shows the exact copy and leaves Start available', (tester) async {
    final starter = FakeStarter(const StartFailed(StartFailure.notEnoughQuestions));
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote()), starter: starter),
    );
    await settle(tester);
    await tester.tap(text('Start practice'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(text('We do not have enough questions for this yet. Nothing was charged.'), findsOneWidget);
    expect(text('Start practice'), findsOneWidget);
  });

  testWidgets('a generic failure shows the exact copy, never server text', (tester) async {
    final starter = FakeStarter(const StartFailed(StartFailure.generic));
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote()), starter: starter),
    );
    await settle(tester);
    await tester.tap(text('Start practice'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(text('We could not start the session. Nothing was charged. Try again.'), findsOneWidget);
  });

  testWidgets('a mock opens one pre-start sheet with the numbered title, then starts', (tester) async {
    final starter = FakeStarter();
    final quotes = FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50));
    final router = await pumpRouted(
      tester,
      location: '/practice/setup/full?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, starter: starter, catalog: FakeCatalog(mocks: 6)),
    );
    await settle(tester);
    expect(text('Uses 50 credits. You have 120.'), findsOneWidget);
    await tester.tap(text('Start mock'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(text('Mock 7, Accountancy'), findsOneWidget);
    expect(text('50 questions, 60 minutes.'), findsOneWidget);
    expect(text('5 marks for each correct answer, minus 1 for each wrong answer.'), findsOneWidget);
    expect(text('The timer keeps running if you leave the app. Submit ends the mock.'), findsOneWidget);
    expect(text('For fewer interruptions, turn on Do Not Disturb from Quick Settings.'), findsOneWidget);
    // The ticket-mode line needs a ticket-mode session, which only exists after the start.
    expect(find.textContaining('open MockMob again'), findsNothing);
    await tester.tap(text('Start mock').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(starter.started, hasLength(1));
    expect(starter.mockNumbers.single, 7);
    expect(starter.started.single.mode, PracticeMode.full);
    expect(router.state.uri.path, '/run/sess-1');
  });

  testWidgets('a Pro-gated mode says what the account includes and offers a free alternative, with no price', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice/setup/nta?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => proGate())),
    );
    await settle(tester);
    expect(text('NTA-style mode is part of Pro'), findsOneWidget);
    expect(text('Your account includes Full mock, Quick practice and Chapter practice.'), findsOneWidget);
    expect(text('Take a Full mock instead'), findsOneWidget);
    expect(find.textContaining('Rs'), findsNothing);
    expect(find.textContaining('Upgrade'), findsNothing);
  });

  testWidgets('the skeleton appears only after 400 ms', (tester) async {
    final gate = Completer<PracticeQuote>();
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => gate.future)),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.bySemanticsLabel('Checking what this costs'), findsNothing);
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.bySemanticsLabel('Checking what this costs'), findsOneWidget);
    gate.complete(dailyFree());
    await tester.pump();
    await tester.pump();
  });
}
