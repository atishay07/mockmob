import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthChangeEvent, AuthState, Session;

import '../analytics/analytics_client.dart';
import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../models/auth_me.dart';
import '../notifications/notification_service.dart';
import '../repositories/consent_repository.dart';
import '../storage/storage_providers.dart';
import '../sync/sync_providers.dart';
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
  Future<void>? _profileLoad;
  bool _explicitSignOut = false;

  @override
  AuthSnapshot build() {
    ref.onDispose(() {
      _changes?.cancel();
      _lost?.cancel();
      final observer = _observer;
      if (observer != null) WidgetsBinding.instance.removeObserver(observer);
    });
    scheduleMicrotask(_start);
    return AuthSnapshot.unknown;
  }

  Future<AuthService?> _service() => ref.read(authServiceProvider.future);

  Future<void> _start() async {
    AuthService? service;
    try {
      service = await _service();
    } on Object {
      service = null;
    }
    if (!ref.mounted) return;
    if (service == null) {
      state = AuthSnapshot.signedOut;
      return;
    }
    _changes = service.changes.listen((event) => _onAuthEvent(service!, event.event, event.session));
    _lost = service.sessionLost.listen((_) {
      if (!_explicitSignOut) state = const AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true);
    });
    _observer = _ResumeObserver(() => service!.syncFromStorage());
    WidgetsBinding.instance.addObserver(_observer!);
    await _handleSession(service.session);
  }

  void _onAuthEvent(AuthService service, AuthChangeEvent event, Session? session) {
    switch (event) {
      case AuthChangeEvent.signedIn:
      case AuthChangeEvent.initialSession:
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
    try {
      final me = await loadAuthMe(ref.read(apiClientProvider));
      await _applyProfile(me, fromCache: false);
    } on ApiError catch (e) {
      if (!ref.mounted) return;
      if (e.isUnauthorized) return; // The API client signed out and the lost-session stream set the state.
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

  /// Native Google sign-in. Returns false when the student cancelled.
  Future<bool> signInWithGoogle() async {
    final service = await _service();
    if (service == null) throw const SignInException(AuthFailure.notConfigured);
    final signedIn = await service.signInWithGoogle();
    if (signedIn) await _handleSession(service.session);
    return signedIn;
  }

  /// Signs out on purpose: clears the tokens, this account's drafts and usage-data queue,
  /// and scheduled reminders. The screen warns about unsent answers first (spec 5.12.4).
  Future<void> signOut() async {
    final userId = state.userId;
    _explicitSignOut = true;
    try {
      await ref.read(analyticsClientProvider).discardAll();
      await SignOutHooks.runAll();
      try {
        await ref.read(notificationServiceProvider).cancelAll();
      } on Object {
        // Notifications may not be initialised yet.
      }
      await (await _service())?.signOutLocal();
      if (userId != null) await ref.read(appDatabaseProvider).clearUserData(userId);
      final prefs = ref.read(appPrefsProvider);
      await prefs.setLastUserId(null);
      await prefs.setCachedMe(null);
      if (ref.mounted) state = AuthSnapshot.signedOut;
    } finally {
      _explicitSignOut = false;
    }
  }
}

class _ResumeObserver with WidgetsBindingObserver {
  _ResumeObserver(this._onResume);

  final Future<bool> Function() _onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(_onResume());
  }
}
