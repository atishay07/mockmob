// ignore_for_file: depend_on_referenced_packages
// D181 (owner, 20 Oct 2026), review v15: the first-session sheet arms on the second return to Today since the
// student first viewed a result. Counted by the real router, so it holds however the page closed: a pop, or `go`
// home from a result opened with `go` (which takes the shell away and builds it again). A sheet opened and closed
// on Today, and a page of another tab opened and closed, are not returns.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/billing/billing.dart' show playBillingUserIdProvider;
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart';

Future<ProviderContainer> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(720, 1560);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(
    overrides: <Override>[
      authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1')),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      proNudgePrefsProvider.overrideWithValue(MemoryPrefsStore()),
      playBillingUserIdProvider.overrideWithValue('u1'),
      // The count is kept whatever the flag says; with the nudges off nothing opens over the screens here.
      proNudgesOnProvider.overrideWithValue(false),
      proNudgeCreditsLowProvider.overrideWithValue(false),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: Consumer(
        builder: (context, ref, _) => MaterialApp.router(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          routerConfig: ref.watch(routerProvider),
        ),
      ),
    ),
  );
  await _settle(tester);
  return container;
}

/// Real screens keep timers and requests alive, so settle for a fixed span instead of waiting.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

void main() {
  setUp(() => SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty());

  testWidgets('only the second real return to Today arms the sheet: a result closed, not a sheet or another tab\'s page', (tester) async {
    final container = await _pump(tester);
    final router = container.read(routerProvider);
    ProNudgeState nudge() => container.read(proNudgeProvider);
    String top() => router.state.uri.path;
    expect(top(), AppRoutes.today);
    expect(nudge().loaded, isTrue);

    // A first mock's result, opened with `go` (the shell is taken away), seen, then home with `go`: the first return.
    router.go(AppRoutes.resultSealed('att1'));
    await _settle(tester);
    router.go(AppRoutes.result('att1'));
    await _settle(tester);
    container.read(proNudgeProvider.notifier).noteResultViewed('att1');
    router.go(AppRoutes.today);
    await _settle(tester);
    expect(top(), AppRoutes.today);
    expect(nudge().todayReturns, 1, reason: 'the result closed back to Today');
    expect(nudge().armed, isFalse);

    // A sheet the router opens on Today, opened and closed.
    router.push('/today/week');
    await _settle(tester);
    router.pop();
    await _settle(tester);
    // A sheet opened over Today without the router, opened and closed.
    final navigator = router.routerDelegate.navigatorKey.currentState!;
    showModalBottomSheet<void>(context: navigator.context, builder: (_) => const SizedBox(height: 120, child: Text('a sheet')));
    await _settle(tester);
    expect(find.text('a sheet'), findsOneWidget);
    navigator.pop();
    await _settle(tester);
    expect(top(), AppRoutes.today);
    expect(nudge().todayReturns, 1, reason: 'a sheet closing is not a return');

    // Practice: a page opened and closed there, then the Today tab.
    router.go(AppRoutes.practice);
    await _settle(tester);
    router.push(AppRoutes.practiceSetup('quick'));
    await _settle(tester);
    expect(top(), AppRoutes.practiceSetup('quick'));
    router.pop();
    await _settle(tester);
    expect(top(), AppRoutes.practice);
    router.go(AppRoutes.today);
    await _settle(tester);
    expect(nudge().todayReturns, 1, reason: 'a page of another tab, then a switch of tab, is not a return');
    expect(nudge().armed, isFalse);

    // A second result, pushed over Today and closed with Back: the second real return arms the sheet.
    router.push(AppRoutes.result('att2'));
    await _settle(tester);
    container.read(proNudgeProvider.notifier).noteResultViewed('att2');
    router.pop();
    await _settle(tester);
    expect(top(), AppRoutes.today);
    expect(nudge().todayReturns, 2, reason: 'a later result does not start the count again');
    expect(nudge().armed, isTrue);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('returns before any result was viewed count for nothing', (tester) async {
    final container = await _pump(tester);
    final router = container.read(routerProvider);
    for (var i = 0; i < 3; i++) {
      router.push(AppRoutes.practiceSetup('quick'));
      await _settle(tester);
      router.pop();
      await _settle(tester);
    }
    expect(container.read(proNudgeProvider).todayReturns, 0);
    expect(container.read(proNudgeProvider).armed, isFalse);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 10));
  });
}
