import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../storage/app_database.dart';
import 'local_scope.dart';

/// Local status of one mistake in the repair flow.
abstract final class RepairLocalStatus {
  /// Sent or about to be sent; no acknowledgement yet. The stored `requestId` is reused on retry.
  static const pending = 'pending';
  static const explained = 'explained';
  static const stored = 'stored';
  static const heldForRecheck = 'held_for_recheck';
  static const notExplained = 'not_explained';
  static const notAMistake = 'not_a_mistake';

  /// Answer review without an AI explanation ("Reviewed", "On this phone").
  static const reviewed = 'reviewed';

  /// Statuses that count as a repaired mistake.
  static const repaired = {explained, stored};
}

class RepairLocalRecord {
  const RepairLocalRecord({required this.attemptId, required this.questionId, required this.requestId, required this.status, this.ackedAt});

  final String attemptId;
  final String questionId;
  final String requestId;
  final String status;

  /// Server acknowledgement time, null until acknowledged.
  final DateTime? ackedAt;

  bool get isRepaired => RepairLocalStatus.repaired.contains(status);
  bool get isAcknowledged => ackedAt != null;
}

/// `repair_local`: {attemptId, questionId, requestId, status, ackedAt}. The per-mistake
/// acknowledgements of `POST /api/recovery/repair` are the only records of a repair (no
/// endpoint marks a whole repair finished), so the Review record, the Today card and the
/// repair ending all read them from here.
class RepairLocalRepository {
  RepairLocalRepository(this._scope, {String Function()? newRequestId}) : _newRequestId = newRequestId ?? _defaultRequestId;

  final LocalScope _scope;
  final String Function() _newRequestId;

  AppDatabase get _db => _scope.db;

  /// 36 characters of `[A-Za-z0-9-]`, inside the server's `[A-Za-z0-9_-]{16,64}`.
  static String _defaultRequestId() => const Uuid().v4();

  RepairLocalRecord _from(RepairLocalRow r) => RepairLocalRecord(
        attemptId: r.attemptId,
        questionId: r.questionId,
        requestId: r.requestId,
        status: r.status,
        ackedAt: r.ackedAtMs == null ? null : DateTime.fromMillisecondsSinceEpoch(r.ackedAtMs!),
      );

  Future<RepairLocalRow?> _row(String attemptId, String questionId) => (_db.select(_db.repairLocal)
        ..where((t) => t.userId.equals(_scope.userId) & t.attemptId.equals(attemptId) & t.questionId.equals(questionId)))
      .getSingleOrNull();

  /// The `requestId` to send for this mistake. Stored before the call so a retry after a
  /// crash or timeout reuses it (the server charges once per id). A new id is minted after
  /// [release] (`operation_released`) or when an earlier call ended without a repair
  /// (`held_for_recheck`, `not_explained`, a local review). Reopening an already repaired
  /// mistake uses a throwaway id (a stored reopen is free) and leaves the record untouched.
  Future<String> requestIdFor(String attemptId, String questionId) async {
    final existing = await _row(attemptId, questionId);
    if (existing != null && existing.status == RepairLocalStatus.pending) return existing.requestId;
    if (existing != null && RepairLocalStatus.repaired.contains(existing.status)) return _newRequestId();
    final id = _newRequestId();
    await _db.into(_db.repairLocal).insertOnConflictUpdate(
          RepairLocalCompanion.insert(
            userId: _scope.userId,
            attemptId: attemptId,
            questionId: questionId,
            requestId: id,
            status: RepairLocalStatus.pending,
          ),
        );
    return id;
  }

  /// The server answered with `operation_released`: the next call needs a new id.
  Future<void> release(String attemptId, String questionId) async {
    await _db.into(_db.repairLocal).insertOnConflictUpdate(
          RepairLocalCompanion.insert(
            userId: _scope.userId,
            attemptId: attemptId,
            questionId: questionId,
            requestId: _newRequestId(),
            status: RepairLocalStatus.pending,
          ),
        );
  }

  /// Records a server outcome (`explained`, `stored`, `held_for_recheck`, `not_explained`,
  /// `not_a_mistake`) with the acknowledgement time, or a local `reviewed` entry.
  Future<void> recordOutcome({required String attemptId, required String questionId, required String status, String? requestId, bool acknowledged = true}) async {
    final existing = await _row(attemptId, questionId);
    await _db.into(_db.repairLocal).insertOnConflictUpdate(
          RepairLocalCompanion.insert(
            userId: _scope.userId,
            attemptId: attemptId,
            questionId: questionId,
            requestId: requestId ?? existing?.requestId ?? _newRequestId(),
            status: status,
            ackedAtMs: Value(acknowledged ? _scope.now().millisecondsSinceEpoch : existing?.ackedAtMs),
          ),
        );
  }

  Future<List<RepairLocalRecord>> forAttempt(String attemptId) async {
    final rows = await (_db.select(_db.repairLocal)..where((t) => t.userId.equals(_scope.userId) & t.attemptId.equals(attemptId))).get();
    return rows.map(_from).toList();
  }

  Future<List<RepairLocalRecord>> all() async {
    final rows = await (_db.select(_db.repairLocal)..where((t) => t.userId.equals(_scope.userId))).get();
    return rows.map(_from).toList();
  }

  Stream<List<RepairLocalRecord>> watchAll() {
    final id = _scope.userIdOrNull;
    if (id == null) return Stream.value(const []);
    return (_db.select(_db.repairLocal)..where((t) => t.userId.equals(id))).watch().map((rows) => rows.map(_from).toList());
  }

  /// Questions of this attempt already repaired (explained or stored).
  Future<Set<String>> repairedIds(String attemptId) async =>
      {for (final r in await forAttempt(attemptId)) if (r.isRepaired) r.questionId};

  /// Ids the server answered with `not_a_mistake`: hidden quietly and recounted.
  Future<Set<String>> notAMistakeIds(String attemptId) async =>
      {for (final r in await forAttempt(attemptId)) if (r.status == RepairLocalStatus.notAMistake) r.questionId};

  /// The acknowledgement time of the latest acknowledged repair call for this attempt. The
  /// ending's receipt line ("Recorded at 11:51 PM") reads this and nothing else.
  Future<DateTime?> lastAckedAt(String attemptId) async {
    DateTime? latest;
    for (final r in await forAttempt(attemptId)) {
      final at = r.ackedAt;
      if (at != null && RepairLocalStatus.repaired.contains(r.status) && (latest == null || at.isAfter(latest))) latest = at;
    }
    return latest;
  }
}

final repairLocalRepositoryProvider = Provider<RepairLocalRepository>((ref) => RepairLocalRepository(ref.watch(localScopeProvider)));

/// Every local repair record for the signed-in student, live.
final repairLocalRecordsProvider = StreamProvider<List<RepairLocalRecord>>((ref) {
  ref.watch(userIdProvider);
  return ref.watch(repairLocalRepositoryProvider).watchAll();
});
