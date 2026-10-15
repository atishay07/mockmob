import '../api/api_error.dart';

/// Why a read failed, in words a student understands. Every "did not load" in the app names the
/// cause the same way, so a failed Try again says something new instead of looking dead.
enum LoadProblem {
  /// No connection on this phone.
  offline,

  /// The server took too long.
  slow,

  /// The server answered with an error or asked the app to slow down (5xx, 429).
  busy,

  /// The server refused the request (401 or 403 while Supabase still accepts the session).
  refused,

  /// The answer arrived but the app could not read it.
  unreadable,

  /// The phone could not open the saved sign-in (secure storage or the session lock).
  device,

  /// The server could not read the study record behind the suggestion.
  record,

  /// Something in front of the server (its firewall or bot check) turned the app away. Nothing
  /// was judged and nothing was lost: it is tried again.
  blocked,

  /// Anything else.
  unknown;

  /// The problem behind [error]: an [ApiError] by its kind, anything else as [unknown].
  static LoadProblem of(Object? error) {
    if (error is! ApiError) return LoadProblem.unknown;
    if (error.code == 'unusable_response') return LoadProblem.unreadable;
    return switch (error.kind) {
      ApiErrorKind.blocked => LoadProblem.blocked,
      ApiErrorKind.network => LoadProblem.offline,
      ApiErrorKind.timeout => LoadProblem.slow,
      ApiErrorKind.server || ApiErrorKind.unavailable || ApiErrorKind.rateLimited => LoadProblem.busy,
      ApiErrorKind.unauthorized || ApiErrorKind.forbidden => LoadProblem.refused,
      _ => LoadProblem.unknown,
    };
  }

  /// One plain sentence naming what failed.
  String get sentence => switch (this) {
        LoadProblem.offline => 'This phone is not connected to the internet.',
        LoadProblem.slow => 'MockMob took too long to answer.',
        LoadProblem.busy => "MockMob's server is busy right now.",
        LoadProblem.refused => "MockMob's server did not accept the request.",
        LoadProblem.blocked => "MockMob's server is not letting the app in just now.",
        LoadProblem.unreadable => 'MockMob sent an answer the app could not read.',
        LoadProblem.device => 'This phone could not open your saved sign-in.',
        LoadProblem.record => "MockMob's server could not read your study record.",
        LoadProblem.unknown => 'Something went wrong on the way.',
      };

  /// What to do about it, when there is something better than trying again.
  String get advice => switch (this) {
        LoadProblem.offline => 'Connect to Wi-Fi or mobile data, then try again.',
        LoadProblem.busy || LoadProblem.slow || LoadProblem.record => 'Try again in a minute.',
        LoadProblem.blocked => 'Your work is kept.',
        LoadProblem.refused => 'Try again. If it keeps happening, sign out and sign in again.',
        LoadProblem.device => 'Try again. If it keeps happening, restart the app.',
        LoadProblem.unreadable || LoadProblem.unknown => 'Try again in a moment.',
      };
}
