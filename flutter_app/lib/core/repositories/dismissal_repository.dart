import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/next_move.dart';
import '../notifications/timezones.dart';
import 'notification_prefs_repository.dart';
import '../storage/app_database.dart';
import 'local_scope.dart';

/// What a "Not today" dismissal hides: one suggestion, keyed by (kind, subject, chapter,
/// source attempt id).
class DismissalKey {
  const DismissalKey({required this.kind, this.subject = '', this.chapter = '', this.sourceAttemptId = ''});

  final String kind;
  final String subject;
  final String chapter;
  final String sourceAttemptId;

  @override
  bool operator ==(Object other) =>
      other is DismissalKey && other.kind == kind && other.subject == subject && other.chapter == chapter && other.sourceAttemptId == sourceAttemptId;

  @override
  int get hashCode => Object.hash(kind, subject, chapter, sourceAttemptId);
}

/// Local `dismissals`. A dismissal hides one suggestion on Today until 4:00 AM the next local
/// day, or until a new attempt is submitted, whichever comes first. It never deletes, hides or
/// edits anything in Review, the repair record, an attempt or the plan inputs.
class DismissalRepository {
  DismissalRepository(this._scope, this._timezoneName);

  final LocalScope _scope;

  /// IANA name of the student's timezone (notification prefs), default Asia/Kolkata.
  final String Function() _timezoneName;

  AppDatabase get _db => _scope.db;

  Future<void> dismiss(DismissalKey key) async {
    final now = _scope.now();
    final expires = dismissalExpiry(now, locationFor(_timezoneName()));
    await _db.into(_db.dismissals).insertOnConflictUpdate(
          DismissalsCompanion.insert(
            userId: _scope.userId,
            kind: key.kind,
            subject: Value(key.subject),
            chapter: Value(key.chapter),
            sourceAttemptId: Value(key.sourceAttemptId),
            createdAtMs: now.millisecondsSinceEpoch,
            expiresAtMs: expires.millisecondsSinceEpoch,
          ),
        );
  }

  /// A dismissed suggestion stays hidden inside its expiry even if the plan returns it.
  Future<bool> isDismissed(DismissalKey key) async {
    final row = await (_db.select(_db.dismissals)
          ..where((t) =>
              t.userId.equals(_scope.userId) &
              t.kind.equals(key.kind) &
              t.subject.equals(key.subject) &
              t.chapter.equals(key.chapter) &
              t.sourceAttemptId.equals(key.sourceAttemptId)))
        .getSingleOrNull();
    return row != null && row.expiresAtMs > _scope.now().millisecondsSinceEpoch;
  }

  Future<Set<DismissalKey>> active() async => _toKeys(await _activeRows());

  Stream<Set<DismissalKey>> watchActive() {
    final id = _scope.userIdOrNull;
    if (id == null) return Stream.value(const {});
    final query = _db.select(_db.dismissals)..where((t) => t.userId.equals(id));
    final nowMs = _scope.now().millisecondsSinceEpoch;
    return query.watch().map((rows) => _toKeys(rows.where((r) => r.expiresAtMs > nowMs).toList()));
  }

  Future<List<DismissalRow>> _activeRows() =>
      (_db.select(_db.dismissals)..where((t) => t.userId.equals(_scope.userId) & t.expiresAtMs.isBiggerThanValue(_scope.now().millisecondsSinceEpoch))).get();

  Set<DismissalKey> _toKeys(List<DismissalRow> rows) =>
      {for (final r in rows) DismissalKey(kind: r.kind, subject: r.subject, chapter: r.chapter, sourceAttemptId: r.sourceAttemptId)};

  /// A newly submitted attempt ends every dismissal early: the suggestion is based on new evidence.
  Future<void> clearForNewAttempt() => (_db.delete(_db.dismissals)..where((t) => t.userId.equals(_scope.userId))).go();

  /// Housekeeping: drops expired rows.
  Future<void> purgeExpired() =>
      (_db.delete(_db.dismissals)..where((t) => t.userId.equals(_scope.userId) & t.expiresAtMs.isSmallerOrEqualValue(_scope.now().millisecondsSinceEpoch))).go();
}

final dismissalRepositoryProvider = Provider<DismissalRepository>((ref) {
  final scope = ref.watch(localScopeProvider);
  return DismissalRepository(scope, () => ref.read(studentTimezoneProvider));
});
