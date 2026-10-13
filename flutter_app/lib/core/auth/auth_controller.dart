import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthChangeEvent, AuthState, Session;

import '../analytics/analytics_client.dart';
import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../connectivity/connectivity.dart' show networkRestoredProvider;
import '../models/auth_me.dart';
import '../notifications/notification_service.dart';
import '../repositories/consent_repository.dart';
import '../storage/storage_providers.dart';
import '../sync/sync_providers.dart';
import 'access_failure.dart';
import 'auth_me_loader.dart';
import 'auth_providers.dart';
import 'auth_service.dart';
import 'auth_state.dart';
import 'sign_out_hooks.dart';

/// Owns the session: reacts to Supabase auth events, loads the MockMob profile, detects an
/// account switch, and exposes the sign-in and sign-out actions the screens call.
class AuthController extends Notifier<AuthSnapshot> {
  StreamSubscription<AuthState>? _changes;
  StreamSubscription<void>? _lost;
  _ResumeObserver? _observer;
  ProviderSubscription<AsyncValue<void>>? _restoredWatch;
  AuthService? _running;
  bool _starting = false;
  Future<void>? _profileLoad;
  bool _explicitSignOut = false;
  Timer? _startRetry;
  int _startFailures = 0;

  /// How long to wait before starting the auth service again after it failed to start (secure
  /// storage or the session lock was not ready). After the last one the student retries by hand.
  @visibleForTesting
  static List<Duration> startRetryDelays = const [Duration(seconds: 2), Duration(seconds: 6), Duration(seconds: 15)];

  @override
  AuthSnapshot build() {
    ref.onDispose(() {
      _startRetry?.cancel();
      _changes?.cancel();
      _lost?.cancel();
      _restoredWatch?.close();
      final observer = _observer;
      if (observer != null) WidgetsBinding.instance.removeObserver(observer);
    });
    scheduleMicrotask(_start);
    return AuthSnapshot.unknown;
  }

  Future<AuthService?> _service() => ref.read(authServiceProvider.future);

  Future<void> _start() async {
    if (_starting) return;
    _starting = true;
    try {
      await _startOnce();
    } finally {
      _starting = false;
    }
  }

  Future<void> _startOnce() async {
    AuthService? service;
    try {
      service = await _service();
    } on Object {
      if (!ref.mounted) return;
      // The service failed to start, which is not the same as "no session": the stored session
      // is untouched and may be fine. Say so (the profile-load-failed state, with a retry)
      // instead of sending the student to sign in.
      state = const AuthSnapshot(status: AuthStatus.unknown, loadFailed: true);
      _watchForRecovery();
      _scheduleStartRetry();
      return;
    }
    if (!ref.mounted) return;
    if (service == null) {
      // Not configured in this build: there is nothing to sign in to.
      state = AuthSnapshot.signedOut;
      return;
    }
    _startFailures = 0;
    _running = service;
    _changes = service.changes.listen((event) => _onAuthEvent(service!, event.event, event.session));
    _lost = service.sessionLost.listen((_) {
      if (!_explicitSignOut) state = const AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true);
    });
    _watchForRecovery();
    await _handleSession(service.session);
  }

  /// Retries a failed start or profile load when the app comes back to the front and when the
  /// network returns, and keeps checking the stored session on resume. The timers in
  /// [_scheduleStartRetry] stop after a few tries; these do not.
  void _watchForRecovery() {
    if (_observer == null) {
      _observer = _ResumeObserver(_onResumed);
      WidgetsBinding.instance.addObserver(_observer!);
    }
    _restoredWatch ??= ref.listen<AsyncValue<void>>(networkRestoredProvider, (_, _) {
      if (state.loadFailed) unawaited(retryStart());
    });
  }

  Future<void> _onResumed() async {
    if (!ref.mounted) return;
    if (state.loadFailed) {
      await retryStart();
      return;
    }
    await _running?.syncFromStorage();
  }

  void _scheduleStartRetry() {
    _startRetry?.cancel();
    if (_startFailures >= startRetryDelays.length) return;
    final delay = startRetryDelays[_startFailures++];
    _startRetry = Timer(delay, () {
      if (ref.mounted) unawaited(retryStart());
    });
  }

  /// Tries again after a load failure ([AuthSnapshot.loadFailed]): starts the auth service again
  /// when it failed to start, or reads the profile again when the service is running but the
  /// profile did not load. Safe to call at any time; it does nothing while a start is already in
  /// progress, or when nothing has failed.
  Future<void> retryStart() async {
    if (!ref.mounted || _starting) return;
    _startRetry?.cancel();
    final running = _running;
    if (running != null) {
      if (!state.loadFailed) return;
      state = AuthSnapshot.unknown;
      await _handleSession(running.session);
      return;
    }
    state = AuthSnapshot.unknown;
    ref.invalidate(authServiceProvider);
    await _start();
  }

  void _onAuthEvent(AuthService service, AuthChangeEvent event, Session? session) {
    switch (event) {
      // A new sign-in, including one finished by the browser callback link. `initialSession`
      // is not handled here: the service raises it whenever it restores or refreshes a session,
      // and _start already handled the launch session.
      case AuthChangeEvent.signedIn:
        _handleSession(session);
      case AuthChangeEvent.signedOut:
        if (!_explicitSignOut && state.status == AuthStatus.signedIn) {
          state = AuthSnapshot.signedOut;
        } else if (state.status == AuthStatus.unknown && !state.loadFailed) {
          state = AuthSnapshot.signedOut;
        }
      default:
        break;
    }
  }

  Future<void> _handleSession(Session? session) {
    if (session == null) {
      if (state.status != AuthStatus.signedOut) {
        state = state.sessionExpired ? state : AuthSnapshot.signedOut;
      }
      return Future.value();
    }
    // One profile load at a time: sign-in fires an auth event and the caller also loads.
    return _profileLoad ??= _loadProfile(session).whenComplete(() => _profileLoad = null);
  }

  Future<void> _loadProfile(Session session) async {
    final prefs = ref.read(appPrefsProvider);
    // Local first: at launch a stored session with this account's cached profile opens the app
    // at once, and the network read below then replaces it. A budget phone on a slow
    // connection would otherwise sit on the splash until the server answers.
    if (state.status != AuthStatus.signedIn) {
      final cached = await _cachedProfileFor(session.user.email);
      if (cached != null && ref.mounted) await _applyProfile(cached, fromCache: true);
    }
    try {
      final me = await loadAuthMe(ref.read(apiClientProvider));
      await _applyProfile(me, fromCache: false);
    } on ApiError catch (e) {
      if (!ref.mounted) return;
      if (e.isUnauthorized) {
        // Normally the session is gone and the lost-session stream set the state. When Supabase
        // still accepts the session (the MockMob server refused it for another reason), the
        // student stays signed in and this is a load failure like any other.
        final service = await _service();
        if (!ref.mounted || service?.session == null) return;
      }
      final cached = await _cachedProfileFor(session.user.email);
      if (cached != null) {
        await _applyProfile(cached, fromCache: true);
      } else if (state.status != AuthStatus.signedIn) {
        state = const AuthSnapshot(status: AuthStatus.unknown, loadFailed: true);
      }
    }
    unawaited(prefs.setLastOpenedAt(ref.read(nowProvider)()));
  }

  Future<AuthMe?> _cachedProfileFor(String? email) async {
    final raw = await ref.read(appPrefsProvider).cachedMe();
    if (raw == null || email == null) return null;
    try {
      final me = AuthMe.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
      final cachedEmail = me.user?.email;
      return cachedEmail != null && cachedEmail.toLowerCase() == email.toLowerCase() ? me : null;
    } on FormatException {
      return null;
    }
  }

  Future<void> _applyProfile(AuthMe me, {required bool fromCache}) async {
    final user = me.user;
    if (user == null || !ref.mounted) return;
    final prefs = ref.read(appPrefsProvider);
    final previous = await prefs.lastUserId();
    if (previous != null && previous != user.id) {
      // A different account on this phone: the earlier account's drafts, queue and caches go.
      await ref.read(analyticsClientProvider).discardAll();
      await ref.read(appDatabaseProvider).clearUserData(previous);
      await ref.read(notificationServiceProvider).cancelAll();
    }
    await prefs.setLastUserId(user.id);
    if (!fromCache) {
      await prefs.setCachedMe(jsonEncode({
        'user': {
          'id': user.id,
          'name': user.name,
          'email': user.email,
          'subjects': user.subjects,
          'creditBalance': user.creditBalance,
          'isPremium': user.isPremium,
          'premiumUntil': user.premiumUntil?.toIso8601String(),
        },
        'needsOnboarding': me.needsOnboarding,
      }));
    }
    if (!ref.mounted) return;
    state = AuthSnapshot(
      status: AuthStatus.signedIn,
      userId: user.id,
      email: user.email,
      isPro: user.isPremium,
      premiumUntil: user.premiumUntil,
      name: user.name,
      subjects: user.subjects,
      needsOnboarding: me.needsOnboarding,
      creditBalance: user.creditBalance,
    );
    // Start the pieces that listen for sign-out, consent and reconnect events, and send
    // anything left over from the last run.
    ref.read(consentRepositoryProvider);
    ref.read(analyticsClientProvider);
    unawaited(ref.read(syncCoordinatorProvider).flushNow());
  }

  /// Reloads the profile (after onboarding or any change that affects subjects or Pro status).
  Future<void> reload() async {
    if (state.loadFailed) {
      // Starting the service again, or reading the profile again, is what failed.
      await retryStart();
      return;
    }
    final session = (await _service())?.session;
    if (session == null) return;
    await _handleSession(session);
  }

  /// Emails a sign-in code. Throws [SignInException] with a failure the screen has copy for.
  Future<void> sendEmailCode(String email) async {
    try {
      await ref.read(apiClientProvider).post(
            '/api/auth/email-login',
            body: {'email': email.trim().toLowerCase()},
            options: const ApiOptions(authenticated: false, retries: 0),
          );
    } on ApiError catch (e) {
      throw SignInException(switch (e.kind) {
        ApiErrorKind.network || ApiErrorKind.timeout => AuthFailure.offline,
        ApiErrorKind.rateLimited => AuthFailure.rateLimited,
        ApiErrorKind.validation => AuthFailure.invalidEmail,
        _ => AuthFailure.unknown,
      });
    }
  }

  /// Verifies the emailed code, then loads the profile. Throws [SignInException].
  Future<void> verifyEmailCode(String email, String code) async {
    final service = await _service();
    if (service == null) throw const SignInException(AuthFailure.notConfigured);
    await service.verifyEmailCode(email.trim().toLowerCase(), code);
    await _handleSession(service.session);
  }

  /// Google sign-in for the email-code screens. [GoogleOutcome.signedIn] when signed in on the
  /// spot, [GoogleOutcome.cancelled] when the student closed the sheet, and
  /// [GoogleOutcome.browserOpened] when the browser took over (the session then arrives through
  /// the callback link and the router moves on by itself; [oauthReturns] reports a cancel or a
  /// failure). Throws [SignInException].
  Future<GoogleOutcome> signInWithGoogle() async {
    try {
      return await continueWithGoogle();
    } on AccessException catch (e) {
      throw SignInException(switch (e.failure) {
        AccessFailure.offline => AuthFailure.offline,
        AccessFailure.rateLimited => AuthFailure.rateLimited,
        AccessFailure.notConfigured => AuthFailure.notConfigured,
        _ => AuthFailure.googleUnavailable,
      });
    }
  }

  /// "Continue with Google": the native account sheet when it works here, else the browser.
  /// Throws [AccessException].
  Future<GoogleOutcome> continueWithGoogle() async {
    final service = await _requireService();
    final outcome = await service.signInWithGoogle();
    if (outcome == GoogleOutcome.signedIn) await _handleSession(service.session);
    return outcome;
  }

  /// Google in the browser, chosen by the student ("Use the browser instead"). Throws
  /// [AccessException].
  Future<void> continueWithGoogleInBrowser() async => (await _requireService()).startGoogleBrowser();

  /// Results of browser sign-ins (signed in, cancelled, failed) for the screen to acknowledge.
  Stream<OAuthReturn> oauthReturns() async* {
    final service = await _service();
    if (service != null) yield* service.oauthReturns;
  }

  /// Email and password. Throws [AccessException].
  Future<void> signInWithPassword(String email, String password) async {
    final service = await _requireService();
    await service.signInWithPassword(email, password);
    await _handleSession(service.session);
  }

  /// Sets or changes the password of the signed-in student. Throws [AccessException].
  Future<void> setPassword(String password) async => (await _requireService()).setPassword(password);

  /// Ends the account's sessions on every other device (the website, other phones), keeping
  /// this one. Throws [AccessException].
  Future<void> signOutOtherDevices() async => (await _requireService()).signOutOtherDevices();

  /// Phone sign-in (behind PHONE_SIGN_IN). Throws [AccessException].
  Future<void> sendPhoneCode(String phoneE164) async => (await _requireService()).sendPhoneCode(phoneE164);

  /// Throws [AccessException].
  Future<void> verifyPhoneCode(String phoneE164, String code) async {
    final service = await _requireService();
    await service.verifyPhoneCode(phoneE164, code);
    await _handleSession(service.session);
  }

  /// Adds a phone to the signed-in account. Throws [AccessException].
  Future<void> addPhone(String phoneE164) async => (await _requireService()).addPhone(phoneE164);

  /// Throws [AccessException].
  Future<void> verifyPhoneChange(String phoneE164, String code) async =>
      (await _requireService()).verifyPhoneChange(phoneE164, code);

  Future<AuthService> _requireService() async {
    final service = await _service();
    if (service == null) throw const AccessException(AccessFailure.notConfigured);
    return service;
  }

  /// Signs out on purpose: clears the tokens, this account's drafts and usage-data queue, and
  /// scheduled reminders. The queued study writes stay ([keepQueuedWork], the default): they are
  /// scoped to this account and send when it signs in again; signing in as a different account
  /// removes them (see [_applyProfile]). Account deletion passes false. The screen warns about
  /// unsent answers and queued writes first (spec 5.12.4).
  ///
  /// Once the tokens are gone the student is signed out, whatever local cleanup does after.
  Future<void> signOut({bool keepQueuedWork = true}) async {
    final userId = state.userId;
    _explicitSignOut = true;
    var tokensCleared = false;
    try {
      await _bestEffort(() => ref.read(analyticsClientProvider).discardAll());
      await SignOutHooks.runAll();
      // Notifications may not be initialised yet.
      await _bestEffort(() => ref.read(notificationServiceProvider).cancelAll());
      await (await _service())?.signOutLocal();
      tokensCleared = true;
      // A failure here is picked up by the next sign-in: the remembered user id still points at
      // this account, so a different account clears what is left.
      var cleaned = true;
      if (userId != null) {
        cleaned = await _bestEffort(() => ref.read(appDatabaseProvider).clearUserData(userId, keepOutbox: keepQueuedWork));
      }
      final prefs = ref.read(appPrefsProvider);
      if (cleaned && !keepQueuedWork) await _bestEffort(() => prefs.setLastUserId(null));
      await _bestEffort(() => prefs.setCachedMe(null));
    } finally {
      _explicitSignOut = false;
      if (tokensCleared && ref.mounted) state = AuthSnapshot.signedOut;
    }
  }

  /// Runs a cleanup step that must never stop the sign-out. False when it failed.
  Future<bool> _bestEffort(Future<void> Function() step) async {
    try {
      await step();
      return true;
    } on Object {
      return false;
    }
  }
}

class _ResumeObserver with WidgetsBindingObserver {
  _ResumeObserver(this._onResume);

  final Future<void> Function() _onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(_onResume());
  }
}
