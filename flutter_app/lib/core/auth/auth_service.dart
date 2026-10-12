import 'dart:async';

import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../api/token_provider.dart';
import '../config/app_config.dart';
import '../storage/secure_store.dart';
import 'session_lock.dart';
import 'stored_session.dart';

/// Why a sign-in step failed, in terms the sign-in screen has copy for.
enum AuthFailure { invalidCode, rateLimited, offline, invalidEmail, notConfigured, googleUnavailable, unknown }

class SignInException implements Exception {
  const SignInException(this.failure);

  final AuthFailure failure;

  @override
  String toString() => 'SignInException($failure)';
}

/// Starts Supabase with the session persisted in secure storage. Returns null when the build
/// has no Supabase configuration (auth then stays signed out instead of crashing).
Future<GoTrueClient?> initializeSupabase(AppConfig config, SecureStore store) async {
  if (!config.supabaseConfigured) return null;
  await Supabase.initialize(
    url: config.supabaseUrl,
    publishableKey: config.supabaseAnonKey,
    authOptions: FlutterAuthClientOptions(
      localStorage: SecureSessionStorage(store),
      // Sign-in is by code or native Google, never a redirect, so no deep link carries a session.
      detectSessionInUri: false,
    ),
  );
  return Supabase.instance.client.auth;
}

/// The Supabase side of auth: OTP and Google sign-in, the session, and refreshing it. It is
/// the foreground [ApiTokenProvider].
class AuthService implements ApiTokenProvider {
  AuthService({
    required this._client,
    required this._store,
    required this._lock,
    required this._config,
  });

  final GoTrueClient _client;
  final SecureStore _store;
  final SessionLock _lock;
  final AppConfig _config;

  /// Shorter than the lock's stale window, so the lock always outlives the work it guards.
  static const _refreshTimeout = Duration(seconds: 30);

  final _sessionLost = StreamController<void>.broadcast();
  bool _googleReady = false;

  Stream<AuthState> get changes => _client.onAuthStateChange;
  Session? get session => _client.currentSession;

  /// Fires when a refresh failed or a retried request was still unauthorized.
  Stream<void> get sessionLost => _sessionLost.stream;

  @override
  Future<String?> accessToken() async {
    final current = _client.currentSession;
    if (current == null) return null;
    if (current.isExpired) {
      try {
        await refresh();
      } on RefreshUnavailable {
        // Offline: hand back what we have. The server decides, and a 401 retries the refresh.
      }
    }
    return _client.currentSession?.accessToken;
  }

  @override
  Future<bool> refresh() async {
    try {
      return await _lock.synchronized(() async {
        // The background job may have rotated the refresh token while this isolate slept.
        if (await _adoptStoredSessionIfNewer()) {
          final adopted = _client.currentSession;
          if (adopted != null && !adopted.isExpired) return true;
        }
        final response = await _client.refreshSession().timeout(_refreshTimeout);
        return response.session != null;
      });
    } on AuthRetryableFetchException {
      // No network: the session is intact, so this is not a lost session.
      throw const RefreshUnavailable();
    } on TimeoutException {
      // The lock stayed busy or the request hung. Still not a verdict on the session.
      throw const RefreshUnavailable();
    } on Object {
      return false;
    }
  }

  /// Loads the stored session into the client when another isolate wrote a newer one.
  /// Called on resume, so a background token refresh never leaves this isolate holding a
  /// refresh token that was already spent.
  Future<bool> syncFromStorage() async {
    try {
      return await _lock.synchronized(_adoptStoredSessionIfNewer, wait: const Duration(seconds: 5));
    } on Object {
      return false;
    }
  }

  Future<bool> _adoptStoredSessionIfNewer() async {
    final stored = StoredSession.tryParse(await _store.read(SecureKeys.supabaseSession));
    final current = _client.currentSession;
    if (stored == null || current == null) return false;
    if (stored.refreshToken == current.refreshToken) return false;
    final storedExp = stored.expiresAtSeconds ?? 0;
    final currentExp = current.expiresAt ?? 0;
    if (storedExp <= currentExp) return false;
    await _client.recoverSession(stored.encode());
    return true;
  }

  @override
  Future<void> onSessionLost() async {
    _sessionLost.add(null);
    // Clear the tokens only; local answers and drafts stay on the phone.
    await signOutLocal();
  }

  /// Tries the `email` token type first and then `magiclink`, like the web does. Which one
  /// succeeds for new and existing users is unverified [API 1.2].
  Future<void> verifyEmailCode(String email, String code) async {
    final token = code.trim();
    try {
      await _client.verifyOTP(email: email, token: token, type: OtpType.email);
      return;
    } on AuthRetryableFetchException {
      throw const SignInException(AuthFailure.offline);
    } on Object {
      // Fall through to the second type.
    }
    try {
      await _client.verifyOTP(email: email, token: token, type: OtpType.magiclink);
    } on AuthRetryableFetchException {
      throw const SignInException(AuthFailure.offline);
    } on AuthApiException catch (e) {
      throw SignInException(e.statusCode == '429' ? AuthFailure.rateLimited : AuthFailure.invalidCode);
    } on Object {
      throw const SignInException(AuthFailure.invalidCode);
    }
  }

  /// Native Google sign-in, only when a web client id is configured. Returns false when the
  /// student cancelled, which the screen treats as "nothing happened".
  Future<bool> signInWithGoogle() async {
    if (!_config.googleSignInEnabled) throw const SignInException(AuthFailure.notConfigured);
    final google = GoogleSignIn.instance;
    try {
      if (!_googleReady) {
        await google.initialize(serverClientId: _config.googleWebClientId);
        _googleReady = true;
      }
      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) throw const SignInException(AuthFailure.googleUnavailable);
      await _client.signInWithIdToken(provider: OAuthProvider.google, idToken: idToken);
      return true;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return false;
      throw const SignInException(AuthFailure.googleUnavailable);
    } on AuthRetryableFetchException {
      throw const SignInException(AuthFailure.offline);
    } on SignInException {
      rethrow;
    } on Object {
      throw const SignInException(AuthFailure.unknown);
    }
  }

  /// Clears the stored tokens on this phone. Does not touch local answers.
  Future<void> signOutLocal() async {
    try {
      await _client.signOut(scope: SignOutScope.local);
    } on Object {
      // The tokens are removed locally even when the server call fails.
    }
    await _store.delete(SecureKeys.supabaseSession);
    if (_googleReady) {
      try {
        await GoogleSignIn.instance.signOut();
      } on Object {
        // Not signed in with Google.
      }
    }
  }

  Future<void> dispose() => _sessionLost.close();
}
