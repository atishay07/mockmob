import 'dart:async';

import 'package:dio/dio.dart';

import '../api/token_provider.dart';
import '../config/app_config.dart';
import '../storage/secure_store.dart';
import 'session_keeper.dart';
import 'session_lock.dart';
import 'session_vault.dart';
import 'token_client.dart';

/// Token source for the headless WorkManager isolate (design spec 5.5.1, point 3).
///
/// The isolate has no Supabase client. It reads the stored session and, when the access token
/// is about to expire, refreshes it through [SessionKeeper], the same code the foreground uses,
/// under the shared [SessionLock], so the two isolates never spend one refresh token twice.
///
/// It never deletes the session: when Supabase rejects the refresh token it only reports
/// [sessionLost], and the foreground clears the session on its next refresh.
class BackgroundTokenRefresher implements ApiTokenProvider {
  BackgroundTokenRefresher({
    required AppConfig config,
    required SecureStore store,
    required SessionLock lock,
    Dio? dio,
    DateTime Function()? now,
    Future<void> Function(Duration)? pause,
  })  : _config = config,
        _keeper = SessionKeeper(
          // The same hardened storage as the foreground (session_vault.dart).
          store: SessionVault.around(store),
          lock: lock,
          client: SupabaseTokenClient(config: config, dio: dio, pause: pause),
          now: now,
        );

  final AppConfig _config;
  final SessionKeeper _keeper;

  bool _lost = false;

  /// True after the refresh token was rejected: the caller keeps `pendingSubmission` and stops.
  bool get sessionLost => _lost;

  @override
  Future<String?> accessToken() async {
    final session = await _keeper.read();
    if (session == null) return null;
    if (session.isFresh(_keeper.now())) return session.accessToken;
    if (!_config.supabaseConfigured) return null;
    try {
      return _tokenFrom(await _keeper.ensureFresh(staleAccessToken: session.accessToken));
    } on RefreshUnavailable {
      return null; // Offline: the next job run tries again.
    }
  }

  /// The isolate has no profile, so it cannot say whose token this is: a write that names its
  /// account is refused here rather than risk the wrong one.
  @override
  Future<ApiToken?> accountToken() async {
    final token = await accessToken();
    return token == null ? null : ApiToken(token);
  }

  @override
  Future<bool> refresh() async {
    if (!_config.supabaseConfigured) return false;
    final stale = (await _keeper.read())?.accessToken;
    return _tokenFrom(await _keeper.ensureFresh(force: true, staleAccessToken: stale)) != null;
  }

  @override
  Future<void> onSessionLost() async => _lost = true;

  String? _tokenFrom(KeepResult result) {
    switch (result) {
      case KeepFresh(:final session):
        return session.accessToken;
      case KeepRejected():
        _lost = true;
        return null;
      case KeepNone():
        return null;
    }
  }
}
