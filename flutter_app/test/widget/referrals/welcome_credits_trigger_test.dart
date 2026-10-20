// The welcome-credits trigger over a real router: it reads the router's location and whether a sheet or dialog is over
// the page, and opens only on Today with nothing over it, once per account.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/referrals/welcome_credits_rules.dart';
import 'package:mockmob/features/referrals/welcome_credits_trigger.dart';

GoRouter _router() => GoRouter(
      initialLocation: AppRoutes.today,
      routes: [
        GoRoute(path: AppRoutes.today, builder: (_, _) => const Scaffold(body: Text('Today'))),
        GoRoute(path: AppRoutes.beforeYouStart, builder: (_, _) => const Scaffold(body: Text('Before you start'))),
        GoRoute(path: '/onboarding', builder: (_, _) => const Scaffold(body: Text('Onboarding'))),
      ],
    );

Future<void> _wait(WidgetTester tester, Duration d) async {
  final steps = d.inMilliseconds ~/ 100;
  for (var i = 0; i < steps; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  testWidgets('a sheet or dialog over the page counts as a modal on top; a router page does not', (tester) async {
    final router = _router();
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    final nav = router.routerDelegate.navigatorKey.currentState;
    expect(rootModalOnTop(nav), isFalse);
    showModalBottomSheet<void>(context: router.routerDelegate.navigatorKey.currentContext!, builder: (_) => const Text('sheet'));
    await tester.pumpAndSettle();
    expect(rootModalOnTop(nav), isTrue);
    expect(rootModalOnTop(null), isTrue);
  });

  testWidgets('opens on Today after the after-sign-in sheet closes, never over onboarding or a sheet, once', (tester) async {
    final router = _router();
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    final delegate = router.routerDelegate;
    final prefs = MemoryPrefsStore();
    var opened = 0;
    final trigger = WelcomeCreditsTrigger(
      prefs: prefs,
      signedInAs: () => 'u1',
      location: () => delegate.currentConfiguration.uri.path,
      modalOnTop: () => rootModalOnTop(delegate.navigatorKey.currentState),
      open: () async => opened++,
    );
    addTearDown(trigger.dispose);

    // The launcher: arm, push the sheet, and report its close.
    trigger.arm('u1');
    router.push<void>(AppRoutes.beforeYouStart).whenComplete(trigger.sheetClosed);
    await tester.pumpAndSettle();
    await _wait(tester, const Duration(seconds: 2));
    expect(opened, 0, reason: 'the after-sign-in sheet is up');

    // It closes onto onboarding (the starting-point check): nothing yet.
    router.pop();
    router.go('/onboarding');
    await tester.pumpAndSettle();
    await _wait(tester, const Duration(seconds: 2));
    expect(opened, 0);

    // Back on Today, but with a sheet over it: still nothing.
    router.go(AppRoutes.today);
    await tester.pumpAndSettle();
    showModalBottomSheet<void>(context: delegate.navigatorKey.currentContext!, builder: (_) => const Text('another sheet'));
    await tester.pumpAndSettle();
    await _wait(tester, const Duration(seconds: 2));
    expect(opened, 0);

    // That sheet closes: the poll (300 ms) opens it 600 to 900 ms after Today settles, once. Half a poll in, nothing yet.
    delegate.navigatorKey.currentState!.pop();
    await tester.pumpAndSettle();
    await _wait(tester, const Duration(milliseconds: 150));
    expect(opened, 0);
    await _wait(tester, const Duration(seconds: 1));
    expect(opened, 1);
    await _wait(tester, const Duration(seconds: 2));
    expect(opened, 1);
    expect(await prefs.getBool(welcomeCreditsShownKey('u1')), isTrue);
  });
}
