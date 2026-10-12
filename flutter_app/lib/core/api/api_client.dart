import 'dart:async';

import 'package:dio/dio.dart';

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

  Future<ApiResponse> get(String path, {Map<String, Object?>? query, ApiOptions options = const ApiOptions()}) =>
      _send('GET', path, query: query, options: options);

  Future<ApiResponse> post(String path, {Object? body, Map<String, Object?>? query, ApiOptions options = const ApiOptions()}) =>
      _send('POST', path, body: body, query: query, options: options);

  Future<ApiResponse> put(String path, {Object? body, ApiOptions options = const ApiOptions()}) =>
      _send('PUT', path, body: body, options: options);

  Future<ApiResponse> patch(String path, {Object? body, ApiOptions options = const ApiOptions()}) =>
      _send('PATCH', path, body: body, options: options);

  Future<ApiResponse> delete(String path, {Object? body, ApiOptions options = const ApiOptions()}) =>
      _send('DELETE', path, body: body, options: options);

  /// Any method by name, for callers that replay a stored request (the outbox).
  Future<ApiResponse> request(String method, String path, {Object? body, Map<String, Object?>? query, ApiOptions options = const ApiOptions()}) =>
      _send(method.toUpperCase(), path, body: body, query: query, options: options);

  /// Remaining client-side hold for a path after a 429, if any.
  Duration? heldFor(String path) {
    final until = _blockedUntil[_bucket(path)];
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
  }) async {
    if (!options.bypassRateGate) {
      final held = heldFor(path);
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
            extra: {_authKey: options.authenticated},
          ),
        );
        observer?.onReachedServer();
        return ApiResponse(response.statusCode ?? 200, response.data);
      } on ApiError {
        rethrow;
      } on DioException catch (e) {
        final error = e.error is ApiError ? e.error! as ApiError : ApiError.fromDio(e);
        if (error.isOffline) {
          observer?.onNetworkError();
        } else if (error.status != null) {
          observer?.onReachedServer();
        }
        if (error.isRateLimited) {
          _blockedUntil[_bucket(path)] = _now().add(error.retryAfter ?? const Duration(seconds: 60));
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
    final token = await _client._tokens.accessToken();
    if (token == null || token.isEmpty) {
      return handler.reject(
        DioException(requestOptions: options, error: const ApiError.signedOut(), type: DioExceptionType.unknown),
      );
    }
    options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    final authenticated = options.extra[ApiClient._authKey] != false;
    if (err.response?.statusCode != 401 || !authenticated) return handler.next(err);

    if (options.extra[ApiClient._retriedKey] == true) {
      // Refreshed once already and still unauthorized: the session is gone.
      await _client._tokens.onSessionLost();
      return handler.next(_unauthorized(err));
    }

    // Another request may already have refreshed while this one was in flight: if the token
    // changed since this request was sent, just retry with it instead of refreshing again.
    final sent = options.headers['Authorization'];
    final current = await _client._tokens.accessToken();
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
      final token = await _client._tokens.accessToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
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
