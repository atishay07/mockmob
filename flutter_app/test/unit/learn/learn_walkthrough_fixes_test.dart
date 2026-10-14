// Device walk-through fixes for Learn: the summary error says what failed, the first-load
// skeleton gives way to an error with Try again, and system Back from a deep link goes to
// Practice (or Learn) instead of leaving the app.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/data/summary_loader.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';
import 'package:mockmob/features/learn/screens/summary_screen.dart';

import '../../golden/learn/golden_support.dart';
import '../../helpers/fonts.dart';
import 'support/learn_fixtures.dart';

const _server = ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500);
const _offline = ApiError(kind: ApiErrorKind.network, code: 'network');

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> pumpRouter(
    WidgetTester tester, {
    required String at,
    required List<Override> overrides,
    Duration slowAfter = const Duration(seconds: 15),
  }) async {
    final router = GoRouter(
      initialLocation: at,
      routes: [
        GoRoute(path: '/practice', builder: (c, s) => const Scaffold(body: Text('AT practice'))),
        GoRoute(
          path: '/learn',
          builder: (c, s) => LearnScreen(slowAfter: slowAfter),
          routes: [
            GoRoute(path: 'summary/:subject/:chapter', builder: (c, s) => LearnSummaryScreen(subject: s.pathParameters['subject']!, chapter: s.pathParameters['chapter']!)),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides,
        child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
      ),
    );
    await tester.pump();
    return router;
  }

  group('P3-23: the summary error says what failed', () {
    test('no online failure blames the connection', () {
      for (final e in [null, _server, const ApiError(kind: ApiErrorKind.rateLimited, code: 'rate_limited'), const ApiError(kind: ApiErrorKind.unknown, code: 'x')]) {
        expect(LearnCopy.summaryFailedMessage(e).toLowerCase(), isNot(contains('connection')));
        expect(LearnCopy.summaryFailedMessage(e), isNot(contains('!')));
      }
      expect(LearnCopy.summaryFailedMessage(_server), isNot(LearnCopy.summaryFailedMessage(null)));
    });

    testWidgets('a server failure on an online phone shows the server line and Try again', (tester) async {
      await pumpRouter(
        tester,
        at: '/learn/summary/accountancy/Goodwill',
        overrides: [...learnOverrides(catalog: catalog()), chapterSummaryProvider(('accountancy', 'Goodwill')).overrideWith((ref) => throw _server)],
      );
      await tester.pump();
      expect(find.text(LearnCopy.summaryFailedTitle), findsOneWidget);
      expect(find.text(LearnCopy.summaryFailedMessage(_server)), findsOneWidget);
      expect(find.textContaining('connection'), findsNothing);
      expect(find.text(LearnCopy.tryAgain), findsOneWidget);
    });

    testWidgets('a real offline failure still says it is not on this phone', (tester) async {
      await pumpRouter(
        tester,
        at: '/learn/summary/accountancy/Goodwill',
        overrides: [...learnOverrides(catalog: catalog()), chapterSummaryProvider(('accountancy', 'Goodwill')).overrideWith((ref) => throw _offline)],
      );
      await tester.pump();
      expect(find.text(LearnCopy.summaryOfflineTitle), findsOneWidget);
      expect(find.text(LearnCopy.summaryOfflineMessage), findsOneWidget);
    });
  });

  group('P3-24: the first-load skeleton times out', () {
    testWidgets('with nothing arriving, the skeleton gives way to an error with Try again, and Try again starts the wait over', (tester) async {
      await pumpRouter(
        tester,
        at: '/learn',
        slowAfter: const Duration(seconds: 3),
        overrides: learnOverrides(catalogState: const RemoteState<LearnCatalog>.idle()),
      );
      expect(find.text(LearnCopy.loadSlowTitle), findsNothing);
      await tester.pump(const Duration(seconds: 2));
      expect(find.text(LearnCopy.loadSlowTitle), findsNothing, reason: 'still within the wait');
      await tester.pump(const Duration(seconds: 2));
      expect(find.text(LearnCopy.loadSlowTitle), findsOneWidget);
      expect(find.text(LearnCopy.loadSlowMessage), findsOneWidget);

      await tester.tap(find.text(LearnCopy.tryAgain));
      await tester.pump();
      expect(find.text(LearnCopy.loadSlowTitle), findsNothing, reason: 'back to the skeleton while it retries');
      await tester.pump(const Duration(seconds: 4));
      expect(find.text(LearnCopy.loadSlowTitle), findsOneWidget);
    });
  });

  group('P3-25: system Back from a deep link', () {
    testWidgets('Learn with nothing under it goes to Practice, not out of the app', (tester) async {
      final router = await pumpRouter(tester, at: '/learn', overrides: learnOverrides(catalog: catalog()));
      final handled = await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(handled, isTrue, reason: 'Back is handled by the app, so it does not exit');
      expect(router.state.uri.path, '/practice');
    });

    testWidgets('a deep-linked summary goes to Learn', (tester) async {
      final router = await pumpRouter(
        tester,
        at: '/learn/summary/accountancy/Goodwill',
        overrides: [...learnOverrides(catalog: catalog()), chapterSummaryProvider(('accountancy', 'Goodwill')).overrideWith((ref) => throw _server)],
      );
      final handled = await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(handled, isTrue);
      expect(router.state.uri.path, '/learn');
    });

    testWidgets('with Learn open over Practice, Back pops as before', (tester) async {
      final router = await pumpRouter(tester, at: '/practice', overrides: learnOverrides(catalog: catalog()));
      router.push('/learn').ignore();
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/learn');
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/practice');
      expect(find.text('AT practice'), findsOneWidget);
    });
  });
}
