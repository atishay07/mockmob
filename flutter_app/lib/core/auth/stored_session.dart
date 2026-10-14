import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart' show GotrueAsyncStorage, LocalStorage;

import '../storage/secure_store.dart';

/// The Supabase session JSON as persisted in secure storage. Kept as a raw map so a
/// background refresh writes back every field the Supabase client expects.
///
/// Two expiry readings are kept apart on purpose:
/// - [expiresAtSeconds] is the server's `expires_at`. Every value comes from the same server
///   clock, so it orders sessions ("which one is newer") correctly.
/// - [freshUntilSeconds] is when the token stops being usable, measured on this phone's clock
///   ([localExpiresKey], set when the token arrived from `expires_in`). Budget phones often run
///   minutes or hours off; judging freshness by the server's timestamp on a wrong clock would
///   refresh on every request or never.
class StoredSession {
  const StoredSession(this.raw);

  /// Our own field: this phone's clock plus `expires_in`, written when the token arrived.
  static const localExpiresKey = 'mm_local_expires_at';

  static StoredSession? tryParse(String? json) {
    if (json == null || json.isEmpty) return null;
    try {
      final decoded = jsonDecode(json);
      if (decoded is Map<String, dynamic> && decoded['access_token'] is String) return StoredSession(decoded);
    } on FormatException {
      // Corrupt entry: treat as signed out.
    }
    return null;
  }

  final Map<String, dynamic> raw;

  String get accessToken => raw['access_token'] as String;
  String? get refreshToken => raw['refresh_token'] as String?;

  /// The Supabase user id, when the stored JSON carries the user.
  String? get userId {
    final user = raw['user'];
    final id = user is Map ? user['id'] : null;
    return id is String ? id : null;
  }

  /// Server expiry as epoch seconds, from `expires_at` or the token's own `exp` claim.
  int? get expiresAtSeconds {
    final v = raw['expires_at'];
    if (v is num) return v.toInt();
    return _jwtExp(accessToken);
  }

  /// Expiry on this phone's clock when known, otherwise the server expiry.
  int? get freshUntilSeconds {
    final local = raw[localExpiresKey];
    if (local is num) return local.toInt();
    return expiresAtSeconds;
  }

  static int? _jwtExp(String jwt) {
    final parts = jwt.split('.');
    if (parts.length != 3) return null;
    try {
      final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
      final exp = payload is Map ? payload['exp'] : null;
      return exp is num ? exp.toInt() : null;
    } on FormatException {
      return null;
    }
  }

  /// True when the access token is valid for at least [margin] more.
  bool isFresh(DateTime now, {Duration margin = const Duration(seconds: 60)}) {
    final exp = freshUntilSeconds;
    if (exp == null) return false;
    return exp * 1000 - now.millisecondsSinceEpoch > margin.inMilliseconds;
  }

  /// Applies a token endpoint response over the stored session.
  StoredSession withRefreshed(Map<String, dynamic> response, DateTime now) {
    final next = Map<String, dynamic>.from(raw)
      ..['access_token'] = response['access_token']
      ..['refresh_token'] = response['refresh_token'] ?? raw['refresh_token']
      ..['token_type'] = response['token_type'] ?? raw['token_type'] ?? 'bearer'
      ..remove(localExpiresKey);
    final nowSeconds = now.millisecondsSinceEpoch ~/ 1000;
    final expiresIn = response['expires_in'];
    if (expiresIn is num) {
      next['expires_in'] = expiresIn.toInt();
      next[localExpiresKey] = nowSeconds + expiresIn.toInt();
    }
    final expiresAt = response['expires_at'];
    if (expiresAt is num) {
      next['expires_at'] = expiresAt.toInt();
    } else if (expiresIn is num) {
      next['expires_at'] = nowSeconds + expiresIn.toInt();
    }
    if (response['user'] is Map) next['user'] = response['user'];
    return StoredSession(next);
  }

  /// A copy stamped with this phone's expiry, from `expires_in`, for a session that just arrived.
  StoredSession stampedArrival(DateTime now) {
    final expiresIn = raw['expires_in'];
    if (expiresIn is! num) return this;
    return StoredSession(Map<String, dynamic>.from(raw)..[localExpiresKey] = now.millisecondsSinceEpoch ~/ 1000 + expiresIn.toInt());
  }

  String encode() => jsonEncode(raw);
}

/// Reads the stored session, retrying once: Android Keystore can fail a read transiently right
/// after the phone wakes. A read that keeps failing is reported as no session, but nothing is
/// deleted, so the next launch can still find it.
Future<StoredSession?> readStoredSession(SecureStore store, {Future<void> Function(Duration)? pause}) async {
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      return StoredSession.tryParse(await store.read(SecureKeys.supabaseSession));
    } on Object {
      if (attempt == 0) await (pause ?? (d) => Future<void>.delayed(d))(const Duration(milliseconds: 250));
    }
  }
  return null;
}

/// The storage handed to supabase_flutter. It is deliberately inert: [AuthService] alone
/// restores, writes and deletes the stored session, under the cross-isolate [SessionLock].
///
/// Left to itself, supabase_flutter restores at launch and signs the student out when an
/// expired session cannot be refreshed at once (offline, for example), and it persists every
/// session event asynchronously and outside the lock, so a late write could put back a refresh
/// token the background job already spent, or bring back a session after a sign-out.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage();

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() async => false;

  @override
  Future<String?> accessToken() async => null;

  @override
  Future<void> removePersistedSession() async {}

  @override
  Future<void> persistSession(String persistSessionString) async {}
}

/// Keeps the PKCE code verifier of a browser sign-in in Keystore backed storage instead of
/// plain shared preferences. It must survive the app being killed while the browser is open.
class SecurePkceStorage extends GotrueAsyncStorage {
  const SecurePkceStorage(this._store);

  final SecureStore _store;

  static String _key(String key) => 'mm.auth.pkce.$key';

  @override
  Future<String?> getItem({required String key}) => _store.read(_key(key));

  @override
  Future<void> setItem({required String key, required String value}) => _store.write(_key(key), value);

  @override
  Future<void> removeItem({required String key}) => _store.delete(_key(key));
}
