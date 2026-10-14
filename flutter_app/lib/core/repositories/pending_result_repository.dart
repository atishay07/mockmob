import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/app_database.dart';
import 'local_scope.dart';

/// A result that was received but not opened yet.
class PendingResult {
  const PendingResult({required this.attemptId, required this.receivedAt, this.openedAt});

  final String attemptId;
  final DateTime receivedAt;
  final DateTime? openedAt;

  bool get isOpened => openedAt != null;
}

/// Local `pending_result` records: {attemptId, receivedAt, openedAt}. Today's result slot and
/// the dot on the Review tab are driven from here, so they survive process death.
class PendingResultRepository {
  PendingResultRepository(this._scope);

  final LocalScope _scope;

  AppDatabase get _db => _scope.db;

  PendingResult _from(PendingResultRow r) => PendingResult(
        attemptId: r.attemptId,
        receivedAt: DateTime.fromMillisecondsSinceEpoch(r.receivedAtMs),
        openedAt: r.openedAtMs == null ? null : DateTime.fromMillisecondsSinceEpoch(r.openedAtMs!),
      );

  /// Records a result as received (the attempt was acknowledged). Idempotent: a repeat keeps
  /// the first receive time and does not reopen an opened result.
  Future<void> recordReceived(String attemptId) => _db.into(_db.pendingResults).insert(
        PendingResultsCompanion.insert(userId: _scope.userId, attemptId: attemptId, receivedAtMs: _scope.now().millisecondsSinceEpoch),
        mode: InsertMode.insertOrIgnore,
      );

  /// Marks the sealed sheet opened. Clears the slot and the tab dot.
  Future<void> markOpened(String attemptId) async {
    final id = _scope.userId;
    await (_db.update(_db.pendingResults)..where((t) => t.userId.equals(id) & t.attemptId.equals(attemptId) & t.openedAtMs.isNull()))
        .write(PendingResultsCompanion(openedAtMs: Value(_scope.now().millisecondsSinceEpoch)));
  }

  Future<PendingResult?> find(String attemptId) async {
    final row = await (_db.select(_db.pendingResults)..where((t) => t.userId.equals(_scope.userId) & t.attemptId.equals(attemptId))).getSingleOrNull();
    return row == null ? null : _from(row);
  }

  Future<List<PendingResult>> unopened() async {
    final rows = await (_db.select(_db.pendingResults)
          ..where((t) => t.userId.equals(_scope.userId) & t.openedAtMs.isNull())
          ..orderBy([(t) => OrderingTerm.desc(t.receivedAtMs)]))
        .get();
    return rows.map(_from).toList();
  }

  Stream<List<PendingResult>> watchUnopened() {
    final id = _scope.userIdOrNull;
    if (id == null) return Stream.value(const []);
    final query = _db.select(_db.pendingResults)
      ..where((t) => t.userId.equals(id) & t.openedAtMs.isNull())
      ..orderBy([(t) => OrderingTerm.desc(t.receivedAtMs)]);
    return query.watch().map((rows) => rows.map(_from).toList());
  }
}

final pendingResultRepositoryProvider = Provider<PendingResultRepository>((ref) => PendingResultRepository(ref.watch(localScopeProvider)));

/// Results received but not opened, newest first.
final unopenedResultsProvider = StreamProvider<List<PendingResult>>((ref) {
  ref.watch(userIdProvider);
  return ref.watch(pendingResultRepositoryProvider).watchUnopened();
});

/// Drives the 8 dp dot on the Review tab.
final hasUnopenedResultProvider = Provider<bool>((ref) => ref.watch(unopenedResultsProvider).value?.isNotEmpty ?? false);
