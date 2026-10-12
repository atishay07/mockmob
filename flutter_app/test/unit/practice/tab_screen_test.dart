import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/run/:sessionId'),
];

FakeQuoteRepository _quotes({bool nta = true}) => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return nta ? proGate() : modeUnavailable();
  return dailyFree();
});

Future<void> settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('each row states the cost the quote returns, and Chapter practice costs what Quick practice costs', (tester) async {
    final quotes = _quotes();
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await settle(tester);
    expect(find.text('Full mock'), findsOneWidget);
    expect(find.text('50 questions, 60 minutes'), findsWidgets);
    expect(find.text('Uses 50 credits. You have 120.'), findsOneWidget);
    expect(find.text('Quick practice'), findsOneWidget);
    expect(find.text('5 to 20 questions'), findsOneWidget);
    expect(find.text('Chapter practice'), findsOneWidget);
    expect(find.text('Practice, not proof'), findsOneWidget);
    expect(find.text('Free today'), findsNWidgets(2));
    // Costs come from the quote: a Full mock asks with its first-use allowance purpose, Quick practice with none.
    final full = quotes.calls.firstWhere((c) => c.mode == 'full');
    expect(full.purpose, 'full_sample');
    expect(full.count, 50);
    expect(quotes.calls.firstWhere((c) => c.mode == 'quick').purpose, isNull);
    expect(quotes.calls.where((c) => c.mode == 'quick').map((c) => c.count).toSet(), {10});
  });

  testWidgets('a Pro-gated NTA-style row says "Part of Pro" with a free alternative and no price', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes()),
    );
    await settle(tester);
    expect(find.text('NTA-style mode'), findsOneWidget);
    expect(find.text('Part of Pro. You can take a Full mock instead.'), findsOneWidget);
    expect(find.byIcon(Icons.lock), findsNothing);
    expect(find.textContaining('Rs'), findsNothing);
    expect(find.textContaining('Upgrade'), findsNothing);
  });

  testWidgets('the NTA-style row is shown only when the quote returns it', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(nta: false)),
    );
    await settle(tester);
    expect(find.text('NTA-style mode'), findsNothing);
    expect(find.text('Full mock'), findsOneWidget);
  });

  testWidgets('a row opens its setup with the chosen subject', (tester) async {
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes()),
    );
    await settle(tester);
    await tester.tap(find.text('Chapter practice'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/setup/chapter');
    expect(router.state.uri.queryParameters['subject'], 'accountancy');
  });

  testWidgets('changing the subject asks the quote again for that subject', (tester) async {
    final quotes = _quotes();
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes),
    );
    await settle(tester);
    await tester.tap(find.text('English'));
    await settle(tester);
    expect(quotes.calls.any((c) => c.subject == 'english' && c.mode == 'full'), isTrue);
  });

  testWidgets('offline says so once, plainly', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), network: NetworkStatus.offline),
    );
    await settle(tester);
    expect(find.text('Connect to start. Your downloaded reviews still work.'), findsOneWidget);
  });

  testWidgets('a mock still running is offered before a new one, with its fixed end time', (tester) async {
    final endsAt = testNow.add(const Duration(minutes: 47)).millisecondsSinceEpoch;
    final draft = draftOf(sessionId: 'sess-7', count: 50, mode: 'full', endsAtWallMs: endsAt, mockNumber: 7);
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), draft: draft),
    );
    await settle(tester);
    expect(find.text('Mock 7, Accountancy is still running. It ends at 11:47 PM.'), findsOneWidget);
    await tester.tap(find.text('Continue').first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/run/sess-7');
  });

  testWidgets('a start link for Quick practice opens a session without a setup screen', (tester) async {
    final starter = FakeStarter();
    final router = await pumpRouted(
      tester,
      location: '/practice/start?mode=quick&subject=accountancy&count=10',
      routes: _routes(),
      overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 500));
    expect(starter.started, hasLength(1));
    expect(router.state.uri.path, '/run/sess-1');
  });

  testWidgets('a start link for a mock goes to setup, where the pre-start sheet lives', (tester) async {
    final starter = FakeStarter();
    final router = await pumpRouted(
      tester,
      location: '/practice/start?mode=full&subject=accountancy',
      routes: _routes(),
      overrides: practiceOverrides(starter: starter),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 500));
    expect(starter.started, isEmpty);
    expect(router.state.uri.path, '/practice/setup/full');
  });
}
