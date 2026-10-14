import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/json_helpers.dart';
import '../models/rhythm.dart';
import 'json_remote_notifier.dart';
import 'remote_state.dart';

/// `GET /api/me/rhythm`: the week strip, weeks in rhythm and milestones. Cached with its
/// fetch time so Today can say "As of 9:15 PM" when it is stale.
class RhythmRepository extends JsonRemoteNotifier<Rhythm> {
  @override
  String get cacheKey => 'rhythm';

  @override
  Rhythm parse(Object? json) => Rhythm.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/me/rhythm')).data;
}

final rhythmRepositoryProvider = NotifierProvider<RhythmRepository, RemoteState<Rhythm>>(RhythmRepository.new);
