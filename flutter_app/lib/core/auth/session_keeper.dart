import 'dart:async';

import '../api/token_provider.dart';
import '../storage/secure_store.dart';
import 'session_lock.dart';
import 'stored_session.dart';
import 'token_client.dart';

/// What [SessionKeeper.ensureFresh] found.
sealed class KeepResult {
  const KeepResult();
}

/// A usable session. [refreshed] is true when this call spent the refresh token.
class KeepFresh extends KeepResult {
  const KeepFresh(this.session, {this.refreshed = false});
  final StoredSession session;
  final bool refreshed;
}

/// No stored session: signed out.
class KeepNone extends KeepResult {
  const KeepNone();
}

/// Supabase ended the session (see [TokenCallRejected]). The stored session is left in place
/// for the foreground to clear, so the background job never signs anyone out by itself.
class KeepRejected extends KeepResult {
  const KeepRejected(this.code);
  final String code;
}

/// The one place a refresh token is spent, in either isolate (design spec 5.5.1).
///
/// Every refresh happens under the cross-isolate [SessionLock] and starts by re-reading secure
/// storage, so the newest refresh token is always the one sent and no token is spent twice.
/// The result is written back before the lock is released.
class SessionKeeper {
  SessionKeeper({
    required this.store,
    required this.lock,
    required this.client,
    DateTime Function()? now,
    this.lockWait = const Duration(seconds: 100),
  }) : _now = now ?? DateTime.now;

  final SecureStore store;
  final SessionLock lock;
  final SupabaseTokenClient client;
  final DateTime Function() _now;
  final Duration lockWait;

  DateTime now() => _now();

  Future<StoredSession?> read() => readStoredSession(store);

  /// Stores a session that just arrived from a sign-in, under the lock, so a background refresh
  /// of an earlier session can never land on top of it.
  Future<void> save(StoredSession session) => _locked(() => store.write(SecureKeys.supabaseSession, session.encode()));

  /// Deletes the stored session under the lock, so a background refresh already in flight
  /// cannot write it back after a sign-out.
  Future<void> clear() => _locked(() => store.delete(SecureKeys.supabaseSession));

  /// Deletes the stored session at once, without waiting for the lock. A sign-out calls this
  /// first and [clear] after it, which also catches a refresh that was in flight.
  Future<void> forget() => store.delete(SecureKeys.supabaseSession);

  /// The lock is waited for longer than the slowest refresh; if it is still busy (a stuck
  /// holder), the write goes ahead anyway rather than losing a sign-in or a sign-out.
  Future<void> _locked(Future<void> Function() action) async {
    try {
      await lock.synchronized(action, wait: const Duration(seconds: 40));
    } on TimeoutException {
      await action();
    }
  }

  /// Returns a session fresh for at least [margin], refreshing when needed.
  ///
  /// With [force] the refresh token is spent even if the stored access token looks fresh (the
  /// server refused it), unless the stored token already differs from [staleAccessToken]: then
  /// another caller refreshed in the meantime and its session is used.
  ///
  /// Throws [RefreshUnavailable] when the answer is unknown (offline, timeout, 5xx, 429, a busy
  /// lock). Never deletes the stored session.
  Future<KeepResult> ensureFresh({
    bool force = false,
    String? staleAccessToken,
    Duration margin = const Duration(seconds: 60),
  }) async {
    try {
      return await lock.synchronized(() async {
        final stored = await read();
        if (stored == null) return const KeepNone();
        final rotated = staleAccessToken != null && stored.accessToken != staleAccessToken;
        final fresh = stored.isFresh(_now(), margin: margin);
        if (fresh && (!force || rotated)) return KeepFresh(stored);
        final refreshToken = stored.refreshToken;
        if (refreshToken == null || refreshToken.isEmpty) return const KeepRejected('no_refresh_token');
        final result = await client.refresh(refreshToken);
        switch (result) {
          case TokenCallOk(:final body):
            final next = stored.withRefreshed(body, _now());
            await store.write(SecureKeys.supabaseSession, next.encode());
            return KeepFresh(next, refreshed: true);
          case TokenCallRejected(:final code):
            return KeepRejected(code);
          case TokenCallUnavailable():
            throw const RefreshUnavailable();
        }
      }, wait: lockWait);
    } on TimeoutException {
      throw const RefreshUnavailable();
    }
  }
}
