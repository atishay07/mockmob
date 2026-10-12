import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../models/json_helpers.dart';
import '../models/learning_plan.dart';
import '../storage/app_database.dart';
import '../storage/storage_providers.dart';
import 'remote_state.dart';

/// `GET /api/learning/plan?minutes=` cached per minutes in `cached_plan`. The plan is
/// expensive on the server: it loads once on open and again after a session, never on a timer.
/// Only 10, 20 and 30 are honoured by the server.
class PlanRepository extends RemoteNotifier<LearningPlan> {
  PlanRepository(this.minutes);

  final int minutes;

  @override
  Future<CachedValue<LearningPlan>?> readCache(String userId) async {
    final db = ref.read(appDatabaseProvider);
    final row = await (db.select(db.cachedPlan)..where((t) => t.userId.equals(userId) & t.minutes.equals(minutes))).getSingleOrNull();
    if (row == null) return null;
    try {
      return CachedValue(LearningPlan.fromJson(asJson(jsonDecode(row.json))), DateTime.fromMillisecondsSinceEpoch(row.fetchedAtMs));
    } on Object {
      return null;
    }
  }

  @override
  Future<Fetched<LearningPlan>> fetchRemote() async {
    final response = await ref.read(apiClientProvider).get('/api/learning/plan', query: {'minutes': minutes});
    try {
      return Fetched(LearningPlan.fromJson(response.map), response.data);
    } on Object {
      throw const ApiError(kind: ApiErrorKind.unknown, code: 'unusable_response');
    }
  }

  @override
  Future<void> writeCache(String userId, Fetched<LearningPlan> fetched, DateTime at) async {
    final db = ref.read(appDatabaseProvider);
    await db.into(db.cachedPlan).insertOnConflictUpdate(
          CachedPlanCompanion.insert(userId: userId, minutes: minutes, json: jsonEncode(fetched.payload), fetchedAtMs: at.millisecondsSinceEpoch),
        );
  }
}

/// Family key is the minutes (10, 20 or 30).
final planRepositoryProvider = NotifierProvider.family<PlanRepository, RemoteState<LearningPlan>, int>(PlanRepository.new);
