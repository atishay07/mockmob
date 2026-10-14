import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/platform/app_shortcuts.dart';
import 'package:mockmob/core/platform/native_prefs.dart';
import 'package:mockmob/core/platform/native_touches.dart';
import 'package:mockmob/core/platform/play_update.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/router/router.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:quick_actions/quick_actions.dart';

import '../core_data/support/fixtures.dart';

class _Auth extends AuthController {
  _Auth(this.initial);

  final AuthSnapshot initial;

  @override
  AuthSnapshot build() => initial;

  void put(AuthSnapshot next) => state = next;
}

class _Router extends Fake implements GoRouter {
  final List<String> went = [];

  @override
  void go(String location, {Object? extra}) => went.add(location);
}

class _Surface implements ShortcutSurface {
  void Function(String)? handler;
  String? launchedWith;
  final List<List<String>> sets = [];
  final List<List<String>> setTitles = [];
  int clears = 0;

  @override
  Future<void> initialize(void Function(String type) onType) async {
    handler = onType;
    final type = launchedWith;
    if (type != null) onType(type);
  }

  @override
  Future<void> set(List<ShortcutItem> items) async {
    sets.add([for (final i in items) i.type]);
    setTitles.add([for (final i in items) i.localizedTitle]);
  }

  @override
  Future<void> clear() async => clears++;
}

const _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');

Future<void> _settle() async {
  for (var i = 0; i < 6; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final now = DateTime.utc(2026, 10, 14, 12);

  ProviderContainer make({required AuthSnapshot auth, required _Surface surface, required _Router router, bool draft = false, _Auth? holder}) {
    final container = ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWith(() => holder ?? _Auth(auth)),
        routerProvider.overrideWithValue(router),
        shortcutSurfaceProvider.overrideWithValue(surface),
        nativePrefsProvider.overrideWithValue(NativePrefs(MemoryPrefsStore())),
        playUpdateGatewayProvider.overrideWithValue(_NoPlay()),
        nowProvider.overrideWithValue(() => now),
        latestSessionDraftProvider.overrideWith(
          (ref) => Stream.value(draft ? draftOf(endsAtWallMs: now.millisecondsSinceEpoch + 600000, sessionId: 'sess-1') : null),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('warm start: shortcuts are set from the open session and a tap routes through ActionRouter', () async {
    final surface = _Surface();
    final router = _Router();
    final container = make(auth: _signedIn, surface: surface, router: router, draft: true);
    // The app root watches it, so it is an active listener there (Riverpod pauses the rest).
    container.listen(nativeTouchesProvider, (_, _) {});
    await _settle();

    
    expect(surface.sets.last, ['resume', 'repair', 'practice10']);
    surface.handler!('resume');
    await _settle();
    expect(router.went, ['/run/sess-1']);
  });

  group('a mock whose time ran out', () {
    Future<(ProviderContainer, _Surface, _Router, void Function(Duration))> open({required int msLeft, bool pending = false}) async {
      var clock = now;
      final surface = _Surface();
      final router = _Router();
      final container = ProviderContainer(
        overrides: [
          authSnapshotProvider.overrideWith(() => _Auth(_signedIn)),
          routerProvider.overrideWithValue(router),
          shortcutSurfaceProvider.overrideWithValue(surface),
          nativePrefsProvider.overrideWithValue(NativePrefs(MemoryPrefsStore())),
          playUpdateGatewayProvider.overrideWithValue(_NoPlay()),
          nowProvider.overrideWithValue(() => clock),
          latestSessionDraftProvider.overrideWith(
            (ref) => Stream.value(draftOf(endsAtWallMs: now.millisecondsSinceEpoch + msLeft, sessionId: 'sess-1', pending: pending)),
          ),
        ],
      );
      addTearDown(container.dispose);
      container.listen(nativeTouchesProvider, (_, _) {});
      await _settle();
      return (container, surface, router, (Duration by) => clock = clock.add(by));
    }

    test('the Resume shortcut is dropped when the deadline passes, with no draft write', () async {
      final (_, surface, _, advance) = await open(msLeft: 100);
      expect(surface.sets.last, ['resume', 'repair', 'practice10']);
      advance(const Duration(seconds: 1));
      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(surface.sets.last, ['repair', 'practice10']);
    });

    test('a tap on a stale Resume does not open the dead session', () async {
      final (container, _, router, advance) = await open(msLeft: 600000);
      advance(const Duration(hours: 2));
      // The 2-hour jump comes before the expiry timer could run, so the cached id is stale.
      await container.read(nativeTouchesProvider).shortcuts.handle('resume');
      expect(router.went, isNot(contains('/run/sess-1')));
    });

    test('a pending submit keeps it resumable through the grace window', () async {
      final (container, _, _, advance) = await open(msLeft: 600000, pending: true);
      advance(const Duration(minutes: 11));
      expect(container.read(nativeTouchesProvider).updates.sessionOpen(), isTrue);
      advance(const Duration(minutes: 2));
      expect(container.read(nativeTouchesProvider).updates.sessionOpen(), isFalse);
    });

    test('an expired mock no longer blocks the quiet update', () async {
      final (container, _, _, advance) = await open(msLeft: 600000);
      final updates = container.read(nativeTouchesProvider).updates;
      expect(updates.sessionOpen(), isTrue);
      advance(const Duration(hours: 2));
      expect(updates.sessionOpen(), isFalse);
    });
  });

  test('without an open session Resume is not listed', () async {
    final surface = _Surface();
    final container = make(auth: _signedIn, surface: surface, router: _Router());
    // The app root watches it, so it is an active listener there (Riverpod pauses the rest).
    container.listen(nativeTouchesProvider, (_, _) {});
    await _settle();
    expect(surface.sets.last, ['repair', 'practice10']);
  });

  test('cold start: a launching shortcut opens after the account is known', () async {
    final surface = _Surface()..launchedWith = 'practice10';
    final router = _Router();
    final holder = _Auth(AuthSnapshot.unknown);
    final container = make(auth: AuthSnapshot.unknown, surface: surface, router: router, holder: holder);
    // The app root watches it, so it is an active listener there (Riverpod pauses the rest).
    container.listen(nativeTouchesProvider, (_, _) {});
    await _settle();
    expect(router.went, isEmpty);
    expect(surface.sets, isEmpty, reason: 'the launcher list is left alone while the account is unknown');

    holder.put(_signedIn);
    await _settle();
    expect(router.went, ['/practice/setup/quick?count=10']);
    expect(surface.sets.last, ['repair', 'practice10']);
  });

  test('signing out clears the launcher shortcuts', () async {
    final surface = _Surface();
    final holder = _Auth(_signedIn);
    final container = make(auth: _signedIn, surface: surface, router: _Router(), holder: holder);
    // The app root watches it, so it is an active listener there (Riverpod pauses the rest).
    container.listen(nativeTouchesProvider, (_, _) {});
    await _settle();
    holder.put(AuthSnapshot.signedOut);
    await _settle();
    expect(surface.clears, 1);
  });

  test('tonight\'s repair is picked up from the quick-start provider', () async {
    final surface = _Surface();
    final router = _Router();
    final container = ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWith(() => _Auth(_signedIn)),
        routerProvider.overrideWithValue(router),
        shortcutSurfaceProvider.overrideWithValue(surface),
        nativePrefsProvider.overrideWithValue(NativePrefs(MemoryPrefsStore())),
        playUpdateGatewayProvider.overrideWithValue(_NoPlay()),
        nowProvider.overrideWithValue(() => now),
        latestSessionDraftProvider.overrideWith((ref) => Stream.value(null)),
        quickStartRepairProvider.overrideWithValue(const QuickRepair(location: '/review/repair/m7/m7-q0', chapter: 'Partnership')),
      ],
    );
    addTearDown(container.dispose);
    // The app root watches it, so it is an active listener there (Riverpod pauses the rest).
    container.listen(nativeTouchesProvider, (_, _) {});
    await _settle();
    surface.handler!('repair');
    await _settle();
    expect(router.went, ['/review/repair/m7/m7-q0']);
  });

  test('"10-min repair" opens tonight\'s repair with its 10-minute count', () async {
    final surface = _Surface();
    final router = _Router();
    final container = ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWith(() => _Auth(_signedIn)),
        routerProvider.overrideWithValue(router),
        shortcutSurfaceProvider.overrideWithValue(surface),
        nativePrefsProvider.overrideWithValue(NativePrefs(MemoryPrefsStore())),
        playUpdateGatewayProvider.overrideWithValue(_NoPlay()),
        nowProvider.overrideWithValue(() => now),
        latestSessionDraftProvider.overrideWith((ref) => Stream.value(null)),
        quickStartRepairProvider.overrideWithValue(
          const QuickRepair(location: '/review/repair/m7/m7-q0', chapter: 'Partnership', tenMinuteLocation: '/review/repair/m7/m7-q0?count=3'),
        ),
      ],
    );
    addTearDown(container.dispose);
    container.listen(nativeTouchesProvider, (_, _) {});
    await _settle();
    surface.handler!('repair');
    await _settle();
    expect(router.went, ['/review/repair/m7/m7-q0?count=3'], reason: 'three mistakes, not the whole chapter');
  });

  test('the launcher says "10-min repair" only when tonight has a 10-minute repair', () async {
    Future<_Surface> launch(QuickRepair repair) async {
      final surface = _Surface();
      final container = ProviderContainer(
        overrides: [
          authSnapshotProvider.overrideWith(() => _Auth(_signedIn)),
          routerProvider.overrideWithValue(_Router()),
          shortcutSurfaceProvider.overrideWithValue(surface),
          nativePrefsProvider.overrideWithValue(NativePrefs(MemoryPrefsStore())),
          playUpdateGatewayProvider.overrideWithValue(_NoPlay()),
          nowProvider.overrideWithValue(() => now),
          latestSessionDraftProvider.overrideWith((ref) => Stream.value(null)),
          quickStartRepairProvider.overrideWithValue(repair),
        ],
      );
      addTearDown(container.dispose);
      container.listen(nativeTouchesProvider, (_, _) {});
      await _settle();
      return surface;
    }

    final three = await launch(const QuickRepair(location: '/review/repair/m7/m7-q0', chapter: 'Partnership', tenMinuteLocation: '/review/repair/m7/m7-q0?count=3'));
    expect(three.setTitles.last, ['10-min repair', 'Practice 10']);
    // One mistake open: Today has no 10-minute chip, so the shortcut makes no length promise.
    final one = await launch(const QuickRepair(location: '/review/repair/m7/m7-q0', chapter: 'Partnership', tenMinuteLocation: '/review/repair/m7/m7-q0?count=1'));
    expect(one.setTitles.last, ['Repair a mistake', 'Practice 10']);
  });
}

class _NoPlay implements PlayUpdateGateway {
  @override
  Future<PlayUpdateOffer?> check() async => null;

  @override
  Future<bool> startFlexible() async => false;

  @override
  Stream<void> get downloaded => const Stream<void>.empty();

  @override
  Future<void> install() async {}
}
