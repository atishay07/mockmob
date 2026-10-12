// ignore_for_file: depend_on_referenced_packages
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/app_shell.dart';
import 'package:mockmob/core/router/external_link_opener.dart';
import 'package:mockmob/core/router/router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/bottom_nav.dart';

class _Auth extends Notifier<AuthSnapshot> {
  @override
  AuthSnapshot build() => AuthSnapshot.signedOut;

  void set(AuthSnapshot value) => state = value;
}

final _testAuth = NotifierProvider<_Auth, AuthSnapshot>(_Auth.new);

class _RecordingOpener implements ExternalLinkOpener {
  final List<Uri> opened = [];

  @override
  Future<bool> open(Uri uri) async {
    opened.add(uri);
    return true;
  }
}

const _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');

Future<ProviderContainer> _pump(WidgetTester tester, {AuthSnapshot auth = _signedIn, ExternalLinkOpener? opener}) async {
  tester.view.physicalSize = const Size(720, 1560);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(
    overrides: <Override>[
      authSnapshotProvider.overrideWithBuild((ref, notifier) => ref.watch(_testAuth)),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      if (opener != null) externalLinkOpenerProvider.overrideWithValue(opener),
    ],
  );
  addTearDown(container.dispose);
  container.read(_testAuth.notifier).set(auth);

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

GoRouter _router(ProviderContainer container) => container.read(routerProvider);

Finder _tab(String label) => find.descendant(of: find.byType(MmBottomNav), matching: find.text(label));

String _location(ProviderContainer container) => _router(container).routerDelegate.currentConfiguration.uri.toString();

String _sample(String template) => template.replaceAllMapped(RegExp(r':(\w+)'), (m) {
  return switch (m[1]) {
    'i' => '2',
    'card' => '2',
    'mode' => 'quick',
    'actionId' => 'act1',
    'attemptId' => 'att1',
    'questionId' => 'q1',
    'sessionId' => 's1',
    'unitId' => 'u1',
    'runId' => 'r1',
    _ => 'x',
  };
});

/// Runs [body], then unmounts the app and lets the real screens' timers run out.
void _test(String name, Future<void> Function(WidgetTester tester) body) {
  testWidgets(name, (tester) async {
    await body(tester);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 10));
  });
}

void main() {
  setUp(() => SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty());

  _test('cold start with a known signed-in user lands on Today with the bottom nav', (tester) async {
    final container = await _pump(tester);
    expect(_location(container), '/today');
    expect(find.byType(MmBottomNav), findsOneWidget);
    expect(_tab('Practice'), findsOneWidget);
    expect(_tab('You'), findsOneWidget);
  });

  _test('unknown auth shows the splash, signed out shows welcome', (tester) async {
    final container = await _pump(tester, auth: AuthSnapshot.unknown);
    expect(_location(container), '/splash');

    container.read(_testAuth.notifier).set(AuthSnapshot.signedOut);
    await _settle(tester);
    expect(_location(container), '/welcome');
  });

  _test('every route of spec 4.2 opens its screen', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);

    for (final template in AppRoutes.templates) {
      final path = _sample(template);
      if (AppRoutes.isAuthPath(path) || path == AppRoutes.dashboard) continue;
      router.go(path);
      await _settle(tester);
      expect(_location(container), isNotEmpty, reason: 'route $template at $path');
      expect(tester.takeException(), isNull, reason: path);
    }
  });

  _test('every auth route opens its screen when signed out', (tester) async {
    final container = await _pump(tester, auth: AuthSnapshot.signedOut);
    final router = _router(container);

    for (final template in AppRoutes.templates.where((t) => AppRoutes.isAuthPath(_sample(t)))) {
      if (template == AppRoutes.splash) continue;
      router.go(_sample(template));
      await _settle(tester);
      expect(tester.takeException(), isNull, reason: template);
    }
  });

  _test('/dashboard is Today', (tester) async {
    final container = await _pump(tester);
    _router(container).go('/dashboard');
    await _settle(tester);
    expect(_location(container), '/today');
  });

  _test('tabs switch with the bottom nav and keep their own state', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);

    await tester.tap(_tab('Practice'));
    await _settle(tester);
    expect(_location(container), '/practice');

    router.go('/practice/setup/full');
    await _settle(tester);
    expect(_location(container), '/practice/setup/full');

    await tester.tap(_tab('Learn'));
    await _settle(tester);
    expect(_location(container), '/learn');

    // Back to Practice: its pushed screen is still there.
    await tester.tap(_tab('Practice'));
    await _settle(tester);
    expect(_location(container), '/practice/setup/full');
  });

  _test('re-tapping a tab pops to its root, then asks the screen to scroll to top', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    router.go('/practice');
    await _settle(tester);
    router.push('/practice/setup/quick');
    await _settle(tester);

    await tester.tap(_tab('Practice'));
    await _settle(tester);
    expect(_location(container), '/practice');
    expect(container.read(tabReselectProvider), isNull);

    await tester.tap(_tab('Practice'));
    await _settle(tester);
    final event = container.read(tabReselectProvider);
    expect(event?.tabIndex, 1);
  });

  _test('back from another tab goes to Today, then exits', (tester) async {
    final container = await _pump(tester);
    await tester.tap(_tab('You'));
    await _settle(tester);
    expect(_location(container), '/you');

    final handled = await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(handled, isTrue);
    expect(_location(container), '/today');
  });

  _test('a sheet route opens over the shell and dismisses with back', (tester) async {
    final container = await _pump(tester);
    _router(container).push('/today/week');
    await _settle(tester);
    expect(find.text('Today'), findsWidgets);
    expect(find.text('Today'), findsWidgets, reason: 'the shell is still behind the sheet');

    await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(_location(container), '/today');
  });

  _test('a deep link while signed out continues after sign-in', (tester) async {
    final container = await _pump(tester, auth: AuthSnapshot.signedOut);
    final router = _router(container);

    router.go('/result/att9');
    await _settle(tester);
    expect(_location(container), '/sign-in');

    container.read(_testAuth.notifier).set(_signedIn);
    await _settle(tester);
    expect(_location(container), '/result/att9');
  });

  _test('the Review dot follows its provider', (tester) async {
    final container = await _pump(tester);
    final handle = tester.ensureSemantics();
    expect(find.bySemanticsLabel('Review, tab 3 of 5'), findsOneWidget);
    handle.dispose();
    expect(container.read(reviewDotProvider), isFalse);
  });

  _test('an unknown page on our domain opens in a Custom Tab and keeps the current screen', (tester) async {
    final opener = _RecordingOpener();
    final container = await _pump(tester, opener: opener);
    _router(container).go('/cuet-mock-test-free');
    await _settle(tester);
    expect(opener.opened, [Uri.parse('https://www.mockmob.in/cuet-mock-test-free')]);
    expect(_location(container), '/today');
  });

  _test('a pricing link never opens', (tester) async {
    final opener = _RecordingOpener();
    final container = await _pump(tester, opener: opener);
    _router(container).go('/pricing');
    await _settle(tester);
    expect(opener.opened, isEmpty);
    expect(_location(container), '/today');
  });
}
