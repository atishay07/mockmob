import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/json_helpers.dart';
import '../models/rhythm.dart';
import 'json_remote_notifier.dart';
import 'remote_state.dart';

/// `GET/PUT /api/me/goal`. The goal unit is study days per week (1 to 7, default 4).
class GoalRepository extends JsonRemoteNotifier<Goal> {
  @override
  String get cacheKey => 'goal';

  @override
  Goal parse(Object? json) => Goal.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/me/goal')).data;

  /// Saves the weekly goal. [pausedUntil] is `YYYY-MM-DD` (at most 100 days ahead). The state
  /// changes only after the server acknowledges. Throws `ApiError` (422 for a rejected value).
  Future<Goal> save({required int daysPerWeek, String? pausedUntil}) async {
    final response = await ref.read(apiClientProvider).put(
          '/api/me/goal',
          body: {'daysPerWeek': daysPerWeek, 'pausedUntil': pausedUntil},
        );
    final goal = Goal.fromJson(response.map);
    await setAcknowledged(Fetched(goal, response.data));
    return goal;
  }

  /// Pausing never removes history. Pass null to resume.
  Future<Goal> setPause(String? pausedUntil) {
    final current = state.value?.daysPerWeek ?? 4;
    return save(daysPerWeek: current, pausedUntil: pausedUntil);
  }
}

final goalRepositoryProvider = NotifierProvider<GoalRepository, RemoteState<Goal>>(GoalRepository.new);
