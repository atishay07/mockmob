import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/local_scope.dart' show userIdProvider;
import '../../../core/repositories/repair_local_repository.dart';

/// `GET /api/me/repair-record` (B7): every mistake of this account whose repair was made and
/// stored, newest first, with when. It is the account's record, so a repair made on another
/// phone, on the website or before a reinstall is in it.
abstract interface class RepairRecordApi {
  /// The saved repairs by `attemptId/questionId` (see [savedKey]) with when each was made. Throws
  /// [ApiError] for a non-2xx answer.
  Future<Map<String, DateTime>> read();
}

/// The key a saved repair is held under: the paper and the question, the same pair the phone's own
/// repair records and the Review index use.
String savedKey(String attemptId, String questionId) => '$attemptId/$questionId';

class HttpRepairRecordApi implements RepairRecordApi {
  HttpRepairRecordApi(this._api);

  /// The most the server returns in one read.
  static const limit = 100;

  /// A short wait: the record is a quiet extra, the tab and the repair screen never hold for long
  /// on it (they go by the phone's own records when it does not answer).
  static const receiveTimeout = Duration(seconds: 5);

  final ApiClient _api;

  @override
  Future<Map<String, DateTime>> read() async {
    final response = await _api.get(
      '/api/me/repair-record',
      query: {'limit': limit},
      options: const ApiOptions(receiveTimeout: receiveTimeout, retries: 0),
    );
    final rows = response.map['repairs'];
    final out = <String, DateTime>{};
    if (rows is! List) return out;
    for (final row in rows) {
      if (row is! Map) continue;
      final attemptId = row['attemptId'];
      final questionId = row['questionId'];
      final at = DateTime.tryParse('${row['repairedAt'] ?? ''}');
      // A row with no readable time is left out, never guessed.
      if (attemptId is! String || questionId is! String || at == null) continue;
      final key = savedKey(attemptId, questionId);
      final before = out[key];
      if (before == null || at.isAfter(before)) out[key] = at.toUtc();
    }
    return out;
  }
}

final repairRecordApiProvider = Provider<RepairRecordApi>((ref) => HttpRepairRecordApi(ref.watch(apiClientProvider)));

/// Copies the account's saved repairs the phone does not hold as repaired into the phone's own
/// records, at the time the server made each. Today, the result and the reminders read those
/// records, so they agree with Review at once and offline. A mistake the student set aside as not a
/// mistake stays hidden. A write that fails changes nothing: the saved repair still shows from the
/// account's own record.
Future<void> syncSavedRepairs(RepairLocalRepository repo, Map<String, DateTime> saved) async {
  if (saved.isEmpty) return;
  final List<RepairLocalRecord> held;
  try {
    held = await repo.all();
  } on Object {
    return;
  }
  final byKey = {for (final r in held) savedKey(r.attemptId, r.questionId): r};
  for (final e in saved.entries) {
    final r = byKey[e.key];
    if (r != null && (r.isRepaired || r.status == RepairLocalStatus.notAMistake)) continue;
    final at = e.key.indexOf('/');
    if (at <= 0) continue;
    try {
      await repo.recordOutcome(attemptId: e.key.substring(0, at), questionId: e.key.substring(at + 1), status: RepairLocalStatus.stored, at: e.value);
    } on Object {
      // Only the phone's copy is missing.
    }
  }
}

/// What the account holds as saved repairs, read once when the signed-in student's papers are on
/// hand and again when the papers are read again (after a repair, a refresh). A read that fails
/// gives nothing: the phone's own records still stand, and the next read tries again.
final serverRepairsProvider = FutureProvider<Map<String, DateTime>>((ref) async {
  if (ref.watch(userIdProvider) == null) return const {};
  // A new paper list is the moment a repair may have been made: read the record again with it.
  ref.watch(attemptsRepositoryProvider.select((s) => s.fetchedAt));
  final Map<String, DateTime> saved;
  try {
    saved = await ref.watch(repairRecordApiProvider).read();
  } on Object {
    return const {};
  }
  await syncSavedRepairs(ref.read(repairLocalRepositoryProvider), saved);
  return saved;
});
