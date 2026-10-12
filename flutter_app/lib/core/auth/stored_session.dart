import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart' show LocalStorage;

import '../storage/secure_store.dart';

/// The Supabase session JSON as persisted in secure storage. Kept as a raw map so a
/// background refresh writes back every field the Supabase client expects.
class StoredSession {
  const StoredSession(this.raw);

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

  /// Expiry as epoch seconds, from `expires_at` or the token's own `exp` claim.
  int? get expiresAtSeconds {
    final v = raw['expires_at'];
    if (v is num) return v.toInt();
    return _jwtExp(accessToken);
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
    final exp = expiresAtSeconds;
    if (exp == null) return false;
    return exp * 1000 - now.millisecondsSinceEpoch > margin.inMilliseconds;
  }

  /// Applies a token endpoint response over the stored session.
  StoredSession withRefreshed(Map<String, dynamic> response, DateTime now) {
    final next = Map<String, dynamic>.from(raw)
      ..['access_token'] = response['access_token']
      ..['refresh_token'] = response['refresh_token'] ?? raw['refresh_token']
      ..['token_type'] = response['token_type'] ?? raw['token_type'] ?? 'bearer';
    final expiresIn = response['expires_in'];
    if (expiresIn is num) next['expires_in'] = expiresIn.toInt();
    final expiresAt = response['expires_at'];
    if (expiresAt is num) {
      next['expires_at'] = expiresAt.toInt();
    } else if (expiresIn is num) {
      next['expires_at'] = now.millisecondsSinceEpoch ~/ 1000 + expiresIn.toInt();
    }
    if (response['user'] is Map) next['user'] = response['user'];
    return StoredSession(next);
  }

  String encode() => jsonEncode(raw);
}

/// Persists the Supabase session in Android Keystore backed storage instead of plain
/// shared preferences.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage(this._store);

  final SecureStore _store;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() async => (await _store.read(SecureKeys.supabaseSession)) != null;

  /// The Supabase client treats this as "the persisted session string".
  @override
  Future<String?> accessToken() => _store.read(SecureKeys.supabaseSession);

  @override
  Future<void> removePersistedSession() => _store.delete(SecureKeys.supabaseSession);

  @override
  Future<void> persistSession(String persistSessionString) => _store.write(SecureKeys.supabaseSession, persistSessionString);
}
