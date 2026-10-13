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
  int clears = 0;

  @override
  Future<void> initialize(void Function(String type) onType) async {
    handler = onType;
    final type = launchedWith;
    if (type != null) onType(type);
  }

  @override
  Future<void> set(List<ShortcutItem> items) async => sets.add([for (final i in items) i.type]);

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
