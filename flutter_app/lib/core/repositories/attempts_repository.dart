import 'dart:convert';
import 'dart:isolate';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../models/attempt.dart';
import '../models/json_helpers.dart';
import '../storage/app_database.dart';
import '../storage/storage_providers.dart';
import 'json_remote_notifier.dart';
import 'remote_state.dart';

/// Payloads above this are decoded and parsed in an isolate (spec section 11).
const _isolateThresholdChars = 50000;

class _ParsedAttempts {
  const _ParsedAttempts(this.attempts, this.jsons);

  final List<Attempt> attempts;

  /// One JSON string per attempt, same order, for the cache rows.
  final List<String> jsons;
}

_ParsedAttempts _parseAttempts(String body) {
  final decoded = jsonDecode(body);
  final attempts = <Attempt>[];
  final jsons = <String>[];
  if (decoded is List) {
    for (final item in decoded) {
      if (item is! Map) continue;
      final map = Json.from(item);
      attempts.add(Attempt.fromJson(map));
      jsons.add(jsonEncode(map));
    }
  }
  return _ParsedAttempts(attempts, jsons);
}

List<Attempt> _parseCachedRows(List<String> rows) => [for (final r in rows) Attempt.fromJson(asJson(jsonDecode(r)))];

/// All of the student's attempts, newest first. `GET /api/attempts` is an unpaginated dump,
/// so it is read once after sign-in and after a submit, parsed off the main isolate, and then
/// served from drift (`cached_attempts`) until [refresh] is called again.
class AttemptsRepository extends RemoteNotifier<List<Attempt>> {
  /// Unlike the other reads, the list loads from the cache first and goes to the network only
  /// when the cache is empty or `refresh(force: true)` is called.
  @override
  bool get cacheFirst => true;

  @override
  Future<CachedValue<List<Attempt>>?> readCache(String userId) async {
    final db = ref.read(appDatabaseProvider);
    final rows = await (db.select(db.cachedAttempts)
          ..where((t) => t.userId.equals(userId))
          ..orderBy([(t) => OrderingTerm.desc(t.completedAtMs), (t) => OrderingTerm.desc(t.attemptId)]))
        .get();
    if (rows.isEmpty) return null;
    final jsons = [for (final r in rows) r.json];
    final attempts = jsons.fold<int>(0, (n, j) => n + j.length) > _isolateThresholdChars
        ? await Isolate.run(() => _parseCachedRows(jsons))
        : _parseCachedRows(jsons);
    final fetchedAt = rows.map((r) => r.fetchedAtMs).reduce((a, b) => a > b ? a : b);
    return CachedValue(attempts, DateTime.fromMillisecondsSinceEpoch(fetchedAt));
  }

  @override
  Future<Fetched<List<Attempt>>> fetchRemote() async {
    final ApiClient api = ref.read(apiClientProvider);
    final response = await api.get('/api/attempts', options: const ApiOptions(plainBody: true, receiveTimeout: Duration(seconds: 60)));
    final body = response.text;
    try {
      final parsed = body.length > _isolateThresholdChars ? await Isolate.run(() => _parseAttempts(body)) : _parseAttempts(body);
      return Fetched(parsed.attempts, parsed.jsons);
    } on Object {
      throw const ApiError(kind: ApiErrorKind.unknown, code: 'unusable_response');
    }
  }

  @override
  Future<void> writeCache(String userId, Fetched<List<Attempt>> fetched, DateTime at) async {
    final db = ref.read(appDatabaseProvider);
    final jsons = fetched.payload! as List<String>;
    final attempts = fetched.value;
    await db.transaction(() async {
      await (db.delete(db.cachedAttempts)..where((t) => t.userId.equals(userId))).go();
      await db.batch((b) {
        b.insertAll(db.cachedAttempts, [
          for (var i = 0; i < attempts.length; i++)
            CachedAttemptsCompanion.insert(
              userId: userId,
              attemptId: attempts[i].id,
              subject: attempts[i].subject,
              completedAtMs: attempts[i].completedAt.millisecondsSinceEpoch,
              json: jsons[i],
              fetchedAtMs: at.millisecondsSinceEpoch,
            ),
        ], mode: InsertMode.insertOrReplace);
      });
    });
  }

  /// Adds a just-submitted attempt (the 200 body of `POST /api/attempts`) so Review and Today
  /// see it before the next list read.
  Future<void> upsertSubmitted(Map<String, dynamic> body) async {
    final id = userId;
    if (id == null) return;
    final attempt = Attempt.fromJson(body);
    final at = ref.read(nowProvider)();
    final db = ref.read(appDatabaseProvider);
    await db.into(db.cachedAttempts).insertOnConflictUpdate(
          CachedAttemptsCompanion.insert(
            userId: id,
            attemptId: attempt.id,
            subject: attempt.subject,
            completedAtMs: attempt.completedAt.millisecondsSinceEpoch,
            json: jsonEncode(body),
            fetchedAtMs: at.millisecondsSinceEpoch,
          ),
        );
    if (!ref.mounted) return;
    final current = [...?state.value]..removeWhere((a) => a.id == attempt.id);
    current.insert(0, attempt);
    current.sort((a, b) => b.completedAt.compareTo(a.completedAt));
    state = RemoteState(value: current, fetchedAt: state.fetchedAt ?? at, fromCache: state.fromCache);
  }
}

final attemptsRepositoryProvider = NotifierProvider<AttemptsRepository, RemoteState<List<Attempt>>>(AttemptsRepository.new);

/// `GET /api/attempts/{id}` with `answerReviews`, cached per attempt for offline reading.
/// 404 means the attempt does not exist for this account (or the submission window closed).
class AttemptDetailRepository extends JsonRemoteNotifier<AttemptDetail> {
  AttemptDetailRepository(this.attemptId);

  final String attemptId;

  @override
  String get cacheKey => 'attempt:$attemptId';

  @override
  AttemptDetail parse(Object? json) => AttemptDetail.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/attempts/$attemptId')).data;
}

final attemptDetailProvider =
    NotifierProvider.family<AttemptDetailRepository, RemoteState<AttemptDetail>, String>(AttemptDetailRepository.new);
