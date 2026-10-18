import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Build-time configuration, supplied with `--dart-define` or `--dart-define-from-file`.
/// See `dart_defines/README.md` for the dev and prod value sets.
class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    this.googleWebClientId = '',
    this.freshChecksLive = false,
    this.googleSignInModeName = 'auto',
    this.phoneSignInEnabled = false,
    this.playBilling = false,
  });

  /// Reads the compile-time defines. `API_BASE_URL` defaults to the production `www` host:
  /// the apex redirects and a redirect can drop the Authorization header [API 1.1].
  const AppConfig.fromEnvironment()
      : apiBaseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'https://www.mockmob.in'),
        supabaseUrl = const String.fromEnvironment('SUPABASE_URL'),
        supabaseAnonKey = const String.fromEnvironment('SUPABASE_ANON_KEY'),
        googleWebClientId = const String.fromEnvironment('GOOGLE_WEB_CLIENT_ID'),
        freshChecksLive = const bool.fromEnvironment('FRESH_CHECKS_LIVE'),
        googleSignInModeName = const String.fromEnvironment('GOOGLE_SIGN_IN', defaultValue: 'auto'),
        phoneSignInEnabled = const bool.fromEnvironment('PHONE_SIGN_IN'),
        playBilling = const bool.fromEnvironment('PLAY_BILLING');

  final String apiBaseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String googleWebClientId;

  /// The content gate for fresh-question checks. False until the owner opens it.
  final bool freshChecksLive;

  /// `GOOGLE_SIGN_IN`: `auto` (default), `native`, `browser` or `off`. See docs/AUTH.md.
  final String googleSignInModeName;

  /// `PHONE_SIGN_IN`: phone sign-in by SMS code. Off until the owner sets up an SMS provider
  /// (docs/AUTH.md, "Phone sign-in").
  final bool phoneSignInEnabled;

  /// `PLAY_BILLING`: Pro and AI credit packs through Google Play Billing. Off by default: with it off
  /// nothing of it shows and the app behaves as it did before (lib/core/billing). The server has its own
  /// flag (`POST /api/billing/play/verify` answers 404 while that one is off).
  final bool playBilling;

  GoogleSignInMode get googleSignInMode => switch (googleSignInModeName.trim().toLowerCase()) {
        'native' => GoogleSignInMode.native,
        'browser' => GoogleSignInMode.browser,
        'off' => GoogleSignInMode.off,
        _ => GoogleSignInMode.auto,
      };

  /// The one-tap Android account sheet (Credential Manager). Needs the Google web client id.
  bool get googleNativeEnabled =>
      googleWebClientId.isNotEmpty && (googleSignInMode == GoogleSignInMode.auto || googleSignInMode == GoogleSignInMode.native);

  /// Google through the browser, like the website (Supabase OAuth with PKCE, back through
  /// `in.mockmob.app://login-callback`). Needs no Android OAuth client.
  bool get googleBrowserEnabled =>
      supabaseConfigured && (googleSignInMode == GoogleSignInMode.auto || googleSignInMode == GoogleSignInMode.browser);

  /// Whether to show "Continue with Google" at all.
  bool get googleSignInEnabled => googleNativeEnabled || googleBrowserEnabled;

  /// Supabase cannot start without both values, so auth reports a clear failure instead.
  bool get supabaseConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  /// Path used for the light reachability ping while work is pending (cached at the edge).
  String get pingUrl => '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api/stats';
}

/// How Google sign-in is offered. `auto` uses the native account sheet when a web client id is
/// configured and falls back to the browser when the sheet cannot be used on this phone.
enum GoogleSignInMode { auto, native, browser, off }

final appConfigProvider = Provider<AppConfig>((ref) => const AppConfig.fromEnvironment());
