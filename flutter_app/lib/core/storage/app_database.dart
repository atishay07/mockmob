import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'tables.dart';

part 'app_database.g.dart';

/// The core SQLite database (spec section 10). Only core owns drift tables.
@DriftDatabase(
  tables: [
    AnswerJournal,
    Outbox,
    SessionDrafts,
    CachedPlan,
    CachedAttempts,
    CacheEntries,
    LearnCache,
    ReviewLog,
    AnalyticsQueue,
    PendingResults,
    RepairLocal,
    RhythmSeen,
    Dismissals,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.executor);

  /// Opens the on-disk database. `shareAcrossIsolates` lets the WorkManager isolate and the
  /// main isolate use one connection server instead of two writers.
  factory AppDatabase.open() => AppDatabase(
        driftDatabase(
          name: 'mockmob',
          native: const DriftNativeOptions(shareAcrossIsolates: true),
        ),
      );

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        beforeOpen: (details) async {
          // WAL keeps journal writes under the 5 ms budget and lets readers continue.
          await customStatement('PRAGMA journal_mode=WAL');
          await customStatement('PRAGMA synchronous=NORMAL');
        },
      );

  /// Removes every row that belongs to a user. Used on sign-out and account switch.
  /// Server read caches can be kept when the same account signs in again.
  Future<void> clearUserData(String userId, {bool keepCaches = false}) async {
    await transaction(() async {
      await (delete(answerJournal)..where((t) => t.userId.equals(userId))).go();
      await (delete(outbox)..where((t) => t.userId.equals(userId))).go();
      await (delete(sessionDrafts)..where((t) => t.userId.equals(userId))).go();
      await (delete(analyticsQueue)..where((t) => t.userId.equals(userId))).go();
      await (delete(pendingResults)..where((t) => t.userId.equals(userId))).go();
      await (delete(repairLocal)..where((t) => t.userId.equals(userId))).go();
      await (delete(rhythmSeen)..where((t) => t.userId.equals(userId))).go();
      await (delete(dismissals)..where((t) => t.userId.equals(userId))).go();
      await (delete(reviewLog)..where((t) => t.userId.equals(userId))).go();
      if (!keepCaches) {
        await (delete(cachedPlan)..where((t) => t.userId.equals(userId))).go();
        await (delete(cachedAttempts)..where((t) => t.userId.equals(userId))).go();
        await (delete(cacheEntries)..where((t) => t.userId.equals(userId))).go();
        await (delete(learnCache)..where((t) => t.userId.equals(userId))).go();
      }
    });
  }
}
