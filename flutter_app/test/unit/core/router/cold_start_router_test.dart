// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/router/router.dart';
import 'package:mockmob/core/router/router_redirect.dart';
import 'package:mockmob/core/router/splash_screen.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_opening.dart';

/// Cold start through the real router (finding 24): the brand opening plays on its own clock
/// while the stored session takes 5 s to read, the router keeps its launch screen (never a wrong
/// screen) until the session is known, and then goes where the student was heading: Today, the
/// welcome flow, or the page a link or a killed sign-in left behind.

class _QuietHaptics implements HapticDriver {
  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}

/// A session that is read slowly: unknown until [after], then [result].
class _SlowAuth extends AuthController {
  _SlowAuth({required this.after, required this.result});

  final Duration after;
  final AuthSnapshot result;

  @override
  AuthSnapshot build() {
    Timer(after, () {
      if (ref.mounted) state = result;
    });
    return AuthSnapshot.unknown;
  }
}

const AuthSnapshot _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');

Future<ProviderContainer> _coldStart(
  WidgetTester tester, {
  required AuthSnapshot result,
  Duration authAfter = const Duration(seconds: 5),
  IntendedRoute? restored,
}) async {
  tester.view.physicalSize = const Size(720, 1560);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(
    overrides: [
      hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: _QuietHaptics())),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      authSnapshotProvider.overrideWith(() => _SlowAuth(after: authAfter, result: result)),
      // What main.dart restores from the phone before the first frame.
      intendedRouteProvider.overrideWithValue(restored ?? IntendedRoute()),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: Consumer(
        builder: (context, ref, _) => MaterialApp.router(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.dark),
          routerConfig: ref.watch(routerProvider),
          // As in app.dart: the opening covers whatever the router builds.
          builder: (context, child) => BrandOpeningHost(shown: Future<void>.value(), child: child ?? const SizedBox.shrink()),
        ),
      ),
    ),
  );
  return container;
}

String _location(ProviderContainer container) =>
    container.read(routerProvider).routerDelegate.currentConfiguration.uri.toString();

/// The opening's own time in ms, or null once it is gone.
double? _timeline(WidgetTester tester) {
  final painters = tester
      .widgetList<CustomPaint>(find.descendant(of: find.byType(BrandOpening), matching: find.byType(CustomPaint)))
      .map((c) => c.painter)
      .whereType<CustomPainter>()
      .where((p) => p.runtimeType.toString() == '_OpeningPainter');
  if (painters.isEmpty) return null;
  // ignore: avoid_dynamic_calls
  return (painters.first as dynamic).time() as double;
}

/// Plays the first [until] ms in 16 ms frames, checking at every frame that the router has not
/// gone anywhere but the launch screen, and returns when the opening's unfold began (the camera
/// leaving the "mo") and when the opening was gone.
Future<({int unfoldAt, int goneAt})> _playLaunch(WidgetTester tester, ProviderContainer container, {required int until}) async {
  var unfoldAt = -1;
  var goneAt = -1;
  for (var ms = 16; ms <= until; ms += 16) {
    await tester.pump(const Duration(milliseconds: 16));
    expect(_location(container), '/splash', reason: 'no wrong screen while the session is unknown (at $ms ms)');
    final t = _timeline(tester);
    if (t == null) {
      if (goneAt < 0) goneAt = ms;
    } else if (unfoldAt < 0 && OpeningTimeline.camera(t) > 0) {
      unfoldAt = ms;
    }
  }
  return (unfoldAt: unfoldAt, goneAt: goneAt);
}

/// The route change after the session lands plays its fade: a few frames, not one long pump.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

/// Real screens keep timers alive: unmount, then let them run out.
void _test(String name, Future<void> Function(WidgetTester tester) body) {
  testWidgets(name, (tester) async {
    await body(tester);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 10));
  });
}

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty();
    // As main.dart: the first frame is the opening alone, the app builds under it.
    BrandOpeningHost.deferApp = true;
  });
  tearDown(() => BrandOpeningHost.deferApp = false);

  group('a session that takes 5 s to read', () {
    _test('the unfold starts by 1.0 s; the launch screen holds, then the first screen is Today', (tester) async {
      final container = await _coldStart(tester, result: _signedIn);
      final played = await _playLaunch(tester, container, until: 1008);
      // The camera leaves the "mo" at 500 ms and the word is composed by 1.0 s: not at 3.3 s.
      expect(played.unfoldAt, inInclusiveRange(OpeningTimeline.expandAt, OpeningTimeline.expandAt + 40));
      final t = _timeline(tester)!;
      expect(t, greaterThanOrEqualTo(OpeningTimeline.settledAt));
      expect(OpeningTimeline.camera(t), closeTo(1, 1e-6));

      // The opening hands off to the router's launch screen (the same word), and the router stays
      // on it while the session is read.
      final rest = await _playLaunch(tester, container, until: 700);
      expect(rest.goneAt, greaterThan(0), reason: 'the opening is gone about 1.6 s in');
      expect(find.byType(BrandOpening), findsNothing);
      expect(find.byType(SplashScreen), findsOneWidget);
      for (var ms = 0; ms < 3000; ms += 250) {
        await tester.pump(const Duration(milliseconds: 250));
        expect(_location(container), '/splash');
        expect(find.byType(SplashScreen), findsOneWidget);
      }

      // The session lands at 5 s: Today replaces the launch screen.
      await tester.pump(const Duration(seconds: 1, milliseconds: 500));
      await _settle(tester);
      expect(_location(container), '/today');
      expect(find.byType(SplashScreen), findsNothing);
    });

    _test('a signed-out student goes to the welcome flow, never to Today', (tester) async {
      final container = await _coldStart(tester, result: AuthSnapshot.signedOut);
      await _playLaunch(tester, container, until: 4000);
      expect(_location(container), '/splash');
      await tester.pump(const Duration(seconds: 2));
      await _settle(tester);
      expect(_location(container), '/welcome');
      expect(find.byType(SplashScreen), findsNothing);
    });

    _test('the page a killed sign-in left behind is restored once the session is known', (tester) async {
      // What main.dart read from the phone: the student was heading to this result, with no owner.
      final restored = IntendedRoute()..remember('/result/att9');
      final container = await _coldStart(tester, result: _signedIn, restored: restored);
      await _playLaunch(tester, container, until: 4000);
      expect(_location(container), '/splash', reason: 'not routed anywhere before the session is known');
      expect(container.read(intendedRouteProvider).location, '/result/att9', reason: 'kept, not spent on the launch screen');
      await tester.pump(const Duration(seconds: 2));
      await _settle(tester);
      expect(_location(container), '/result/att9');
    });

    _test('a link tapped while the session is read waits for it, then opens (signed in)', (tester) async {
      final container = await _coldStart(tester, result: _signedIn);
      await _playLaunch(tester, container, until: 2000);
      container.read(intendedRouteProvider).remember('/review');
      await tester.pump(const Duration(seconds: 4));
      // An old Review link lands on Your papers, a door of Practice (D105, D126).
      expect(_location(container), '/practice?door=papers');
    });
  });

  group('a session that is known as the word lands (the usual start)', () {
    _test('the first screen is Today directly, with the opening gone about 1.3 s in', (tester) async {
      final container = await _coldStart(tester, result: _signedIn, authAfter: const Duration(milliseconds: 300));
      var goneAt = -1;
      for (var ms = 16; ms <= 1800; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
        if (goneAt < 0 && find.byType(BrandOpening).evaluate().isEmpty) goneAt = ms;
      }
      expect(goneAt, inInclusiveRange(OpeningTimeline.settledAt + OpeningTimeline.fadeMs - 20, OpeningTimeline.settledAt + OpeningTimeline.fadeMs + 40));
      expect(_location(container), '/today');
      expect(find.byType(SplashScreen), findsNothing);
    });
  });
}
