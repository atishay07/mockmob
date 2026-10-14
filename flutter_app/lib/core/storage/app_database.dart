import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import '../domain/session_rules.dart' show submissionGraceMs;
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

  /// Removes the rows that belong to a user. Used on sign-out and account switch.
  /// Server read caches can be kept when the same account signs in again. [keepOutbox] leaves
  /// the queued writes: they are scoped by user id, so they stay apart from any other account
  /// and send when the same account signs in again (a sign-out keeps them; an account switch and
  /// an account deletion do not).
  ///
  /// A paper the server can still accept (its deadline plus the 120 s grace has not passed) stays,
  /// with its answer journal: both are keyed by user id, so another account never sees them, and
  /// the owner finds the paper again when she signs back in within the window. Deleting them on
  /// an account switch or a sign-out lost 12 to 30 answers the sign-out warning had just counted
  /// (offline-01, offline-02). Papers whose window has closed go with the rest, and
  /// [purgeUserPapers] removes the others too (account deletion).
  Future<void> clearUserData(String userId, {bool keepCaches = false, bool keepOutbox = false}) async {
    final closedBefore = DateTime.now().millisecondsSinceEpoch - submissionGraceMs;
    await transaction(() async {
      final owed = await (select(sessionDrafts)..where((t) => t.userId.equals(userId) & t.endsAtMs.isBiggerThanValue(closedBefore))).get();
      final owedIds = owed.map((r) => r.sessionId).toList();
      await (delete(answerJournal)..where((t) => t.userId.equals(userId) & t.sessionId.isNotIn(owedIds))).go();
      if (!keepOutbox) await (delete(outbox)..where((t) => t.userId.equals(userId))).go();
      await (delete(sessionDrafts)..where((t) => t.userId.equals(userId) & t.endsAtMs.isSmallerOrEqualValue(closedBefore))).go();
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

  /// Removes every paper and answer journal of a user, owed or not: account deletion only.
  Future<void> purgeUserPapers(String userId) async {
    await transaction(() async {
      await (delete(answerJournal)..where((t) => t.userId.equals(userId))).go();
      await (delete(sessionDrafts)..where((t) => t.userId.equals(userId))).go();
    });
  }
}
