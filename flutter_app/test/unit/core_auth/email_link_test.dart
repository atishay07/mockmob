// 20 Oct, I2: the sign-in email's button opens the app (https://www.mockmob.in/app/login?token_hash=...)
// and the app spends the token hash itself.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_links.dart';
import 'package:mockmob/core/auth/auth_service.dart';
import 'package:mockmob/core/storage/secure_store.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show GoTrueClient;

import 'support.dart';

void main() {
  group('AuthLinks.isEmailLink', () {
    test('claims only /app/login on our own https hosts', () {
      expect(AuthLinks.isEmailLink(Uri.parse('https://www.mockmob.in/app/login?token_hash=h&type=magiclink')), isTrue);
      expect(AuthLinks.isEmailLink(Uri.parse('https://mockmob.in/app/login/?token_hash=h')), isTrue);
      expect(AuthLinks.isEmailLink(Uri.parse('https://www.mockmob.in/auth/callback?token_hash=h')), isFalse,
          reason: 'website sign-ins stay in the browser');
      expect(AuthLinks.isEmailLink(Uri.parse('https://evil.example/app/login?token_hash=h')), isFalse);
      expect(AuthLinks.isEmailLink(Uri.parse('http://www.mockmob.in/app/login?token_hash=h')), isFalse);
      expect(AuthLinks.isEmailLink(Uri.parse('https://www.mockmob.in/app/login-other')), isFalse);
    });

    test('parses the token hash and type; a link without one is nothing', () {
      final parsed = AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login?token_hash=abc&type=magiclink'));
      expect(parsed, isA<AuthCallbackTokenHash>());
      expect((parsed! as AuthCallbackTokenHash).tokenHash, 'abc');
      expect((parsed as AuthCallbackTokenHash).type, 'magiclink');
      expect((AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login?token_hash=abc&type=email'))! as AuthCallbackTokenHash).type, 'email');
      expect(AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login')), isNull);
    });

    test('a first sign-in comes back as signup and is spent as signup; an unknown type is refused (app-signin H1)', () {
      final signup = AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login?token_hash=abc&type=signup'));
      expect((signup! as AuthCallbackTokenHash).type, 'signup');
      expect((AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login?token_hash=abc&type=invite'))! as AuthCallbackTokenHash).type, 'invite');
      expect((AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login?token_hash=abc'))! as AuthCallbackTokenHash).type, 'magiclink');
      expect(AuthCallback.parse(Uri.parse('https://www.mockmob.in/app/login?token_hash=abc&type=recovery')), isNull);
    });
  });

  group('AuthService.handleLink, email link', () {
    late DateTime clock;
    late MemorySecureStore store;
    late GoTrueServer server;
    late GoTrueClient client;
    late StreamController<Uri> links;
    final subs = <StreamSubscription<Object?>>[];

    setUp(() {
      clock = DateTime.utc(2026, 10, 20, 1);
      store = FlakyStore();
      server = GoTrueServer();
      client = gotrue(server, store);
      links = StreamController<Uri>.broadcast();
    });

    tearDown(() async {
      for (final s in subs) {
        await s.cancel();
      }
      subs.clear();
      await links.close();
    });

    Future<AuthService> service() async => AuthService(
          client: client,
          store: store,
          lock: await tempLock(),
          config: config(),
          links: links.stream,
          openExternal: (_) async => true,
          now: () => clock,
        );

    test('signed out: the token hash is verified once and the student is signed in', () async {
      final bodies = <Map>[];
      server.routes['verify'] = (request) {
        bodies.add(jsonDecode(request.body) as Map);
        return GoTrueServer.json(200, tokenBody(access: 'e1', refresh: 'er1', serverNow: clock));
      };
      final auth = await service();
      await auth.restore();
      final returns = <OAuthReturn>[];
      subs.add(auth.oauthReturns.listen(returns.add));
      final link = Uri.parse('https://www.mockmob.in/app/login?token_hash=hash_abc&type=magiclink');
      links
        ..add(link)
        ..add(link);
      await eventually(() => returns.length >= 2);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(bodies, hasLength(1), reason: 'a one-time link is spent once');
      expect(bodies.single['token_hash'], 'hash_abc');
      expect(bodies.single['type'], 'magiclink');
      expect(returns.map((r) => r.kind), [OAuthReturnKind.exchanging, OAuthReturnKind.signedIn]);
      expect(auth.session?.accessToken, 'e1');
    });

    test('a brand-new account\'s link (type=signup) is verified as signup and signs the student in (app-signin H1)', () async {
      final bodies = <Map>[];
      server.routes['verify'] = (request) {
        bodies.add(jsonDecode(request.body) as Map);
        return GoTrueServer.json(200, tokenBody(access: 's1', refresh: 'sr1', serverNow: clock));
      };
      final auth = await service();
      await auth.restore();
      final returns = <OAuthReturn>[];
      subs.add(auth.oauthReturns.listen(returns.add));
      links.add(Uri.parse('https://www.mockmob.in/app/login?token_hash=hash_new&type=signup'));
      await eventually(() => returns.length >= 2);
      expect(bodies.single['type'], 'signup');
      expect(returns.last.kind, OAuthReturnKind.signedIn);
      expect(auth.session?.accessToken, 's1');
    });

    test('an expired or used link is reported as a bad code and signs nobody in', () async {
      server.routes['verify'] = (_) => GoTrueServer.json(403, {'code': 'otp_expired', 'msg': 'Email link is invalid or has expired'});
      final auth = await service();
      await auth.restore();
      final returns = <OAuthReturn>[];
      subs.add(auth.oauthReturns.listen(returns.add));
      links.add(Uri.parse('https://www.mockmob.in/app/login?token_hash=old&type=magiclink'));
      await eventually(() => returns.length >= 2);
      expect(returns.last.kind, OAuthReturnKind.failed);
      expect(auth.session, isNull);
    });

    test('signed in: a link (perhaps someone else\'s) never swaps the account', () async {
      server.routes['token?password'] = (_) => GoTrueServer.json(200, tokenBody(access: 'p1', refresh: 'pr1', serverNow: clock));
      final auth = await service();
      await auth.restore();
      await auth.signInWithPassword('asha@example.com', 'correct horse');
      server.requests.clear();
      links.add(Uri.parse('https://www.mockmob.in/app/login?token_hash=other&type=magiclink'));
      await settle();
      expect(server.requests, isEmpty);
      expect(auth.session?.accessToken, 'p1');
    });
  });

  test('the app asks for the code with client app, and the App Link claims /app/login', () {
    final controller = File('lib/core/auth/auth_controller.dart').readAsStringSync();
    expect(controller, contains("'client': 'app'"));
    final manifest = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    expect(manifest, contains('<data android:path="/app/login" />'));
    expect(manifest, isNot(contains('/auth/callback"')), reason: 'website sign-ins on this phone stay in the browser');
    final router = File('lib/core/router/router.dart').readAsStringSync();
    expect(router, contains('if (AuthLinks.isEmailLink(uri)) return;'));
  });
}
