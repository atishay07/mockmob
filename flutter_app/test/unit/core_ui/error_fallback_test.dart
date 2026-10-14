import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/error_fallback.dart';
import 'package:mockmob/core/theme/theme.dart';

FlutterErrorDetails get _details => FlutterErrorDetails(exception: StateError('bad data'));

void main() {
  tearDown(ErrorLog.reset);

  testWidgets('a failed screen shows a calm note and a way back, not a blank box', (tester) async {
    final router = GoRouter(
      initialLocation: '/a',
      routes: [
        GoRoute(
          path: '/a',
          builder: (_, _) => const Scaffold(body: Text('first')),
        ),
        GoRoute(
          path: '/b',
          builder: (context, _) => Scaffold(body: buildErrorFallback(_details)),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router));
    unawaited(router.push('/b'));
    await tester.pumpAndSettle();

    expect(find.text(ErrorFallback.message), findsOneWidget);
    expect(find.text(ErrorFallback.backLabel), findsOneWidget);
    expect(tester.getSize(find.byType(TextButton)).height, greaterThanOrEqualTo(48));

    await tester.tap(find.text(ErrorFallback.backLabel));
    await tester.pumpAndSettle();
    expect(find.text('first'), findsOneWidget);
  });

  testWidgets('at a tab root the way out is Today', (tester) async {
    final router = GoRouter(
      initialLocation: '/review',
      routes: [
        GoRoute(
          path: '/today',
          builder: (_, _) => const Scaffold(body: Text('today')),
        ),
        GoRoute(
          path: '/review',
          builder: (_, _) => Scaffold(body: buildErrorFallback(_details)),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router));
    await tester.pumpAndSettle();
    expect(find.text(ErrorFallback.todayLabel), findsOneWidget);
    await tester.tap(find.text(ErrorFallback.todayLabel));
    await tester.pumpAndSettle();
    expect(find.text('today'), findsOneWidget);
  });

  testWidgets('it fits a 360 dp phone at 1.3x text, and works with no router or theme above it', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(size: Size(360, 640), textScaler: TextScaler.linear(1.3)),
        child: buildErrorFallback(_details),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.text(ErrorFallback.message), findsOneWidget);
    expect(find.byType(TextButton), findsNothing, reason: 'no router and no navigator: no control to offer');
  });

  testWidgets('a small failed spot still draws nothing', (tester) async {
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: SizedBox(width: 40, height: 40, child: buildErrorFallback(_details))),
      ),
    );
    expect(find.text(ErrorFallback.message), findsNothing);
  });

  test('the error log keeps the last twenty and is bounded in size', () {
    final printer = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {};
    addTearDown(() => debugPrint = printer);
    for (var i = 0; i < 25; i++) {
      ErrorLog.add('error $i ${'x' * 1000}', StackTrace.current);
    }
    expect(ErrorLog.entries, hasLength(ErrorLog.capacity));
    expect(ErrorLog.entries.first, contains('error 5'));
    expect(ErrorLog.entries.every((e) => e.length <= 400), isTrue);
  });
}
