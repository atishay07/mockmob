// onboarding-auth-03 and onboarding-auth-05 against the real AuthController: a profile load that
// finishes after a sign-out cannot sign the student back in, and a profile load that fails in a
// way other than the network ends in the load-failed state (with its retry), never on the splash.
import 'dart:async';
import 'dart:convert';

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
import 'package:mockmob/core/sync/background_tasks.dart' show WorkmanagerScheduler;
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

  /// What happened, in order, for the tests that care about the order of sign-out steps.
  final List<String> log = [];

  /// Set to make clearing the tokens fail.
  Object? signOutError;

  /// When set, the token handed out instead of the session's own.
  String? tokenOverride;

  @override
  Future<void> signOutLocal() async {
    log.add('signOutLocal');
    if (signOutError != null) throw signOutError!;
    session = null;
  }

  @override
  Future<String?> accessToken() async => tokenOverride ?? session?.accessToken;

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

  @override
  Future<void> flushQuietly() async {}
}

class _NoOutbox extends Fake implements OutboxRepository {}

class _NoFlusher extends Fake implements OutboxFlusher {}

class _NoScheduler extends Fake implements WorkmanagerScheduler {}

/// The real coordinator's [SyncCoordinator.flushQuietly] over a flush that fails, like a
/// database closed under it.
class _FailingSync extends SyncCoordinator {
  _FailingSync() : super(repository: _NoOutbox(), flusher: _NoFlusher(), scheduler: _NoScheduler(), userId: () => 'b', isOnline: () => true);

  int flushes = 0;

  @override
  Future<List<OutboxResult>> flushNow() {
    flushes++;
    return Future<List<OutboxResult>>.error(StateError('database closed'));
  }
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
  late _Notifications notifications;

  Future<_Auth> start({AppDatabase? database, SyncCoordinator? sync}) async {
    final db = database ?? AppDatabase(NativeDatabase.memory());
    store = MemoryPrefsStore();
    service = _FakeService();
    api = _MeApi();
    final restored = StreamController<void>.broadcast();
    final analytics = _Analytics();
    when(analytics.discardAll).thenAnswer((_) async {});
    notifications = _Notifications();
    when(notifications.cancelAll).thenAnswer((_) async => service.log.add('cancelAll'));
    container = ProviderContainer(retry: (_, _) => null, overrides: [
      authSnapshotProvider.overrideWith(_Auth.new),
      authServiceProvider.overrideWith((ref) async => service),
      appDatabaseProvider.overrideWithValue(db),
      appPrefsProvider.overrideWithValue(AppPrefs(store)),
      analyticsClientProvider.overrideWithValue(analytics),
      notificationServiceProvider.overrideWithValue(notifications),
      consentRepositoryProvider.overrideWith(_Consent.new),
      syncCoordinatorProvider.overrideWithValue(sync ?? _Sync()),
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

  group('a reload after the student changed something', () {
    ApiResponse withSubjects(List<String> subjects) => ApiResponse(200, {
          'user': {'id': 'a', 'email': 'a@x.com', 'name': 'Student', 'subjects': subjects},
          'needsOnboarding': false,
        });

    test('starts its own read; an older read that lands later is dropped', () async {
      final auth = await start();
      service.session = _session('a@x.com');
      auth.seed(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com', subjects: ['accountancy']));
      final before = Completer<ApiResponse>();
      final after = Completer<ApiResponse>();
      var calls = 0;
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) {
        calls++;
        return calls == 1 ? before.future : after.future;
      });
      // A read that asked the server before the edit, still waiting on a slow connection.
      final older = auth.reload();
      await pumpEventQueue();

      // The subjects were saved; the editor reloads.
      final newer = auth.reload();
      await pumpEventQueue();
      expect(calls, 2, reason: 'the reload after the edit asks the server again');

      after.complete(withSubjects(['accountancy', 'economics']));
      await newer;
      before.complete(withSubjects(['accountancy']));
      await older;
      await pumpEventQueue();

      expect(now().subjects, ['accountancy', 'economics']);
      expect(await store.getString('cached_auth_me'), contains('economics'), reason: 'the next launch opens with the edit');
    });
  });

  group('Try again on the load-failed screen', () {
    test('keeps the load-failed screen while it tries, and offers the key again on a stall', () async {
      final saved = AuthController.retryWait;
      AuthController.retryWait = const Duration(milliseconds: 50);
      addTearDown(() => AuthController.retryWait = saved);
      final auth = await start();
      service.session = _session('a@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options')))
          .thenThrow(const ApiError(kind: ApiErrorKind.network, code: 'network'));
      await auth.reload();
      await pumpEventQueue();
      expect(now().loadFailed, isTrue);

      // The connection now stalls.
      final stalled = Completer<ApiResponse>();
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) => stalled.future);
      final retry = auth.retryStart();
      await pumpEventQueue();
      expect(now().loadFailed, isTrue, reason: 'the router keeps /load-failed, never the bare splash');
      expect(now().retrying, isTrue, reason: 'the screen says it is trying');

      await retry;
      expect(now().loadFailed, isTrue);
      expect(now().retrying, isFalse, reason: 'past the wait the key works again');

      // A late answer still opens the app.
      stalled.complete(_me('a', 'a@x.com'));
      await pumpEventQueue();
      expect(now().status, AuthStatus.signedIn);
    });
  });

  group('the flush that follows sign-in', () {
    test('a flush that fails is left for the next one, never an unhandled error', () async {
      final sync = _FailingSync();
      final auth = await start(sync: sync);
      service.session = _session('b@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) async => _me('b', 'b@x.com'));

      // An error escaping the fire-and-forget flush would fail this test as an uncaught error.
      await auth.verifyEmailCode('b@x.com', '12345678');
      await pumpEventQueue();

      expect(now().status, AuthStatus.signedIn);
      expect(sync.flushes, 1);
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

  // Reminders planned for the account that signed out must not fire for the next student. A
  // re-plan that was running when the first cancel went out can schedule them again, so they are
  // cancelled once more after the tokens are gone, on sign-out and on account deletion alike.
  group('reminders after sign-out', () {
    for (final keep in [true, false]) {
      test('are cancelled again once the tokens are gone (${keep ? 'sign-out' : 'account deletion'})', () async {
        final auth = await start();
        service.session = _session('a@x.com');
        auth.seed(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com'));
        await auth.signOut(keepQueuedWork: keep);
        expect(service.log, ['cancelAll', 'signOutLocal', 'cancelAll']);
        expect(now().status, AuthStatus.signedOut);
      });
    }

    test('a failure of the second cancel never stops the sign-out', () async {
      final auth = await start();
      service.session = _session('a@x.com');
      auth.seed(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com'));
      var calls = 0;
      when(notifications.cancelAll).thenAnswer((_) async {
        calls++;
        if (calls == 2) throw StateError('plugin');
      });
      await auth.signOut();
      expect(calls, 2);
      expect(now().status, AuthStatus.signedOut);
    });

    test('when the tokens could not be cleared, the student is still signed in and nothing runs after', () async {
      final auth = await start();
      service.session = _session('a@x.com');
      service.signOutError = StateError('storage');
      auth.seed(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'a', email: 'a@x.com'));
      await expectLater(auth.signOut(), throwsStateError);
      expect(service.log, ['cancelAll', 'signOutLocal']);
      expect(now().status, AuthStatus.signedIn);
    });
  });

  // The guard's foreground half: the API client is told which account each token belongs to.
  group('the account a token belongs to', () {
    Future<_Auth> signedInAsA() async {
      final auth = await start();
      service.session = _session('a@x.com');
      when(() => api.get('/api/auth/me', options: any(named: 'options'))).thenAnswer((_) async => _me('a', 'a@x.com'));
      await auth.verifyEmailCode('a@x.com', '12345678');
      await pumpEventQueue();
      expect(now().userId, 'a');
      return auth;
    }

    test('is the account whose profile was loaded for that Supabase user', () async {
      final auth = await signedInAsA();
      expect(auth.accountFor('supabase-a@x.com'), 'a');
      expect(auth.accountFor('supabase-b@x.com'), isNull);
      expect(auth.accountFor(null), isNull);
      final token = await container.read(apiTokenProvider).accountToken();
      expect(token?.value, 'token');
      expect(token?.userId, 'a');
    });

    test('is unknown for a session that signed in since and has not loaded its profile', () async {
      await signedInAsA();
      // B's session replaced A's; the signed-in state still says A.
      service.session = _session('b@x.com');
      expect(now().userId, 'a');
      expect((await container.read(apiTokenProvider).accountToken())?.userId, isNull);
    });

    test('is read from the token itself when it names its user', () async {
      await signedInAsA();
      String b64(Object o) => base64Url.encode(utf8.encode(jsonEncode(o))).replaceAll('=', '');
      // A token of Supabase user B handed out while A's session object is still current.
      service.tokenOverride = '${b64({'alg': 'HS256'})}.${b64({'sub': 'supabase-b@x.com'})}.sig';
      expect((await container.read(apiTokenProvider).accountToken())?.userId, isNull);
      service.tokenOverride = '${b64({'alg': 'HS256'})}.${b64({'sub': 'supabase-a@x.com'})}.sig';
      expect((await container.read(apiTokenProvider).accountToken())?.userId, 'a');
    });

    test('is no one after sign-out', () async {
      final auth = await signedInAsA();
      await auth.signOut();
      expect(auth.accountFor('supabase-a@x.com'), isNull);
      expect(await container.read(apiTokenProvider).accountToken(), isNull);
    });

    test('is recorded for the background job', () async {
      await signedInAsA();
      final prefs = AppPrefs(store);
      expect(await prefs.accountForSession('supabase-a@x.com'), 'a');
      expect(await prefs.accountForSession('supabase-b@x.com'), isNull);
    });
  });
}
