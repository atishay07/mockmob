import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mockmob/core/auth/google_native.dart';
import 'package:mockmob/core/auth/session_lock.dart';
import 'package:mockmob/core/auth/stored_session.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/storage/secure_store.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show GoTrueClient;

const supabaseUrl = 'https://sb.test';

AppConfig config({String webClientId = '', String google = 'auto', bool phone = false}) => AppConfig(
      apiBaseUrl: 'https://api.test',
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: 'anon',
      googleWebClientId: webClientId,
      googleSignInModeName: google,
      phoneSignInEnabled: phone,
    );

/// Epoch seconds of [t].
int secs(DateTime t) => t.millisecondsSinceEpoch ~/ 1000;

Map<String, dynamic> userJson([String id = 'sb-user', String email = 'asha@example.com']) => {
      'id': id,
      'aud': 'authenticated',
      'email': email,
      'app_metadata': {'provider': 'email'},
      'user_metadata': <String, dynamic>{},
      'created_at': '2026-01-01T00:00:00Z',
    };

/// A token endpoint answer.
Map<String, dynamic> tokenBody({
  required String access,
  required String refresh,
  required DateTime serverNow,
  int expiresIn = 3600,
  String userId = 'sb-user',
}) =>
    {
      'access_token': access,
      'refresh_token': refresh,
      'token_type': 'bearer',
      'expires_in': expiresIn,
      'expires_at': secs(serverNow) + expiresIn,
      'user': userJson(userId),
    };

/// A stored session as supabase_flutter would have written it.
String storedSession({
  required String access,
  required String refresh,
  required int expiresAt,
  int? localExpiresAt,
  String userId = 'sb-user',
}) =>
    jsonEncode({
      'access_token': access,
      'refresh_token': refresh,
      'token_type': 'bearer',
      'expires_in': 3600,
      'expires_at': expiresAt,
      'user': userJson(userId),
      StoredSession.localExpiresKey: ?localExpiresAt,
    });

/// One scripted answer for the Dio side (refresh and user check).
class Reply {
  const Reply(this.status, [this.body]);
  const Reply.network() : this(-1);
  const Reply.receiveTimeout() : this(-2);

  final int status;
  final Object? body;
}

class Recorded {
  Recorded(this.method, this.url, this.headers, this.body);
  final String method;
  final Uri url;
  final Map<String, dynamic> headers;
  final Object? body;
}

/// Dio adapter that answers from a script and records what was sent.
class ScriptedAdapter implements HttpClientAdapter {
  final List<Reply> replies = [];
  final List<Recorded> requests = [];

  /// When set, decides each answer instead of [replies].
  Reply Function(RequestOptions)? handler;

  /// When set, every request waits for it (to hold a refresh in flight).
  Completer<void>? hold;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(Recorded(options.method, options.uri, Map.of(options.headers), options.data));
    await hold?.future;
    final reply = handler?.call(options) ?? (replies.isEmpty ? const Reply.network() : replies.removeAt(0));
    if (reply.status == -1) {
      throw DioException(requestOptions: options, type: DioExceptionType.connectionError, error: 'offline');
    }
    if (reply.status == -2) {
      throw DioException(requestOptions: options, type: DioExceptionType.receiveTimeout, error: 'slow');
    }
    final body = reply.body;
    final text = body is String ? body : jsonEncode(body ?? {});
    return ResponseBody.fromString(text, reply.status, headers: {
      Headers.contentTypeHeader: [body is String && !(body.trimLeft().startsWith('[') || body.trimLeft().startsWith('{')) ? 'text/html' : Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

Dio scriptedDio(ScriptedAdapter adapter) => Dio()..httpClientAdapter = adapter;

/// The Supabase client's own HTTP (sign-in calls, sign-out, code exchange).
class GoTrueServer {
  final List<http.Request> requests = [];

  /// Path (without the /auth/v1 prefix) plus grant type, for example `token?password`.
  final Map<String, http.Response Function(http.Request)> routes = {};

  late final MockClient client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/auth/v1/', '');
    final grant = request.url.queryParameters['grant_type'];
    final key = grant == null ? path : '$path?$grant';
    final route = routes[key] ?? routes[path];
    if (route != null) return route(request);
    if (path == 'logout') return http.Response('', 204);
    return http.Response(jsonEncode({'code': 'unexpected', 'msg': 'no route for $key'}), 418);
  });

  static http.Response json(int status, Object body) =>
      http.Response(jsonEncode(body), status, headers: {
        'content-type': 'application/json',
        // Real Supabase sends this; without it error codes are read from the legacy field.
        'x-supabase-api-version': '2024-01-01',
      });
}

GoTrueClient gotrue(GoTrueServer server, SecureStore store) => GoTrueClient(
      url: '$supabaseUrl/auth/v1',
      httpClient: server.client,
      autoRefreshToken: false,
      asyncStorage: SecurePkceStorage(store),
    );

Future<SessionLock> tempLock() async {
  final dir = await Directory.systemTemp.createTemp('mm_auth_test');
  return SessionLock(File('${dir.path}/mm_session.lock'), pollEvery: const Duration(milliseconds: 5));
}

/// A store whose reads can be made to fail, like a Keystore hiccup.
class FlakyStore extends MemorySecureStore {
  int failReads = 0;

  @override
  Future<String?> read(String key) async {
    if (failReads > 0) {
      failReads--;
      throw const FileSystemException('keystore busy');
    }
    return super.read(key);
  }
}

class FakeGoogle implements GoogleIdTokenSource {
  String? token = 'google-id-token';
  Object? error;
  final List<(String, String)> calls = [];
  int signOuts = 0;

  @override
  Future<String?> idToken({required String serverClientId, required String hashedNonce}) async {
    calls.add((serverClientId, hashedNonce));
    final e = error;
    if (e != null) throw e;
    return token;
  }

  @override
  Future<void> signOut() async => signOuts++;
}

/// Lets queued stream events and microtasks run.
Future<void> settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// Waits (in real time, since the session lock polls a file) until [done] holds.
Future<void> eventually(bool Function() done, {Duration within = const Duration(seconds: 3)}) async {
  final deadline = DateTime.now().add(within);
  while (!done()) {
    if (DateTime.now().isAfter(deadline)) throw StateError('condition not met in $within');
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}
