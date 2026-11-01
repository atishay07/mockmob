// Learn home as the Learn door of Practice mounts it (learn2_door.dart): the door's address carries its own place
// (?subject=, ?find=1&q=), and Learn home takes them; a later pick of another subject is the student's own and is not
// pulled back by the address.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/cards/find_view.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';
import 'package:mockmob/features/learn2/home/learn_home.dart';
import 'package:mockmob/features/learn2/learn2_door.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';

import 'home_support.dart';

Future<GoRouter> _pump(WidgetTester tester, String location, {bool on = true}) async {
  tester.view.physicalSize = const Size(720, 1600);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: location,
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => Scaffold(
          backgroundColor: context.mmColors.ground,
          body: SafeArea(child: SingleChildScrollView(child: Learn2Door())),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [...homeOverrides(HomeLearnApi()), learnOnProvider.overrideWithBuild((ref, n) => on)],
      child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router, builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!)),
    ),
  );
  await settleHome(tester);
  return router;
}

void main() {
  testWidgets('the door shows Learn home when the server has Learn v2 on', (tester) async {
    await _pump(tester, '/');
    expect(find.byType(LearnHome), findsOneWidget);
    expect(find.text('Search 868 Key cards'), findsOneWidget);
  });

  testWidgets('its address names the subject, and Find with its words', (tester) async {
    await _pump(tester, '/?subject=economics&find=1&q=goodwill');
    final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
    expect(container.read(practiceSubjectProvider), 'economics');
    expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');
    expect(tester.widget<FindPanel>(find.byType(FindPanel)).subject, 'economics');
    expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).controller!.text, 'goodwill');
  });

  testWidgets('find=1 alone opens it with the field ready to type in', (tester) async {
    await _pump(tester, '/?find=1');
    expect(find.byType(FindPanel), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).focusNode!.hasFocus, isTrue);
  });

  testWidgets('a new address for the same door replaces what is open: Find with new words, another subject', (tester) async {
    final router = await _pump(tester, '/');
    final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
    expect(find.byType(FindPanel), findsNothing);
    router.go('/?subject=economics&find=1&q=goodwill');
    await settleHome(tester);
    expect(container.read(practiceSubjectProvider), 'economics');
    expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');
    router.go('/?subject=business_studies');
    await settleHome(tester);
    expect(container.read(practiceSubjectProvider), 'business_studies');
    expect(find.byType(FindPanel), findsNothing, reason: 'the new address names no words');
  });

  testWidgets('the student\'s own pick of another subject is not pulled back by the address', (tester) async {
    await _pump(tester, '/?subject=economics');
    final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
    expect(container.read(practiceSubjectProvider), 'economics');
    await tester.ensureVisible(find.byKey(const ValueKey('lh-subject-english')));
    await tester.tap(find.byKey(const ValueKey('lh-subject-english')));
    await settleHome(tester);
    expect(container.read(practiceSubjectProvider), 'english');
    await settleHome(tester);
    expect(container.read(practiceSubjectProvider), 'english');
  });
}
