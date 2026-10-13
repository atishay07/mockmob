// robustness-01, auth-06 and auth-07 against the real AuthController: what sign-out keeps and
// drops, what an account switch drops, and what a failing cleanup or a failing start does to the
// session state.
import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart' show AppLifecycleState, WidgetsBinding;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/auth/auth_providers.dart';
import 'package:mockmob/core/auth/auth_service.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show networkRestoredProvider;
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/core/sync/sync_providers.dart';
import 'package:mocktail/mocktail.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthState, Session, User;

import '../core_data/support/test_db.dart';
import 'you_test_support.dart';

class _FakeService extends Fake implements AuthService {
  _FakeService();

  @override
  Session? session;
  int signOutLocals = 0;

  @override
  Stream<AuthState> get changes => const Stream.empty();

  @override
  Stream<void> get sessionLost => const Stream.empty();

  @override
  Stream<OAuthReturn> get oauthReturns => const Stream.empty();

  @override
  Future<bool> syncFromStorage() async => false;

  @override
  Future<void> signOutLocal() async => signOutLocals++;

  @override
  Future<void> verifyEmailCode(String email, String code) async {}
}

Session _session(String email) => Session(
      accessToken: 'token',
      tokenType: 'bearer',
      user: User(id: 'supabase-$email', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z', email: email),
    );

/// The real controller with a seam to put it in a signed-in state without a network.
class _Auth extends AuthController {
  void seed(AuthSnapshot value) => state = value;
}

class _FailingCleanupDb extends AppDatabase {
  _FailingCleanupDb(super.executor);

  @override
  Future<void> clearUserData(String userId, {bool keepCaches = false, bool keepOutbox = false}) =>
      Future<void>.error(StateError('disk full'));
}

class _MockNotifications extends Mock implements NotificationService {}

class _FakeSync extends Fake implements SyncCoordinator {
  @override
  Future<List<OutboxResult>> flushNow() async => const [];
}

class _MeApi extends Mock implements ApiClient {}

ApiResponse _me(String id, String email) => ApiResponse(200, {
      'user': {'id': id, 'email': email, 'name': 'Student', 'subjects': ['accountancy']},
      'needsOnboarding': false,
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() => registerFallbackValue(const ApiOptions()));

  late AppDatabase db;
  late MemoryPrefsStore store;
  late _FakeService service;
  late ProviderContainer container;
  late _MeApi api;
  late StreamController<void> restored;

  Future<_Auth> start({AppDatabase? database, FutureOr<AuthService?> Function()? serviceBuilder}) async {
    db = database ?? newTestDb();
    store = MemoryPrefsStore();
    service = _FakeService();
    api = _MeApi();
    restored = StreamController<void>.broadcast();
    addTearDown(restored.close);
    final analytics = MockAnalytics();
    when(analytics.discardAll).thenAnswer((_) async {});
    final notifications = _MockNotifications();
    when(notifications.cancelAll).thenAnswer((_) async {});
    container = ProviderContainer(retry: (_, _) => null, overrides: [
      authSnapshotProvider.overrideWith(_Auth.new),
      authServiceProvider.overrideWith((ref) async => serviceBuilder != null ? await serviceBuilder() : service),
      appDatabaseProvider.overrideWithValue(db),
      appPrefsProvider.overrideWithValue(AppPrefs(store)),
      analyticsClientProvider.overrideWithValue(analytics),
      notificationServiceProvider.overrideWithValue(notifications),
      consentRepositoryProvider.overrideWith(() => FakeConsent(consentState(AgeBand.adult))),
      syncCoordinatorProvider.overrideWithValue(_FakeSync()),
      apiClientProvider.overrideWithValue(api),
      networkRestoredProvider.overrideWith((ref) => restored.stream),
    ]);
    addTearDown(() {
      container.dispose();
      db.close();
    });
    final auth = container.read(authSnapshotProvider.notifier) as _Auth;
    container.listen(authSnapshotProvider, (_, _) {});
    await pumpEventQueue();
    return auth;
  }

  Future<void> queueWrite(String user, String key) => OutboxRepository(LocalScope(db, () => user, DateTime.now)).enqueue(
        kind: 'study_event',
        method: 'POST',
        path: '/api/study',
        body: {'k': key},
        idempotencyKey: key,
      );

  Future<List<String>> outboxUsers() async => (await db.select(db.outbox).get()).map((r) => r.userId).toList();

  const signedInA = AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com');

  group('sign out', () {
    test('keeps the account\'s queued writes so they send when it signs in again', () async {
      final auth = await start();
      auth.seed(signedInA);
      await queueWrite('a', 'k1');
      await queueWrite('a', 'k2');
      await store.setString('last_user_id', 'a');

      await auth.signOut();

      expect(container.read(authSnapshotProvider).status, AuthStatus.signedOut);
      expect(service.signOutLocals, 1);
      expect(await outboxUsers(), ['a', 'a'], reason: 'rows are scoped by user id and survive a sign-out');
      expect(await store.getString('last_user_id'), 'a', reason: 'remembered so a different account clears them');
    });

    test('still drops the session drafts and the other local rows of the account', () async {
      final auth = await start();
      auth.seed(signedInA);
      await db.into(db.dismissals).insert(DismissalsCompanion.insert(userId: 'a', kind: 'k', createdAtMs: 1, expiresAtMs: 2));
      await queueWrite('a', 'k1');

      await auth.signOut();

      expect(await db.select(db.dismissals).get(), isEmpty);
      expect(await outboxUsers(), ['a']);
    });

    test('account deletion drops everything, queued writes included', () async {
      final auth = await start();
      auth.seed(signedInA);
      await queueWrite('a', 'k1');
      await store.setString('last_user_id', 'a');

      await auth.signOut(keepQueuedWork: false);

      expect(await outboxUsers(), isEmpty);
      expect(await store.getString('last_user_id'), isNull);
    });

    test('a cleanup that fails still signs the student out', () async {
      final auth = await start(database: _FailingCleanupDb(NativeDatabase.memory()));
      auth.seed(signedInA);

      await auth.signOut();

      expect(container.read(authSnapshotProvider).status, AuthStatus.signedOut, reason: 'the tokens are gone, so the state says so');
      expect(service.signOutLocals, 1);
      expect(await store.getString('last_user_id'), isNull, reason: 'nothing was remembered to compare with');
    });
  });

  group('account switch', () {
    test('signing in as a different account removes the earlier account\'s queued writes', () async {
      final auth = await start();
      auth.seed(signedInA);
      await queueWrite('a', 'k1');
      await store.setString('last_user_id', 'a');
      await auth.signOut();
      expect(await outboxUsers(), ['a']);

      service.session = _session('b@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) async => _me('b', 'b@x.com'));
      await auth.verifyEmailCode('b@x.com', '12345678');
      await pumpEventQueue();

      expect(container.read(authSnapshotProvider).userId, 'b');
      expect(await outboxUsers(), isEmpty, reason: 'a different account clears what the first left behind');
    });

    test('signing in as the same account keeps them', () async {
      final auth = await start();
      auth.seed(signedInA);
      await queueWrite('a', 'k1');
      await store.setString('last_user_id', 'a');
      await auth.signOut();

      service.session = _session('a@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) async => _me('a', 'a@x.com'));
      await auth.verifyEmailCode('a@x.com', '12345678');
      await pumpEventQueue();

      expect(container.read(authSnapshotProvider).userId, 'a');
      expect(await outboxUsers(), ['a'], reason: 'they flush now that the same account is back');
    });
  });

  group('start', () {
    setUp(() => AuthController.startRetryDelays = const []);

    test('a service that fails to start is not a sign-out: the student is told it did not load', () async {
      var attempt = 0;
      final auth = await start(serviceBuilder: () {
        attempt++;
        if (attempt == 1) throw StateError('keystore busy');
        return null;
      });
      var s = container.read(authSnapshotProvider);
      expect(s.status, AuthStatus.unknown, reason: 'not signed out');
      expect(s.loadFailed, isTrue);

      await auth.retryStart();
      await pumpEventQueue();
      s = container.read(authSnapshotProvider);
      expect(s.loadFailed, isFalse);
      expect(s.status, AuthStatus.signedOut, reason: 'the second start answered "not configured", which is a real signed-out');
    });

    /// A service that fails to start the first time and starts the second.
    Future<_Auth> failFirstStart() async {
      var attempt = 0;
      final auth = await start(serviceBuilder: () {
        attempt++;
        if (attempt == 1) throw StateError('keystore busy');
        return service;
      });
      expect(container.read(authSnapshotProvider).loadFailed, isTrue);
      return auth;
    }

    test('the network coming back starts it again', () async {
      await failFirstStart();
      restored.add(null);
      await pumpEventQueue();
      final s = container.read(authSnapshotProvider);
      expect(s.loadFailed, isFalse);
      expect(s.status, AuthStatus.signedOut, reason: 'the second start worked and there is no session');
    });

    test('coming back to the app starts it again', () async {
      await failFirstStart();
      final binding = WidgetsBinding.instance;
      binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await pumpEventQueue();
      final s = container.read(authSnapshotProvider);
      expect(s.loadFailed, isFalse);
      expect(s.status, AuthStatus.signedOut);
    });

    test('a profile that did not load is read again by retryStart, with the service already running', () async {
      final auth = await start();
      service.session = _session('a@x.com');
      var calls = 0;
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) async {
        calls++;
        if (calls == 1) throw offlineError();
        return _me('a', 'a@x.com');
      });
      await auth.reload();
      await pumpEventQueue();
      expect(container.read(authSnapshotProvider).loadFailed, isTrue);

      await auth.retryStart();
      await pumpEventQueue();
      final s = container.read(authSnapshotProvider);
      expect(s.loadFailed, isFalse);
      expect(s.status, AuthStatus.signedIn);
      expect(s.userId, 'a');
    });
  });
}
