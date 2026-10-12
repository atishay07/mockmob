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
  });

  /// Reads the compile-time defines. `API_BASE_URL` defaults to the production `www` host:
  /// the apex redirects and a redirect can drop the Authorization header [API 1.1].
  const AppConfig.fromEnvironment()
      : apiBaseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'https://www.mockmob.in'),
        supabaseUrl = const String.fromEnvironment('SUPABASE_URL'),
        supabaseAnonKey = const String.fromEnvironment('SUPABASE_ANON_KEY'),
        googleWebClientId = const String.fromEnvironment('GOOGLE_WEB_CLIENT_ID'),
        freshChecksLive = const bool.fromEnvironment('FRESH_CHECKS_LIVE');

  final String apiBaseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String googleWebClientId;

  /// The content gate for fresh-question checks. False until the owner opens it.
  final bool freshChecksLive;

  /// Google sign-in is hidden when no web client id is configured.
  bool get googleSignInEnabled => googleWebClientId.isNotEmpty;

  /// Supabase cannot start without both values, so auth reports a clear failure instead.
  bool get supabaseConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  /// Path used for the light reachability ping while work is pending (cached at the edge).
  String get pingUrl => '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/api/stats';
}

final appConfigProvider = Provider<AppConfig>((ref) => const AppConfig.fromEnvironment());
