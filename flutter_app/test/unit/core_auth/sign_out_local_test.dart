// onboarding-auth-04: signing out never waits on the server before the stored tokens go, and a
// server that does not answer cannot hold the sign-out.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mockmob/core/auth/auth_service.dart';
import 'package:mockmob/core/auth/stored_session.dart';
import 'package:mockmob/core/auth/token_client.dart';
import 'package:mockmob/core/storage/secure_store.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show GoTrueClient;

import 'support.dart';

void main() {
  test('a stalled server logout neither keeps the stored tokens nor holds the sign-out', () async {
    final clock = DateTime.utc(2026, 10, 14, 9);
    final store = MemorySecureStore();
    final logoutAnswer = Completer<void>();
    var logouts = 0;
    final server = MockClient((request) async {
      final path = request.url.path.replaceFirst('/auth/v1/', '');
      if (path == 'logout') {
        logouts++;
        await logoutAnswer.future;
        return http.Response('', 204);
      }
      if (path == 'token') return GoTrueServer.json(200, tokenBody(access: 'p1', refresh: 'pr1', serverNow: clock));
      return http.Response('{}', 418);
    });
    final client = GoTrueClient(
      url: '$supabaseUrl/auth/v1',
      httpClient: server,
      autoRefreshToken: false,
      asyncStorage: SecurePkceStorage(store),
    );
    final auth = AuthService(
      client: client,
      store: store,
      lock: await tempLock(),
      config: config(),
      tokens: SupabaseTokenClient(config: config(), dio: scriptedDio(ScriptedAdapter()), pause: (_) async {}),
      google: FakeGoogle(),
      now: () => clock,
      serverSignOutWait: const Duration(milliseconds: 300),
    );
    addTearDown(auth.dispose);
    await auth.restore();
    await auth.signInWithPassword('asha@example.com', 'correct horse');
    expect(store.values.containsKey(SecureKeys.supabaseSession), isTrue);

    final signingOut = auth.signOutLocal();
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(logouts, 1, reason: 'the server is still told, best effort');
    expect(store.values.containsKey(SecureKeys.supabaseSession), isFalse,
        reason: 'gone before the server answers, so closing the app now still signs out');

    await signingOut.timeout(const Duration(seconds: 3));
    expect(auth.session, isNull);
    expect(await auth.accessToken(), isNull);
    logoutAnswer.complete();
  });
}
