import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/repair_check.dart';
import '../revise/revise_data.dart' show reviseEntryProvider;
import 'repair_check_api.dart';
import 'repair_check_logic.dart';

/// One repair's check: the mistake's attempt and question.
typedef CheckKey = ({String attemptId, String questionId});

/// "Check it held" for one repaired mistake. The repair response's `check` field says whether to
/// ask for a question; from there the screen follows the server's own answers. Kept for the run
/// (a family provider that is not auto-disposed), so going back along the run track shows the
/// same question, the student's pick and the verdict, never a second question.
class RepairCheckController extends Notifier<CheckView> {
  RepairCheckController(this.key);

  final CheckKey key;

  // Bumped by every new question request, so a late answer for an old one lands nowhere.
  int _turn = 0;

  // One id per student action; reused on a retry so an answer counts once.
  String? _requestId;
  bool _inFlight = false;

  @override
  CheckView build() {
    // Another student on this phone never inherits a question or an answer.
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return const CheckView();
  }

  RepairCheckApi get _api => ref.read(repairCheckApiProvider);

  /// Starts from the repair response's `check`. A question, an answer or a load under way is left
  /// alone; a reason that there was nothing (or a failed load) is read again when the repair is reopened,
  /// because new questions may have come since.
  void begin(RepairCheckInfo info) {
    if (state.phase != CheckPhase.idle && state.phase != CheckPhase.none && state.phase != CheckPhase.loadError) return;
    switch (info.status) {
      case RepairCheckStatus.ready || RepairCheckStatus.answered:
        load();
      case RepairCheckStatus.none || RepairCheckStatus.unchecked:
        state = CheckView(phase: CheckPhase.none, message: info.line, canRetry: info.canRetry);
    }
  }

  /// Asks for the question (free). Also the retry, and "Get another question".
  Future<void> load() async {
    final turn = ++_turn;
    _requestId = null;
    state = const CheckView(phase: CheckPhase.loading);
    CheckView next;
    try {
      next = planLoaded(await _api.load(attemptId: key.attemptId, questionId: key.questionId));
    } on ApiError catch (e) {
      next = planLoadFailed(e);
    } on FormatException {
      next = const CheckView(phase: CheckPhase.loadError, message: CheckCopy.loadFailed, canRetry: true);
    }
    if (!ref.mounted || turn != _turn) return;
    state = next;
  }

  /// Chooses option [index] (0 to 3). Only while a question is open and nothing is being sent.
  void pick(int index) {
    if (state.phase != CheckPhase.ready || state.refetch || index < 0 || index > 3) return;
    state = state.copyWith(pick: index, clearError: true);
  }

  /// Sends the pick for marking. The pick stays on screen while it is out and after a failure.
  Future<void> submit() async {
    final open = state.question;
    final pick = state.pick;
    if (state.phase != CheckPhase.ready || state.refetch || open == null || pick == null || _inFlight) return;
    _inFlight = true;
    final turn = _turn;
    _requestId ??= const Uuid().v4().replaceAll('-', '');
    state = state.copyWith(phase: CheckPhase.sending, clearError: true);
    try {
      final answer = await _api.submit(
        attemptId: key.attemptId,
        questionId: key.questionId,
        checkQuestionId: open.checkQuestionId,
        pick: pick,
        requestId: _requestId!,
      );
      if (!ref.mounted || turn != _turn) return;
      state = CheckView(phase: CheckPhase.answered, question: open, pool: state.pool, result: answer.result, replayed: answer.replayed);
      // Revise now holds the cards this answer scheduled.
      ref.invalidate(reviseEntryProvider);
    } on Object catch (e) {
      if (!ref.mounted || turn != _turn) return;
      final failure = e is ApiError
          ? planAnswerFailed(e)
          : const AnswerFailure(message: CheckCopy.markFailed, canRetry: true, refetch: false);
      state = CheckView(
        phase: CheckPhase.ready,
        question: open,
        pool: state.pool,
        pick: failure.refetch ? null : pick,
        error: failure.message,
        errorCanRetry: failure.canRetry,
        refetch: failure.refetch,
      );
    } finally {
      _inFlight = false;
    }
  }
}

final repairCheckProvider = NotifierProvider.family<RepairCheckController, CheckView, CheckKey>(RepairCheckController.new);
