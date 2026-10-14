import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/token_provider.dart';
import 'package:mockmob/core/auth/background_token_refresher.dart';
import 'package:mockmob/core/auth/session_keeper.dart';
import 'package:mockmob/core/auth/session_lock.dart';
import 'package:mockmob/core/auth/stored_session.dart';
import 'package:mockmob/core/auth/token_client.dart';
import 'package:mockmob/core/storage/secure_store.dart';

import 'support.dart';

void main() {
  final now = DateTime.utc(2026, 10, 13, 12);

  group('classifying a failed refresh', () {
    test('only Supabase session-ending codes are a verdict', () {
      for (final code in definitiveRefreshCodes) {
        expect(classifyRefreshFailure(400, {'code': code, 'msg': 'x'}), isA<TokenCallRejected>(), reason: code);
      }
      expect(classifyRefreshFailure(400, {'error_code': 'refresh_token_not_found'}), isA<TokenCallRejected>());
      expect(classifyRefreshFailure(400, {'error': 'invalid_grant', 'error_description': 'Invalid Refresh Token: Revoked'}), isA<TokenCallRejected>());
      expect(classifyRefreshFailure(400, {'msg': 'Invalid Refresh Token: Already Used'}), isA<TokenCallRejected>());
    });

    test('rate limits, server errors, proxies and unknown answers keep the session', () {
      expect(classifyRefreshFailure(429, {'code': 'over_request_rate_limit'}), isA<TokenCallUnavailable>());
      expect(classifyRefreshFailure(500, {'code': 'unexpected_failure'}), isA<TokenCallUnavailable>());
      expect(classifyRefreshFailure(503, '<html>'), isA<TokenCallUnavailable>());
      expect(classifyRefreshFailure(403, '<html>Blocked by proxy</html>'), isA<TokenCallUnavailable>());
      expect(classifyRefreshFailure(401, {'message': 'Invalid API key'}), isA<TokenCallUnavailable>());
      expect(classifyRefreshFailure(null, null), isA<TokenCallUnavailable>());
    });

    test('the user endpoint is a verdict only for a gone session or user', () {
      expect(classifyUserFailure(403, {'code': 'session_not_found'}), isA<TokenCallRejected>());
      expect(classifyUserFailure(404, {'code': 'user_not_found'}), isA<TokenCallRejected>());
      expect(classifyUserFailure(401, {'code': 'bad_jwt'}), isA<TokenCallUnavailable>());
      expect(classifyUserFailure(500, {'code': 'session_not_found'}), isA<TokenCallUnavailable>());
    });
  });

  group('SupabaseTokenClient', () {
    late ScriptedAdapter http;
    late List<Duration> pauses;

    SupabaseTokenClient client() => SupabaseTokenClient(
          config: config(),
          dio: scriptedDio(http),
          pause: (d) async => pauses.add(d),
        );

    setUp(() {
      http = ScriptedAdapter();
      pauses = [];
    });

    test('sends the refresh token in the body, never in the URL', () async {
      http.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: now)));
      final result = await client().refresh('r1');
      expect(result, isA<TokenCallOk>());
      final sent = http.requests.single;
      expect(sent.url.toString(), 'https://sb.test/auth/v1/token?grant_type=refresh_token');
      expect(sent.url.toString(), isNot(contains('r1')));
      expect(sent.body, {'refresh_token': 'r1'});
      expect(sent.headers['apikey'], 'anon');
    });

    test('a lost answer is retried once, inside the reuse window', () async {
      http.replies
        ..add(const Reply.receiveTimeout())
        ..add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: now)));
      expect(await client().refresh('r1'), isA<TokenCallOk>());
      expect(http.requests, hasLength(2));
      expect(pauses.single, lessThan(const Duration(seconds: 10)));
    });

    test('a verdict is not retried', () async {
      http.replies.add(const Reply(400, {'code': 'refresh_token_already_used'}));
      expect(await client().refresh('r1'), isA<TokenCallRejected>());
      expect(http.requests, hasLength(1));
    });

    test('a 200 without tokens (a captive portal page) is not a verdict', () async {
      http.replies.add(const Reply(200, '<html>Sign in to the hotel wifi</html>'));
      expect(await client().refresh('r1'), isA<TokenCallUnavailable>());
    });
  });

  group('StoredSession freshness', () {
    test("judges freshness by this phone's clock when the arrival was stamped", () {
      // The phone runs two hours fast. The server says the token expires in an hour.
      final phoneNow = now.add(const Duration(hours: 2));
      final s = StoredSession({'access_token': 't', 'expires_at': secs(now) + 3600}).withRefreshed(
        {'access_token': 't2', 'refresh_token': 'r2', 'expires_in': 3600, 'expires_at': secs(now) + 3600},
        phoneNow,
      );
      expect(s.expiresAtSeconds, secs(now) + 3600, reason: 'ordering keeps the server time');
      expect(s.isFresh(phoneNow), isTrue, reason: 'judged on the phone clock it is fresh for an hour');
      expect(s.isFresh(phoneNow.add(const Duration(minutes: 59, seconds: 30))), isFalse);
    });

    test('without a stamp the server expiry is used', () {
      final s = StoredSession({'access_token': 't', 'expires_at': secs(now) + 600});
      expect(s.freshUntilSeconds, secs(now) + 600);
    });
  });

  group('SecureSessionStorage (handed to supabase_flutter)', () {
    test('is inert: supabase_flutter never restores, writes or deletes the session itself', () async {
      final store = MemorySecureStore();
      final stored = storedSession(access: 'a', refresh: 'r', expiresAt: 1);
      store.values[SecureKeys.supabaseSession] = stored;
      const storage = SecureSessionStorage();
      expect(await storage.hasAccessToken(), isFalse);
      expect(await storage.accessToken(), isNull);
      await storage.persistSession(storedSession(access: 'old', refresh: 'spent', expiresAt: 0));
      await storage.removePersistedSession();
      expect(store.values[SecureKeys.supabaseSession], stored);
    });

    test('the PKCE verifier lives in secure storage under its own key', () async {
      final store = MemorySecureStore();
      final verifier = SecurePkceStorage(store);
      await verifier.setItem(key: 'supabase.auth.token-code-verifier', value: 'v/signedIn');
      expect(store.values['mm.auth.pkce.supabase.auth.token-code-verifier'], 'v/signedIn');
      await verifier.removeItem(key: 'supabase.auth.token-code-verifier');
      expect(store.values, isEmpty);
    });
  });

  group('SessionKeeper', () {
    late MemorySecureStore store;
    late ScriptedAdapter http;

    Future<SessionKeeper> keeper({DateTime? clock}) async => SessionKeeper(
          store: store,
          lock: await tempLock(),
          client: SupabaseTokenClient(config: config(), dio: scriptedDio(http), pause: (_) async {}),
          now: () => clock ?? now,
        );

    setUp(() {
      store = FlakyStore();
      http = ScriptedAdapter();
    });

    test('a definitive rejection is reported but the stored session is left for the foreground', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) - 10);
      http.replies.add(const Reply(400, {'code': 'session_not_found'}));
      final result = await (await keeper()).ensureFresh();
      expect(result, isA<KeepRejected>());
      expect(store.values, contains(SecureKeys.supabaseSession));
    });

    test('offline is unknown, never a verdict, and nothing is deleted', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) - 10);
      http.replies.addAll(const [Reply.network(), Reply.network()]);
      await expectLater((await keeper()).ensureFresh(), throwsA(isA<RefreshUnavailable>()));
      expect(store.values, contains(SecureKeys.supabaseSession));
    });

    test('a Keystore read that fails once is retried', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) + 3600);
      (store as FlakyStore).failReads = 1;
      final result = await (await keeper()).ensureFresh();
      expect(result, isA<KeepFresh>());
      expect(http.requests, isEmpty);
    });

    test('a refreshed session is written back, stamped, before the lock is released', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) + 20);
      http.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: now)));
      final result = await (await keeper()).ensureFresh();
      expect(result, isA<KeepFresh>().having((r) => r.refreshed, 'refreshed', isTrue));
      final saved = StoredSession.tryParse(store.values[SecureKeys.supabaseSession])!;
      expect(saved.refreshToken, 'r2');
      expect(saved.raw[StoredSession.localExpiresKey], secs(now) + 3600);
    });

    test('the background job never deletes a session Supabase rejected', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) - 10);
      http.replies.add(const Reply(400, {'code': 'refresh_token_not_found'}));
      final job = BackgroundTokenRefresher(
        config: config(),
        store: store,
        lock: await tempLock(),
        dio: scriptedDio(http),
        now: () => now,
        pause: (_) async {},
      );
      expect(await job.accessToken(), isNull);
      expect(job.sessionLost, isTrue);
      expect(store.values, contains(SecureKeys.supabaseSession));
    });

    test('the background job treats a 503 as "try next run"', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) - 10);
      http.replies.add(const Reply(503, {'code': 'unexpected_failure'}));
      final job = BackgroundTokenRefresher(
        config: config(),
        store: store,
        lock: await tempLock(),
        dio: scriptedDio(http),
        now: () => now,
        pause: (_) async {},
      );
      expect(await job.accessToken(), isNull);
      expect(job.sessionLost, isFalse);
    });

    test('two isolates refreshing at once spend the refresh token once', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(now) + 20);
      final lock = await tempLock();
      http.handler = (options) {
        final body = options.data as Map;
        return body['refresh_token'] == 'r1'
            ? Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: now))
            : const Reply(400, {'code': 'refresh_token_already_used'});
      };
      SessionKeeper make() => SessionKeeper(
            store: store,
            lock: lock,
            client: SupabaseTokenClient(config: config(), dio: scriptedDio(http), pause: (_) async {}),
            now: () => now,
          );
      final first = make().ensureFresh();
      final second = make().ensureFresh();
      final results = await Future.wait([first, second]);
      expect(results.every((r) => r is KeepFresh), isTrue);
      expect(http.requests, hasLength(1));
    });
  });

  group('SessionLock', () {
    Future<File> lockFile() async {
      final dir = await Directory.systemTemp.createTemp('mm_lock_test');
      addTearDown(() => dir.delete(recursive: true));
      return File('${dir.path}/mm_session.lock');
    }

    void plantAbandoned(File file) =>
        file.writeAsStringSync(jsonEncode({'owner': 'dead', 'at': DateTime.now().subtract(const Duration(minutes: 5)).millisecondsSinceEpoch}));

    test('waiters that all find an abandoned lock never hold it at the same time', () async {
      final file = await lockFile();
      for (var round = 0; round < 15; round++) {
        plantAbandoned(file);
        var inside = 0;
        var most = 0;
        final waiters = List.generate(
          6,
          (_) => SessionLock(file, pollEvery: const Duration(milliseconds: 1)).synchronized(() async {
            inside++;
            most = most > inside ? most : inside;
            await Future<void>.delayed(const Duration(milliseconds: 3));
            inside--;
          }, wait: const Duration(seconds: 20)),
        );
        await Future.wait(waiters);
        expect(most, 1, reason: 'round $round: two waiters held the lock at once');
        expect(file.existsSync(), isFalse);
        expect(File('${file.path}.reclaim').existsSync(), isFalse);
      }
    });

    test('a reclaim guard left by a waiter that died is cleared', () async {
      final file = await lockFile();
      plantAbandoned(file);
      final guard = File('${file.path}.reclaim')..writeAsStringSync('');
      guard.setLastModifiedSync(DateTime.now().subtract(const Duration(minutes: 1)));
      var ran = false;
      await SessionLock(file, pollEvery: const Duration(milliseconds: 1)).synchronized(() async => ran = true, wait: const Duration(seconds: 5));
      expect(ran, isTrue);
    });

    test('a live lock is waited for, not taken over', () async {
      final file = await lockFile();
      final holder = SessionLock(file, pollEvery: const Duration(milliseconds: 1));
      final release = Completer<void>();
      final held = holder.synchronized(() => release.future);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      var second = false;
      final waiter = SessionLock(file, pollEvery: const Duration(milliseconds: 1)).synchronized(() async => second = true);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(second, isFalse);
      release.complete();
      await held;
      await waiter;
      expect(second, isTrue);
    });
  });
}
