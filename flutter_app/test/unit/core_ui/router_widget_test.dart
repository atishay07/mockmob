// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemChannels;
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
import 'package:mockmob/core/widgets/bar/bar_badges.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart' show AccountAvatarButton;
import 'package:mockmob/core/widgets/bar/mm_bar.dart';
import 'package:mockmob/features/account_access/access_routes.dart';
import 'package:mockmob/features/account_access/screens/forgot_password_screen.dart';
import 'package:mockmob/features/account_access/screens/password_sign_in_screen.dart';
import 'package:mockmob/features/account_access/screens/phone_screens.dart';
import 'package:mockmob/features/account_access/screens/set_password_screen.dart';
import 'package:mockmob/features/account_sheet/account_sheet.dart' show AccountSheet;
import 'package:mockmob/features/practice/practice_setup_screen.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';

import '../../helpers/fonts.dart';

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

class _FakeLinks implements AppLinkSource {
  _FakeLinks({this.initial});

  final Uri? initial;
  final StreamController<Uri> controller = StreamController<Uri>.broadcast();

  @override
  Future<Uri?> initialLink() async => initial;

  @override
  Stream<Uri> get links => controller.stream;
}

Future<ProviderContainer> _pump(
  WidgetTester tester, {
  AuthSnapshot auth = _signedIn,
  ExternalLinkOpener? opener,
  AppLinkSource? links,
}) async {
  tester.view.physicalSize = const Size(720, 1560);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(
    overrides: <Override>[
      authSnapshotProvider.overrideWithBuild((ref, notifier) => ref.watch(_testAuth)),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      if (opener != null) externalLinkOpenerProvider.overrideWithValue(opener),
      if (links != null) appLinkSourceProvider.overrideWithValue(links),
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

Finder _tab(String label) => find.descendant(of: find.byType(MmBottomBar), matching: find.text(label));

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

  _test('cold start with a known signed-in user lands on Today with the bar', (tester) async {
    final container = await _pump(tester);
    expect(_location(container), '/today');
    expect(find.byType(MmBottomBar), findsOneWidget);
    expect(_tab('Today'), findsOneWidget);
    expect(_tab('Practice'), findsOneWidget);
    expect(_tab('Start'), findsOneWidget, reason: 'the volt key in the middle slot');
    expect(_tab('Review'), findsOneWidget);
    expect(_tab('Colleges'), findsOneWidget, reason: 'Colleges is a place on the bar (app-ia D1, L32)');
    expect(_tab('You'), findsOneWidget, reason: 'You is a place on the bar (DOCK.md option A)');
    expect(_tab('Learn'), findsNothing, reason: 'Learn is no longer a tab');
  });

  _test('/you builds inside the shell with the bar; its pages and Learn cover it', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    router.go(AppRoutes.you);
    await _settle(tester);
    expect(_location(container), '/you');
    expect(find.byType(MmBottomBar), findsOneWidget);

    await tester.tap(_tab('Today'));
    await _settle(tester);
    expect(_location(container), '/today');
    await tester.tap(_tab('You'));
    await _settle(tester);
    expect(_location(container), '/you', reason: 'the You tab opens the You root');

    for (final page in ['/you/goal', '/you/account', '/you/appearance', '/you/milestones']) {
      router.go(page);
      await _settle(tester);
      expect(_location(container), page);
      expect(find.byType(MmBottomBar), findsNothing, reason: '$page is a root page over the bar');
    }

    router.go(AppRoutes.learn);
    await _settle(tester);
    expect(_location(container), '/learn');
    expect(find.byType(MmBottomBar), findsNothing);

    router.go(AppRoutes.today);
    await _settle(tester);
    expect(find.byType(MmBottomBar), findsOneWidget);
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

  _test('the keyboard hides the bar and it comes back when the keyboard closes', (tester) async {
    await _pump(tester);
    double opacity() => tester.widget<Opacity>(find.ancestor(of: find.byType(MmBottomBar), matching: find.byType(Opacity)).first).opacity;
    expect(opacity(), 1);
    tester.view.viewInsets = const FakeViewPadding(bottom: 600);
    await _settle(tester);
    expect(opacity(), 0);
    expect(
      tester.widget<IgnorePointer>(find.ancestor(of: find.byType(MmBottomBar), matching: find.byType(IgnorePointer)).first).ignoring,
      isTrue,
      reason: 'a hidden bar takes no taps',
    );
    tester.view.resetViewInsets();
    await _settle(tester);
    expect(opacity(), 1);
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

    await tester.tap(_tab('Review'));
    await _settle(tester);
    expect(_location(container), '/review');

    router.go('/review/mistakes');
    await _settle(tester);
    expect(_location(container), '/review/mistakes');

    await tester.tap(_tab('Practice'));
    await _settle(tester);
    expect(_location(container), '/practice');

    // Back to Review: its pushed screen is still there.
    await tester.tap(_tab('Review'));
    await _settle(tester);
    expect(_location(container), '/review/mistakes');
  });

  _test('the confirm pages inside Practice hide the dock, like the runner', (tester) async {
    final container = await _pump(tester);
    _router(container).go('/practice/setup/full');
    await _settle(tester);
    expect(find.byType(MmBottomBar), findsNothing);

    _router(container).go('/practice');
    await _settle(tester);
    expect(find.byType(MmBottomBar), findsOneWidget);
  });

  _test('re-tapping a tab pops to its root, then asks the screen to scroll to top', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    router.go('/review');
    await _settle(tester);
    router.push('/review/mistakes');
    await _settle(tester);

    await tester.tap(_tab('Review'));
    await _settle(tester);
    expect(_location(container), '/review');
    expect(container.read(tabReselectProvider), isNull);

    await tester.tap(_tab('Review'));
    await _settle(tester);
    final event = container.read(tabReselectProvider);
    expect(event?.tabIndex, 2);
  });

  _test('/colleges is the fourth tab with the bar and the avatar; /tools redirects to it', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    await tester.tap(_tab('Colleges'));
    await _settle(tester);
    expect(_location(container), AppRoutes.colleges);
    expect(find.byType(MmBottomBar), findsOneWidget);
    expect(find.byType(AccountAvatarButton), findsOneWidget, reason: 'the avatar on every tab root');

    router.go(AppRoutes.today);
    await _settle(tester);
    router.go(AppRoutes.tools);
    await _settle(tester);
    expect(_location(container), AppRoutes.colleges, reason: '/tools is the Colleges tab now');

    // The tool pages keep their paths, cover the bar, and Back returns to the tab.
    unawaited(router.push(AppRoutes.toolsCompass));
    await _settle(tester);
    expect(find.byType(CompassScreen), findsOneWidget);
    expect(find.byType(MmBottomBar), findsNothing);
    await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(_location(container), AppRoutes.colleges);
    expect(find.byType(MmBottomBar), findsOneWidget);

    // Back from Colleges goes to Today, as from every tab.
    final handled = await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(handled, isTrue);
    expect(_location(container), AppRoutes.today);
  });

  _test('a link to a CUET tool opens it over Colleges, so Back never leaves the app (L04)', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    openNativeLocation(router, AppRoutes.toolsCompass);
    await _settle(tester);
    expect(find.byType(CompassScreen), findsOneWidget);
    final handled = await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(handled, isTrue);
    expect(_location(container), AppRoutes.colleges);
    expect(find.byType(MmBottomBar), findsOneWidget);
  });

  _test('/you?account=1 (the website profile) lands on You with the account sheet open', (tester) async {
    final container = await _pump(tester);
    _router(container).go(AppRoutes.youWithAccount);
    await _settle(tester);
    expect(_location(container), AppRoutes.you, reason: 'the query is dropped');
    expect(find.byType(AccountSheet), findsOneWidget);
    await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(find.byType(AccountSheet), findsNothing, reason: 'Back closes the sheet first');
    expect(_location(container), AppRoutes.you);
  });

  _test('back from another tab goes to Today, then exits', (tester) async {
    final container = await _pump(tester);
    await tester.tap(_tab('Review'));
    await _settle(tester);
    expect(_location(container), '/review');

    final handled = await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(handled, isTrue);
    expect(_location(container), '/today');
  });

  _test('back on Today asks for a second press before Android closes the app', (tester) async {
    final container = await _pump(tester);
    expect(_location(container), '/today');

    final first = await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(first, isTrue, reason: 'one stray press never closes the app');
    expect(_location(container), '/today');
    expect(find.text('Press back again to close'), findsOneWidget);

    final second = await tester.binding.handlePopRoute();
    expect(second, isFalse, reason: 'the second press inside the window is left to Android, which closes the app');

    // Past the window the next press only arms again.
    await tester.pump(const Duration(seconds: 3));
    final again = await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(again, isTrue);
    expect(_location(container), '/today');
  });

  // Android 14's predictive back: when the framework says it will not handle back, Android closes
  // the app without asking Flutter, so handlePopRoute alone (above) never saw the owner's bug.
  _test('the engine is told Flutter handles back on every tab until the second press on Today (L04)', (tester) async {
    final told = <bool>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'SystemNavigator.setFrameworkHandlesBack') told.add(call.arguments as bool);
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);

    final container = await _pump(tester);
    expect(told, isNotEmpty);
    expect(told.last, isTrue, reason: 'on Today the first press only arms closing');

    for (final tab in ['Practice', 'Review', 'Colleges', 'You']) {
      await tester.tap(_tab(tab));
      await _settle(tester);
      expect(told.last, isTrue, reason: 'Back on $tab goes to Today; Android must not close the app');
      final handled = await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(handled, isTrue);
      expect(_location(container), AppRoutes.today, reason: 'Back on $tab');
      expect(told.last, isTrue);
    }

    await tester.binding.handlePopRoute();
    await _settle(tester);
    expect(told.last, isFalse, reason: 'armed: the second press is Android closing the app');
    await tester.pump(const Duration(seconds: 3));
    await _settle(tester);
    expect(told.last, isTrue, reason: 'past the window, back only arms again');
  });

  _test('the avatar opens the account sheet from all five tab roots (L16, D5)', (tester) async {
    final container = await _pump(tester);
    for (final root in AppRoutes.tabRoots) {
      _router(container).go(root);
      await _settle(tester);
      expect(find.byType(AccountAvatarButton), findsOneWidget, reason: 'one avatar on $root');
    }
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

  _test('signing out does not hand the screen you left to the next student who signs in', (tester) async {
    final container = await _pump(tester);
    _router(container).go('/you/account');
    await _settle(tester);
    expect(_location(container), '/you/account');

    container.read(_testAuth.notifier).set(AuthSnapshot.signedOut);
    await _settle(tester);
    expect(_location(container), '/sign-in');
    expect(container.read(intendedRouteProvider).location, isNull);

    container.read(_testAuth.notifier).set(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2'));
    await _settle(tester);
    expect(_location(container), '/today');
  });

  _test('an expired session continues for the same student only', (tester) async {
    final container = await _pump(tester);
    _router(container).go('/result/att9');
    await _settle(tester);

    container.read(_testAuth.notifier).set(const AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true));
    await _settle(tester);
    expect(_location(container), '/sign-in');

    container.read(_testAuth.notifier).set(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2'));
    await _settle(tester);
    expect(_location(container), '/today', reason: 'a different student never lands on the last result');
  });

  _test('an expired session returns the same student to where they were', (tester) async {
    final container = await _pump(tester);
    _router(container).go('/result/att9');
    await _settle(tester);

    container.read(_testAuth.notifier).set(const AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true));
    await _settle(tester);
    container.read(_testAuth.notifier).set(_signedIn);
    await _settle(tester);
    expect(_location(container), '/result/att9');
  });

  _test('the tabs count to five and carry no badge by default', (tester) async {
    final container = await _pump(tester);
    final handle = tester.ensureSemantics();
    expect(find.bySemanticsLabel('Review, tab 3 of 5'), findsOneWidget);
    expect(find.bySemanticsLabel('Colleges, tab 4 of 5'), findsOneWidget);
    expect(find.bySemanticsLabel('You, tab 5 of 5'), findsOneWidget);
    expect(find.bySemanticsLabel(MmBottomBar.startSemanticsLabel), findsOneWidget);
    handle.dispose();
    expect(container.read(barBadgesProvider), BarBadges.none);
  });

  _test('the runner, result, repair, setup and NTA paths build with no bar', (tester) async {
    final container = await _pump(tester);
    final router = _router(container);
    for (final template in ['/run/s1', '/result/att1', AppRoutes.practiceSetup('full')]) {
      router.go(_sample(template));
      await _settle(tester);
      expect(find.byType(MmBottomBar), findsNothing, reason: template);
      expect(tester.takeException(), isNull, reason: template);
    }
    for (final template in AppRoutes.templates.where((t) => t.contains('repair/') || t.contains('nta'))) {
      router.go(_sample(template));
      await _settle(tester);
      expect(find.byType(MmBottomBar), findsNothing, reason: template);
      expect(tester.takeException(), isNull, reason: template);
    }
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

  group('account access routes (auth-01)', () {
    // Real type: the Ahem test font is wide enough to overflow these forms' fixed rows.
    setUpAll(loadAppFonts);

    _test('the sign-in methods open their screens when signed out', (tester) async {
      final container = await _pump(tester, auth: AuthSnapshot.signedOut);
      final router = _router(container);
      for (final (path, screen) in [
        (AccountAccessRoutes.passwordSignIn, PasswordSignInScreen),
        (AccountAccessRoutes.passwordSignInFor(email: 'a@b.in'), PasswordSignInScreen),
        (AccountAccessRoutes.forgotPassword, ForgotPasswordScreen),
        (AccountAccessRoutes.phoneSignIn, PhoneSignInScreen),
      ]) {
        router.go(path);
        await _settle(tester);
        expect(_location(container), path, reason: path);
        expect(find.byType(screen), findsOneWidget, reason: path);
        expect(tester.takeException(), isNull, reason: path);
      }
    });

    _test('set password and add phone open over the shell when signed in', (tester) async {
      final container = await _pump(tester);
      final router = _router(container);
      for (final (path, screen) in [
        (AccountAccessRoutes.setPassword, SetPasswordScreen),
        (AccountAccessRoutes.addPhone, AddPhoneScreen),
      ]) {
        router.go(path);
        await _settle(tester);
        expect(_location(container), path, reason: path);
        expect(find.byType(screen), findsOneWidget, reason: path);
        expect(find.byType(MmBottomBar), findsNothing, reason: '$path is a root page');
        expect(tester.takeException(), isNull, reason: path);
      }
    });

    _test('a reset code sign-in continues to Choose a new password', (tester) async {
      final container = await _pump(tester, auth: AuthSnapshot.signedOut);
      final router = _router(container);
      router.go(AccountAccessRoutes.forgotPassword);
      await _settle(tester);

      // What the forgot-password screen does just before the code signs the student in.
      container.read(intendedRouteProvider).remember(AccountAccessRoutes.setPasswordAfterReset);
      container.read(_testAuth.notifier).set(_signedIn);
      await _settle(tester);

      expect(_location(container), AccountAccessRoutes.setPasswordAfterReset);
      expect(tester.widget<SetPasswordScreen>(find.byType(SetPasswordScreen)).reset, isTrue);
    });

    _test('the reset destination while signed out goes through sign-in', (tester) async {
      final container = await _pump(tester, auth: AuthSnapshot.signedOut);
      _router(container).go(AccountAccessRoutes.setPasswordAfterReset);
      await _settle(tester);
      expect(_location(container), AppRoutes.signIn);
      expect(container.read(intendedRouteProvider).location, AccountAccessRoutes.setPasswordAfterReset);
    });
  });

  group('Practice setup over the dock (tools-06)', () {
    const fromCompass = '/practice/setup/quick?subject=accountancy';

    // A push leaves the base location as it was; the top page's own location is the state's.
    String top(ProviderContainer container) => _router(container).state.uri.toString();
    String topPath(ProviderContainer container) => _router(container).state.uri.path;

    _test('Practise from Compass opens setup over it, and Back returns to Compass', (tester) async {
      final container = await _pump(tester);
      final router = _router(container);
      // The way in from the app: Practice's More row opens Compass directly.
      router.go(AppRoutes.practice);
      await _settle(tester);
      unawaited(router.push(AppRoutes.toolsCompass));
      await _settle(tester);
      expect(find.byType(CompassScreen), findsOneWidget);

      // What the Practise chip and the Pro key do.
      unawaited(router.push(fromCompass));
      await _settle(tester);
      expect(tester.takeException(), isNull, reason: 'the shell is not built a second time');
      expect(top(container), fromCompass);
      expect(find.byType(PracticeSetupScreen), findsOneWidget);
      expect(find.byType(MmBottomBar), findsNothing);

      await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(top(container), AppRoutes.toolsCompass);
      expect(find.byType(CompassScreen), findsOneWidget);
      expect(find.byType(PracticeSetupScreen), findsNothing);

      // Compass is still stacked over Practice.
      await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(top(container), AppRoutes.practice);
      expect(find.byType(MmBottomBar), findsOneWidget);
    });

    _test('Compass opened by a link: Practise and Back work the same', (tester) async {
      final container = await _pump(tester);
      final router = _router(container);
      router.go(AppRoutes.toolsCompass);
      await _settle(tester);
      unawaited(router.push(fromCompass));
      await _settle(tester);
      expect(tester.takeException(), isNull);
      expect(top(container), fromCompass);
      expect(find.byType(PracticeSetupScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(top(container), AppRoutes.toolsCompass);
      expect(find.byType(CompassScreen), findsOneWidget);
    });

    _test('Start sheet (go): setup over Practice, Back to the Practice tab', (tester) async {
      final container = await _pump(tester);
      final router = _router(container);
      // QuickStartSheet's Quick 10 row.
      router.go(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString());
      await _settle(tester);
      expect(tester.takeException(), isNull);
      expect(top(container), '/practice/setup/quick?count=10');
      expect(find.byType(PracticeSetupScreen), findsOneWidget);
      expect(find.byType(MmBottomBar), findsNothing);

      await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(topPath(container), AppRoutes.practice);
      expect(find.byType(PracticeSetupScreen), findsNothing);
      expect(find.byType(MmBottomBar), findsOneWidget);
    });

    _test('Today (push from the tab): Back returns to Today', (tester) async {
      final container = await _pump(tester);
      final router = _router(container);
      expect(top(container), AppRoutes.today);
      // Today's "Full mock" link (TodayScreen pushes anything that is not a tab root).
      unawaited(router.push(Uri(path: AppRoutes.practiceSetup('full'), queryParameters: {'subject': 'accountancy'}).toString()));
      await _settle(tester);
      expect(tester.takeException(), isNull);
      expect(top(container), '/practice/setup/full?subject=accountancy');
      expect(find.byType(PracticeSetupScreen), findsOneWidget);
      expect(find.byType(MmBottomBar), findsNothing);

      await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(top(container), AppRoutes.today);
      expect(find.byType(PracticeSetupScreen), findsNothing);
      expect(find.byType(MmBottomBar), findsOneWidget);
    });

    _test('a website link through ActionRouter opens setup, Back to Practice', (tester) async {
      final links = _FakeLinks();
      final container = await _pump(tester, links: links);
      links.controller.add(Uri.parse('https://www.mockmob.in/test?mode=quick&subject=accountancy'));
      await _settle(tester);
      expect(tester.takeException(), isNull);
      expect(top(container), fromCompass);
      expect(find.byType(PracticeSetupScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await _settle(tester);
      expect(topPath(container), AppRoutes.practice);
      expect(find.byType(PracticeSetupScreen), findsNothing);
    });
  });

  group('App Links (navigation-01)', () {
    _test('a link on our domain opens its native screen when signed in', (tester) async {
      final links = _FakeLinks();
      final container = await _pump(tester, links: links);
      links.controller.add(Uri.parse('https://www.mockmob.in/result/att7'));
      await _settle(tester);
      expect(_location(container), '/result/att7');
    });

    _test('a page with no native screen opens in a Custom Tab; others are ignored', (tester) async {
      final links = _FakeLinks();
      final opener = _RecordingOpener();
      final container = await _pump(tester, links: links, opener: opener);
      links.controller
        ..add(Uri.parse('https://www.mockmob.in/cuet-mock-test-free'))
        ..add(Uri.parse('https://evil.example/today'))
        ..add(Uri.parse('https://www.mockmob.in/pricing'))
        ..add(Uri.parse('in.mockmob.app://login-callback?code=x'));
      await _settle(tester);
      expect(opener.opened, [Uri.parse('https://www.mockmob.in/cuet-mock-test-free')]);
      expect(_location(container), '/today');
    });

    _test('the launch link while signed out continues after sign-in', (tester) async {
      final links = _FakeLinks(initial: Uri.parse('https://mockmob.in/result/att9'));
      final container = await _pump(tester, auth: AuthSnapshot.signedOut, links: links);
      expect(_location(container), AppRoutes.signIn);

      // app_links replays the launch link on the stream; it is handled once.
      links.controller.add(Uri.parse('https://mockmob.in/result/att9'));
      await _settle(tester);

      container.read(_testAuth.notifier).set(_signedIn);
      await _settle(tester);
      expect(_location(container), '/result/att9');
    });

    _test('a link while auth is still loading is remembered for after the splash', (tester) async {
      final links = _FakeLinks(initial: Uri.parse('https://www.mockmob.in/review'));
      final container = await _pump(tester, auth: AuthSnapshot.unknown, links: links);
      expect(_location(container), '/splash');
      expect(container.read(intendedRouteProvider).location, '/review');

      container.read(_testAuth.notifier).set(_signedIn);
      await _settle(tester);
      expect(_location(container), '/review');
    });
  });
}
