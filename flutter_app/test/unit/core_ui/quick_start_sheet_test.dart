import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../core_data/support/fixtures.dart';

Future<GoRouter> _pump(WidgetTester tester, {double textScale = 1, bool crowded = false}) async {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final draft = draftOf(endsAtWallMs: DateTime(2026, 10, 13, 22, 40).millisecondsSinceEpoch, count: 50);
  final router = GoRouter(
    initialLocation: '/today',
    routes: [
      GoRoute(
        path: '/today',
        builder: (_, _) => Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const Material(child: QuickStartSheet()),
              ),
              child: const Text('Start'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/ask',
        builder: (_, _) => const Scaffold(body: Text('ask screen')),
      ),
      GoRoute(
        path: '/exam/nta',
        builder: (_, _) => const Scaffold(body: Text('nta screen')),
      ),
      GoRoute(
        path: '/review/repair/a/q',
        builder: (_, _) => const Scaffold(body: Text('repair screen')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        resumeDraftProvider.overrideWith((ref) => crowded ? draft : null),
        resumeOfferProvider.overrideWith((ref) async => crowded ? ResumeOffer(draft: draft, answered: 12) : null),
        if (crowded) quickStartNtaProvider.overrideWith((ref) => const QuickNta(location: '/exam/nta', subject: 'english', proOnly: true)),
        if (crowded)
          quickStartRepairProvider.overrideWith((ref) => const QuickRepair(location: '/review/repair/a/q', chapter: 'Cash flow')),
      ],
      child: MaterialApp.router(
        theme: buildTheme(Brightness.light),
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.tap(find.text('Start'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
  return router;
}

void main() {
  testWidgets('five rows at 1.3x text on a 360 x 640 phone: no overflow and the last row is reachable', (tester) async {
    await _pump(tester, textScale: 1.3, crowded: true);
    expect(tester.takeException(), isNull, reason: 'the sheet scrolls instead of overflowing');

    final last = find.text('Repair the next mistake');
    await tester.scrollUntilVisible(last, 120, scrollable: find.byType(Scrollable).last);
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(tester.getRect(last).bottom, lessThanOrEqualTo(640));
    // The header (title and grab handle) stays in place while the rows scroll.
    expect(find.text('Resume Accountancy mock'), findsOneWidget);
  });

  testWidgets('Ask your record opens over the tab, so Back returns to it', (tester) async {
    final router = await _pump(tester);
    await tester.tap(find.text('Ask your record'));
    await tester.pumpAndSettle();
    expect(find.text('ask screen'), findsOneWidget);
    expect(router.canPop(), isTrue, reason: 'there is a screen to go back to');
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('Start'), findsOneWidget);
  });

  testWidgets('NTA mode opens over the tab', (tester) async {
    final router = await _pump(tester, crowded: true);
    final nta = find.text('NTA mode, with Pro');
    await tester.scrollUntilVisible(nta, 80, scrollable: find.byType(Scrollable).last);
    await tester.tap(nta);
    await tester.pumpAndSettle();
    expect(find.text('nta screen'), findsOneWidget);
    expect(router.canPop(), isTrue);
  });

  test('only top-level screens are pushed', () {
    expect(QuickStartSheet.opensOutsideShell('/ask'), isTrue);
    expect(QuickStartSheet.opensOutsideShell('/exam/nta'), isTrue);
    expect(QuickStartSheet.opensOutsideShell('/run/abc'), isTrue);
    expect(QuickStartSheet.opensOutsideShell('/practice/setup/quick?count=10'), isFalse);
    expect(QuickStartSheet.opensOutsideShell('/review/repair/a/q'), isFalse);
  });
}
