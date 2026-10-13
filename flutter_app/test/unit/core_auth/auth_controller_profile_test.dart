// onboarding-auth-03 and onboarding-auth-05 against the real AuthController: a profile load that
// finishes after a sign-out cannot sign the student back in, and a profile load that fails in a
// way other than the network ends in the load-failed state (with its retry), never on the splash.
import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/auth/auth_providers.dart';
import 'package:mockmob/core/auth/auth_service.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show networkRestoredProvider;
import 'package:mockmob/core/models/consent.dart';
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

class _FakeService extends Fake implements AuthService {
  @override
  Session? session;

  @override
  Stream<AuthState> get changes => const Stream.empty();

  @override
  Stream<void> get sessionLost => const Stream.empty();

  @override
  Stream<OAuthReturn> get oauthReturns => const Stream.empty();

  @override
  Future<bool> syncFromStorage() async => false;

  @override
  Future<void> signOutLocal() async => session = null;

  @override
  Future<void> verifyEmailCode(String email, String code) async {}
}

Session _session(String email) => Session(
      accessToken: 'token',
      tokenType: 'bearer',
      user: User(id: 'supabase-$email', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z', email: email),
    );

class _Auth extends AuthController {
  void seed(AuthSnapshot value) => state = value;
}

class _FailingCleanupDb extends AppDatabase {
  _FailingCleanupDb() : super(NativeDatabase.memory());

  @override
  Future<void> clearUserData(String userId, {bool keepCaches = false, bool keepOutbox = false}) =>
      Future<void>.error(StateError('disk full'));
}

class _Analytics extends Mock implements AnalyticsClient {}

class _Notifications extends Mock implements NotificationService {}

class _Sync extends Fake implements SyncCoordinator {
  @override
  Future<List<OutboxResult>> flushNow() async => const [];
}

class _Consent extends ConsentRepository {
  @override
  ConsentState build() => const ConsentState(status: ConsentStatus.loaded, consent: Consent(ageBand: AgeBand.adult));

  @override
  Future<void> load() async {}
}

class _MeApi extends Mock implements ApiClient {}

ApiResponse _me(String id, String email) => ApiResponse(200, {
      'user': {'id': id, 'email': email, 'name': 'Student', 'subjects': ['accountancy']},
      'needsOnboarding': false,
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() => registerFallbackValue(const ApiOptions()));

  late MemoryPrefsStore store;
  late _FakeService service;
  late ProviderContainer container;
  late _MeApi api;

  Future<_Auth> start({AppDatabase? database}) async {
    final db = database ?? AppDatabase(NativeDatabase.memory());
    store = MemoryPrefsStore();
    service = _FakeService();
    api = _MeApi();
    final restored = StreamController<void>.broadcast();
    final analytics = _Analytics();
    when(analytics.discardAll).thenAnswer((_) async {});
    final notifications = _Notifications();
    when(notifications.cancelAll).thenAnswer((_) async {});
    container = ProviderContainer(retry: (_, _) => null, overrides: [
      authSnapshotProvider.overrideWith(_Auth.new),
      authServiceProvider.overrideWith((ref) async => service),
      appDatabaseProvider.overrideWithValue(db),
      appPrefsProvider.overrideWithValue(AppPrefs(store)),
      analyticsClientProvider.overrideWithValue(analytics),
      notificationServiceProvider.overrideWithValue(notifications),
      consentRepositoryProvider.overrideWith(_Consent.new),
      syncCoordinatorProvider.overrideWithValue(_Sync()),
      apiClientProvider.overrideWithValue(api),
      networkRestoredProvider.overrideWith((ref) => restored.stream),
    ]);
    addTearDown(() async {
      container.dispose();
      await restored.close();
      await db.close();
    });
    final auth = container.read(authSnapshotProvider.notifier) as _Auth;
    container.listen(authSnapshotProvider, (_, _) {});
    await pumpEventQueue();
    return auth;
  }

  AuthSnapshot now() => container.read(authSnapshotProvider);

  group('a profile load in flight during sign-out', () {
    test('cannot sign the student back in when it finishes', () async {
      final auth = await start();
      service.session = _session('a@x.com');
      auth.seed(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com'));
      final answer = Completer<ApiResponse>();
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) => answer.future);
      final loading = auth.reload();
      await pumpEventQueue();

      await auth.signOut();
      expect(now().status, AuthStatus.signedOut);

      answer.complete(_me('a', 'a@x.com'));
      await loading;
      await pumpEventQueue();

      expect(now().status, AuthStatus.signedOut, reason: 'the old answer belongs to the ended session');
      expect(await store.getString('cached_auth_me'), isNull, reason: 'nothing of the old session is written back');
    });

    test('does not hold up the next sign-in, which loads its own profile', () async {
      final auth = await start();
      service.session = _session('a@x.com');
      auth.seed(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com'));
      final stale = Completer<ApiResponse>();
      var calls = 0;
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) {
        calls++;
        return calls == 1 ? stale.future : Future.value(_me('b', 'b@x.com'));
      });
      unawaited(auth.reload());
      await pumpEventQueue();
      await auth.signOut();

      service.session = _session('b@x.com');
      await auth.verifyEmailCode('b@x.com', '12345678');
      await pumpEventQueue();
      expect(now().status, AuthStatus.signedIn);
      expect(now().userId, 'b');

      stale.complete(_me('a', 'a@x.com'));
      await pumpEventQueue();
      expect(now().userId, 'b', reason: 'the stale answer for the first account is dropped');
    });
  });

  group('a profile load that fails outside the network', () {
    test('a damaged cached profile is skipped: offline with no usable cache says it did not load', () async {
      final auth = await start();
      await store.setString('cached_auth_me', '[1, 2, 3]');
      service.session = _session('a@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options')))
          .thenThrow(const ApiError(kind: ApiErrorKind.network, code: 'network'));

      await auth.reload();
      await pumpEventQueue();

      expect(now().status, AuthStatus.unknown);
      expect(now().loadFailed, isTrue, reason: 'the load-failed screen has a retry; the splash does not');
    });

    test('a database that fails on an account switch ends in the load-failed state', () async {
      final auth = await start(database: _FailingCleanupDb());
      await store.setString('last_user_id', 'a');
      service.session = _session('b@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) async => _me('b', 'b@x.com'));

      await auth.reload();
      await pumpEventQueue();

      expect(now().loadFailed, isTrue);
      expect(now().status, isNot(AuthStatus.signedIn), reason: 'the earlier account\'s data was not cleared');
    });
  });
}
