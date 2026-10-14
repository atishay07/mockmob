import 'dart:convert';

import 'package:drift/drift.dart';

import '../api/api_error.dart';
import '../storage/app_database.dart';
import '../storage/storage_providers.dart';
import 'remote_state.dart';

/// A [RemoteNotifier] for one JSON resource cached in `cache_entries`.
abstract class JsonRemoteNotifier<T> extends RemoteNotifier<T> {
  /// Stable cache key, unique per resource and parameters.
  String get cacheKey;

  /// Builds the model from the decoded JSON body.
  T parse(Object? json);

  /// Reads the decoded JSON body from the network.
  Future<Object?> fetchJson();

  AppDatabase get _db => ref.read(appDatabaseProvider);

  @override
  Future<CachedValue<T>?> readCache(String userId) async {
    final row = await (_db.select(_db.cacheEntries)..where((t) => t.userId.equals(userId) & t.cacheKey.equals(cacheKey))).getSingleOrNull();
    if (row == null) return null;
    try {
      return CachedValue(parse(jsonDecode(row.json)), DateTime.fromMillisecondsSinceEpoch(row.fetchedAtMs));
    } on Object {
      // An unreadable cache row is the same as no cache.
      return null;
    }
  }

  @override
  Future<Fetched<T>> fetchRemote() async {
    final json = await fetchJson();
    try {
      return Fetched(parse(json), json);
    } on Object {
      throw const ApiError(kind: ApiErrorKind.unknown, code: 'unusable_response');
    }
  }

  @override
  Future<void> writeCache(String userId, Fetched<T> fetched, DateTime at) async {
    await _db.into(_db.cacheEntries).insertOnConflictUpdate(
          CacheEntriesCompanion.insert(
            userId: userId,
            cacheKey: cacheKey,
            json: jsonEncode(fetched.payload),
            fetchedAtMs: at.millisecondsSinceEpoch,
          ),
        );
  }
}
