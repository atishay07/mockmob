import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<GoRouter> _pumpHub(
  WidgetTester tester, {
  FakeConsent? consent,
  FakeGoal? goal,
  FakeRhythm? rhythm,
  RecordingOpener? opener,
}) async {
  tester.view.physicalSize = const Size(720, 3200);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/you',
    routes: [
      GoRoute(path: '/you', builder: (_, _) => const YouHubScreen()),
      GoRoute(path: '/you/rhythm', builder: (_, _) => const Text('rhythm page')),
      GoRoute(path: '/review/record', builder: (_, _) => const Text('record page')),
      GoRoute(path: '/you/privacy', builder: (_, _) => const Text('privacy page')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: youOverrides(consent: consent, goal: goal, rhythm: rhythm, opener: opener),
      child: MaterialApp.router(
        theme: buildTheme(Brightness.light),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('lists the rows of spec 5.10 in three groups', (tester) async {
    await _pumpHub(tester);
    for (final label in [
      'Weekly goal and rhythm',
      'Repair record',
      'Milestones',
      'Personal bests',
      'Notifications',
      'Appearance and feel',
      'Privacy',
      'Account',
      'Help',
      'Compass',
      'Combo Planner',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('Signed in as asha.verma@example.com'), findsOneWidget);
  });

  testWidgets('the rhythm row shows the goal and weeks in rhythm', (tester) async {
    await _pumpHub(tester);
    expect(find.text('Goal: 4 days a week\nWeeks in rhythm: 3'), findsOneWidget);
    expect(find.bySemanticsLabel('Weekly goal and rhythm. Goal: 4 days a week\nWeeks in rhythm: 3'), findsOneWidget);
  });

  testWidgets('a run of zero weeks is never printed as a number', (tester) async {
    await _pumpHub(tester, rhythm: FakeRhythm(rhythmState(streak: 0)));
    expect(find.text('Goal: 4 days a week'), findsOneWidget);
    expect(find.textContaining('Weeks in rhythm'), findsNothing);
  });

  testWidgets('a pause replaces the weeks figure', (tester) async {
    final until = DateTime.now().add(const Duration(days: 10));
    final iso = '${until.year}-${until.month.toString().padLeft(2, '0')}-${until.day.toString().padLeft(2, '0')}';
    await _pumpHub(tester, goal: FakeGoal(goalState(4, pausedUntil: iso)));
    expect(find.textContaining('Rhythm is paused until'), findsOneWidget);
    expect(find.textContaining('Weeks in rhythm'), findsNothing);
  });

  testWidgets('the privacy row reflects the account', (tester) async {
    await _pumpHub(tester, consent: FakeConsent(consentState(AgeBand.minor)));
    expect(find.text('Off for your account'), findsOneWidget);
  });

  testWidgets('a row opens its screen', (tester) async {
    final router = await _pumpHub(tester);
    await tester.tap(find.text('Weekly goal and rhythm'));
    await tester.pumpAndSettle();
    expect(find.text('rhythm page'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Repair record'));
    await tester.pumpAndSettle();
    expect(find.text('record page'), findsOneWidget);
  });

  testWidgets('CUET tools open in a Custom Tab on www.mockmob.in', (tester) async {
    final opener = RecordingOpener();
    await _pumpHub(tester, opener: opener);
    await tester.tap(find.text('Compass'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Combo Planner'));
    await tester.pumpAndSettle();
    expect(opener.opened.map((u) => u.toString()), [
      'https://www.mockmob.in/admission-compass',
      'https://www.mockmob.in/cuet-subject-combination',
    ]);
  });

  testWidgets('a tool that will not open says so', (tester) async {
    await _pumpHub(tester, opener: RecordingOpener(result: false));
    await tester.tap(find.text('Compass'));
    await tester.pumpAndSettle();
    expect(find.text('We could not open that page. Check your connection and try again.'), findsOneWidget);
  });

  testWidgets('reduced motion shows the hub at once', (tester) async {
    await pumpMockmob(
      tester,
      const YouHubScreen(),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: youOverrides(),
    );
    await tester.pump();
    expect(find.text('Account'), findsOneWidget);
  });

  testWidgets('rows are at least 44 dp tall and labelled for TalkBack', (tester) async {
    await _pumpHub(tester);
    final size = tester.getSize(find.ancestor(of: find.text('Help'), matching: find.byType(DecoratedBox)).first);
    expect(size.height, greaterThanOrEqualTo(44));
    expect(find.bySemanticsLabel('Help'), findsOneWidget);
  });
}
