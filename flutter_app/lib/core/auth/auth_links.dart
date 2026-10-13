/// The deep link a browser sign-in comes back through: `in.mockmob.app://login-callback`.
///
/// It carries a one-time PKCE authorization code (`?code=`), never a token. The code is useless
/// without the code verifier kept in this app's secure storage, so another app that registered
/// the same scheme could not turn it into a session.
abstract final class AuthLinks {
  static const String scheme = 'in.mockmob.app';
  static const String host = 'login-callback';

  /// Must be in the Supabase redirect allow list (docs/AUTH.md, owner steps).
  static const String redirectUri = '$scheme://$host';

  /// True for the sign-in callback. The router should not try to open it as a page.
  static bool isCallback(Uri uri) => uri.scheme.toLowerCase() == scheme && uri.host.toLowerCase() == host;
}

/// What came back through [AuthLinks.redirectUri].
sealed class AuthCallback {
  const AuthCallback();

  /// Null when [uri] is not the sign-in callback or carries nothing usable.
  static AuthCallback? parse(Uri uri) {
    if (!AuthLinks.isCallback(uri)) return null;
    final fragment = uri.fragment.isEmpty ? const <String, String>{} : _splitQuery(uri.fragment);
    String? param(String key) => uri.queryParameters[key] ?? fragment[key];
    final error = param('error') ?? param('error_code');
    if (error != null && error.isNotEmpty) return AuthCallbackError(error);
    final code = param('code');
    if (code != null && code.isNotEmpty) return AuthCallbackCode(code);
    return null;
  }

  static Map<String, String> _splitQuery(String text) {
    try {
      return Uri.splitQueryString(text);
    } on FormatException {
      return const {};
    }
  }
}

class AuthCallbackCode extends AuthCallback {
  const AuthCallbackCode(this.code);
  final String code;
}

class AuthCallbackError extends AuthCallback {
  const AuthCallbackError(this.error);

  /// For example `access_denied` when the student closed Google's consent page.
  final String error;

  bool get cancelled => error == 'access_denied';
}
