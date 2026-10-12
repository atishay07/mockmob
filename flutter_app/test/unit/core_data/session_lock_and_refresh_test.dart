import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/token_provider.dart';
import 'package:mockmob/core/auth/background_token_refresher.dart';
import 'package:mockmob/core/auth/session_lock.dart';
import 'package:mockmob/core/auth/stored_session.dart';
import 'package:mockmob/core/storage/secure_store.dart';

import 'support/fakes.dart';

String jwt(int expSeconds) {
  String b64(Object o) => base64Url.encode(utf8.encode(jsonEncode(o))).replaceAll('=', '');
  return '${b64({'alg': 'HS256'})}.${b64({'exp': expSeconds, 'sub': 'u'})}.sig';
}

void main() {
  late Directory dir;
  late File lockFile;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('mm_lock_test');
    lockFile = File('${dir.path}/mm_session.lock');
  });

  tearDown(() async {
    if (await dir.exists()) await dir.delete(recursive: true);
  });

  group('SessionLock', () {
    test('runs the action and releases the lock', () async {
      final lock = SessionLock(lockFile);
      final result = await lock.synchronized(() async => 42);
      expect(result, 42);
      expect(await lockFile.exists(), isFalse);
    });

    test('two holders never overlap', () async {
      final a = SessionLock(lockFile, pollEvery: const Duration(milliseconds: 5));
      final b = SessionLock(lockFile, pollEvery: const Duration(milliseconds: 5));
      var inside = 0;
      var maxInside = 0;
      Future<void> critical() async {
        inside++;
        maxInside = inside > maxInside ? inside : maxInside;
        await Future<void>.delayed(const Duration(milliseconds: 30));
        inside--;
      }

      await Future.wait([
        for (var i = 0; i < 3; i++) a.synchronized(critical),
        for (var i = 0; i < 3; i++) b.synchronized(critical),
      ]);
      expect(maxInside, 1);
    });

    test('the lock is released when the action throws', () async {
      final lock = SessionLock(lockFile);
      await expectLater(lock.synchronized<void>(() async => throw StateError('x')), throwsStateError);
      expect(await lockFile.exists(), isFalse);
    });

    test('a lock abandoned by a killed isolate is taken over after it goes stale', () async {
      var now = DateTime.utc(2026, 10, 12, 12);
      await lockFile.writeAsString(jsonEncode({'owner': 'dead', 'at': now.millisecondsSinceEpoch}));
      final lock = SessionLock(lockFile, staleAfter: const Duration(seconds: 25), pollEvery: const Duration(milliseconds: 1), now: () => now);
      // Not stale yet: waiting times out.
      await expectLater(lock.synchronized(() async => 1, wait: Duration.zero), throwsA(isA<TimeoutException>()));
      now = now.add(const Duration(seconds: 26));
      expect(await lock.synchronized(() async => 7, wait: const Duration(seconds: 1)), 7);
    });

    test('a timeout is reported when the lock stays busy', () async {
      final holder = SessionLock(lockFile);
      final release = Completer<void>();
      final holding = holder.synchronized(() => release.future);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      final waiter = SessionLock(lockFile, pollEvery: const Duration(milliseconds: 5));
      await expectLater(waiter.synchronized(() async => 1, wait: const Duration(milliseconds: 50)), throwsA(isA<TimeoutException>()));
      release.complete();
      await holding;
    });
  });

  group('StoredSession', () {
    test('reads expiry from expires_at or from the token', () {
      final withField = StoredSession({'access_token': 'x.y.z', 'expires_at': 2000});
      expect(withField.expiresAtSeconds, 2000);
      final fromJwt = StoredSession({'access_token': jwt(3000)});
      expect(fromJwt.expiresAtSeconds, 3000);
    });

    test('fresh means more than a minute left', () {
      final now = DateTime.fromMillisecondsSinceEpoch(1000 * 1000);
      expect(StoredSession({'access_token': 't', 'expires_at': 1100}).isFresh(now), isTrue);
      expect(StoredSession({'access_token': 't', 'expires_at': 1050}).isFresh(now), isFalse);
      expect(StoredSession({'access_token': 'no-exp'}).isFresh(now), isFalse);
    });

    test('a refresh response is applied over the stored session', () {
      final stored = StoredSession({'access_token': 'old', 'refresh_token': 'r1', 'token_type': 'bearer', 'user': {'id': 'x'}, 'provider_token': null});
      final next = stored.withRefreshed({'access_token': 'new', 'refresh_token': 'r2', 'expires_in': 3600}, DateTime.fromMillisecondsSinceEpoch(1000000 * 1000));
      expect(next.accessToken, 'new');
      expect(next.refreshToken, 'r2');
      expect(next.raw['expires_at'], 1000000 + 3600);
      expect(next.raw['user'], {'id': 'x'});
    });

    test('bad json is treated as signed out', () {
      expect(StoredSession.tryParse('not json'), isNull);
      expect(StoredSession.tryParse(null), isNull);
      expect(StoredSession.tryParse('{"a":1}'), isNull);
    });
  });

  group('BackgroundTokenRefresher (headless refresh under the lock)', () {
    late MemorySecureStore store;
    late FakeHttpAdapter http;
    late DateTime now;

    BackgroundTokenRefresher newRefresher() => BackgroundTokenRefresher(
          config: testConfig,
          store: store,
          lock: SessionLock(lockFile, pollEvery: const Duration(milliseconds: 5)),
          dio: Dio()..httpClientAdapter = http,
          now: () => now,
        );

    void storeSession({required int exp, String access = 'access-1', String refresh = 'refresh-1'}) {
      store.values[SecureKeys.supabaseSession] = jsonEncode({
        'access_token': access,
        'refresh_token': refresh,
        'expires_at': exp,
        'token_type': 'bearer',
        'user': {'id': 'sb-user'},
      });
    }

    setUp(() {
      store = MemorySecureStore();
      http = FakeHttpAdapter();
      now = DateTime.fromMillisecondsSinceEpoch(1000000 * 1000);
    });

    test('a fresh token is used as is, with no network call', () async {
      storeSession(exp: 1000000 + 3600);
      expect(await newRefresher().accessToken(), 'access-1');
      expect(http.requests, isEmpty);
    });

    test('an expiring token is refreshed through the Supabase endpoint and written back', () async {
      storeSession(exp: 1000000 + 20);
      http.replies.add(const FakeReply(200, {'access_token': 'access-2', 'refresh_token': 'refresh-2', 'expires_in': 3600, 'token_type': 'bearer'}));
      final token = await newRefresher().accessToken();
      expect(token, 'access-2');
      final req = http.requests.single;
      expect(req.path, 'https://sb.test/auth/v1/token');
      expect(req.headers['apikey'], 'anon');
      expect(req.body, {'refresh_token': 'refresh-1'});
      final written = jsonDecode(store.values[SecureKeys.supabaseSession]!) as Map<String, dynamic>;
      expect(written['access_token'], 'access-2');
      expect(written['refresh_token'], 'refresh-2');
      expect(written['user'], {'id': 'sb-user'});
    });

    test('the foreground refreshing first means the background job reuses its token', () async {
      storeSession(exp: 1000000 + 20);
      final refresher = newRefresher();
      // While the job waits for the lock, the foreground writes a fresh session.
      final foreground = SessionLock(lockFile).synchronized(() async {
        await Future<void>.delayed(const Duration(milliseconds: 40));
        storeSession(exp: 1000000 + 3600, access: 'access-fg', refresh: 'refresh-fg');
      });
      await Future<void>.delayed(const Duration(milliseconds: 10));
      final token = await refresher.accessToken();
      await foreground;
      expect(token, 'access-fg');
      // The refresh token the foreground already spent was never sent.
      expect(http.requests, isEmpty);
    });

    test('a refused refresh token marks the session lost and returns no token', () async {
      storeSession(exp: 1000000 + 20);
      http.replies.add(const FakeReply(400, {'error': 'invalid_grant'}));
      final refresher = newRefresher();
      expect(await refresher.accessToken(), isNull);
      expect(refresher.sessionLost, isTrue);
    });

    test('a network failure is not a lost session', () async {
      storeSession(exp: 1000000 + 20);
      http.replies.add(const FakeReply.network());
      final refresher = newRefresher();
      expect(await refresher.accessToken(), isNull);
      expect(refresher.sessionLost, isFalse);
    });

    test('a forced refresh with no network is unavailable, not a lost session', () async {
      storeSession(exp: 1000000 + 3600);
      http.replies.add(const FakeReply.network());
      final refresher = newRefresher();
      await expectLater(refresher.refresh(), throwsA(isA<RefreshUnavailable>()));
      expect(refresher.sessionLost, isFalse);
    });

    test('a forced refresh after a 401 spends the refresh token even if the access token looks fresh', () async {
      storeSession(exp: 1000000 + 3600);
      http.replies.add(const FakeReply(200, {'access_token': 'access-3', 'refresh_token': 'refresh-3', 'expires_in': 3600}));
      expect(await newRefresher().refresh(), isTrue);
      expect((jsonDecode(store.values[SecureKeys.supabaseSession]!) as Map)['access_token'], 'access-3');
    });

    test('no stored session means no token', () async {
      expect(await newRefresher().accessToken(), isNull);
    });
  });
}
