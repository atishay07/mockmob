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

  /// The emailed sign-in button for a code asked for in the app (20 Oct, I2):
  /// `https://www.mockmob.in/app/login?token_hash=...&type=magiclink`. The verified App Link claims
  /// this path only; the website's own `/auth/callback` stays in the browser.
  static const String emailLinkPath = '/app/login';

  static const Set<String> _emailLinkHosts = {'www.mockmob.in', 'mockmob.in'};

  /// True for the emailed sign-in link. The router leaves it to the auth service.
  static bool isEmailLink(Uri uri) {
    if (uri.scheme.toLowerCase() != 'https' || !_emailLinkHosts.contains(uri.host.toLowerCase())) return false;
    final path = uri.path.endsWith('/') && uri.path.length > 1 ? uri.path.substring(0, uri.path.length - 1) : uri.path;
    return path == emailLinkPath;
  }
}

/// What came back through [AuthLinks.redirectUri].
sealed class AuthCallback {
  const AuthCallback();

  /// Null when [uri] is not the sign-in callback or carries nothing usable.
  static AuthCallback? parse(Uri uri) {
    if (AuthLinks.isEmailLink(uri)) {
      final hash = uri.queryParameters['token_hash']?.trim();
      if (hash == null || hash.isEmpty) return null;
      final type = uri.queryParameters['type']?.trim().toLowerCase();
      return AuthCallbackTokenHash(hash, type == 'email' ? 'email' : 'magiclink');
    }
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

/// The emailed sign-in link: a one-time token hash, spent with `verifyOTP(tokenHash:)`.
class AuthCallbackTokenHash extends AuthCallback {
  const AuthCallbackTokenHash(this.tokenHash, this.type);
  final String tokenHash;

  /// `magiclink` (what the server mints) or `email`.
  final String type;
}

class AuthCallbackError extends AuthCallback {
  const AuthCallbackError(this.error);

  /// For example `access_denied` when the student closed Google's consent page.
  final String error;

  bool get cancelled => error == 'access_denied';
}
