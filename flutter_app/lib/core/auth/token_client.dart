import 'package:dio/dio.dart';

import '../config/app_config.dart';

/// The outcome of one call to the Supabase token or user endpoint.
sealed class TokenCallResult {
  const TokenCallResult();
}

/// The call worked. [body] is the decoded JSON.
class TokenCallOk extends TokenCallResult {
  const TokenCallOk(this.body);
  final Map<String, dynamic> body;
}

/// Supabase said, definitively, that the session is over: the refresh token was revoked,
/// already used, or its session or user is gone. Only this signs a student out.
class TokenCallRejected extends TokenCallResult {
  const TokenCallRejected(this.code);

  /// The Supabase error code (never a token), for diagnostics.
  final String code;
}

/// Nothing is known about the session: offline, a timeout, a 5xx, a 429, a proxy page or any
/// answer that is not a clear verdict. The session must be kept.
class TokenCallUnavailable extends TokenCallResult {
  const TokenCallUnavailable();
}

/// Error codes that end a session at the token endpoint (Supabase Auth `RefreshTokenGrant`).
const definitiveRefreshCodes = {
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'user_banned',
};

/// Error codes that end a session at the user endpoint.
const definitiveUserCodes = {'session_not_found', 'user_not_found', 'user_banned'};

/// Reads a failed token-endpoint answer. Only a 400, 401 or 403 whose JSON body carries one of
/// Supabase's session-ending codes (or the legacy `invalid_grant`, "Invalid Refresh Token") is a
/// verdict. Everything else, including 429 and 5xx, is [TokenCallUnavailable].
TokenCallResult classifyRefreshFailure(int? status, Object? body) {
  if (status == null || !const {400, 401, 403}.contains(status) || body is! Map) return const TokenCallUnavailable();
  final code = body['code'] ?? body['error_code'];
  if (code is String && definitiveRefreshCodes.contains(code)) return TokenCallRejected(code);
  if (body['error'] == 'invalid_grant') return const TokenCallRejected('invalid_grant');
  final message = body['msg'] ?? body['message'] ?? body['error_description'];
  if (message is String && message.startsWith('Invalid Refresh Token')) return const TokenCallRejected('invalid_refresh_token');
  return const TokenCallUnavailable();
}

/// Reads a failed user-endpoint answer the same way, with the user endpoint's codes.
TokenCallResult classifyUserFailure(int? status, Object? body) {
  if (status == null || !const {401, 403, 404}.contains(status) || body is! Map) return const TokenCallUnavailable();
  final code = body['code'] ?? body['error_code'];
  if (code is String && definitiveUserCodes.contains(code)) return TokenCallRejected(code);
  return const TokenCallUnavailable();
}

/// Talks to the Supabase Auth endpoints directly, without the Supabase client, so the
/// foreground and the WorkManager isolate refresh the same way and classify failures the same
/// way. Tokens are sent in the body or the Authorization header, never in a URL, and nothing
/// here logs.
class SupabaseTokenClient {
  SupabaseTokenClient({
    required this._config,
    Dio? dio,
    Future<void> Function(Duration)? pause,
    this.retryPause = const Duration(milliseconds: 800),
  })  : _dio = dio ?? Dio(BaseOptions(connectTimeout: const Duration(seconds: 8), receiveTimeout: const Duration(seconds: 10))),
        _pause = pause ?? ((d) => Future<void>.delayed(d));

  final AppConfig _config;
  final Dio _dio;
  final Future<void> Function(Duration) _pause;

  /// The second try after an unclear failure comes within Supabase's refresh-token reuse
  /// window (set to 30 s on both projects, docs/AUTH.md S4; Supabase's default is 10 s): when
  /// the first request did reach the server but the answer was lost, the retry is accepted
  /// instead of being taken for token theft.
  final Duration retryPause;

  String get _authUrl => '${_config.supabaseUrl.replaceAll(RegExp(r'/+$'), '')}/auth/v1';

  /// `POST /token?grant_type=refresh_token`.
  Future<TokenCallResult> refresh(String refreshToken) async {
    final first = await _post(refreshToken);
    if (!first.ambiguous) return first.result;
    await _pause(retryPause);
    return (await _post(refreshToken)).result;
  }

  /// [ambiguous] is true when the request may have reached Supabase but no answer came back.
  Future<({TokenCallResult result, bool ambiguous})> _post(String refreshToken) async {
    try {
      final response = await _dio.post<Object?>(
        '$_authUrl/token',
        queryParameters: const {'grant_type': 'refresh_token'},
        data: {'refresh_token': refreshToken},
        options: Options(headers: {'apikey': _config.supabaseAnonKey, 'Content-Type': 'application/json'}),
      );
      final body = response.data;
      if (body is Map<String, dynamic> && body['access_token'] is String) return (result: TokenCallOk(body), ambiguous: false);
      // A 2xx without tokens: a captive portal or a proxy page, not a verdict.
      return (result: const TokenCallUnavailable(), ambiguous: false);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == null) {
        // No answer. Unless the connection never opened, the request may have reached Supabase.
        final ambiguous = e.type != DioExceptionType.connectionTimeout && e.type != DioExceptionType.cancel;
        return (result: const TokenCallUnavailable(), ambiguous: ambiguous);
      }
      return (result: classifyRefreshFailure(status, e.response?.data), ambiguous: false);
    } on Object {
      return (result: const TokenCallUnavailable(), ambiguous: false);
    }
  }

  /// `GET /user` with [accessToken]: does Supabase still know this session?
  Future<TokenCallResult> user(String accessToken) async {
    try {
      final response = await _dio.get<Object?>(
        '$_authUrl/user',
        options: Options(headers: {'apikey': _config.supabaseAnonKey, 'Authorization': 'Bearer $accessToken'}),
      );
      final body = response.data;
      return body is Map<String, dynamic> ? TokenCallOk(body) : const TokenCallUnavailable();
    } on DioException catch (e) {
      return classifyUserFailure(e.response?.statusCode, e.response?.data);
    } on Object {
      return const TokenCallUnavailable();
    }
  }
}
