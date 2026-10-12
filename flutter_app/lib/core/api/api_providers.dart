import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';
import '../config/app_config.dart';
import '../connectivity/connectivity_providers.dart';
import 'api_client.dart';
import 'token_provider.dart';

/// Bridges the synchronous provider graph to the lazily created auth service.
class _LazyTokenProvider implements ApiTokenProvider {
  _LazyTokenProvider(this._ref);

  final Ref _ref;

  Future<ApiTokenProvider?> _service() => _ref.read(authServiceProvider.future);

  @override
  Future<String?> accessToken() async => (await _service())?.accessToken();

  @override
  Future<bool> refresh() async => await (await _service())?.refresh() ?? false;

  @override
  Future<void> onSessionLost() async => (await _service())?.onSessionLost();
}

/// The one API client for the foreground isolate.
final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(
    config: ref.watch(appConfigProvider),
    tokens: _LazyTokenProvider(ref),
    observer: ref.watch(connectivityMonitorProvider),
  ),
);

/// Current time, replaceable in tests.
final nowProvider = Provider<DateTime Function()>((ref) => DateTime.now);
