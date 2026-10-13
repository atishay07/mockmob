import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

/// Broad class of failure, for code that only needs to decide between retry, sign-in and stop.
enum ApiErrorKind {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  paymentRequired,
  rateLimited,
  payloadTooLarge,
  unavailable,
  server,
  cancelled,
  unknown,
}

/// Machine codes the server uses that callers branch on. The server mixes upper and lower case,
/// so compare with [ApiError.hasCode], never with `==`.
abstract final class ApiCodes {
  static const sessionExpired = 'SESSION_EXPIRED';
  static const sessionNotFound = 'SESSION_NOT_FOUND';
  static const sessionAlreadySubmitted = 'SESSION_ALREADY_SUBMITTED';
  static const eventConflict = 'EVENT_CONFLICT';
  static const insufficientCredits = 'INSUFFICIENT_CREDITS';
  static const premiumRequired = 'PREMIUM_REQUIRED';
  static const insufficientPracticeContent = 'INSUFFICIENT_PRACTICE_CONTENT';
  static const insufficientVerifiedContent = 'INSUFFICIENT_VERIFIED_CONTENT';
  static const insufficientAiCredits = 'insufficient_ai_credits';
  static const notAMistake = 'not_a_mistake';
  static const operationReleased = 'operation_released';
  static const inProgress = 'in_progress';
  static const paused = 'paused';
  static const questionWithdrawn = 'question_withdrawn';
  static const questionUnderReview = 'question_under_review';
  static const keyChanged = 'key_changed';
  static const rateLimited = 'rate_limited';
  static const unavailable = 'unavailable';
  static const invalidRequest = 'invalid_request';
  static const dailyNewLimitReached = 'DAILY_NEW_LIMIT_REACHED';
  static const nothingDue = 'NOTHING_DUE';
  static const studyContentChanged = 'STUDY_CONTENT_CHANGED';
  static const revisionConflict = 'REVISION_CONFLICT';
  static const stepConflict = 'STEP_CONFLICT';
  static const idempotencyConflict = 'IDEMPOTENCY_CONFLICT';
  static const checkNotAvailable = 'check_not_available';
}

/// A failed API call. Carries a machine [code], never the server's own text: servers return
/// raw parser messages on some routes, so nothing from the response body reaches the UI.
class ApiError implements Exception {
  const ApiError({
    required this.kind,
    required this.code,
    this.status,
    this.retryAfter,
    this.details = const {},
  });

  /// HTTP status, or null when no response arrived.
  final int? status;
  final ApiErrorKind kind;

  /// Machine code from the response (`SESSION_EXPIRED`, `not_a_mistake`) or a status-derived
  /// fallback (`not_found`, `server_error`, `network`, `timeout`).
  final String code;

  /// How long to wait before calling again, set for 429 and by a Retry-After header.
  final Duration? retryAfter;

  /// Whitelisted structured fields only: `balance`, `review`, `reasonCode`, `state`.
  final Map<String, Object?> details;

  bool hasCode(String other) => code.toLowerCase() == other.toLowerCase();

  bool get isOffline => kind == ApiErrorKind.network || kind == ApiErrorKind.timeout;

  /// The connection was refused as insecure, not missing: "Can't make a secure connection.
  /// Check your date and time."
  bool get isInsecureConnection => code == 'tls';
  bool get isUnauthorized => kind == ApiErrorKind.unauthorized;
  bool get isRateLimited => kind == ApiErrorKind.rateLimited;

  /// True when repeating the same call may succeed without the student changing anything.
  bool get isRetryable => switch (kind) {
        ApiErrorKind.network || ApiErrorKind.timeout || ApiErrorKind.server || ApiErrorKind.unavailable || ApiErrorKind.rateLimited => true,
        _ => false,
      };

  /// The server answered and refused the call for a reason that sending the same request again
  /// cannot fix (a 400 or 422, 402, 403, 404, 409 or 413). Only these may discard queued work or
  /// mark a submitted paper as refused. Everything else, including a 408, a 425, a status the
  /// app does not know and a failure with no response at all, is worth another try.
  bool get isDefinitiveRefusal =>
      status != null &&
      switch (kind) {
        ApiErrorKind.validation ||
        ApiErrorKind.paymentRequired ||
        ApiErrorKind.forbidden ||
        ApiErrorKind.notFound ||
        ApiErrorKind.conflict ||
        ApiErrorKind.payloadTooLarge =>
          true,
        _ => false,
      };

  /// A fixed, plain fallback sentence for places that have nothing more specific to say.
  /// Screens normally map [code] to their own copy.
  String get message => switch (kind) {
        ApiErrorKind.network => 'You are offline.',
        ApiErrorKind.timeout => 'The connection is slow. Try again.',
        ApiErrorKind.unauthorized => 'Please sign in again.',
        ApiErrorKind.forbidden => 'This is not available for your account.',
        ApiErrorKind.notFound => 'We could not find that.',
        ApiErrorKind.conflict => 'That changed while you were working. Try again.',
        ApiErrorKind.validation => 'That did not work. Check it and try again.',
        ApiErrorKind.paymentRequired => 'That is not included in your account right now.',
        ApiErrorKind.rateLimited => 'Please wait a minute and try again.',
        ApiErrorKind.payloadTooLarge => 'That was too large to send.',
        ApiErrorKind.unavailable || ApiErrorKind.server => 'MockMob could not do that just now. Try again.',
        ApiErrorKind.cancelled => 'Cancelled.',
        ApiErrorKind.unknown => 'Something went wrong. Try again.',
      };

  /// Builds an error from a non-2xx response. The body shape differs by route family
  /// (contract section 1.3), so the code is read from every place a family puts it.
  factory ApiError.fromResponse(int status, Object? body, {String? retryAfterHeader}) {
    final map = _asMap(body);
    final details = <String, Object?>{};
    String? code;

    final review = map['review'];
    if (review is Map && review['state'] is String) {
      // Repair eligibility failures: the review state takes priority over the error code.
      details['review'] = {'state': review['state']};
      code = review['state'] as String;
    }
    final reasonCode = map['reasonCode'];
    if (reasonCode is String && _machineCode.hasMatch(reasonCode)) {
      details['reasonCode'] = reasonCode;
      code ??= reasonCode;
    }
    final error = map['error'];
    if (error is String && _machineCode.hasMatch(error)) code ??= error;
    final state = map['state'];
    if (state is String) details['state'] = state;
    final balance = map['balance'];
    if (balance is num) details['balance'] = balance;

    Duration? retryAfter;
    final seconds = int.tryParse(retryAfterHeader ?? '');
    if (seconds != null && seconds >= 0) retryAfter = Duration(seconds: seconds.clamp(0, 3600));
    if (status == 429) retryAfter ??= const Duration(seconds: 60);

    return ApiError(
      status: status,
      kind: _kindForStatus(status),
      code: code ?? _fallbackCode(status),
      retryAfter: retryAfter,
      details: details,
    );
  }

  factory ApiError.fromDio(DioException e) {
    final response = e.response;
    if (response != null && response.statusCode != null) {
      return ApiError.fromResponse(response.statusCode!, response.data, retryAfterHeader: response.headers.value('retry-after'));
    }
    return switch (e.type) {
      DioExceptionType.connectionTimeout || DioExceptionType.sendTimeout || DioExceptionType.receiveTimeout =>
        const ApiError(kind: ApiErrorKind.timeout, code: 'timeout'),
      DioExceptionType.cancel => const ApiError(kind: ApiErrorKind.cancelled, code: 'cancelled'),
      _ when e.error is FormatException => const ApiError(kind: ApiErrorKind.server, code: 'unusable_response'),
      // A certificate or handshake failure (a wrong phone clock, an interception proxy) keeps the
      // offline queue's safe behaviour but carries its own code, so the copy can say what to fix.
      DioExceptionType.badCertificate => const ApiError(kind: ApiErrorKind.network, code: 'tls'),
      _ when e.error is TlsException || e.error is HandshakeException => const ApiError(kind: ApiErrorKind.network, code: 'tls'),
      DioExceptionType.connectionError => const ApiError(kind: ApiErrorKind.network, code: 'network'),
      _ => e.error is SocketException || e.error is HttpException
          ? const ApiError(kind: ApiErrorKind.network, code: 'network')
          : const ApiError(kind: ApiErrorKind.unknown, code: 'unknown'),
    };
  }

  /// A signed-out caller reached an authenticated call.
  const ApiError.signedOut()
      : status = 401,
        kind = ApiErrorKind.unauthorized,
        code = 'unauthorized',
        retryAfter = null,
        details = const {};

  static Map<Object?, Object?> _asMap(Object? body) {
    if (body is Map) return body;
    if (body is String && body.trimLeft().startsWith('{')) {
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map) return decoded;
      } on FormatException {
        // Not JSON: no machine code to read.
      }
    }
    return const {};
  }

  static final _machineCode = RegExp(r'^[A-Za-z][A-Za-z0-9_]*$');

  static ApiErrorKind _kindForStatus(int status) {
    if (status == 401) return ApiErrorKind.unauthorized;
    if (status == 402) return ApiErrorKind.paymentRequired;
    if (status == 403) return ApiErrorKind.forbidden;
    if (status == 404) return ApiErrorKind.notFound;
    // Request Timeout: a proxy or the server gave up waiting on a slow upload.
    if (status == 408) return ApiErrorKind.timeout;
    if (status == 409) return ApiErrorKind.conflict;
    if (status == 413) return ApiErrorKind.payloadTooLarge;
    // Too Early: the server asks for the same request again later.
    if (status == 425) return ApiErrorKind.unavailable;
    if (status == 429) return ApiErrorKind.rateLimited;
    if (status == 503) return ApiErrorKind.unavailable;
    if (status >= 500) return ApiErrorKind.server;
    if (status == 400 || status == 422) return ApiErrorKind.validation;
    return ApiErrorKind.unknown;
  }

  static String _fallbackCode(int status) => switch (status) {
        400 => 'bad_request',
        401 => 'unauthorized',
        402 => 'payment_required',
        403 => 'forbidden',
        404 => 'not_found',
        408 => 'timeout',
        409 => 'conflict',
        413 => 'payload_too_large',
        422 => 'invalid_request',
        425 => 'unavailable',
        429 => 'rate_limited',
        503 => 'unavailable',
        >= 500 => 'server_error',
        _ => 'unknown',
      };

  @override
  String toString() => 'ApiError($status, $code)';
}
