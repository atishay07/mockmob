import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import 'insights_models.dart';

/// `GET /api/prepos/insights` (60 a minute, no credits): the record, cached for offline reading.
class InsightsRepository extends JsonRemoteNotifier<PrepInsights> {
  @override
  String get cacheKey => 'prepos-insights';

  @override
  PrepInsights parse(Object? json) => PrepInsights.fromJson(json);

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/prepos/insights')).data;
}

final insightsRepositoryProvider = NotifierProvider<InsightsRepository, RemoteState<PrepInsights>>(InsightsRepository.new);

/// Pro accounts see the depth the website gates (all chapters, changed answers, pace).
final insightsProProvider = Provider<bool>((ref) => ref.watch(authSnapshotProvider.select((s) => s.isPro)));
