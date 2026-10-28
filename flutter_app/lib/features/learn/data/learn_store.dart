import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/app_database.dart';
import 'pending_event.dart';

/// A lesson kept on the phone, with what it was cached under.
class CachedLesson {
  const CachedLesson({required this.json, this.version, this.contentHash, required this.subject, required this.sizeBytes});

  final Json json;
  final String? version;
  final String? contentHash;
  final String subject;
  final int sizeBytes;
}

/// Everything Learn keeps on the phone, in the core `learn_cache` table: lessons (by
/// `id + version + contentHash`), the last state of each run, and the one pending event per run.
/// Rows are per user and are removed at sign-out by core.
class LearnStore {
  LearnStore(this._scope);

  final LocalScope _scope;

  AppDatabase get _db => _scope.db;

  static String _unitKey(String subject, String id) => 'unit:$subject:$id';
  static String _runKey(String runId) => 'run:$runId';
  static String _pendingKey(String runId) => 'pending:$runId';

  Future<LearnCacheRow?> _row(String key) => (_db.select(_db.learnCache)
        ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.equals(key)))
      .getSingleOrNull();

  Future<void> _put(String key, Object json, {String version = '', String hash = ''}) async {
    final text = jsonEncode(json);
    await _db.into(_db.learnCache).insertOnConflictUpdate(
          LearnCacheCompanion.insert(
            userId: _scope.userId,
            cacheKey: key,
            version: Value(version),
            contentHash: Value(hash),
            json: text,
            sizeBytes: Value(utf8.encode(text).length),
            updatedAtMs: _scope.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<void> _delete(String key) =>
      (_db.delete(_db.learnCache)..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.equals(key))).go();

  Json? _decode(LearnCacheRow? row) {
    if (row == null) return null;
    try {
      return asJson(jsonDecode(row.json));
    } on Object {
      return null;
    }
  }

  // Lessons.

  Future<CachedLesson?> lesson(String id) async {
    final rows = await (_db.select(_db.learnCache)
          ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.like('unit:%:$id')))
        .get();
    if (rows.isEmpty) return null;
    final row = rows.first;
    final json = _decode(row);
    if (json == null) return null;
    return CachedLesson(
      json: json,
      version: row.version.isEmpty ? null : row.version,
      contentHash: row.contentHash.isEmpty ? null : row.contentHash,
      subject: row.cacheKey.split(':')[1],
      sizeBytes: row.sizeBytes,
    );
  }

  Future<void> putLesson(Json lesson) {
    final subject = asStringOr(lesson['subject'], 'other');
    final id = asStringOr(lesson['id'], '');
    return _put(
      _unitKey(subject, id),
      lesson,
      version: asStringOr(lesson['version'], ''),
      hash: asStringOr(lesson['contentHash'], ''),
    );
  }

  Future<void> dropLesson(String id) => (_db.delete(_db.learnCache)
        ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.like('unit:%:$id')))
      .go();

  Future<void> dropSubject(String subject) => (_db.delete(_db.learnCache)
        ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.like('unit:$subject:%')))
      .go();

  /// Bytes kept per subject.
  Future<Map<String, int>> sizeBySubject() async {
    final rows = await (_db.select(_db.learnCache)
          ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.like('unit:%')))
        .get();
    final sizes = <String, int>{};
    for (final row in rows) {
      final subject = row.cacheKey.split(':')[1];
      sizes[subject] = (sizes[subject] ?? 0) + row.sizeBytes;
    }
    return sizes;
  }

  /// Drops every kept lesson whose version no longer matches the catalog's (the lesson changed).
  Future<void> dropChanged(Map<String, String?> currentVersions) async {
    final rows = await (_db.select(_db.learnCache)
          ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.like('unit:%')))
        .get();
    for (final row in rows) {
      final id = row.cacheKey.split(':').last;
      final current = currentVersions[id];
      if (currentVersions.containsKey(id) && current != null && current != row.version) await _delete(row.cacheKey);
    }
  }

  // Runs.

  Future<Json?> run(String runId) async => _decode(await _row(_runKey(runId)));

  Future<void> putRun(String runId, Json json) => _put(_runKey(runId), json);

  Future<void> dropRun(String runId) => _delete(_runKey(runId));

  // The one pending event of a run.

  Future<PendingEvent?> pending(String runId) async {
    final json = _decode(await _row(_pendingKey(runId)));
    if (json == null) return null;
    final event = PendingEvent.fromJson(json);
    return event.requestKey.isEmpty ? null : event;
  }

  Future<void> putPending(String runId, PendingEvent event) => _put(_pendingKey(runId), event.toJson());

  Future<void> clearPending(String runId) => _delete(_pendingKey(runId));

  /// Ids of runs that have an event on this phone that the server has not acknowledged.
  Future<List<String>> pendingRunIds() async {
    final rows = await (_db.select(_db.learnCache)
          ..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.like('pending:%')))
        .get();
    return [for (final r in rows) r.cacheKey.substring('pending:'.length)];
  }
}

final learnStoreProvider = Provider<LearnStore>((ref) => LearnStore(ref.watch(localScopeProvider)));
