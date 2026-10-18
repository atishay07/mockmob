import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/mistake_lab_traps.dart';
import '../../../core/storage/prefs_store.dart';
import 'revise_copy.dart';

/// A recall the server refused (`409`): the card is not due now, the day's cap is reached, or the
/// question changed. [message] is the website's own sentence for it.
class ReviseRefused implements Exception {
  const ReviseRefused(this.code, this.message);

  final String code;
  final String message;
}

/// Revise's two calls (`GET /api/me/revise`, `POST /api/me/revise/answer`). Behind an interface
/// so tests replace it. Revise costs no credits and writes no attempts row.
abstract interface class ReviseApi {
  /// Today's questions with at most [cap] (5 or 10) shown. [ReviseRead.notAvailable] when the
  /// server says it cannot read Revise now. Throws [ApiError] for anything else.
  Future<ReviseRead> read({required int cap});

  /// Posts [choice] (an index into the options sent) for [questionId]. Only a body that says
  /// `ok` is an answer; the server's grade, never the app's. Throws [ReviseRefused] on a 409 and
  /// [ApiError] or [FormatException] otherwise (nothing was saved).
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap});
}

class HttpReviseApi implements ReviseApi {
  HttpReviseApi(this._api);

  final ApiClient _api;

  static const _refusals = {'not_due', 'cap_reached', 'question_unavailable', 'key_changed'};

  @override
  Future<ReviseRead> read({required int cap}) async {
    try {
      // `queue=1`: the merged queue (LEARN-REVIEW-1017 5.8). An older server ignores it.
      final response = await _api.get('/api/me/revise', query: {'cap': '$cap', 'queue': '1'});
      return ReviseRead.parse(response.data);
    } on ApiError catch (e) {
      if (e.kind == ApiErrorKind.unavailable || e.details['state'] == 'unavailable') return ReviseRead.notAvailable;
      rethrow;
    }
  }

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) async {
    try {
      final response = await _api.post('/api/me/revise/answer', query: {'cap': '$cap'}, body: {'questionId': questionId, 'choice': choice});
      final answer = ReviseAnswer.tryParse(response.data);
      if (answer == null) throw const FormatException('revise answer: not confirmed');
      return answer;
    } on ApiError catch (e) {
      if (e.status == 409 && _refusals.contains(e.code.toLowerCase())) {
        throw ReviseRefused(e.code.toLowerCase(), e.code.toLowerCase() == 'cap_reached' ? ReviseCopy.capReached : ReviseCopy.notDue);
      }
      rethrow;
    }
  }
}

final reviseApiProvider = Provider<ReviseApi>((ref) => HttpReviseApi(ref.watch(apiClientProvider)));

/// Replaced with a [MemoryPrefsStore] in tests.
final revisePrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

/// Questions a day: 5 or 10 (the website's choice, kept on this device).
final reviseCapProvider = AsyncNotifierProvider<ReviseCapNotifier, int>(ReviseCapNotifier.new);

class ReviseCapNotifier extends AsyncNotifier<int> {
  static const _key = 'revise.cap';

  @override
  Future<int> build() async {
    try {
      final v = await ref.read(revisePrefsStoreProvider).getInt(_key);
      return v == 5 ? 5 : 10;
    } on Object {
      return 10;
    }
  }

  Future<void> set(int cap) async {
    final next = cap == 5 ? 5 : 10;
    state = AsyncData(next);
    try {
      await ref.read(revisePrefsStoreProvider).setInt(_key, next);
    } on Object {
      // The choice still holds for this run.
    }
  }
}

/// Review's entry: one read at the default cap, only while signed in. A failed read is null (the
/// entry hides itself, so nothing points at a dead page).
final reviseEntryProvider = FutureProvider.autoDispose<ReviseRead?>((ref) async {
  final userId = ref.watch(authSnapshotProvider.select((s) => s.userId));
  if (userId == null) return null;
  try {
    return await ref.read(reviseApiProvider).read(cap: 10);
  } on Object {
    return null;
  }
});
