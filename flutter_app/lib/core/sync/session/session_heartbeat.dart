import 'package:drift/drift.dart';

import '../../storage/app_database.dart';

/// A small "the app is on screen with this session open" stamp in `cache_entries`, shared with
/// the WorkManager isolate through the database.
///
/// The backup submit job must not fire while the student is still answering: it would send the
/// journal as it stands, delete the draft and drop every later answer. The foreground engine
/// beats every few seconds; the job defers while the stamp is fresh.
class SessionHeartbeat {
  SessionHeartbeat(this._db, {required this.userId, DateTime Function()? now}) : _now = now ?? DateTime.now;

  /// A stamp younger than this means a live engine owns the session.
  static const freshFor = Duration(seconds: 20);

  /// How often the engine should beat. Well inside [freshFor].
  static const interval = Duration(seconds: 5);

  final AppDatabase _db;
  final String userId;
  final DateTime Function() _now;

  static String _key(String sessionId) => 'session-heartbeat:$sessionId';

  Future<void> beat(String sessionId) async {
    try {
      await _db.into(_db.cacheEntries).insertOnConflictUpdate(
            CacheEntriesCompanion.insert(userId: userId, cacheKey: _key(sessionId), json: '{}', fetchedAtMs: _now().millisecondsSinceEpoch),
          );
    } on Object {
      // A missed beat only means the backup job may run a little early; never break answering.
    }
  }

  Future<void> clear(String sessionId) async {
    try {
      await (_db.delete(_db.cacheEntries)..where((t) => t.userId.equals(userId) & t.cacheKey.equals(_key(sessionId)))).go();
    } on Object {
      // The database may already be closed when a screen goes away.
    }
  }

  /// True when a foreground engine owns a session other than [sessionId]. The status
  /// notification is shared by every session, so it then belongs to that one.
  Future<bool> anotherIsLive(String sessionId) async {
    final since = _now().millisecondsSinceEpoch - freshFor.inMilliseconds;
    final rows = await (_db.select(_db.cacheEntries)
          ..where((t) => t.userId.equals(userId) & t.cacheKey.like('session-heartbeat:%') & t.cacheKey.equals(_key(sessionId)).not() & t.fetchedAtMs.isBiggerThanValue(since)))
        .get();
    return rows.isNotEmpty;
  }

  /// True when a foreground engine beat within [freshFor].
  Future<bool> isLive(String sessionId) async {
    final row = await (_db.select(_db.cacheEntries)..where((t) => t.userId.equals(userId) & t.cacheKey.equals(_key(sessionId)))).getSingleOrNull();
    if (row == null) return false;
    return _now().millisecondsSinceEpoch - row.fetchedAtMs < freshFor.inMilliseconds;
  }
}
