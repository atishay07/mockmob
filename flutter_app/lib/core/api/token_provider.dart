import 'dart:convert';

/// An access token and the MockMob account it belongs to.
class ApiToken {
  const ApiToken(this.value, {this.userId});

  final String value;

  /// The MockMob user id of the account the token was issued to. Null when the provider cannot
  /// tell: a session whose profile has not loaded yet, or (in the background isolate) a session
  /// no profile was ever loaded for on this phone. A write that names the account it is for is
  /// refused unless this matches.
  final String? userId;
}

/// What the API client needs from the auth layer. Implemented by the foreground auth service
/// and by the headless token refresher used in the WorkManager isolate.
abstract class ApiTokenProvider {
  /// The current access token, or null when signed out.
  Future<String?> accessToken();

  /// The current access token with the account it belongs to, read in one step so the id always
  /// describes the token it comes with. Null when signed out.
  Future<ApiToken?> accountToken();

  /// Refreshes the session once. True when a new access token is available, false when the
  /// refresh token was definitely rejected. Throws [RefreshUnavailable] when the answer is
  /// unknown (no network, a timeout, a busy lock): the session is intact and must be kept.
  Future<bool> refresh();

  /// Called after a refresh failed or a retried request still returned 401: the session is gone.
  Future<void> onSessionLost();
}

/// A refresh could not be attempted or finished, so nothing is known about the session.
class RefreshUnavailable implements Exception {
  const RefreshUnavailable();

  @override
  String toString() => 'RefreshUnavailable';
}

/// The `sub` claim of a Supabase access token: the Supabase user it was issued to. Read without
/// checking the signature, which is the server's job; the app only asks whose its own token is.
/// Null when [token] is not a readable JWT.
String? jwtSubject(String token) {
  final parts = token.split('.');
  if (parts.length != 3) return null;
  try {
    final claims = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
    final sub = claims is Map ? claims['sub'] : null;
    return sub is String && sub.isNotEmpty ? sub : null;
  } on FormatException {
    return null;
  }
}
