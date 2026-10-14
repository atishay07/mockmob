import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/json_helpers.dart';
import '../models/session_draft.dart';
import '../storage/app_database.dart';
import '../sync/session/session_journal.dart';
import 'local_scope.dart';

/// Answer counts of one session, from its journal.
class DraftSummary {
  const DraftSummary({required this.answered, required this.acknowledgedAnswered, required this.total});

  /// Questions with an answer now ("31 of 50 answered").
  final int answered;

  /// Questions that had an answer as of the server's acknowledgement ("Your 31 answers sent
  /// before then were recorded").
  final int acknowledgedAnswered;
  final int total;
}

/// Persists the one in-progress (or just ended) session per draft key in `session_draft`.
/// The runner writes it; Today reads it for the resume and ended slots.
class SessionDraftRepository {
  SessionDraftRepository(this._scope);

  final LocalScope _scope;

  AppDatabase get _db => _scope.db;

  Future<void> save(SessionDraft draft) async {
    // An archived draft keeps the time it was last worked on. Its submit and retries re-save it
    // (often while the student is on a newer paper), and stamping now would make the old paper
    // the "latest" draft that Today, Start and Practice resume from.
    final updated = isArchiveKey(draft.draftKey) && draft.updatedAtMs > 0 ? draft.updatedAtMs : _scope.now().millisecondsSinceEpoch;
    await _db
        .into(_db.sessionDrafts)
        .insertOnConflictUpdate(
          SessionDraftsCompanion.insert(
            draftKey: draft.draftKey,
            userId: draft.userId,
            sessionId: draft.sessionId,
            generationKey: draft.generationKey,
            payloadJson: jsonEncode({...draft.toJson(), 'updatedAtMs': updated}),
            endsAtMs: draft.endsAtWallMs,
            pendingSubmission: Value(draft.pendingSubmission),
            updatedAtMs: updated,
          ),
        );
  }

  /// Writes [draft] only while its row is still this session's, or there is none. The table holds
  /// one row per selection, so an engine that is still closing (a PUT in flight, a late
  /// acknowledgement, a pause) must not write its draft over the row of the new session of the
  /// same selection that started meanwhile: the new session then opens as "not found" and the
  /// old one reappears (practice-02). Returns false when it did not write. [save] is for the
  /// start of a session, which does replace the row.
  Future<bool> saveIfOwned(SessionDraft draft) {
    return _db.transaction(() async {
      final row = await (_db.select(_db.sessionDrafts)..where((t) => t.userId.equals(draft.userId) & t.draftKey.equals(draft.draftKey))).getSingleOrNull();
      if (row != null && row.sessionId != draft.sessionId) return false;
      await save(draft);
      return true;
    });
  }

  /// The key an archived draft lives under: one per session id, so it never meets a selection.
  static String archiveKeyOf(String sessionId) => '$_archivePrefix$sessionId';

  static const _archivePrefix = 'archive:';

  /// True for a row written by [archive].
  static bool isArchiveKey(String draftKey) => draftKey.startsWith(_archivePrefix);

  /// Moves a rejected or still-owed draft out of its selection's row, so the next session with
  /// the same selection cannot overwrite it. Its answer journal is untouched (it is keyed by
  /// session id already); the draft keeps its flags, so the backup job, the sign-out count and
  /// any later review still find it. The write is one transaction: the draft is archived or it
  /// stays where it was.
  Future<void> archive(SessionDraft draft) async {
    final key = archiveKeyOf(draft.sessionId);
    final updated = draft.updatedAtMs > 0 ? draft.updatedAtMs : _scope.now().millisecondsSinceEpoch;
    await _db.transaction(() async {
      await _db
          .into(_db.sessionDrafts)
          .insertOnConflictUpdate(
            SessionDraftsCompanion.insert(
              draftKey: key,
              userId: draft.userId,
              sessionId: draft.sessionId,
              generationKey: draft.generationKey,
              payloadJson: jsonEncode({...draft.toJson(), 'draftKey': key, 'updatedAtMs': updated}),
              endsAtMs: draft.endsAtWallMs,
              pendingSubmission: Value(draft.pendingSubmission),
              updatedAtMs: updated,
            ),
          );
      await (_db.delete(
        _db.sessionDrafts,
      )..where((t) => t.userId.equals(draft.userId) & t.draftKey.equals(draft.draftKey) & t.sessionId.equals(draft.sessionId))).go();
    });
  }

  SessionDraft? _decode(SessionDraftRow? row) {
    if (row == null) return null;
    try {
      return SessionDraft.fromJson(asJson(jsonDecode(row.payloadJson)));
    } on Object {
      return null;
    }
  }

  Future<SessionDraft?> byKey(String draftKey) async {
    final row = await (_db.select(_db.sessionDrafts)..where((t) => t.userId.equals(_scope.userId) & t.draftKey.equals(draftKey))).getSingleOrNull();
    return _decode(row);
  }

  Future<SessionDraft?> bySessionId(String sessionId) async {
    final row = await (_db.select(_db.sessionDrafts)..where((t) => t.userId.equals(_scope.userId) & t.sessionId.equals(sessionId))).getSingleOrNull();
    return _decode(row);
  }

  /// Answer counts for [draft], read from its journal.
  Future<DraftSummary> summaryOf(SessionDraft draft) async {
    final journal = await SessionJournal.open(_db, userId: draft.userId, sessionId: draft.sessionId);
    return DraftSummary(
      answered: journal.answers.length,
      acknowledgedAnswered: journal.answeredCountThrough(draft.acknowledgedSequence),
      total: draft.view.questions.length,
    );
  }

  /// Answers that exist only on this phone, across every unfinished session of the signed-in
  /// student: all of them in ticket mode (the server holds nothing), the unacknowledged ones
  /// otherwise. Used by the sign-out warning ("3 answers are on this phone and not sent").
  Future<int> unsentAnswerCount() async {
    final id = _scope.userIdOrNull;
    if (id == null) return 0;
    final rows = await (_db.select(_db.sessionDrafts)..where((t) => t.userId.equals(id))).get();
    var total = 0;
    for (final row in rows) {
      final draft = _decode(row);
      if (draft == null || draft.windowClosed) continue;
      final journal = await SessionJournal.open(_db, userId: id, sessionId: draft.sessionId);
      final answers = journal.answers.keys.toSet();
      if (draft.isTicketMode) {
        total += answers.length;
      } else {
        total += journal.unsyncedQuestionIds(draft.acknowledgedSequence).where(answers.contains).length;
      }
    }
    return total;
  }

  /// The most recently written draft for the signed-in student, whatever its state.
  Future<SessionDraft?> latest() async {
    final id = _scope.userIdOrNull;
    if (id == null) return null;
    final row =
        await (_db.select(_db.sessionDrafts)
              ..where((t) => t.userId.equals(id))
              ..orderBy([(t) => OrderingTerm.desc(t.updatedAtMs)])
              ..limit(1))
            .getSingleOrNull();
    return _decode(row);
  }

  /// Emits whenever a draft changes, for Today's resume and ended slots.
  Stream<SessionDraft?> watchLatest() {
    final id = _scope.userIdOrNull;
    if (id == null) return Stream.value(null);
    final query = _db.select(_db.sessionDrafts)
      ..where((t) => t.userId.equals(id))
      ..orderBy([(t) => OrderingTerm.desc(t.updatedAtMs)])
      ..limit(1);
    return query.watchSingleOrNull().map(_decode);
  }

  Future<void> delete(String draftKey) =>
      (_db.delete(_db.sessionDrafts)..where((t) => t.userId.equals(_scope.userId) & t.draftKey.equals(draftKey))).go();

  /// Removes the draft and its journal once the attempt is recorded or the student dismissed
  /// an ended-session notice. [userId] pins the owner when it may no longer be the signed-in
  /// student (a submit that finished after an account switch).
  Future<void> deleteSession(String sessionId, {String? userId}) async {
    final id = userId ?? _scope.userId;
    await _db.transaction(() async {
      await (_db.delete(_db.sessionDrafts)..where((t) => t.userId.equals(id) & t.sessionId.equals(sessionId))).go();
      await (_db.delete(_db.answerJournal)..where((t) => t.userId.equals(id) & t.sessionId.equals(sessionId))).go();
    });
  }

  /// The `generationKey` for a selection, created and stored before the start request goes out
  /// so a double tap or a crash retries the same key (and the server returns the same session).
  /// A stored key is reused for [reuseFor]; after that a fresh start gets a fresh key.
  Future<String> generationKeyFor(String draftKey, {Duration reuseFor = const Duration(minutes: 15)}) async {
    final id = _scope.userId;
    final cacheKey = 'genkey:$draftKey';
    final now = _scope.now();
    final row = await (_db.select(_db.cacheEntries)..where((t) => t.userId.equals(id) & t.cacheKey.equals(cacheKey))).getSingleOrNull();
    if (row != null && now.millisecondsSinceEpoch - row.fetchedAtMs < reuseFor.inMilliseconds) {
      final key = asString(asJson(jsonDecode(row.json))['key']);
      if (key != null && key.isNotEmpty) return key;
    }
    // Charset [A-Za-z0-9_-], 12 to 100 characters.
    final key = const Uuid().v4();
    await _db
        .into(_db.cacheEntries)
        .insertOnConflictUpdate(
          CacheEntriesCompanion.insert(userId: id, cacheKey: cacheKey, json: jsonEncode({'key': key}), fetchedAtMs: now.millisecondsSinceEpoch),
        );
    return key;
  }

  /// Forgets a stored start key once the session exists (or the start definitively failed).
  Future<void> clearGenerationKey(String draftKey) =>
      (_db.delete(_db.cacheEntries)..where((t) => t.userId.equals(_scope.userId) & t.cacheKey.equals('genkey:$draftKey'))).go();
}

final sessionDraftRepositoryProvider = Provider<SessionDraftRepository>((ref) => SessionDraftRepository(ref.watch(localScopeProvider)));

/// The latest session draft for the signed-in student, kept live for Today.
final latestSessionDraftProvider = StreamProvider<SessionDraft?>((ref) {
  ref.watch(userIdProvider);
  return ref.watch(sessionDraftRepositoryProvider).watchLatest();
});
