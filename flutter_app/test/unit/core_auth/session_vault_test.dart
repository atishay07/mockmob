import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/session_vault.dart';
import 'package:mockmob/core/auth/stored_session.dart';
import 'package:mockmob/core/storage/secure_store.dart';

import 'support.dart';

/// A store whose reads and writes can be made to fail, like a Keystore having a bad moment.
class BrokenStore extends MemorySecureStore {
  int failReads = 0;
  int failWrites = 0;
  bool alwaysFail = false;

  @override
  Future<String?> read(String key) async {
    if (alwaysFail || failReads > 0) {
      if (failReads > 0) failReads--;
      throw const FileSystemException('keystore');
    }
    return super.read(key);
  }

  @override
  Future<void> write(String key, String value) async {
    if (alwaysFail || failWrites > 0) {
      if (failWrites > 0) failWrites--;
      throw const FileSystemException('keystore');
    }
    return super.write(key, value);
  }
}

void main() {
  const key = SecureKeys.supabaseSession;
  final now = DateTime.utc(2026, 10, 13, 9);
  final session = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) + 3600);

  late BrokenStore primary;
  late MemorySecureStore legacy;
  late SessionVault vault;

  setUp(() {
    primary = BrokenStore();
    legacy = MemorySecureStore();
    vault = SessionVault(primary: primary, legacy: legacy, pause: (_) async {});
  });

  test('the real store is wrapped; a test store is used as it is', () {
    expect(SessionVault.around(const FlutterSecureStore()), isA<SessionVault>());
    final memory = MemorySecureStore();
    expect(SessionVault.around(memory), same(memory));
    expect(SessionVault.around(SessionVault.hardened), same(SessionVault.hardened));
  });

  test('an app update keeps the student signed in: a session from an earlier build is moved over', () async {
    legacy.values[key] = session;
    expect(await vault.read(key), session);
    expect(primary.values[key], session);
    expect(legacy.values, isEmpty);
    // Read again: now straight from the hardened store.
    expect(await vault.read(key), session);
  });

  test('a failed Keystore read deletes nothing and the retry finds the session', () async {
    primary.values[key] = session;
    primary.failReads = 1;
    final restored = await readStoredSession(vault, pause: (_) async {});
    expect(restored?.refreshToken, 'r1');
    expect(primary.values[key], session);
  });

  test('a read that keeps failing reports no session but keeps it for the next launch', () async {
    primary.values[key] = session;
    primary.failReads = 2;
    expect(await readStoredSession(vault, pause: (_) async {}), isNull);
    expect(primary.values[key], session);
    expect(await readStoredSession(vault, pause: (_) async {}), isNotNull);
  });

  test('a write that fails once is retried', () async {
    primary.failWrites = 1;
    await vault.write(key, session);
    expect(primary.values[key], session);
    expect(legacy.values, isEmpty);
  });

  test('a hardened store that cannot be written at all still keeps the session', () async {
    primary.values[key] = storedSession(access: 'old', refresh: 'old', expiresAt: secs(now));
    primary.failWrites = 99;
    await vault.write(key, session);
    expect(legacy.values[key], session);
    // The older copy cannot shadow the newer one.
    expect(primary.values, isEmpty);
    expect(await vault.read(key), session);
  });

  test('with the hardened store unreadable, the last-resort copy is still found', () async {
    primary.alwaysFail = true;
    await vault.write(key, session);
    expect(await vault.read(key), session);
  });

  test('a stale copy in the general store is removed once the hardened store has the session', () async {
    legacy.values[key] = storedSession(access: 'old', refresh: 'old', expiresAt: secs(now));
    await vault.write(key, session);
    await Future<void>.delayed(Duration.zero);
    expect(legacy.values, isEmpty);
    expect(await vault.read(key), session);
  });

  test('signing out removes the session from both stores', () async {
    primary.values[key] = session;
    legacy.values[key] = session;
    await vault.delete(key);
    expect(primary.values, isEmpty);
    expect(legacy.values, isEmpty);
    expect(await vault.read(key), isNull);
  });
}
