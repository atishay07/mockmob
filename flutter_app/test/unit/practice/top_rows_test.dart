// M7 of the v15 emulator walk (the owner's D5): on Practice, Repairs and "Ask Mobi what to practise" sat at the very bottom
// of the page, three screens down, and an account with open mistakes had no Repairs row at all. Both now sit right under the
// suggestion, within the first view, and Repairs shows its open count for any account with an open mistake.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  stubRoute('/review'),
  stubRoute('/practice/start'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
];

FakeQuoteRepository _quotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return modeUnavailable();
  return dailyFree(count: c ?? 10);
});

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> pump(WidgetTester tester, {int? openRepairs}) async {
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), attempts: const [], openRepairs: openRepairs),
    );
    await _settle(tester);
    return router;
  }

  testWidgets('with open mistakes the Repairs row says how many, and both rows sit in the first view, above Ways to practise', (tester) async {
    await pump(tester, openRepairs: 98);
    expect(find.text('Repairs'), findsOneWidget);
    expect(find.text('98 open mistakes to repair'), findsOneWidget);
    expect(find.text('Ask Mobi what to practise'), findsOneWidget);
    final viewport = tester.view.physicalSize.height / tester.view.devicePixelRatio;
    final repairs = tester.getTopLeft(find.text('Repairs')).dy;
    final ask = tester.getTopLeft(find.text('Ask Mobi what to practise')).dy;
    expect(repairs, lessThan(viewport), reason: 'on the first screen, not three down');
    expect(ask, lessThan(viewport));
    expect(repairs, lessThan(ask), reason: 'Repairs first, then Ask Mobi');
    expect(ask, lessThan(tester.getTopLeft(find.text('Ways to practise')).dy), reason: 'both are above the modes, not under them');
  });

  testWidgets('the rows are not in "More ways in" any more: Ask Mobi appears once on the page', (tester) async {
    await pump(tester, openRepairs: 3);
    await tester.scrollUntilVisible(find.text('More ways in'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Ask Mobi what to practise'), findsOneWidget);
    expect(find.text('Repairs'), findsOneWidget);
  });

  testWidgets('one open mistake is said in the singular', (tester) async {
    await pump(tester, openRepairs: 1);
    expect(find.text('1 open mistake to repair'), findsOneWidget);
  });

  testWidgets('no open mistakes, or a count not read yet, shows no Repairs row (an unknown is never a zero)', (tester) async {
    await pump(tester, openRepairs: 0);
    expect(find.text('Repairs'), findsNothing);
    expect(find.text('Ask Mobi what to practise'), findsOneWidget, reason: 'Ask Mobi stays near the top for every account');
    await pump(tester);
    expect(find.text('Repairs'), findsNothing);
    expect(find.textContaining('open mistake'), findsNothing);
  });

  testWidgets('a tap on Repairs opens the Review tab', (tester) async {
    final router = await pump(tester, openRepairs: 98);
    await tester.tap(find.text('Repairs'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(router.state.uri.path, '/review');
  });
}
