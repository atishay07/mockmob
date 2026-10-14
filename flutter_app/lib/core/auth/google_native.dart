import 'package:google_sign_in/google_sign_in.dart';

/// The native account sheet could not be used on this phone (no Google Play services, no
/// Android OAuth client for this app's signing key, an unsupported phone). The browser flow
/// is the fallback.
class GoogleNativeUnavailable implements Exception {
  const GoogleNativeUnavailable(this.reason);

  /// The plugin's error code name, for diagnostics. Never a token or an email.
  final String reason;

  @override
  String toString() => 'GoogleNativeUnavailable($reason)';
}

/// Gets a Google ID token from the Android account sheet.
abstract interface class GoogleIdTokenSource {
  /// The ID token, or null when the student closed the sheet. [hashedNonce] is the SHA-256 of
  /// the raw nonce Supabase later checks it against. Throws [GoogleNativeUnavailable].
  Future<String?> idToken({required String serverClientId, required String hashedNonce});

  /// Forgets the account chosen last time, so the next sign-in asks again.
  Future<void> signOut();
}

/// google_sign_in 7 on Android: Credential Manager's "Sign in with Google" sheet.
///
/// The plugin must be initialized exactly once per process, so the nonce is fixed per process
/// (the caller keeps the raw value for that process). That still binds every ID token to this
/// app run.
class CredentialManagerGoogle implements GoogleIdTokenSource {
  CredentialManagerGoogle([GoogleSignIn? plugin]) : _plugin = plugin ?? GoogleSignIn.instance;

  final GoogleSignIn _plugin;
  Future<void>? _ready;

  @override
  Future<String?> idToken({required String serverClientId, required String hashedNonce}) async {
    try {
      try {
        await (_ready ??= _plugin.initialize(serverClientId: serverClientId, nonce: hashedNonce));
      } on Object {
        _ready = null; // Let the next tap try again.
        rethrow;
      }
      final account = await _plugin.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) throw const GoogleNativeUnavailable('no_id_token');
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled || e.code == GoogleSignInExceptionCode.interrupted) return null;
      throw GoogleNativeUnavailable(e.code.name);
    } on GoogleNativeUnavailable {
      rethrow;
    } on Object {
      throw const GoogleNativeUnavailable('plugin_error');
    }
  }

  @override
  Future<void> signOut() async {
    if (_ready == null) return;
    try {
      await _plugin.signOut();
    } on Object {
      // Not signed in with Google on this run.
    }
  }
}
