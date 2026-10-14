import '../api/api_client.dart';
import '../api/api_error.dart';
import '../models/auth_me.dart';

/// Waits before each attempt at `GET /api/auth/me` (mirrors the web `AuthProvider`, contract 1.2).
const authMeBackoff = [
  Duration.zero,
  Duration(milliseconds: 250),
  Duration(milliseconds: 600),
  Duration(milliseconds: 1000),
  Duration(milliseconds: 1600),
  Duration(milliseconds: 2400),
  Duration(milliseconds: 3200),
];

bool _retryable(ApiError e) => e.kind == ApiErrorKind.timeout || const {429, 500, 502, 503, 504}.contains(e.status);

/// Loads the signed-in profile, retrying 429, 5xx and timeouts on the documented schedule.
/// An offline error is thrown at once so the caller can fall back to the cached profile.
/// A 401 is never retried here: the API client already refreshed once.
Future<AuthMe> loadAuthMe(ApiClient api, {Future<void> Function(Duration)? sleep, List<Duration> backoff = authMeBackoff}) async {
  final pause = sleep ?? (Duration d) => Future<void>.delayed(d);
  ApiError? last;
  for (final wait in backoff) {
    if (wait > Duration.zero) await pause(wait);
    try {
      final response = await api.get('/api/auth/me', options: const ApiOptions(retries: 0, bypassRateGate: true));
      final me = AuthMe.fromJson(response.map);
      if (me.user == null) {
        last = const ApiError(status: 404, kind: ApiErrorKind.notFound, code: 'not_found');
        continue;
      }
      return me;
    } on ApiError catch (e) {
      if (!_retryable(e)) rethrow;
      last = e;
    }
  }
  throw last ?? const ApiError(kind: ApiErrorKind.unknown, code: 'unknown');
}
