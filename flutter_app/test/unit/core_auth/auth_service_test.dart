import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/token_provider.dart';
import 'package:mockmob/core/auth/access_failure.dart';
import 'package:mockmob/core/auth/auth_service.dart';
import 'package:mockmob/core/auth/background_token_refresher.dart';
import 'package:mockmob/core/auth/google_native.dart';
import 'package:mockmob/core/auth/stored_session.dart';
import 'package:mockmob/core/auth/token_client.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/storage/secure_store.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show GoTrueClient;

import 'support.dart';

void main() {
  // The phone's clock. Tests move it to age the token.
  late DateTime clock;
  late MemorySecureStore store;
  late ScriptedAdapter dioHttp;
  late GoTrueServer server;
  late GoTrueClient client;
  late FakeGoogle google;
  late StreamController<Uri> links;
  late List<Uri> opened;
  final subs = <StreamSubscription<Object?>>[];

  Future<AuthService> service({AppConfig? cfg, bool openWorks = true}) async {
    final c = cfg ?? config();
    final s = AuthService(
      client: client,
      store: store,
      lock: await tempLock(),
      config: c,
      tokens: SupabaseTokenClient(config: c, dio: scriptedDio(dioHttp), pause: (_) async {}),
      google: google,
      links: links.stream,
      openExternal: (url) async {
        opened.add(url);
        return openWorks;
      },
      now: () => clock,
    );
    return s;
  }

  StoredSession? saved() => StoredSession.tryParse(store.values[SecureKeys.supabaseSession]);

  setUp(() {
    clock = DateTime.utc(2026, 10, 13, 12);
    store = FlakyStore();
    dioHttp = ScriptedAdapter();
    server = GoTrueServer();
    client = gotrue(server, store);
    google = FakeGoogle();
    links = StreamController<Uri>.broadcast();
    opened = [];
  });

  tearDown(() async {
    for (final s in subs) {
      await s.cancel();
    }
    subs.clear();
    await links.close();
  });

  group('staying signed in', () {
    test('a cold start offline with an expired token stays signed in and keeps the session', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) - 7200);
      dioHttp.handler = (_) => const Reply.network();
      final auth = await service();
      await auth.restore();
      await settle();
      expect(auth.session?.accessToken, 'a1');
      expect(saved()?.refreshToken, 'r1');
      // A request now hands out the old token (the server decides) instead of signing out.
      expect(await auth.accessToken(), 'a1');
      expect(auth.session, isNotNull);
    });

    test('a cold start online refreshes an expired token once and stores the new one', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) - 60);
      dioHttp.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: clock)));
      final auth = await service();
      await auth.restore();
      expect(await auth.accessToken(), 'a2');
      await settle();
      expect(saved()?.refreshToken, 'r2');
      expect(dioHttp.requests.where((r) => r.url.path.endsWith('/token')), hasLength(1));
    });

    test('a token near expiry is refreshed ahead on resume', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      expect(dioHttp.requests, isEmpty, reason: 'fresh at launch: no network');
      clock = clock.add(const Duration(minutes: 57));
      dioHttp.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: clock)));
      expect(await auth.syncFromStorage(), isTrue);
      expect(auth.session?.accessToken, 'a2');
    });

    test('on resume a session the background job refreshed is taken over without the network', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      // While the app slept, the WorkManager isolate rotated the tokens.
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'bg', refresh: 'r-bg', expiresAt: secs(clock) + 7200, localExpiresAt: secs(clock) + 7200);
      expect(await auth.syncFromStorage(), isTrue);
      expect(auth.session?.accessToken, 'bg');
      expect(dioHttp.requests, isEmpty);
    });

    test('5xx and 429 on refresh keep the student signed in', () async {
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) - 60);
      final auth = await service();
      await auth.restore();
      await settle();
      for (final reply in const [Reply(502, '<html>Bad gateway</html>'), Reply(429, {'code': 'over_request_rate_limit'})]) {
        dioHttp.handler = (_) => reply;
        await expectLater(auth.refresh(), throwsA(isA<RefreshUnavailable>()));
        expect(auth.session?.accessToken, 'a1');
        expect(saved()?.refreshToken, 'r1');
      }
    });

    test('only a definitive rejection signs out, and it says so', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      var lost = 0;
      subs.add(auth.sessionLost.listen((_) => lost++));
      dioHttp.handler = (_) => const Reply(400, {'code': 'refresh_token_not_found', 'msg': 'Invalid Refresh Token: Refresh Token Not Found'});
      expect(await auth.refresh(), isFalse);
      await settle();
      expect(lost, 1);
      expect(auth.session, isNull);
      expect(store.values.containsKey(SecureKeys.supabaseSession), isFalse);
      expect(google.signOuts, 1);
    });

    test('a 401 from the MockMob API does not sign out while Supabase still accepts the session', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      dioHttp.handler = (o) => o.uri.path.endsWith('/user') ? Reply(200, userJson()) : const Reply.network();
      await auth.onSessionLost();
      expect(auth.session?.accessToken, 'a1');
      final check = dioHttp.requests.single;
      expect(check.headers['Authorization'], 'Bearer a1');
      expect(check.url.query, isEmpty, reason: 'tokens never go in a URL');
    });

    test('a 401 from the API signs out when Supabase confirms the session is gone', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      dioHttp.handler = (_) => const Reply(403, {'code': 'session_not_found'});
      await auth.onSessionLost();
      expect(auth.session, isNull);
    });

    test('an offline check after an API 401 keeps the session', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      dioHttp.handler = (_) => const Reply.network();
      await auth.onSessionLost();
      expect(auth.session, isNotNull);
    });

    test('a phone clock hours off does not cause a refresh on every request', () async {
      clock = DateTime.utc(2026, 10, 13, 14); // Two hours fast against the server.
      final serverNow = DateTime.utc(2026, 10, 13, 12);
      store.values[SecureKeys.supabaseSession] = storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(serverNow) - 60);
      dioHttp.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: serverNow)));
      final auth = await service();
      await auth.restore();
      expect(await auth.accessToken(), 'a2');
      for (var i = 0; i < 5; i++) {
        expect(await auth.accessToken(), 'a2');
      }
      expect(dioHttp.requests, hasLength(1));
    });

    test('the session survives process death: a new service over the same storage is signed in', () async {
      server.routes['token?password'] = (_) => GoTrueServer.json(200, tokenBody(access: 'p1', refresh: 'pr1', serverNow: clock));
      final first = await service();
      await first.restore();
      await first.signInWithPassword('Asha@Example.com', 'correct horse');
      await settle();
      expect(saved()?.refreshToken, 'pr1');
      // The process dies. A new Supabase client and service start from storage alone.
      client = gotrue(server, store);
      final second = await service();
      await second.restore();
      expect(second.session?.accessToken, 'p1');
      expect(await second.accessToken(), 'p1');
      expect(dioHttp.requests, isEmpty);
    });

    test('a sign-out while the background job is refreshing cannot bring the session back', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final lock = await tempLock();
      final auth = AuthService(
        client: client,
        store: store,
        lock: lock,
        config: config(),
        tokens: SupabaseTokenClient(config: config(), dio: scriptedDio(dioHttp), pause: (_) async {}),
        google: google,
        now: () => clock,
      );
      await auth.restore();
      dioHttp.hold = Completer<void>();
      dioHttp.replies.add(Reply(200, tokenBody(access: 'bg', refresh: 'r-bg', serverNow: clock)));
      final background = BackgroundTokenRefresher(config: config(), store: store, lock: lock, dio: scriptedDio(dioHttp), now: () => clock);
      final inFlight = background.refresh();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      final signingOut = auth.signOutLocal();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      dioHttp.hold!.complete();
      await inFlight;
      await signingOut;
      expect(store.values.containsKey(SecureKeys.supabaseSession), isFalse);
      expect(auth.session, isNull);
    });

    test('a damaged stored entry is refreshed into a usable session instead of signing out', () async {
      store.values[SecureKeys.supabaseSession] = jsonEncode({'access_token': 'a1', 'refresh_token': 'r1', 'expires_at': secs(clock) + 10});
      dioHttp.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: clock)));
      final auth = await service();
      await auth.restore();
      expect(auth.session?.accessToken, 'a2');
    });
  });

  group('with the real API client', () {
    late ScriptedAdapter api;

    Future<(AuthService, ApiClient)> wired() async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      final auth = await service();
      await auth.restore();
      api = ScriptedAdapter();
      final apiClient = ApiClient(config: config(), tokens: auth, dio: scriptedDio(api), sleep: (_) async {}, now: () => clock);
      return (auth, apiClient);
    }

    test('a 401 that survives a good refresh does not sign out when Supabase accepts the session', () async {
      final (auth, apiClient) = await wired();
      api.handler = (_) => const Reply(401, {'error': 'Unauthorized'});
      dioHttp.handler = (o) => o.uri.path.endsWith('/token')
          ? Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: clock))
          : Reply(200, userJson());
      await expectLater(apiClient.get('/api/auth/me'), throwsA(isA<ApiError>()));
      expect(auth.session?.accessToken, 'a2', reason: 'still signed in, with the refreshed token');
      expect(api.requests.map((r) => r.headers['Authorization']), ['Bearer a1', 'Bearer a2']);
    });

    test('a 401 then a refused refresh token signs out', () async {
      final (auth, apiClient) = await wired();
      var lost = 0;
      subs.add(auth.sessionLost.listen((_) => lost++));
      api.handler = (_) => const Reply(401, {'error': 'Unauthorized'});
      dioHttp.handler = (_) => const Reply(400, {'code': 'refresh_token_already_used'});
      await expectLater(apiClient.get('/api/auth/me'), throwsA(isA<ApiError>().having((e) => e.isUnauthorized, 'unauthorized', isTrue)));
      await settle();
      expect(auth.session, isNull);
      expect(lost, 1);
    });

    test('a 401 while Supabase cannot be reached keeps the student signed in', () async {
      final (auth, apiClient) = await wired();
      api.handler = (_) => const Reply(401, {'error': 'Unauthorized'});
      dioHttp.handler = (_) => const Reply.network();
      await expectLater(apiClient.get('/api/auth/me'), throwsA(isA<ApiError>().having((e) => e.isUnauthorized, 'unauthorized', isFalse)));
      expect(auth.session?.accessToken, 'a1');
      expect(store.values.containsKey(SecureKeys.supabaseSession), isTrue);
    });
  });

  group('email and password', () {
    test('signs in and stores the session', () async {
      server.routes['token?password'] = (request) {
        final body = jsonDecode(request.body) as Map;
        expect(body['email'], 'asha@example.com');
        return GoTrueServer.json(200, tokenBody(access: 'p1', refresh: 'pr1', serverNow: clock));
      };
      final auth = await service();
      await auth.signInWithPassword(' Asha@Example.com ', 'correct horse');
      expect(auth.session?.accessToken, 'p1');
      // Stored at once, stamped with this phone's clock, before any app kill can lose it.
      expect(saved()?.refreshToken, 'pr1');
      expect(saved()?.raw[StoredSession.localExpiresKey], secs(clock) + 3600);
    });

    test('a wrong password, or no password yet, is reported as such', () async {
      server.routes['token?password'] =
          (_) => GoTrueServer.json(400, {'code': 'invalid_credentials', 'msg': 'Invalid login credentials'});
      final auth = await service();
      await expectLater(
        auth.signInWithPassword('asha@example.com', 'nope'),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.wrongPassword)),
      );
    });

    test('offline is not mistaken for a wrong password', () async {
      final offlineClient = GoTrueClient(
        url: '$supabaseUrl/auth/v1',
        httpClient: _OfflineClient(),
        autoRefreshToken: false,
        asyncStorage: SecurePkceStorage(store),
      );
      client = offlineClient;
      final auth = await service();
      await expectLater(
        auth.signInWithPassword('asha@example.com', 'x'),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.offline)),
      );
    });

    test('setting a password after a code sign-in calls updateUser with the session', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      String? auth0;
      server.routes['user'] = (request) {
        auth0 = request.headers['Authorization'];
        expect((jsonDecode(request.body) as Map)['password'], 'a much better one');
        return GoTrueServer.json(200, userJson());
      };
      final auth = await service();
      await auth.restore();
      await auth.setPassword('a much better one');
      expect(auth0, 'Bearer a1');
    });

    test('a weak password is reported', () async {
      store.values[SecureKeys.supabaseSession] =
          storedSession(access: 'a1', refresh: 'r1', expiresAt: secs(clock) + 3600, localExpiresAt: secs(clock) + 3600);
      server.routes['user'] = (_) => GoTrueServer.json(422, {
            'code': 'weak_password',
            'msg': 'Password should be at least 8 characters.',
            'weak_password': {'reasons': ['length']},
          });
      final auth = await service();
      await auth.restore();
      await expectLater(
        auth.setPassword('short'),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.weakPassword)),
      );
    });

    test('setting a password needs a session', () async {
      final auth = await service();
      await expectLater(
        auth.setPassword('whatever it is'),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.signedOut)),
      );
    });
  });

  group('other devices', () {
    Future<AuthService> signedInService({required int expiresIn}) async {
      store.values[SecureKeys.supabaseSession] = storedSession(
          access: 'a1', refresh: 'r1', expiresAt: secs(clock) + expiresIn, localExpiresAt: secs(clock) + expiresIn);
      final auth = await service();
      await auth.restore();
      await settle();
      return auth;
    }

    test('signs out every other session with a fresh token and keeps this one', () async {
      final auth = await signedInService(expiresIn: 3600);
      await auth.signOutOtherDevices();
      final logout = server.requests.singleWhere((r) => r.url.path.endsWith('/logout'));
      expect(logout.url.queryParameters['scope'], 'others');
      expect(logout.headers['Authorization'], 'Bearer a1');
      expect(auth.session?.accessToken, 'a1', reason: 'this phone stays signed in');
      expect(saved()?.refreshToken, 'r1');
    });

    test('refreshes an expired token first, so Supabase does not ignore the request', () async {
      final auth = await signedInService(expiresIn: 3600);
      clock = clock.add(const Duration(hours: 2));
      dioHttp.replies.add(Reply(200, tokenBody(access: 'a2', refresh: 'r2', serverNow: clock)));
      await auth.signOutOtherDevices();
      expect(server.requests.singleWhere((r) => r.url.path.endsWith('/logout')).headers['Authorization'], 'Bearer a2');
    });

    test('offline with an expired token reports offline and sends nothing', () async {
      final auth = await signedInService(expiresIn: 3600);
      clock = clock.add(const Duration(hours: 2));
      dioHttp.handler = (_) => const Reply.network();
      await expectLater(
        auth.signOutOtherDevices(),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.offline)),
      );
      expect(server.requests.where((r) => r.url.path.endsWith('/logout')), isEmpty);
      expect(auth.session, isNotNull);
    });

    test('needs a session', () async {
      final auth = await service();
      await expectLater(
        auth.signOutOtherDevices(),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.signedOut)),
      );
    });
  });

  group('Google', () {
    test('native: the hashed nonce goes to Google and the raw nonce to Supabase', () async {
      Map? grant;
      server.routes['token?id_token'] = (request) {
        grant = jsonDecode(request.body) as Map;
        return GoTrueServer.json(200, tokenBody(access: 'g1', refresh: 'gr1', serverNow: clock));
      };
      final auth = await service(cfg: config(webClientId: 'web.apps.googleusercontent.com'));
      expect(await auth.signInWithGoogle(), GoogleOutcome.signedIn);
      final (clientId, hashed) = google.calls.single;
      expect(clientId, 'web.apps.googleusercontent.com');
      expect(grant!['provider'], 'google');
      expect(grant!['id_token'], 'google-id-token');
      final raw = grant!['nonce'] as String;
      expect(sha256.convert(utf8.encode(raw)).toString(), hashed);
      expect(auth.session?.accessToken, 'g1');
    });

    test('native: the nonce is used once; a later Google sign-in in the same run uses the browser', () async {
      server.routes['token?id_token'] = (_) => GoTrueServer.json(200, tokenBody(access: 'g1', refresh: 'gr1', serverNow: clock));
      final auth = await service(cfg: config(webClientId: 'web.apps.googleusercontent.com'));
      expect(await auth.signInWithGoogle(), GoogleOutcome.signedIn);
      await auth.signOutLocal();
      expect(await auth.signInWithGoogle(), GoogleOutcome.browserOpened);
      expect(google.calls, hasLength(1), reason: 'the sheet was initialized with the spent nonce');
      expect(opened, hasLength(1));
      await expectLater(auth.signInWithGoogleNative(), throwsA(isA<GoogleNativeUnavailable>()));
    });

    test('native: closing the sheet changes nothing and opens no browser', () async {
      google.token = null;
      final auth = await service(cfg: config(webClientId: 'web'));
      expect(await auth.signInWithGoogle(), GoogleOutcome.cancelled);
      expect(opened, isEmpty);
    });

    test('native unusable on this phone: falls back to the browser, and stays there', () async {
      google.error = const GoogleNativeUnavailable('clientConfigurationError');
      final auth = await service(cfg: config(webClientId: 'web'));
      expect(await auth.signInWithGoogle(), GoogleOutcome.browserOpened);
      expect(await auth.signInWithGoogle(), GoogleOutcome.browserOpened);
      expect(google.calls, hasLength(1));
    });

    test('without a web client id the browser flow is used, with PKCE and our callback', () async {
      final auth = await service();
      expect(await auth.signInWithGoogle(), GoogleOutcome.browserOpened);
      final url = opened.single;
      expect(url.host, 'sb.test');
      expect(url.path, '/auth/v1/authorize');
      expect(url.queryParameters['provider'], 'google');
      expect(url.queryParameters['redirect_to'], 'in.mockmob.app://login-callback');
      expect(url.queryParameters['code_challenge_method'], 's256');
      expect(url.queryParameters['code_challenge'], isNotEmpty);
      expect(url.queryParameters['flow_type'], 'pkce');
      expect(store.values.keys.where((k) => k.startsWith('mm.auth.pkce.')), hasLength(1), reason: 'verifier kept for the return');
    });

    test('the callback code is exchanged once with the stored verifier', () async {
      final auth = await service();
      await auth.restore();
      await auth.startGoogleBrowser();
      final verifierKey = store.values.keys.singleWhere((k) => k.startsWith('mm.auth.pkce.'));
      final verifier = store.values[verifierKey]!.split('/').first;
      Map? exchange;
      server.routes['token?pkce'] = (request) {
        exchange = jsonDecode(request.body) as Map;
        return GoTrueServer.json(200, tokenBody(access: 'o1', refresh: 'or1', serverNow: clock));
      };
      final returns = <OAuthReturn>[];
      subs.add(auth.oauthReturns.listen(returns.add));
      links.add(Uri.parse('in.mockmob.app://login-callback?code=one-time-code'));
      links.add(Uri.parse('in.mockmob.app://login-callback?code=one-time-code'));
      await eventually(() => returns.length >= 2);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(exchange, {'auth_code': 'one-time-code', 'code_verifier': verifier});
      expect(server.requests.where((r) => r.url.queryParameters['grant_type'] == 'pkce'), hasLength(1));
      expect(returns.map((r) => r.kind), [OAuthReturnKind.exchanging, OAuthReturnKind.signedIn],
          reason: 'the screen hears the link arrived before the exchange, then how it ended');
      expect(auth.session?.accessToken, 'o1');
      expect(store.values.containsKey(verifierKey), isFalse, reason: 'the verifier is single use');
    });

    test('closing Google in the browser comes back as cancelled; other links are ignored', () async {
      final auth = await service();
      await auth.restore();
      final returns = <OAuthReturn>[];
      subs.add(auth.oauthReturns.listen(returns.add));
      links
        ..add(Uri.parse('https://www.mockmob.in/today?code=not-ours'))
        ..add(Uri.parse('evil.app://login-callback?code=x'))
        ..add(Uri.parse('in.mockmob.app://login-callback?error=access_denied&error_description=denied'));
      await settle();
      expect(returns.map((r) => r.kind), [OAuthReturnKind.cancelled]);
      expect(server.requests, isEmpty);
    });

    test('no browser on the phone is reported', () async {
      final auth = await service(openWorks: false);
      await expectLater(
        auth.startGoogleBrowser(),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.browserUnavailable)),
      );
    });

    test('GOOGLE_SIGN_IN=off hides and refuses Google', () async {
      final cfg = config(webClientId: 'web', google: 'off');
      expect(cfg.googleSignInEnabled, isFalse);
      final auth = await service(cfg: cfg);
      await expectLater(auth.signInWithGoogle(), throwsA(isA<AccessException>()));
    });
  });

  group('phone (flagged)', () {
    test('off by default: nothing is sent', () async {
      final auth = await service();
      await expectLater(
        auth.sendPhoneCode('+919812345678'),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.notConfigured)),
      );
      expect(server.requests, isEmpty);
    });

    test('on: a code is sent only for a phone already on an account', () async {
      Map? body;
      server.routes['otp'] = (request) {
        body = jsonDecode(request.body) as Map;
        return GoTrueServer.json(200, {});
      };
      final auth = await service(cfg: config(phone: true));
      await auth.sendPhoneCode('+919812345678');
      expect(body!['phone'], '+919812345678');
      expect(body!['create_user'], isFalse);
    });

    test('an unknown phone is reported as not linked', () async {
      server.routes['otp'] = (_) => GoTrueServer.json(422, {'code': 'otp_disabled', 'msg': 'Signups not allowed for otp'});
      final auth = await service(cfg: config(phone: true));
      await expectLater(
        auth.sendPhoneCode('+919812345678'),
        throwsA(isA<AccessException>().having((e) => e.failure, 'failure', AccessFailure.phoneNotLinked)),
      );
    });
  });
}

class _OfflineClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) => throw http.ClientException('offline');
}
