import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import 'practice_question.dart';

/// `GET /api/bookmarks`: every saved id, and the questions that pass the readable-content
/// filter (so [ids] can outnumber [questions]).
class SavedList {
  const SavedList({this.ids = const [], this.questions = const [], this.count = 0});

  factory SavedList.fromJson(Object? body) {
    final j = asJson(body);
    final ids = asStringList(j['questionIds']);
    return SavedList(
      ids: ids,
      questions: [for (final q in asJsonList(j['questions'])) PracticeQuestion.fromJson(q).copyWith(saved: true)],
      count: asInt(j['count']) ?? ids.length,
    );
  }

  final List<String> ids;
  final List<PracticeQuestion> questions;
  final int count;

  /// Saved questions held for checks, not shown until they pass.
  int get held => (ids.length - questions.length).clamp(0, ids.length);
}

class SavedRepository extends JsonRemoteNotifier<SavedList> {
  @override
  String get cacheKey => 'bookmarks';

  @override
  SavedList parse(Object? json) => SavedList.fromJson(json);

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/bookmarks')).data;
}

final savedRepositoryProvider = NotifierProvider<SavedRepository, RemoteState<SavedList>>(SavedRepository.new);

/// The free plan holds 25 saved questions; Pro has no limit.
const freeSaveLimit = 25;

sealed class SaveOutcome {
  const SaveOutcome();
}

class SaveDone extends SaveOutcome {
  const SaveDone({required this.saved, required this.count, this.limit});

  final bool saved;
  final int count;
  final int? limit;
}

class SaveLimitReached extends SaveOutcome {
  const SaveLimitReached();
}

class SaveFailed extends SaveOutcome {
  const SaveFailed(this.error);

  final ApiError error;
}

/// What the student sees on a question's save key: the server's word, or a pending write.
class SaveMarks {
  const SaveMarks({this.acked = const {}, this.pending = const {}, this.count, this.limit});

  /// Saved state the server acknowledged in this run, by question id.
  final Map<String, bool> acked;
  final Set<String> pending;

  /// The count and limit from the last acknowledgement.
  final int? count;
  final int? limit;

  bool savedOf(PracticeQuestion q) => acked[q.id] ?? q.saved;
}

/// `POST /api/bookmarks {questionId, saved, source}`. A question reads as saved only after
/// the server says so.
class SaveController extends Notifier<SaveMarks> {
  @override
  SaveMarks build() {
    // A new account starts clean.
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return const SaveMarks();
  }

  Future<SaveOutcome> set(String questionId, {required bool saved, String source = 'explore'}) async {
    if (state.pending.contains(questionId)) return const SaveFailed(ApiError(kind: ApiErrorKind.conflict, code: 'in_progress'));
    state = SaveMarks(acked: state.acked, pending: {...state.pending, questionId}, count: state.count, limit: state.limit);
    try {
      final res = await ref.read(apiClientProvider).post('/api/bookmarks', body: {'questionId': questionId, 'saved': saved, 'source': source});
      final body = res.map;
      final done = SaveDone(saved: asBool(body['saved']) ?? saved, count: asInt(body['count']) ?? 0, limit: asInt(body['limit']));
      state = SaveMarks(
        acked: {...state.acked, questionId: done.saved},
        pending: {...state.pending}..remove(questionId),
        count: done.count,
        limit: done.limit,
      );
      // The saved list changed on the server: read it again in the background.
      ref.read(savedRepositoryProvider.notifier).refresh(force: true);
      return done;
    } on ApiError catch (e) {
      state = SaveMarks(acked: state.acked, pending: {...state.pending}..remove(questionId), count: state.count, limit: state.limit);
      return e.kind == ApiErrorKind.paymentRequired ? const SaveLimitReached() : SaveFailed(e);
    }
  }
}

final saveControllerProvider = NotifierProvider<SaveController, SaveMarks>(SaveController.new);
