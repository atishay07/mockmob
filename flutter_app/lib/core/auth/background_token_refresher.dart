import 'dart:async';

import 'package:dio/dio.dart';

import '../api/token_provider.dart';
import '../config/app_config.dart';
import '../storage/secure_store.dart';
import 'session_lock.dart';
import 'stored_session.dart';

/// Token source for the headless WorkManager isolate (design spec 5.5.1, point 3).
///
/// The isolate has no Supabase client, so it reads the stored session, and when the access
/// token is about to expire it calls the Supabase token endpoint itself and writes the new
/// session back. All of that happens under the shared [SessionLock] so the foreground and
/// background isolates never spend the same refresh token twice.
class BackgroundTokenRefresher implements ApiTokenProvider {
  BackgroundTokenRefresher({
    required this._config,
    required this._store,
    required this._lock,
    Dio? dio,
    DateTime Function()? now,
  })  : _dio = dio ?? Dio(BaseOptions(connectTimeout: const Duration(seconds: 8), receiveTimeout: const Duration(seconds: 10))),
        _now = now ?? DateTime.now;

  final AppConfig _config;
  final SecureStore _store;
  final SessionLock _lock;
  final Dio _dio;
  final DateTime Function() _now;

  bool _lost = false;

  /// True after the refresh token was rejected: the caller keeps `pendingSubmission` and stops.
  bool get sessionLost => _lost;

  @override
  Future<String?> accessToken() async {
    final session = StoredSession.tryParse(await _store.read(SecureKeys.supabaseSession));
    if (session == null) return null;
    if (session.isFresh(_now())) return session.accessToken;
    try {
      return await _refresh(force: false) ? _current() : null;
    } on RefreshUnavailable {
      return null; // Offline: the next job run tries again.
    }
  }

  @override
  Future<bool> refresh() => _refresh(force: true);

  @override
  Future<void> onSessionLost() async => _lost = true;

  Future<String?> _current() async => StoredSession.tryParse(await _store.read(SecureKeys.supabaseSession))?.accessToken;

  /// False when the refresh token was rejected or there is nothing to refresh; throws
  /// [RefreshUnavailable] when the network or the lock stopped it.
  Future<bool> _refresh({required bool force}) async {
    if (!_config.supabaseConfigured) return false;
    final staleToken = StoredSession.tryParse(await _store.read(SecureKeys.supabaseSession))?.accessToken;
    try {
      return await _lock.synchronized(() async {
        // Re-read inside the lock: the foreground may have refreshed while we waited.
        final stored = StoredSession.tryParse(await _store.read(SecureKeys.supabaseSession));
        if (stored == null) return false;
        final alreadyRefreshed = staleToken != null && stored.accessToken != staleToken;
        if (stored.isFresh(_now()) && (!force || alreadyRefreshed)) return true;
        final refreshToken = stored.refreshToken;
        if (refreshToken == null || refreshToken.isEmpty) return false;
        try {
          final response = await _dio.post<Object?>(
            '${_config.supabaseUrl.replaceAll(RegExp(r'/+$'), '')}/auth/v1/token',
            queryParameters: {'grant_type': 'refresh_token'},
            data: {'refresh_token': refreshToken},
            options: Options(headers: {'apikey': _config.supabaseAnonKey, 'Content-Type': 'application/json'}),
          );
          final body = response.data;
          if (body is! Map<String, dynamic> || body['access_token'] is! String) return false;
          await _store.write(SecureKeys.supabaseSession, stored.withRefreshed(body, _now()).encode());
          return true;
        } on DioException catch (e) {
          final status = e.response?.statusCode;
          // 400 and 401 mean the refresh token itself was refused. Network errors are retried
          // by the next job run, not treated as a lost session.
          if (status == 400 || status == 401 || status == 403) {
            _lost = true;
            return false;
          }
          throw const RefreshUnavailable();
        }
      });
    } on TimeoutException {
      throw const RefreshUnavailable();
    }
  }
}
