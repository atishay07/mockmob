import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';
import '../auth/auth_service.dart';
import '../auth/auth_state.dart';
import '../config/app_config.dart';
import '../connectivity/connectivity_providers.dart';
import 'api_client.dart';
import 'token_provider.dart';

/// Bridges the synchronous provider graph to the lazily created auth service, and names the
/// account each token belongs to.
class _LazyTokenProvider implements ApiTokenProvider {
  _LazyTokenProvider(this._ref);

  final Ref _ref;

  Future<AuthService?> _service() => _ref.read(authServiceProvider.future);

  @override
  Future<String?> accessToken() async => (await _service())?.accessToken();

  /// The token and the account it belongs to. The token names its own Supabase user (its `sub`
  /// claim); a token that cannot be read is matched against the session it came from. The
  /// account is the one the auth controller loaded for that Supabase user. A token of any other
  /// user (one that signed in since, whose profile has not loaded) names no account.
  @override
  Future<ApiToken?> accountToken() async {
    final service = await _service();
    if (service == null) return null;
    final token = await service.accessToken();
    if (token == null) return null;
    final session = service.session;
    final sessionUser = jwtSubject(token) ?? (session != null && session.accessToken == token ? session.user.id : null);
    return ApiToken(token, userId: _ref.read(authSnapshotProvider.notifier).accountFor(sessionUser));
  }

  @override
  Future<bool> refresh() async => await (await _service())?.refresh() ?? false;

  @override
  Future<void> onSessionLost() async => (await _service())?.onSessionLost();
}

/// The token source of the foreground API client.
final apiTokenProvider = Provider<ApiTokenProvider>(_LazyTokenProvider.new);

/// The one API client for the foreground isolate.
final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(
    config: ref.watch(appConfigProvider),
    tokens: ref.watch(apiTokenProvider),
    observer: ref.watch(connectivityMonitorProvider),
  ),
);

/// Current time, replaceable in tests.
final nowProvider = Provider<DateTime Function()>((ref) => DateTime.now);
