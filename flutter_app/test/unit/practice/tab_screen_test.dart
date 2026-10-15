import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/features/practice/widgets/length_dial.dart';
import 'package:mockmob/features/practice/widgets/suggestion_card.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import '../learn/support/learn_fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/result/:attemptId'),
  stubRoute('/result/:attemptId'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/learn/:unitId'),
  stubRoute('/review'),
];

FakeQuoteRepository _quotes({bool nta = true}) => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return nta ? proGate() : modeUnavailable();
  return dailyFree(count: c ?? 10);
});

Future<void> settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 500));
}

/// Opens a sheet and lets it rise and its quote arrive.
Future<void> openSheet(WidgetTester tester, Finder target) async {
  await tester.ensureVisible(target);
  await tester.pump();
  await tester.tap(target);
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

int _ms(DateTime t) => t.millisecondsSinceEpoch;

/// The longer sessions sit under the tiles, below the first view: scroll the page (not the tile
/// strip) down to the exam band.
Future<void> _toExamBand(WidgetTester tester) async {
  await tester.scrollUntilVisible(find.text('Full mock'), 200, scrollable: find.byType(Scrollable).first);
  await tester.pump();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a new student is offered a starting point from the subjects they chose, with no cost on the tab', (tester) async {
    final quotes = _quotes();
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: quotes, attempts: const []));
    await settle(tester);
    expect(find.text('Your starting point'), findsOneWidget);
    expect(find.text('Ten questions shows where you stand.'), findsOneWidget);
    // Costs never appear on the tab, and the defensive tails are gone.
    expect(find.textContaining('credit'), findsNothing);
    expect(find.text('Free today'), findsNothing);
    expect(find.textContaining('not proof'), findsNothing);

    await openSheet(tester, find.widgetWithText(KeyButton, 'Start').first);
    expect(find.text('What you get'), findsOneWidget);
    expect(find.text('10 questions, about 10 minutes.'), findsOneWidget);
    expect(find.text('Free today'), findsOneWidget);
    expect(quotes.calls.any((c) => c.mode == 'quick' && c.purpose == 'baseline'), isTrue);
  });

  testWidgets('the suggestion names the chapter that cost the most in the latest mock, and Show me opens it', (tester) async {
    final mock = attemptOf(
      id: 'm1',
      completedAt: _ms(testNow.subtract(const Duration(days: 1))),
      questions: [...chapterOf('Admission of a partner', right: 1, wrong: 3), ...chapterOf('Goodwill', right: 4)],
    );
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), attempts: [mock]),
    );
    await settle(tester);
    expect(find.text('Admission of a partner'), findsOneWidget);
    expect(find.text('It cost you 18 marks in Mock 1.'), findsOneWidget);
    await tester.tap(find.text('Show me'));
    await settle(tester);
    expect(router.state.uri.path, '/result/m1');
  });

  testWidgets('after 11 PM the suggestion says to stop after it, unless late-night lines are off', (tester) async {
    final mock = attemptOf(
      id: 'm1',
      completedAt: _ms(testNow.subtract(const Duration(days: 1))),
      questions: [...chapterOf('Admission of a partner', right: 1, wrong: 3)],
    );
    Future<void> at(DateTime now, {bool lines = true}) async {
      // A fresh scope for each clock and setting.
      await tester.pumpWidget(const SizedBox());
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _quotes(), attempts: [mock], now: now, lateNightLines: lines),
      );
      await settle(tester);
    }

    await at(DateTime(2026, 10, 12, 23, 30));
    expect(find.text('This one, then sleep'), findsOneWidget);
    expect(find.text('Your next practice'), findsNothing);
    await at(DateTime(2026, 10, 12, 23, 30), lines: false);
    expect(find.text('This one, then sleep'), findsNothing);
    expect(find.text('Your next practice'), findsNothing);
    await at(DateTime(2026, 10, 12, 20));
    expect(find.text('This one, then sleep'), findsNothing);
    expect(find.text('Your next practice'), findsNothing);
  });

  testWidgets('without a nameable chapter the suggestion is the last paper\'s subject, with when it was', (tester) async {
    final practice = attemptOf(
      id: 'p1',
      mode: 'quick',
      subject: 'english',
      completedAt: _ms(testNow.subtract(const Duration(days: 1))),
      questions: [('Reading', V.right), ('Grammar', V.wrong)],
    );
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), attempts: [practice]),
    );
    await settle(tester);
    expect(find.descendant(of: find.byType(SuggestionCard), matching: find.text('English')), findsOneWidget);
    expect(find.text('Quick practice, mixed chapters'), findsOneWidget);
    expect(find.text('Your last paper was yesterday.'), findsOneWidget);
  });

  testWidgets('a mock still running is the suggestion, with its fixed end time, and Resume opens it', (tester) async {
    final endsAt = testNow.add(const Duration(minutes: 47)).millisecondsSinceEpoch;
    final draft = draftOf(sessionId: 'sess-7', count: 50, mode: 'full', endsAtWallMs: endsAt, mockNumber: 7);
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), draft: draft),
    );
    await settle(tester);
    expect(find.text('Mock 7, Accountancy'), findsOneWidget);
    expect(find.text('The clock ends at 11:47 PM.'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Resume').first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/run/sess-7');
  });

  testWidgets('the exam-day row says it comes with Pro, warmly and with no price', (tester) async {
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: _quotes()));
    await settle(tester);
    await _toExamBand(tester);
    expect(find.text('NTA mode'), findsOneWidget);
    expect(find.text('Pro'), findsOneWidget);
    expect(find.text('Comes with Pro. A Full mock is open to you now.'), findsOneWidget);
    expect(find.textContaining('Rs'), findsNothing);
    expect(find.textContaining('Upgrade'), findsNothing);
  });

  testWidgets('the exam-day row is shown only when the quote returns the mode', (tester) async {
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: _quotes(nta: false)));
    await settle(tester);
    await _toExamBand(tester);
    expect(find.text('NTA mode'), findsNothing);
    expect(find.text('Full mock'), findsOneWidget);
  });

  testWidgets('Quick practice opens the confirm sheet; Start starts once and opens the runner', (tester) async {
    final starter = FakeStarter();
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), starter: starter),
    );
    await settle(tester);
    await openSheet(tester, find.text('Quick practice'));
    expect(find.bySemanticsLabel('Quick practice, Accountancy'), findsOneWidget);
    await tester.tap(find.descendant(of: find.byType(LengthDial), matching: find.text('15')));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    expect(find.text('15 questions, about 15 minutes.'), findsOneWidget);
    await tester.ensureVisible(find.text('Start practice'));
    await tester.pump();
    await tester.tap(find.text('Start practice'));
    await tester.tap(find.text('Start practice'), warnIfMissed: false);
    await settle(tester);
    expect(starter.started, hasLength(1));
    expect(starter.started.single.count, 15);
    expect(router.state.uri.path, '/run/sess-1');
  });

  testWidgets('By chapter asks for the chapters first, then confirms with it', (tester) async {
    final starter = FakeStarter();
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: _quotes(), starter: starter));
    await settle(tester);
    await openSheet(tester, find.text('By chapter'));
    await tester.tap(find.text('Goodwill'));
    await tester.pump();
    await openSheet(tester, find.text('Use 1 chapter'));
    expect(find.bySemanticsLabel('By chapter, Accountancy'), findsOneWidget);
    expect(find.text('Goodwill'), findsWidgets);
    await tester.ensureVisible(find.text('Start chapter practice'));
    await tester.pump();
    await tester.tap(find.text('Start chapter practice'));
    await settle(tester);
    expect(starter.started.single.chapter, 'Goodwill');
  });

  testWidgets('changing the subject asks the quote again for that subject', (tester) async {
    final quotes = _quotes();
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: practiceOverrides(quotes: quotes));
    await settle(tester);
    await tester.ensureVisible(find.text('English'));
    await tester.pump();
    await tester.tap(find.text('English'));
    await settle(tester);
    expect(quotes.calls.any((c) => c.subject == 'english' && c.mode == 'full'), isTrue);
  });

  testWidgets('the Concepts shelf shows lessons while study content is on, and opens one', (tester) async {
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      size: const Size(384, 1700),
      overrides: practiceOverrides(quotes: _quotes(), learn: catalog(due: 4)),
    );
    await settle(tester);
    expect(find.text('Concepts'), findsOneWidget);
    // Due lessons lead the shelf.
    expect(find.text('Vocabulary set 1'), findsOneWidget);
    await tester.tap(find.text('Vocabulary set 1'));
    await settle(tester);
    expect(router.state.uri.path, '/learn/eng-vocab');
  });

  testWidgets('with study content switched off there is no Concepts shelf and no "not available" line', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      size: const Size(384, 1400),
      overrides: practiceOverrides(quotes: _quotes(), learn: catalog(state: 'disabled')),
    );
    await settle(tester);
    expect(find.text('Concepts'), findsNothing);
    expect(find.textContaining('not available'), findsNothing);
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

  testWidgets('a start link for a mock goes to setup, where the confirm step lives', (tester) async {
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
