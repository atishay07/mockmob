import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/app_database.dart';

/// What the practice result needs to remember about a session once its draft is gone: the
/// chapter that was chosen ("Chapter: Admission of a partner."). The attempt itself does not
/// carry it, and the draft is deleted as soon as the server records the attempt.
class PracticeNote {
  const PracticeNote({this.chapter, this.mode});

  final String? chapter;
  final String? mode;
}

/// Small per-session notes in `cache_entries`, keyed by session id. Local to this phone, never
/// sent anywhere, and dropped with the account's other cache rows.
class PracticeNotes {
  PracticeNotes(this._scope);

  final LocalScope _scope;

  AppDatabase get _db => _scope.db;

  static String _key(String sessionId) => 'practice-note:$sessionId';

  Future<void> write(String sessionId, {String? chapter, required String mode}) async {
    await _db
        .into(_db.cacheEntries)
        .insertOnConflictUpdate(
          CacheEntriesCompanion.insert(
            userId: _scope.userId,
            cacheKey: _key(sessionId),
            json: jsonEncode({'chapter': chapter, 'mode': mode}),
            fetchedAtMs: _scope.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<PracticeNote?> read(String sessionId) async {
    final id = _scope.userIdOrNull;
    if (id == null) return null;
    final row = await (_db.select(
      _db.cacheEntries,
    )..where((t) => t.userId.equals(id) & t.cacheKey.equals(_key(sessionId)))).getSingleOrNull();
    if (row == null) return null;
    try {
      final json = asJson(jsonDecode(row.json));
      return PracticeNote(chapter: asString(json['chapter']), mode: asString(json['mode']));
    } on Object {
      return null;
    }
  }
}

final practiceNotesProvider = Provider<PracticeNotes>((ref) => PracticeNotes(ref.watch(localScopeProvider)));

/// The note for one session, for the result screen.
final practiceNoteProvider = FutureProvider.autoDispose.family<PracticeNote?, String>(
  (ref, sessionId) => ref.watch(practiceNotesProvider).read(sessionId),
);
