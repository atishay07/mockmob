import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

import '../config/app_config.dart';
import 'api_error.dart';
import 'token_provider.dart';

/// Per-call switches. Defaults suit an ordinary authenticated read or write.
class ApiOptions {
  const ApiOptions({
    this.authenticated = true,
    this.retries,
    this.bypassRateGate = false,
    this.idempotencyKey,
    this.receiveTimeout,
    this.plainBody = false,
    this.cancelToken,
  });

  /// False for `/api/auth/email-login` and other public calls.
  final bool authenticated;

  /// Extra attempts after a network error, timeout or 502/503/504. Null means 2 for GET and 0
  /// for everything else: a write is only repeated by a caller that knows its idempotency.
  final int? retries;

  /// Skip the client-side 429 hold (used by loops that run their own back-off).
  final bool bypassRateGate;

  /// Sent as `Idempotency-Key`. The contract's own ids (`generationKey`, `requestId`,
  /// `requestKey`, `event_id`) travel in the body and are passed by the caller.
  final String? idempotencyKey;
  final Duration? receiveTimeout;

  /// Return the body as a raw string so a large payload can be decoded in an isolate.
  final bool plainBody;
  final CancelToken? cancelToken;
}

/// Successful response: decoded JSON (or the raw string with [ApiOptions.plainBody]).
class ApiResponse {
  const ApiResponse(this.status, this.data);

  final int status;
  final Object? data;

  Map<String, dynamic> get map => data is Map ? Map<String, dynamic>.from(data! as Map) : const {};
  List<dynamic> get list => data is List ? data! as List : const [];
  String get text => data is String ? data! as String : '';
}

/// Told about the outcome of every request, so connectivity can be judged from real traffic
/// instead of the radio flag alone.
abstract class ApiNetworkObserver {
  /// A request failed with no response (offline or timed out).
  void onNetworkError();

  /// A request reached the server (any HTTP status).
  void onReachedServer();
}

/// dio based client: bearer header, refresh once on 401 then sign out, typed errors, a client
/// side 429 hold and timeouts tuned for 4G.
class ApiClient {
  ApiClient({
    required AppConfig config,
    required this._tokens,
    Dio? dio,
    DateTime Function()? now,
    Future<void> Function(Duration)? sleep,
    this.observer,
  })  : _now = now ?? DateTime.now,
        _sleep = sleep ?? Future<void>.delayed,
        dio = dio ?? Dio() {
    this.dio.options
      ..baseUrl = config.apiBaseUrl.replaceAll(RegExp(r'/+$'), '')
      ..connectTimeout = const Duration(seconds: 15)
      ..sendTimeout = const Duration(seconds: 30)
      ..receiveTimeout = const Duration(seconds: 30)
      ..contentType = Headers.jsonContentType
      ..responseType = ResponseType.json
      ..headers['Accept'] = 'application/json';
    this.dio.interceptors.add(_AuthInterceptor(this));
  }

  final Dio dio;
  final ApiNetworkObserver? observer;
  final ApiTokenProvider _tokens;
  final DateTime Function() _now;
  final Future<void> Function(Duration) _sleep;

  final Map<String, DateTime> _blockedUntil = {};
  Future<bool>? _refreshing;

  static const _retryDelays = [Duration(milliseconds: 400), Duration(milliseconds: 1200)];

  // Every call can take [expectUserId]: the MockMob user id it is for. When the token at hand
  // belongs to anyone else, or to an account the token source cannot name (the student signed
  // out and another account signed in while the call waited), nothing is sent and
  // [ApiError.accountChanged] is thrown. Checked again when a 401 is retried with a refreshed
  // token. Every write that can outlive the screen that started it names its account; a read
  // names one when its answer decides what happens to the student's work (a submitted paper's
  // attempt, for example).

  Future<ApiResponse> get(String path, {Map<String, Object?>? query, ApiOptions options = const ApiOptions(), String? expectUserId}) =>
      _send('GET', path, query: query, options: options, expectUserId: expectUserId);

  Future<ApiResponse> post(String path, {Object? body, Map<String, Object?>? query, ApiOptions options = const ApiOptions(), String? expectUserId}) =>
      _send('POST', path, body: body, query: query, options: options, expectUserId: expectUserId);

  Future<ApiResponse> put(String path, {Object? body, ApiOptions options = const ApiOptions(), String? expectUserId}) =>
      _send('PUT', path, body: body, options: options, expectUserId: expectUserId);

  Future<ApiResponse> patch(String path, {Object? body, ApiOptions options = const ApiOptions(), String? expectUserId}) =>
      _send('PATCH', path, body: body, options: options, expectUserId: expectUserId);

  Future<ApiResponse> delete(String path, {Object? body, ApiOptions options = const ApiOptions(), String? expectUserId}) =>
      _send('DELETE', path, body: body, options: options, expectUserId: expectUserId);

  /// Any method by name, for callers that replay a stored request (the outbox).
  Future<ApiResponse> request(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    ApiOptions options = const ApiOptions(),
    String? expectUserId,
  }) =>
      _send(method.toUpperCase(), path, body: body, query: query, options: options, expectUserId: expectUserId);

  /// Remaining client-side hold for a call after a 429, if any. Reads and writes of a route
  /// family are held apart: a 429 on the session events PUT must not stop the result from
  /// opening with a GET.
  Duration? heldFor(String path, {String method = 'GET'}) {
    final until = _blockedUntil[_holdKey(method, path)];
    if (until == null) return null;
    final left = until.difference(_now());
    return left > Duration.zero ? left : null;
  }

  Future<ApiResponse> _send(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    required ApiOptions options,
    String? expectUserId,
  }) async {
    if (!options.bypassRateGate) {
      final held = heldFor(path, method: method);
      if (held != null) {
        throw ApiError(status: 429, kind: ApiErrorKind.rateLimited, code: ApiCodes.rateLimited, retryAfter: held);
      }
    }
    final maxRetries = options.retries ?? (method == 'GET' ? 2 : 0);
    var attempt = 0;
    while (true) {
      try {
        final response = await dio.request<Object?>(
          path,
          data: body,
          queryParameters: query?.map((k, v) => MapEntry(k, v is List ? v : v?.toString())),
          cancelToken: options.cancelToken,
          options: Options(
            method: method,
            responseType: options.plainBody ? ResponseType.plain : ResponseType.json,
            receiveTimeout: options.receiveTimeout,
            headers: {if (options.idempotencyKey != null) 'Idempotency-Key': options.idempotencyKey},
            extra: {_authKey: options.authenticated, _expectUserKey: ?expectUserId},
          ),
        );
        observer?.onReachedServer();
        // A 2xx that Vercel's firewall marked is not the API's answer: never read as success.
        if (ApiError.carriesBlockHeader(response.headers.value)) {
          throw ApiError.fromResponse(response.statusCode ?? 200, response.data, blockHeader: true);
        }
        // dio decodes a JSON answer even when the raw body was asked for, so a plainBody caller
        // got a List or Map and ApiResponse.text read ''. Hand back the text it asked for.
        final data = response.data;
        return ApiResponse(response.statusCode ?? 200, options.plainBody && data != null && data is! String ? jsonEncode(data) : data);
      } on ApiError {
        rethrow;
      } on DioException catch (e) {
        final error = e.error is ApiError ? e.error! as ApiError : ApiError.fromDio(e);
        if (kDebugMode && error.kind == ApiErrorKind.unknown) debugPrint('API $method $path failed: ${e.type.name} ${e.error}');
        // Any HTTP status (a 408 included) proves the server was reached.
        if (error.status != null) {
          observer?.onReachedServer();
        } else if (error.isOffline) {
          observer?.onNetworkError();
        }
        if (error.isRateLimited) {
          _blockedUntil[_holdKey(method, path)] = _now().add(error.retryAfter ?? const Duration(seconds: 60));
        }
        final transient = error.isOffline || const {502, 503, 504}.contains(error.status);
        if (transient && attempt < maxRetries && error.kind != ApiErrorKind.cancelled) {
          await _sleep(_retryDelays[attempt.clamp(0, _retryDelays.length - 1)]);
          attempt++;
          continue;
        }
        throw error;
      }
    }
  }

  /// The 429 hold is per route family and per kind of call (read or write).
  static String _holdKey(String method, String path) {
    final m = method.toUpperCase();
    final kind = m == 'GET' || m == 'HEAD' ? 'read' : 'write';
    return '${_bucket(path)}:$kind';
  }

  /// Rate limits are per route family. The learning routes share one bucket and the session
  /// and attempt writes share another (contract section 1.4).
  static String _bucket(String path) {
    final clean = path.split('?').first;
    if (clean.startsWith('/api/study') || clean.startsWith('/api/learning')) return 'learning';
    if (clean.startsWith('/api/sessions') || clean.startsWith('/api/attempts')) return 'sessions';
    final parts = clean.split('/').where((p) => p.isNotEmpty).take(3).toList();
    return parts.join('/');
  }

  static const _authKey = 'mm_authenticated';
  static const _expectUserKey = 'mm_expect_user';
  static const _retriedKey = 'mm_retried_after_refresh';

  /// One shared refresh for any number of concurrent 401s.
  Future<bool> _refreshOnce() {
    return _refreshing ??= _tokens.refresh().whenComplete(() => _refreshing = null);
  }
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._client);

  final ApiClient _client;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra[ApiClient._authKey] == false) return handler.next(options);
    final token = await _client._tokens.accountToken();
    if (token == null || token.value.isEmpty) {
      return handler.reject(
        DioException(requestOptions: options, error: const ApiError.signedOut(), type: DioExceptionType.unknown),
      );
    }
    if (!_forExpectedUser(options, token)) {
      return handler.reject(
        DioException(requestOptions: options, error: const ApiError.accountChanged(), type: DioExceptionType.unknown),
      );
    }
    options.headers['Authorization'] = 'Bearer ${token.value}';
    handler.next(options);
  }

  /// True unless the request names the account it is for and [token] belongs to another one,
  /// or to an account the provider cannot name.
  static bool _forExpectedUser(RequestOptions options, ApiToken token) {
    final expected = options.extra[ApiClient._expectUserKey];
    return expected == null || token.userId == expected;
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    final authenticated = options.extra[ApiClient._authKey] != false;
    if (err.response?.statusCode != 401 || !authenticated) return handler.next(err);
    // A 401 from Vercel's front door (a page, or a challenge header) says nothing about the
    // sign-in: do not refresh, and above all do not end the session over it.
    final r = err.response;
    if (r != null && (ApiError.carriesBlockHeader(r.headers.value) || ApiError.isNonJsonBody(r.data))) return handler.next(err);

    if (options.extra[ApiClient._retriedKey] == true) {
      // Refreshed once already and still unauthorized: the session is gone.
      await _client._tokens.onSessionLost();
      return handler.next(_unauthorized(err));
    }

    // Another request may already have refreshed while this one was in flight: if the token
    // changed since this request was sent, just retry with it instead of refreshing again.
    final sent = options.headers['Authorization'];
    final current = (await _client._tokens.accountToken())?.value;
    final alreadyRefreshed = current != null && sent != null && sent != 'Bearer $current';
    bool refreshed;
    try {
      refreshed = alreadyRefreshed || await _client._refreshOnce();
    } on RefreshUnavailable {
      // The refresh could not run (offline, slow, lock busy). The session is intact, so report
      // an offline-style error and leave the student signed in.
      return handler.next(
        DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
        ),
      );
    } on Object {
      refreshed = false;
    }
    if (!refreshed) {
      await _client._tokens.onSessionLost();
      return handler.next(_unauthorized(err));
    }
    try {
      options.extra[ApiClient._retriedKey] = true;
      final token = await _client._tokens.accountToken();
      // Signed out since the refresh: the call is not repeated with the token that was refused.
      if (token == null || token.value.isEmpty) {
        return handler.next(
          DioException(requestOptions: options, type: DioExceptionType.unknown, error: const ApiError.signedOut()),
        );
      }
      // The refreshed session may be another account's by now: a call for the first one is
      // not repeated with it.
      if (!_forExpectedUser(options, token)) {
        return handler.next(
          DioException(requestOptions: options, type: DioExceptionType.unknown, error: const ApiError.accountChanged()),
        );
      }
      options.headers['Authorization'] = 'Bearer ${token.value}';
      final retried = await _client.dio.fetch<Object?>(options);
      handler.resolve(retried);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  DioException _unauthorized(DioException err) => DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: DioExceptionType.badResponse,
        error: ApiError.fromResponse(401, err.response?.data),
      );
}
