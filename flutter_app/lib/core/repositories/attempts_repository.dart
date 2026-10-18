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

/// Parses the body of `GET /api/attempts`. The route sends a bare array: anything else (an error
/// object that arrived with a 200, a page from something in front of the server) is not a list of
/// attempts, and reading it as an empty list would tell a student with a record that they have
/// none. One row that cannot be read is left out, not allowed to take the other rows with it; a
/// body where no row can be read is unreadable.
_ParsedAttempts _parseAttempts(String body) {
  final decoded = jsonDecode(body);
  if (decoded is! List) throw const FormatException('attempts body is not a list');
  final attempts = <Attempt>[];
  final jsons = <String>[];
  var rows = 0;
  for (final item in decoded) {
    if (item is! Map) continue;
    rows++;
    try {
      final map = Json.from(item);
      attempts.add(Attempt.fromJson(map));
      jsons.add(jsonEncode(map));
    } on Object {
      continue;
    }
  }
  if (rows > 0 && attempts.isEmpty) throw const FormatException('no attempt could be read');
  return _ParsedAttempts(attempts, jsons);
}

/// Cached rows that still read. A row an older version wrote that no longer parses is left out
/// instead of hiding the rest of the list.
List<Attempt> _parseCachedRows(List<String> rows) {
  final out = <Attempt>[];
  for (final r in rows) {
    try {
      out.add(Attempt.fromJson(asJson(jsonDecode(r))));
    } on Object {
      continue;
    }
  }
  return out;
}

/// Large bodies are read in an isolate. When the isolate cannot run (no memory to start one, a
/// message it cannot send back) the body is read here instead: a phone that cannot spawn an
/// isolate must not report a good answer as unreadable.
Future<T> _offMain<T>(int chars, T Function() inline, Future<T> Function() isolate) async {
  if (chars <= _isolateThresholdChars) return inline();
  try {
    return await isolate();
  } on Object {
    return inline();
  }
}

/// The `cache_entries` row whose `fetchedAtMs` is when the whole list was last read from the
/// server. The rows of `cached_attempts` carry their own times: one added by a submit is newer
/// than the list it joined, so the list's age is kept apart.
const attemptsListFetchKey = 'attempts-list';

/// The list call: `GET /api/attempts?view=summary`.
const String attemptsListPath = '/api/attempts';
const Map<String, String> attemptsListQuery = {'view': 'summary'};

/// All of the student's attempts, newest first. `GET /api/attempts` is an unpaginated dump,
/// so it is read once after sign-in and after a submit, parsed off the main isolate, and then
/// served from drift (`cached_attempts`) until [refresh] is called again.
///
/// The list's [RemoteState.fetchedAt] is the last full server read. A submit adds its attempt
/// without changing it, so days-old rows never look fresh because one new paper joined them.
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
    final chars = jsons.fold<int>(0, (n, j) => n + j.length);
    final attempts = await _offMain(chars, () => _parseCachedRows(jsons), () => Isolate.run(() => _parseCachedRows(jsons)));
    if (attempts.isEmpty) return null;
    return CachedValue(attempts, DateTime.fromMillisecondsSinceEpoch(await _listFetchedAtMs(db, userId, rows)));
  }

  /// When the cached list was last read whole from the server. Without that record (a list
  /// cached by an older version, or only submitted papers so far) the oldest row's time stands
  /// in: it never makes the list look newer than any part of it.
  Future<int> _listFetchedAtMs(AppDatabase db, String userId, List<CachedAttemptRow> rows) async {
    final entry = await (db.select(db.cacheEntries)
          ..where((t) => t.userId.equals(userId) & t.cacheKey.equals(attemptsListFetchKey)))
        .getSingleOrNull();
    return entry?.fetchedAtMs ?? rows.map((r) => r.fetchedAtMs).reduce((a, b) => a < b ? a : b);
  }

  @override
  Future<Fetched<List<Attempt>>> fetchRemote() async {
    final ApiClient api = ref.read(apiClientProvider);
    // The list asks for the summary view: the same array and the same fields the app reads, without
    // the heavy per-question content (the full list was about 29 MB for 25 papers and timed out, so
    // Today could not load for minutes: final walk H15). A server that does not know the parameter
    // ignores it. Only the list asks: one paper's own read (`/api/attempts/{id}`) stays whole.
    final response = await api.get(
      attemptsListPath,
      query: attemptsListQuery,
      options: const ApiOptions(plainBody: true, receiveTimeout: Duration(seconds: 60)),
    );
    final body = response.text;
    try {
      final parsed = await _offMain(body.length, () => _parseAttempts(body), () => Isolate.run(() => _parseAttempts(body)));
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
      await db.into(db.cacheEntries).insertOnConflictUpdate(
            CacheEntriesCompanion.insert(userId: userId, cacheKey: attemptsListFetchKey, json: '{}', fetchedAtMs: at.millisecondsSinceEpoch),
          );
    });
  }

  /// Adds a just-submitted attempt (the 200 body of `POST /api/attempts`) so Review and Today
  /// see it before the next list read. The list keeps its own fetch time: the rest of it is no
  /// fresher than when it was last read.
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
    if (!ref.mounted || userId != id) return;
    if (state.value == null) {
      // The list has not loaded here yet: show what the phone holds, the new paper included,
      // with the list's own time, rather than a list of one that reads as complete and fresh.
      final cached = await readCache(id);
      if (!ref.mounted || userId != id || state.value != null || cached == null) return;
      state = RemoteState(value: cached.value, fetchedAt: cached.fetchedAt, fromCache: true, loading: state.loading, error: state.error);
      return;
    }
    final current = [...?state.value]..removeWhere((a) => a.id == attempt.id);
    current.insert(0, attempt);
    current.sort((a, b) => b.completedAt.compareTo(a.completedAt));
    state = RemoteState(value: current, fetchedAt: state.fetchedAt, fromCache: state.fromCache, loading: state.loading, error: state.error);
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
