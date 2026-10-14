import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../storage/secure_store.dart';

/// Where the sign-in session (and a browser sign-in's PKCE verifier) live on the phone.
///
/// flutter_secure_storage's default Android options have `resetOnError` on: one failed Keystore
/// read deletes that entry, and an unexpected error inside the plugin deletes every entry of
/// the store. Budget phones do fail Keystore calls now and then (right after waking, under
/// memory pressure), and each such failure would quietly sign the student out. So the session
/// gets its own namespace (its own Keystore key) with `resetOnError` off: a failed read is
/// reported, retried by [readStoredSession], and never deletes anything.
///
/// The general store ([legacy]) is still used in two cases:
/// - Migration: a session written there by an earlier build is moved here on first read.
/// - Last resort: if this namespace cannot be written at all (a broken Keystore key, which
///   `resetOnError` off cannot repair), the session is written to the general store instead,
///   so sign-in still survives a restart. Reads look there whenever this store has nothing.
class SessionVault implements SecureStore {
  SessionVault({required this._primary, required this._legacy, Future<void> Function(Duration)? pause})
      : _pause = pause ?? ((d) => Future<void>.delayed(d));

  /// The hardened Android store: separate namespace, never deletes on error.
  static const FlutterSecureStore hardened = FlutterSecureStore(
    FlutterSecureStorage(aOptions: AndroidOptions(resetOnError: false, storageNamespace: 'mm_auth')),
  );

  /// The store the session code should use. The app's real secure store is wrapped; any other
  /// [SecureStore] (a test's memory store) is used as it is.
  static SecureStore around(SecureStore store) =>
      store is FlutterSecureStore && !identical(store, hardened) ? SessionVault(primary: hardened, legacy: store) : store;

  final SecureStore _primary;
  final SecureStore _legacy;
  final Future<void> Function(Duration) _pause;

  /// Keys whose copy in the general store is known to be gone, so a refresh does not touch the
  /// general store every time. Reads never rely on it.
  final Set<String> _settled = {};

  @override
  Future<String?> read(String key) async {
    String? value;
    Object? primaryError;
    try {
      value = await _primary.read(key);
    } on Object catch (e) {
      primaryError = e;
    }
    // Nothing here (signed out, or not moved yet) or this namespace failed: the general store
    // may hold the session. Reading it is cheap and only happens in those cases.
    if (value != null) return value;
    final String? old;
    try {
      old = await _legacy.read(key);
    } on Object {
      if (primaryError != null) throw primaryError;
      return null;
    }
    if (old == null) {
      if (primaryError != null) throw primaryError;
      return null;
    }
    if (primaryError == null) {
      // Written by an earlier build: move it here. If the move fails it stays where it is.
      try {
        await _primary.write(key, old);
        await _legacy.delete(key);
        _settled.add(key);
      } on Object {
        // Read from the general store again next time.
      }
    }
    return old;
  }

  @override
  Future<void> write(String key, String value) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await _primary.write(key, value);
        // A copy left in the general store (from a migration or an earlier last-resort write)
        // must not come back later.
        if (!_settled.contains(key)) {
          unawaited(_quietly(() async {
            await _legacy.delete(key);
            _settled.add(key);
          }));
        }
        return;
      } on Object {
        if (attempt == 0) await _pause(const Duration(milliseconds: 200));
      }
    }
    // This namespace cannot be written. Keep the session anyway, and make sure an older value
    // here cannot shadow it.
    _settled.remove(key);
    await _legacy.write(key, value);
    await _quietly(() => _primary.delete(key));
  }

  @override
  Future<void> delete(String key) async {
    Object? failure;
    try {
      await _primary.delete(key);
    } on Object catch (e) {
      failure = e;
    }
    try {
      await _legacy.delete(key);
      _settled.add(key);
    } on Object catch (e) {
      failure ??= e;
    }
    if (failure != null) throw failure;
  }

  static Future<void> _quietly(Future<void> Function() action) async {
    try {
      await action();
    } on Object {
      // Best effort.
    }
  }
}
