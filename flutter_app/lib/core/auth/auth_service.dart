import 'dart:async';
import 'dart:convert';

import 'package:app_links/app_links.dart';
import 'package:crypto/crypto.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/token_provider.dart';
import '../config/app_config.dart';
import '../storage/secure_store.dart';
import 'access_failure.dart';
import 'auth_links.dart';
import 'google_native.dart';
import 'session_keeper.dart';
import 'session_lock.dart';
import 'session_vault.dart';
import 'stored_session.dart';
import 'token_client.dart';

/// Why a sign-in step failed, in terms the sign-in screen has copy for.
enum AuthFailure { invalidCode, rateLimited, offline, invalidEmail, notConfigured, googleUnavailable, unknown }

class SignInException implements Exception {
  const SignInException(this.failure);

  final AuthFailure failure;

  @override
  String toString() => 'SignInException($failure)';
}

/// What "Continue with Google" did.
enum GoogleOutcome {
  /// Signed in through the native account sheet.
  signedIn,

  /// The student closed the account sheet. Nothing changed.
  cancelled,

  /// The browser is open; the result arrives later on [AuthService.oauthReturns].
  browserOpened,
}

/// How a browser sign-in ended, delivered when the app is opened again by the callback link.
enum OAuthReturnKind {
  /// The callback link arrived and its code is being exchanged for a session (a network call).
  /// [signedIn] or [failed] follows.
  exchanging,
  signedIn,
  cancelled,
  failed,
}

class OAuthReturn {
  const OAuthReturn(this.kind, [this.failure]);

  final OAuthReturnKind kind;
  final AccessFailure? failure;
}

/// Opens [url] outside the app (the browser for Google sign-in).
typedef ExternalUrlOpener = Future<bool> Function(Uri url);

Future<bool> _openInBrowser(Uri url) => launchUrl(url, mode: LaunchMode.externalApplication);

/// Starts Supabase with the session persisted in secure storage. Returns null when the build
/// has no Supabase configuration (auth then stays signed out instead of crashing).
///
/// supabase_flutter's own session handling is switched off on purpose (docs/AUTH.md, "Staying
/// signed in"): it refreshes outside the cross-isolate lock and signs the student out when a
/// refresh is answered with any 4xx (a 429 included) or when an expired session cannot be
/// refreshed at launch. [AuthService] restores and refreshes instead.
Future<GoTrueClient?> initializeSupabase(AppConfig config, SecureStore store) async {
  if (!config.supabaseConfigured) return null;
  await Supabase.initialize(
    url: config.supabaseUrl,
    publishableKey: config.supabaseAnonKey,
    authOptions: FlutterAuthClientOptions(
      localStorage: const SecureSessionStorage(),
      pkceAsyncStorage: SecurePkceStorage(SessionVault.around(store)),
      authFlowType: AuthFlowType.pkce,
      autoRefreshToken: false,
      // The callback link is handled by AuthService, which accepts only in.mockmob.app://login-callback.
      detectSessionInUri: false,
    ),
  );
  return Supabase.instance.client.auth;
}

/// The Supabase side of auth: every sign-in method, the session, and keeping it alive. It is
/// the foreground [ApiTokenProvider].
///
/// Staying signed in, in one rule: only a definitive answer from Supabase that the refresh
/// token or session is over signs a student out. No network, timeouts, 5xx, 429, a busy lock, a
/// storage hiccup or a 401 from the MockMob API (when Supabase still accepts the session) ever do.
class AuthService implements ApiTokenProvider {
  AuthService({
    required this._client,
    required SecureStore store,
    required SessionLock lock,
    required AppConfig config,
    SupabaseTokenClient? tokens,
    GoogleIdTokenSource? google,
    this._links,
    ExternalUrlOpener? openExternal,
    DateTime Function()? now,
    this._serverSignOutWait = const Duration(seconds: 4),
  })  : _config = config,
        _tokens = tokens ?? SupabaseTokenClient(config: config),
        _google = google ?? CredentialManagerGoogle(),
        _openExternal = openExternal ?? _openInBrowser,
        _now = now ?? DateTime.now {
    _keeper = SessionKeeper(store: SessionVault.around(store), lock: lock, client: _tokens, now: _now, lockWait: _lockWait);
  }

  final GoTrueClient _client;
  final AppConfig _config;
  final SupabaseTokenClient _tokens;
  final GoogleIdTokenSource _google;
  final Stream<Uri>? _links;
  final ExternalUrlOpener _openExternal;
  final DateTime Function() _now;
  late final SessionKeeper _keeper;

  /// How long a sign-out waits for Supabase to end the session on the server.
  final Duration _serverSignOutWait;

  /// Longer than the slowest refresh (two tries of 18 s) and shorter than the lock's stale window.
  static const _lockWait = Duration(seconds: 100);

  /// Margin for handing out a token: the API call must arrive before it expires.
  static const _useMargin = Duration(seconds: 30);

  /// Margin for refreshing ahead at launch and on resume.
  static const _aheadMargin = Duration(minutes: 5);

  final _sessionLost = StreamController<void>.broadcast();
  final _oauth = StreamController<OAuthReturn>.broadcast();
  StreamSubscription<Uri>? _linkSub;
  final Set<String> _handledCodes = {};

  /// The access token whose expiry on this phone's clock is [_freshUntil].
  String? _knownToken;
  DateTime? _freshUntil;

  bool _losing = false;

  /// Bumped by every sign-in and sign-out, so a refresh that finishes afterwards is ignored.
  int _epoch = 0;
  bool _nativeGoogleBroken = false;

  /// The raw nonce whose hash the native Google sheet was initialized with. google_sign_in 7
  /// can be initialized only once per process, so the hash cannot change during a run. After
  /// one successful native sign-in the nonce is dropped and [_nativeNonceSpent] sends later
  /// Google sign-ins in this run to the browser, so no nonce is used twice.
  String? _rawNonce;
  bool _nativeNonceSpent = false;

  Stream<AuthState> get changes => _client.onAuthStateChange;
  Session? get session => _client.currentSession;

  /// Fires when Supabase ended the session (never for network trouble).
  Stream<void> get sessionLost => _sessionLost.stream;

  /// Results of browser sign-ins, as the callback link arrives.
  Stream<OAuthReturn> get oauthReturns => _oauth.stream;

  // Restoring and keeping the session.

  /// Loads the stored session at launch, without the network, so a student who was signed in
  /// opens the app signed in even offline, and starts listening for the sign-in callback link.
  /// An access token near expiry is then refreshed in the background.
  Future<void> restore() async {
    _linkSub ??= _links?.listen((uri) => unawaited(handleLink(uri)), onError: (Object _) {});
    final stored = await _keeper.read();
    if (stored == null) return;
    if (!await _adopt(stored)) {
      // Unreadable by the Supabase client (a damaged entry). The refresh token may still work.
      try {
        final result = await _keeper.ensureFresh(force: true, staleAccessToken: stored.accessToken);
        if (result is KeepFresh) {
          await _adopt(result.session);
        } else if (result is KeepRejected) {
          await _keeper.clear();
        }
      } on RefreshUnavailable {
        // Kept for the next launch.
      }
      return;
    }
    if (!stored.isFresh(_now(), margin: _aheadMargin)) unawaited(syncFromStorage());
  }

  @override
  Future<String?> accessToken() async {
    final current = _client.currentSession;
    if (current == null) return null;
    if (_isFresh(current, _useMargin)) return current.accessToken;
    final epoch = _epoch;
    try {
      return await _apply(await _keeper.ensureFresh(staleAccessToken: current.accessToken, margin: _useMargin), current, epoch);
    } on RefreshUnavailable {
      // Offline or slow: hand back what we have. The server decides, and a 401 retries.
      return _client.currentSession?.accessToken;
    }
  }

  /// The token without an account: this service knows Supabase users, not MockMob accounts. The
  /// foreground API client reads tokens through a bridge that names the account
  /// (`api_providers.dart`), so a write meant for one account never leaves with another's token.
  @override
  Future<ApiToken?> accountToken() async {
    final token = await accessToken();
    return token == null ? null : ApiToken(token);
  }

  @override
  Future<bool> refresh() async {
    final current = _client.currentSession;
    final epoch = _epoch;
    final result = await _keeper.ensureFresh(force: true, staleAccessToken: current?.accessToken);
    if (result is KeepNone && current != null && epoch == _epoch) {
      // Storage could not be read; the session in memory still stands.
      throw const RefreshUnavailable();
    }
    return await _apply(result, current, epoch) != null;
  }

  /// Called by the API client when a refresh was refused or a request was still unauthorized
  /// after a successful refresh. In the second case the MockMob server refused a token, which
  /// says nothing certain about the session, so Supabase itself is asked before anyone is
  /// signed out.
  @override
  Future<void> onSessionLost() async {
    final current = _client.currentSession;
    if (current == null) return; // Already signed out (the refresh was refused).
    final check = await _tokens.user(current.accessToken);
    if (check is TokenCallRejected) await _lose();
  }

  /// On resume: takes over a session the background job refreshed while the app slept, and
  /// refreshes ahead when the token expires within five minutes.
  Future<bool> syncFromStorage() async {
    final current = _client.currentSession;
    if (current == null) return false;
    final epoch = _epoch;
    try {
      return await _apply(await _keeper.ensureFresh(staleAccessToken: current.accessToken, margin: _aheadMargin), current, epoch) != null;
    } on RefreshUnavailable {
      return false;
    } on Object {
      return false;
    }
  }

  bool _isFresh(Session current, Duration margin) {
    final until = _knownToken == current.accessToken ? _freshUntil : null;
    if (until != null) return until.difference(_now()) > margin;
    // A session we have not timed (should not happen): fall back to the server's expiry.
    final exp = current.expiresAt;
    if (exp == null) return true;
    return exp * 1000 - _now().millisecondsSinceEpoch > margin.inMilliseconds;
  }

  /// Applies a keeper result to the client. Returns the access token, or null when signed out.
  /// A result that belongs to an earlier [_epoch] (a sign-out or a new sign-in happened while
  /// it was in flight) is dropped: it must not bring back or replace the session.
  Future<String?> _apply(KeepResult result, Session? current, int epoch) async {
    if (epoch != _epoch) return _client.currentSession?.accessToken;
    switch (result) {
      case KeepFresh(:final session):
        if (_client.currentSession?.accessToken != session.accessToken) await _adopt(session);
        return session.accessToken;
      case KeepRejected():
        await _lose();
        return null;
      case KeepNone():
        return current?.accessToken;
    }
  }

  /// Puts [stored] into the Supabase client without any network call or expiry check.
  Future<bool> _adopt(StoredSession stored) async {
    try {
      final parsed = Session.fromJson(stored.raw);
      if (parsed == null) return false;
      _note(stored.accessToken, stored.freshUntilSeconds);
      await _client.setInitialSession(stored.encode());
      return true;
    } on Object {
      return false;
    }
  }

  void _note(String accessToken, int? freshUntilSeconds) {
    _knownToken = accessToken;
    _freshUntil = freshUntilSeconds == null ? null : DateTime.fromMillisecondsSinceEpoch(freshUntilSeconds * 1000);
  }

  /// A session that just arrived from a sign-in: it is fresh for `expires_in` from now, and it
  /// is stored at once (stamped with this phone's clock) so it survives the app being killed.
  Future<void> _arrived(Session? session) async {
    if (session == null) return;
    _epoch++;
    final expiresIn = session.expiresIn;
    _knownToken = session.accessToken;
    _freshUntil = expiresIn == null ? null : _now().add(Duration(seconds: expiresIn));
    try {
      await _keeper.save(StoredSession(session.toJson()).stampedArrival(_now()));
    } on Object {
      // The session works for this run; the next sign-in stores it again.
    }
  }

  Future<void> _lose() async {
    if (_losing) return;
    _losing = true;
    try {
      _sessionLost.add(null);
      await signOutLocal();
    } finally {
      _losing = false;
    }
  }

  // Email code.

  /// Tries the `email` token type first and then `magiclink`, like the web does.
  Future<void> verifyEmailCode(String email, String code) async {
    final token = code.trim();
    try {
      await _arrived((await _client.verifyOTP(email: email, token: token, type: OtpType.email)).session);
      return;
    } on AuthRetryableFetchException {
      throw const SignInException(AuthFailure.offline);
    } on Object {
      // Fall through to the second type.
    }
    try {
      await _arrived((await _client.verifyOTP(email: email, token: token, type: OtpType.magiclink)).session);
    } on AuthRetryableFetchException {
      throw const SignInException(AuthFailure.offline);
    } on AuthApiException catch (e) {
      throw SignInException(e.statusCode == '429' ? AuthFailure.rateLimited : AuthFailure.invalidCode);
    } on Object {
      throw const SignInException(AuthFailure.invalidCode);
    }
  }

  // Email and password.

  /// Throws [AccessException]. A student who only ever used a code or Google has no password
  /// yet, which Supabase reports like a wrong one.
  Future<void> signInWithPassword(String email, String password) async {
    try {
      final response = await _client.signInWithPassword(email: email.trim().toLowerCase(), password: password);
      if (response.session == null) throw const AccessException(AccessFailure.unknown);
      await _arrived(response.session);
    } on AccessException {
      rethrow;
    } on AuthException catch (e) {
      final failure = accessFailureFrom(e);
      final noCode = failure == AccessFailure.unknown && (e.statusCode == '400' || e.code == 'email_not_confirmed');
      throw AccessException(noCode ? AccessFailure.wrongPassword : failure);
    } on Object catch (e) {
      throw AccessException(accessFailureFrom(e));
    }
  }

  /// Sets or changes the signed-in student's password. Throws [AccessException].
  Future<void> setPassword(String password) async {
    if (_client.currentSession == null) throw const AccessException(AccessFailure.signedOut);
    if (await accessToken() == null) throw const AccessException(AccessFailure.signedOut);
    try {
      await _client.updateUser(UserAttributes(password: password));
    } on Object catch (e) {
      throw AccessException(accessFailureFrom(e));
    }
  }

  // Google.

  /// "Continue with Google", choosing the method automatically: the native account sheet when
  /// a web client id is configured and the sheet works on this phone, otherwise the browser.
  /// Throws [AccessException].
  Future<GoogleOutcome> signInWithGoogle() async {
    if (_config.googleNativeEnabled && !_nativeGoogleBroken && !_nativeNonceSpent) {
      try {
        return await signInWithGoogleNative() ? GoogleOutcome.signedIn : GoogleOutcome.cancelled;
      } on GoogleNativeUnavailable {
        _nativeGoogleBroken = true;
        if (!_config.googleBrowserEnabled) throw const AccessException(AccessFailure.googleUnavailable);
      }
    }
    if (_config.googleBrowserEnabled) {
      await startGoogleBrowser();
      return GoogleOutcome.browserOpened;
    }
    throw const AccessException(AccessFailure.notConfigured);
  }

  /// Native one-tap through Credential Manager, then Supabase's ID-token exchange with a nonce.
  /// False when the student closed the sheet. Throws [GoogleNativeUnavailable] when the sheet
  /// cannot be used here, or [AccessException].
  Future<bool> signInWithGoogleNative() async {
    if (!_config.googleNativeEnabled) throw const GoogleNativeUnavailable('not_configured');
    if (_nativeNonceSpent) throw const GoogleNativeUnavailable('nonce_spent');
    final rawNonce = _rawNonce ??= _client.generateRawNonce();
    final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
    final idToken = await _google.idToken(serverClientId: _config.googleWebClientId, hashedNonce: hashedNonce);
    if (idToken == null) return false;
    try {
      final response = await _client.signInWithIdToken(provider: OAuthProvider.google, idToken: idToken, nonce: rawNonce);
      _rawNonce = null;
      _nativeNonceSpent = true;
      await _arrived(response.session);
      return true;
    } on Object catch (e) {
      final failure = accessFailureFrom(e);
      throw AccessException(failure == AccessFailure.unknown ? AccessFailure.googleUnavailable : failure);
    }
  }

  /// Opens Google sign-in in the browser, exactly like the website (Supabase OAuth, PKCE). The
  /// result arrives through [handleLink] and [oauthReturns]. Throws [AccessException].
  Future<void> startGoogleBrowser() async {
    if (!_config.googleBrowserEnabled) throw const AccessException(AccessFailure.notConfigured);
    final OAuthResponse response;
    try {
      response = await _client.getOAuthSignInUrl(
        provider: OAuthProvider.google,
        redirectTo: AuthLinks.redirectUri,
        // Lets a shared family phone pick the right account instead of reusing the last one.
        queryParams: const {'prompt': 'select_account'},
      );
    } on Object catch (e) {
      throw AccessException(accessFailureFrom(e));
    }
    bool opened;
    try {
      opened = await _openExternal(Uri.parse(response.url));
    } on Object {
      opened = false;
    }
    if (!opened) throw const AccessException(AccessFailure.browserUnavailable);
  }

  /// Handles a link that opened the app. `in.mockmob.app://login-callback` (Google in the browser):
  /// its code is exchanged once, with the verifier kept in secure storage. The emailed sign-in
  /// link `https://www.mockmob.in/app/login?token_hash=` (20 Oct, I2): spent once with
  /// `verifyOTP(tokenHash:)`, and only while nobody is signed in on this phone, so a link sent by
  /// someone else can never swap the account under a signed-in student. Nothing is logged.
  Future<void> handleLink(Uri uri) async {
    final callback = AuthCallback.parse(uri);
    switch (callback) {
      case null:
        return;
      case AuthCallbackError(:final cancelled):
        _oauth.add(cancelled ? const OAuthReturn(OAuthReturnKind.cancelled) : const OAuthReturn(OAuthReturnKind.failed, AccessFailure.googleUnavailable));
      case AuthCallbackTokenHash(:final tokenHash, :final type):
        if (_client.currentSession != null) return;
        if (!_handledCodes.add(tokenHash)) return;
        _oauth.add(const OAuthReturn(OAuthReturnKind.exchanging));
        try {
          final response = await _client.verifyOTP(tokenHash: tokenHash, type: switch (type) {
            'signup' => OtpType.signup,
            'email' => OtpType.email,
            'invite' => OtpType.invite,
            _ => OtpType.magiclink,
          });
          await _arrived(response.session);
          _oauth.add(const OAuthReturn(OAuthReturnKind.signedIn));
        } on AuthRetryableFetchException {
          _handledCodes.remove(tokenHash);
          _oauth.add(const OAuthReturn(OAuthReturnKind.failed, AccessFailure.offline));
        } on Object {
          _oauth.add(const OAuthReturn(OAuthReturnKind.failed, AccessFailure.invalidCode));
        }
      case AuthCallbackCode(:final code):
        if (!_handledCodes.add(code)) return;
        // Said before the exchange, which can take a while on a slow network, so the screen
        // keeps waiting for it instead of offering a second sign-in that would replace the
        // verifier this exchange needs.
        _oauth.add(const OAuthReturn(OAuthReturnKind.exchanging));
        try {
          final response = await _client.exchangeCodeForSession(code);
          await _arrived(response.session);
          _oauth.add(const OAuthReturn(OAuthReturnKind.signedIn));
        } on Object catch (e) {
          final failure = accessFailureFrom(e);
          _oauth.add(OAuthReturn(OAuthReturnKind.failed, failure == AccessFailure.unknown ? AccessFailure.googleUnavailable : failure));
        }
    }
  }

  // Other devices.

  /// Ends every other session of this account (the website, other phones), keeping this one.
  /// Used after "Forgot password" and from You, Account. Throws [AccessException].
  Future<void> signOutOtherDevices() async {
    if (_client.currentSession == null) throw const AccessException(AccessFailure.signedOut);
    // A fresh token first: Supabase ignores (does not fail) a logout sent with an expired one.
    if (await accessToken() == null) throw const AccessException(AccessFailure.signedOut);
    if (!_isFresh(_client.currentSession!, _useMargin)) throw const AccessException(AccessFailure.offline);
    try {
      await _client.signOut(scope: SignOutScope.others);
    } on Object catch (e) {
      throw AccessException(accessFailureFrom(e));
    }
  }

  // Phone (behind PHONE_SIGN_IN; docs/AUTH.md).

  /// Texts a sign-in code to a phone already added to an account. It never creates an account:
  /// MockMob accounts are keyed by email. Throws [AccessException].
  Future<void> sendPhoneCode(String phoneE164) => _phoneCall(() => _client.signInWithOtp(phone: phoneE164, shouldCreateUser: false));

  /// Throws [AccessException].
  Future<void> verifyPhoneCode(String phoneE164, String code) => _phoneCall(() async {
        await _arrived((await _client.verifyOTP(phone: phoneE164, token: code.trim(), type: OtpType.sms)).session);
      });

  /// Adds a phone to the signed-in account; Supabase texts a code to confirm it.
  Future<void> addPhone(String phoneE164) => _phoneCall(() async {
        if (_client.currentSession == null || await accessToken() == null) throw const AccessException(AccessFailure.signedOut);
        await _client.updateUser(UserAttributes(phone: phoneE164));
      });

  /// Confirms the phone added with [addPhone].
  Future<void> verifyPhoneChange(String phoneE164, String code) => _phoneCall(() async {
        final response = await _client.verifyOTP(phone: phoneE164, token: code.trim(), type: OtpType.phoneChange);
        if (response.session != null) await _arrived(response.session);
      });

  Future<void> _phoneCall(Future<void> Function() call) async {
    if (!_config.phoneSignInEnabled) throw const AccessException(AccessFailure.notConfigured);
    try {
      await call();
    } on Object catch (e) {
      throw AccessException(accessFailureFrom(e));
    }
  }

  // Signing out.

  /// Clears the stored tokens on this phone. Does not touch local answers.
  ///
  /// The stored tokens go first, before any network call: a student who closes the app while a
  /// slow or captive network holds the server logout is still signed out on the next launch.
  /// The server logout is best effort and waits at most [_serverSignOutWait].
  Future<void> signOutLocal() async {
    _epoch++;
    _knownToken = null;
    _freshUntil = null;
    try {
      await _keeper.forget();
    } on Object {
      // Keystore refused; the locked clear below tries again.
    }
    await Future.wait([
      _quietly(() => _client.signOut(scope: SignOutScope.local).timeout(_serverSignOutWait)),
      // Under the lock, so a background refresh already in flight cannot write the session back.
      _quietly(_keeper.clear),
    ]);
    await _quietly(_google.signOut);
  }

  static Future<void> _quietly(Future<void> Function() step) async {
    try {
      await step();
    } on Object {
      // The tokens are removed locally even when this step fails.
    }
  }

  Future<void> dispose() async {
    await _linkSub?.cancel();
    await _sessionLost.close();
    await _oauth.close();
  }
}

/// The real link source: links that open the app, including the one it was started with.
Stream<Uri> appLinkStream() => AppLinks().uriLinkStream;
