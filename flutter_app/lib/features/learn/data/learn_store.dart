import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/app_database.dart';
import 'pending_event.dart';

/// A lesson kept on the phone, with what it was cached under.
class CachedLesson {
  const CachedLesson({
    required this.json,
    this.version,
    this.contentHash,
    required this.subject,
    required this.sizeBytes,
  });

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

  Future<LearnCacheRow?> _row(String key) =>
      (_db.select(_db.learnCache)..where(
            (t) => t.userId.equals(_scope.userId) & t.cacheKey.equals(key),
          ))
          .getSingleOrNull();

  Future<void> _put(
    String key,
    Object json, {
    String version = '',
    String hash = '',
  }) async {
    final text = jsonEncode(json);
    await _db
        .into(_db.learnCache)
        .insertOnConflictUpdate(
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
      (_db.delete(_db.learnCache)..where(
            (t) => t.userId.equals(_scope.userId) & t.cacheKey.equals(key),
          ))
          .go();

  Json? _decode(LearnCacheRow? row) {
    if (row == null) return null;
    try {
      return asJson(jsonDecode(row.json));
    } on Object {
      return null;
    }
  }

  // Lessons.

  /// The kept lesson rows. Keys are matched in Dart, never with a LIKE built from an id, so
  /// `_` and `%` in an id or subject are plain characters.
  Future<List<LearnCacheRow>> _lessonRows() =>
      (_db.select(_db.learnCache)..where(
            (t) => t.userId.equals(_scope.userId) & t.cacheKey.like('unit:%'),
          ))
          .get();

  /// The subject and id inside a lesson key (`unit:<subject>:<id>`), or null for another key.
  static (String, String)? _parts(String key) {
    if (!key.startsWith('unit:')) return null;
    final rest = key.substring('unit:'.length);
    final colon = rest.indexOf(':');
    if (colon < 0) return null;
    return (rest.substring(0, colon), rest.substring(colon + 1));
  }

  /// The kept copy of lesson [id]. Pass [subject] when it is known to read the exact key.
  Future<CachedLesson?> lesson(String id, {String? subject}) async {
    final LearnCacheRow? row;
    if (subject != null) {
      row = await _row(_unitKey(subject, id));
    } else {
      row = (await _lessonRows())
          .where((r) => _parts(r.cacheKey)?.$2 == id)
          .firstOrNull;
    }
    if (row == null) return null;
    final json = _decode(row);
    if (json == null) return null;
    return CachedLesson(
      json: json,
      version: row.version.isEmpty ? null : row.version,
      contentHash: row.contentHash.isEmpty ? null : row.contentHash,
      subject: _parts(row.cacheKey)?.$1 ?? '',
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

  Future<void> _deleteKeys(Iterable<String> keys) async {
    final list = keys.toList();
    if (list.isEmpty) return;
    await (_db.delete(
          _db.learnCache,
        )..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.isIn(list)))
        .go();
  }

  /// Drops the kept copy of lesson [id] (exact id, under any subject).
  Future<void> dropLesson(String id) async => _deleteKeys([
    for (final r in await _lessonRows())
      if (_parts(r.cacheKey)?.$2 == id) r.cacheKey,
  ]);

  /// Drops every lesson kept for [subject] (exact subject).
  Future<void> dropSubject(String subject) async => _deleteKeys([
    for (final r in await _lessonRows())
      if (_parts(r.cacheKey)?.$1 == subject) r.cacheKey,
  ]);

  /// Bytes kept per subject.
  Future<Map<String, int>> sizeBySubject() async {
    final sizes = <String, int>{};
    for (final row in await _lessonRows()) {
      final subject = _parts(row.cacheKey)?.$1;
      if (subject == null) continue;
      sizes[subject] = (sizes[subject] ?? 0) + row.sizeBytes;
    }
    return sizes;
  }

  /// Drops every kept lesson whose version no longer matches the catalog's (the lesson changed).
  Future<void> dropChanged(Map<String, String?> currentVersions) async {
    for (final row in await _lessonRows()) {
      final id = _parts(row.cacheKey)?.$2;
      if (id == null) continue;
      final current = currentVersions[id];
      if (currentVersions.containsKey(id) &&
          current != null &&
          current != row.version) {
        await _delete(row.cacheKey);
      }
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

  Future<void> putPending(String runId, PendingEvent event) =>
      _put(_pendingKey(runId), event.toJson());

  Future<void> clearPending(String runId) => _delete(_pendingKey(runId));

  /// Ids of runs that have an event on this phone that the server has not acknowledged.
  Future<List<String>> pendingRunIds() async {
    final rows =
        await (_db.select(_db.learnCache)..where(
              (t) =>
                  t.userId.equals(_scope.userId) & t.cacheKey.like('pending:%'),
            ))
            .get();
    return [for (final r in rows) r.cacheKey.substring('pending:'.length)];
  }
}

final learnStoreProvider = Provider<LearnStore>(
  (ref) => LearnStore(ref.watch(localScopeProvider)),
);
