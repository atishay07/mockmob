import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import '../data/tools_store.dart';
import 'compass_pro_models.dart';

/// `GET /api/compass/pro` (60 a minute, no credits, no model): the practice projection. Read
/// only when the screen asks (`refresh`) and only for an account that has access: the server
/// answers `locked` for anyone else, and the screen then shows nothing.
class CompassProRepository extends JsonRemoteNotifier<CompassPro> {
  @override
  String get cacheKey => 'compass-pro';

  @override
  bool get autoLoad => false;

  @override
  CompassPro parse(Object? json) => CompassPro.fromJson(json);

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/compass/pro')).data;
}

final compassProRepositoryProvider = NotifierProvider<CompassProRepository, RemoteState<CompassPro>>(CompassProRepository.new);

/// Access comes from the account (the same Pro flag the quote model and Insights use).
final compassProAccessProvider = Provider<bool>((ref) => ref.watch(authSnapshotProvider.select((s) => s.isPro)));

/// The DU programmes and colleges the student is aiming for (up to [limit]), kept on this phone
/// per account, as the website keeps them in the browser.
class ShortlistController extends AsyncNotifier<List<ShortlistTarget>> {
  static const int limit = 8;

  String? get _userId => ref.read(authSnapshotProvider).userId;

  @override
  Future<List<ShortlistTarget>> build() async {
    final id = ref.watch(authSnapshotProvider.select((s) => s.userId));
    if (id == null) return const [];
    return (await ref.read(toolsStoreProvider).shortlist(id)).take(limit).toList();
  }

  Future<void> _set(List<ShortlistTarget> next) async {
    state = AsyncData(next);
    final id = _userId;
    if (id != null) unawaited(ref.read(toolsStoreProvider).saveShortlist(id, next));
  }

  Future<void> add(ShortlistTarget target) async {
    final now = state.value ?? const <ShortlistTarget>[];
    if (now.length >= limit || now.contains(target)) return;
    await _set([...now, target]);
  }

  Future<void> remove(ShortlistTarget target) async {
    final now = state.value ?? const <ShortlistTarget>[];
    await _set([...now.where((t) => t != target)]);
  }
}

final shortlistProvider = AsyncNotifierProvider<ShortlistController, List<ShortlistTarget>>(
  ShortlistController.new,
  retry: (count, error) => null,
);
