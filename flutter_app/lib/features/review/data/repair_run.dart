import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/repair.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/repositories/repair_local_repository.dart';
import '../../../core/repositories/rhythm_repository.dart';
import 'mistake_index.dart';
import 'repair_api.dart';
import 'repair_state.dart';
import 'review_providers.dart';

/// The repair run for one attempt (spec 5.8). Each mistake is one `POST /api/recovery/repair`
/// whose acknowledgement is stored in `repair_local`; nothing counts as repaired before the
/// server answers `explained` or `stored`. Kept alive so the ending can read the run.
class RepairRun extends Notifier<RepairRunState?> {
  RepairRun(this.attemptId);

  final String attemptId;

  @override
  RepairRunState? build() => null;

  RepairLocalRepository get _repo => ref.read(repairLocalRepositoryProvider);

  /// Opens a run that starts at [questionId]: that mistake, then the other open mistakes of
  /// the same attempt and chapter. A repaired mistake opens alone, as a free reopen. An
  /// unfinished run that already holds [questionId] is kept, so the student never loses their
  /// place. Returns false when the mistake is not in Review (anymore).
  /// [count] (from a `?count=` link on Today or the result) keeps the run to that many
  /// mistakes, starting with [questionId].
  bool open(String questionId, {int? count}) {
    final current = state;
    if (current != null && current.phase != RepairPhase.ending && current.steps.any((s) => s.item.questionId == questionId)) {
      return true;
    }
    final index = ref.read(reviewIndexProvider);
    final item = index?.item(attemptId, questionId);
    if (index == null || item == null) return false;
    var items = item.stage.isOpen ? [item, ...index.openIn(attemptId, item.chapter).where((i) => i.questionId != questionId)] : [item];
    if (count != null && count > 0 && count < items.length) items = items.sublist(0, count);
    final records = ref.read(reviewInputsProvider).records;
    state = RepairRunState(
      attemptId: attemptId,
      chapter: item.chapter,
      subjectId: item.subjectId,
      source: item.source,
      steps: [for (final i in items) RepairStep(i)],
      repairedBefore: _repairedBefore(records),
    );
    return true;
  }

  /// "This is your first repair" must be true across phones and reinstalls, so it comes from the
  /// server: `/api/me/rhythm` says `first_repair` is not achieved yet. Without rhythm data, or with
  /// any repair on this phone, it counts as not the first (and no line is shown).
  bool _repairedBefore(List<RepairLocalRecord> records) {
    if (records.any((r) => r.isRepaired)) return true;
    final rhythm = ref.read(rhythmRepositoryProvider).value;
    if (rhythm == null) return true;
    for (final m in rhythm.milestones) {
      if (m.id == 'first_repair') return m.achievedAt != null;
    }
    return true;
  }

  /// Starts working through the mistakes. [limit] keeps only the first N (a short wallet);
  /// [keyOnly] reads the key explanations without spending explanation credits.
  void begin({int? limit, bool keyOnly = false}) {
    final s = state;
    if (s == null) return;
    final steps = limit != null && limit > 0 && limit < s.steps.length ? s.steps.sublist(0, limit) : s.steps;
    state = s.copyWith(steps: steps, index: 0, phase: RepairPhase.working, keyOnly: keyOnly);
    unawaited(ref.read(analyticsClientProvider).track(AnalyticsEvents.repairStarted, props: {'count': steps.length}));
    unawaited(_loadCurrent());
  }

  /// Calls the repair again for the current mistake (same `requestId`).
  Future<void> retry() => _loadCurrent();

  /// Shows the key explanation for the current mistake instead of an AI explanation.
  Future<void> readKey() => _keyReview(KeyReviewReason.fallback);

  void next() {
    final s = state;
    if (s == null || s.phase != RepairPhase.working) return;
    if (s.isLast) return finish();
    state = s.copyWith(index: s.index + 1);
    unawaited(_loadCurrent());
  }

  /// "Finish for now" or the last mistake: go to the ending.
  void finish() {
    final s = state;
    if (s == null || s.phase == RepairPhase.ending) return;
    state = s.copyWith(phase: RepairPhase.ending);
    final repaired = s.repairedCount;
    unawaited(ref.read(analyticsClientProvider).track(AnalyticsEvents.repairCompleted, props: {'count': repaired}));
    if (repaired > 0) {
      // The week row and the wallet are the server's to update.
      unawaited(ref.read(rhythmRepositoryProvider.notifier).refresh());
      unawaited(ref.read(creditsRepositoryProvider.notifier).refresh());
    }
  }

  bool _isCurrent(RepairStep step) {
    final s = state;
    return ref.mounted && s != null && s.phase == RepairPhase.working && s.current?.item.key == step.item.key;
  }

  Future<void> _loadCurrent() async {
    final s = state;
    final step = s?.current;
    if (s == null || step == null) return;
    if (s.keyOnly) return _keyReview(KeyReviewReason.chosen);
    state = s.withCurrent(const OutcomeLoading());

    final wasRepaired = step.item.stage == MistakeStage.repaired;
    MistakeOutcome? outcome;
    try {
      final requestId = await _repo.requestIdFor(attemptId, step.item.questionId);
      outcome = await _call(step, requestId, wasRepaired: wasRepaired, allowRelease: true);
    } on Object {
      outcome = const OutcomeFailed(RepairFailure.unknown);
    }
    if (!_isCurrent(step)) return;
    if (outcome == null) return _dropCurrent();
    if (outcome is OutcomeKeyReview) {
      // The wallet is empty or explanations are paused: the rest of the run reads keys too.
      state = state!.copyWith(keyOnly: true);
      return _keyReview(outcome.reason);
    }
    state = state!.withCurrent(outcome);
  }

  /// Returns the outcome, or null for `not_a_mistake` (the step is removed quietly).
  Future<MistakeOutcome?> _call(RepairStep step, String requestId, {required bool wasRepaired, required bool allowRelease}) async {
    final qid = step.item.questionId;
    try {
      final r = await ref.read(repairApiProvider).repair(attemptId: attemptId, questionId: qid, requestId: requestId);
      final ackedAt = ref.read(nowProvider)();
      switch (r.status) {
        case RepairStatus.explained || RepairStatus.stored:
          if (!wasRepaired) await _repo.recordOutcome(attemptId: attemptId, questionId: qid, status: r.status.wire, requestId: requestId);
          unawaited(ref.read(hapticsProvider).settle());
          return OutcomeExplained(r, ackedAt: ackedAt, reopened: wasRepaired);
        case RepairStatus.heldForRecheck:
          await _repo.recordOutcome(attemptId: attemptId, questionId: qid, status: RepairLocalStatus.heldForRecheck, requestId: requestId);
          return const OutcomeSetAside(heldByServer: true);
        case RepairStatus.notExplained:
          if (!wasRepaired) {
            await _repo.recordOutcome(attemptId: attemptId, questionId: qid, status: RepairLocalStatus.notExplained, requestId: requestId);
          }
          return const OutcomeNotExplained();
      }
    } on RepairResponseFormatException {
      return const OutcomeFailed(RepairFailure.unavailable);
    } on ApiError catch (e) {
      if (e.hasCode(ApiCodes.notAMistake)) {
        await _repo.recordOutcome(attemptId: attemptId, questionId: qid, status: RepairLocalStatus.notAMistake, requestId: requestId);
        return null;
      }
      if (e.hasCode(ApiCodes.operationReleased) && allowRelease) {
        await _repo.release(attemptId, qid);
        final fresh = await _repo.requestIdFor(attemptId, qid);
        return _call(step, fresh, wasRepaired: wasRepaired, allowRelease: false);
      }
      return _mapError(e);
    }
  }

  MistakeOutcome _mapError(ApiError e) {
    if (e.hasCode(ApiCodes.insufficientAiCredits) || e.status == 402) return const OutcomeKeyReview(KeyReviewReason.outOfCredits);
    if (e.hasCode(ApiCodes.paused)) return const OutcomeKeyReview(KeyReviewReason.paused);
    if (e.details['review'] != null ||
        AnswerReview.heldStates.contains(e.code) ||
        e.hasCode(ApiCodes.questionWithdrawn) ||
        e.hasCode(ApiCodes.questionUnderReview) ||
        e.hasCode(ApiCodes.keyChanged)) {
      return const OutcomeSetAside(heldByServer: false);
    }
    if (e.hasCode(ApiCodes.inProgress)) return const OutcomeFailed(RepairFailure.inProgress);
    if (e.isRateLimited) return const OutcomeFailed(RepairFailure.rateLimited);
    if (e.isOffline) return const OutcomeFailed(RepairFailure.offline);
    return switch (e.kind) {
      ApiErrorKind.notFound => const OutcomeFailed(RepairFailure.notFound),
      ApiErrorKind.validation => const OutcomeFailed(RepairFailure.cannotRepair),
      ApiErrorKind.server || ApiErrorKind.unavailable => const OutcomeFailed(RepairFailure.unavailable),
      _ => const OutcomeFailed(RepairFailure.unknown),
    };
  }

  Future<void> _keyReview(KeyReviewReason reason) async {
    final s = state;
    final step = s?.current;
    if (s == null || step == null) return;
    state = s.withCurrent(OutcomeKeyReview(reason));
    if (!step.item.stage.isOpen) return;
    try {
      // Not a repair, not acknowledged: "Reviewed, On this phone".
      await _repo.recordOutcome(
        attemptId: attemptId,
        questionId: step.item.questionId,
        status: RepairLocalStatus.reviewed,
        acknowledged: false,
      );
    } on Object {
      // The review still shows; only the local mark is missing.
    }
  }

  void _dropCurrent() {
    final s = state!;
    final steps = [...s.steps]..removeAt(s.index);
    if (steps.isEmpty) {
      state = s.copyWith(steps: steps, index: 0);
      return finish();
    }
    final index = s.index >= steps.length ? steps.length - 1 : s.index;
    state = s.copyWith(steps: steps, index: index);
    if (s.index >= steps.length) return finish();
    unawaited(_loadCurrent());
  }
}

final repairRunProvider = NotifierProvider.family<RepairRun, RepairRunState?, String>(RepairRun.new);
