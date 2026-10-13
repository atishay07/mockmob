import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';

import '../../golden/learn/golden_support.dart';
import '../../helpers/fonts.dart';
import 'support/learn_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  testWidgets('with study content switched off, Concepts leaves for Practice instead of saying "not available"', (tester) async {
    final router = GoRouter(
      initialLocation: '/learn',
      routes: [
        GoRoute(path: '/learn', builder: (c, s) => const LearnScreen()),
        GoRoute(path: '/practice', builder: (c, s) => const Scaffold(body: Text('AT practice'))),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: learnOverrides(catalog: catalog(state: 'disabled')),
        child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
      ),
    );
    await tester.pump();
    expect(find.textContaining('not available'), findsNothing);
    await tester.pump(const Duration(milliseconds: 400));
    expect(router.state.uri.path, '/practice');
  });
}
