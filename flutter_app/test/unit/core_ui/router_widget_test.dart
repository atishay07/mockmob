import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/app_shell.dart';
import 'package:mockmob/core/router/external_link_opener.dart';
import 'package:mockmob/core/router/placeholder_screen.dart';
import 'package:mockmob/core/router/router.dart';
import 'package:mockmob/core/router/routes.dart';
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

Future<ProviderContainer> _pump(
  WidgetTester tester, {
  AuthSnapshot auth = _signedIn,
  ExternalLinkOpener? opener,
}) async {
  tester.view.physicalSize = const Size(720, 1560);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(
    overrides: <Override>[
      authSnapshotProvider.overrideWithBuild((ref, notifier) => ref.watch(_testAuth)),
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
  await tester.pumpAndSettle();
  return container;
}

GoRouter _router(ProviderContainer container) => container.read(routerProvider);

Finder _tab(String label) => find.descendant(of: find.byType(MmBottomNav), matching: find.text(label));

String _location(ProviderContainer container) =>
    _router(container).routerDelegate.currentConfiguration.uri.toString();

Finder _placeholder(String route) =>
    find.byWidgetPredicate((w) => w is PlaceholderScreen && w.route == route, description: 'placeholder $route');

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

void main() {
  testWidgets('cold start with a known signed-in user lands on Today with the bottom nav', (tester) async {
    final container = await _pump(tester);
    expect(_location(container), '/today');
    expect(_placeholder('/today'), findsOneWidget);
    expect(find.byType(MmBottomNav), findsOneWidget);
    expect(_tab('Practice'), findsOneWidget);
    expect(_tab('You'), findsOneWidget);
  });

  testWidgets('unknown auth shows the splash, signed out shows welcome', (tester) async {
    final container = await _pump(tester, auth: AuthSnapshot.unknown);
    expect(_location(container), '/splash');
    expect(_placeholder('/splash'), findsOneWidget);

    container.read(_testAuth.notifier).set(AuthSnapshot.signedOut);
    await tester.pumpAndSettle();
    expect(_location(container), '/welcome');
    expect(_placeholder('/welcome'), findsOneWidget);
  });

  testWidgets('every route of spec 4.2 builds a placeholder', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);

    for (final template in AppRoutes.templates) {
      final path = _sample(template);
      if (AppRoutes.isAuthPath(path) || path == AppRoutes.dashboard) continue;
      router.go(path);
      await tester.pumpAndSettle();
      expect(_placeholder(template), findsOneWidget, reason: 'route $template at $path');
      expect(tester.takeException(), isNull, reason: path);
    }
  });

  testWidgets('every auth route builds a placeholder when signed out', (tester) async {
    final container = await _pump(tester, auth: AuthSnapshot.signedOut);
    final router = _router(container);

    for (final template in AppRoutes.templates.where((t) => AppRoutes.isAuthPath(_sample(t)))) {
      if (template == AppRoutes.splash) continue;
      router.go(_sample(template));
      await tester.pumpAndSettle();
      expect(_placeholder(template), findsOneWidget, reason: template);
    }
  });

  testWidgets('/dashboard is Today', (tester) async {
    final container = await _pump(tester);
    _router(container).go('/dashboard');
    await tester.pumpAndSettle();
    expect(_location(container), '/today');
  });

  testWidgets('tabs switch with the bottom nav and keep their own state', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);

    await tester.tap(_tab('Practice'));
    await tester.pumpAndSettle();
    expect(_location(container), '/practice');

    router.go('/practice/setup/full');
    await tester.pumpAndSettle();
    expect(_location(container), '/practice/setup/full');

    await tester.tap(_tab('Learn'));
    await tester.pumpAndSettle();
    expect(_location(container), '/learn');

    // Back to Practice: its pushed screen is still there.
    await tester.tap(_tab('Practice'));
    await tester.pumpAndSettle();
    expect(_location(container), '/practice/setup/full');
  });

  testWidgets('re-tapping a tab pops to its root, then asks the screen to scroll to top', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    router.go('/practice');
    await tester.pumpAndSettle();
    router.push('/practice/setup/quick');
    await tester.pumpAndSettle();

    await tester.tap(_tab('Practice'));
    await tester.pumpAndSettle();
    expect(_location(container), '/practice');
    expect(container.read(tabReselectProvider), isNull);

    await tester.tap(_tab('Practice'));
    await tester.pumpAndSettle();
    final event = container.read(tabReselectProvider);
    expect(event?.tabIndex, 1);
  });

  testWidgets('back from another tab goes to Today, then exits', (tester) async {
    final container = await _pump(tester);
    await tester.tap(_tab('You'));
    await tester.pumpAndSettle();
    expect(_location(container), '/you');

    final handled = await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(handled, isTrue);
    expect(_location(container), '/today');
  });

  testWidgets('a sheet route opens over the shell and dismisses with back', (tester) async {
    final container = await _pump(tester);
    _router(container).push('/today/week');
    await tester.pumpAndSettle();
    expect(_placeholder('/today/week'), findsOneWidget);
    expect(find.text('Today'), findsWidgets, reason: 'the shell is still behind the sheet');

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(_placeholder('/today/week'), findsNothing);
    expect(_location(container), '/today');
  });

  testWidgets('a deep link while signed out continues after sign-in', (tester) async {
    final container = await _pump(tester, auth: AuthSnapshot.signedOut);
    final router = _router(container);

    router.go('/result/att9');
    await tester.pumpAndSettle();
    expect(_location(container), '/sign-in');

    container.read(_testAuth.notifier).set(_signedIn);
    await tester.pumpAndSettle();
    expect(_location(container), '/result/att9');
  });

  testWidgets('the Review dot follows its provider', (tester) async {
    final container = await _pump(tester);
    final handle = tester.ensureSemantics();
    expect(find.bySemanticsLabel('Review, tab 3 of 5'), findsOneWidget);
    handle.dispose();
    expect(container.read(reviewDotProvider), isFalse);
  });

  testWidgets('an unknown page on our domain opens in a Custom Tab and keeps the current screen', (tester) async {
    final opener = _RecordingOpener();
    final container = await _pump(tester, opener: opener);
    _router(container).go('/cuet-mock-test-free');
    await tester.pumpAndSettle();
    expect(opener.opened, [Uri.parse('https://www.mockmob.in/cuet-mock-test-free')]);
    expect(_location(container), '/today');
  });

  testWidgets('a pricing link never opens', (tester) async {
    final opener = _RecordingOpener();
    final container = await _pump(tester, opener: opener);
    _router(container).go('/pricing');
    await tester.pumpAndSettle();
    expect(opener.opened, isEmpty);
    expect(_location(container), '/today');
  });
}
