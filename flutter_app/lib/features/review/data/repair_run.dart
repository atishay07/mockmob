import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/haptics/haptics.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/repair.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/repositories/repair_local_repository.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../../rhythm/rhythm.dart' show Celebration, CelebrationEvent, CelebrationScope, celebrationControllerProvider, rhythmPrefsProvider, rhythmVisibleProvider;
import '../copy.dart';
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
  /// the same attempt and chapter. A repaired mistake opens alone, as a free reopen. A run that
  /// is under way on [questionId] with something already repaired, or with its call still in
  /// flight, is kept, so the student never loses their place. Any other earlier run (one left at
  /// its entry, or one backed out of before a single repair) is replaced: it would otherwise
  /// bring back its old offline panels, a stale wallet limit and its own question list in place
  /// of the mistake that was tapped.
  /// Returns false when the mistake is not in Review (anymore).
  /// [count] (from a `?count=` link on Today or the result) keeps the run to that many
  /// mistakes, starting with [questionId].
  bool open(String questionId, {int? count}) {
    final current = state;
    if (current != null &&
        current.phase == RepairPhase.working &&
        (current.repairedCount > 0 || current.current?.outcome is OutcomeLoading) &&
        current.current?.item.questionId == questionId) {
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

  /// Calls the repair again for the current mistake. The `requestId` is the one stored for it: the
  /// same one after a dropped connection or a timeout (the server charges once per id), a fresh one
  /// after a failure the server answered with `charged: 0` (see [_call]).
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

  /// The run's repairs were acknowledged by the server: fire the one `repairFinished` moment
  /// (consuming `first_repair` for a first repair, so Today never celebrates it a second time)
  /// and return what is shown, or null.
  ///
  /// Only the ending screen calls this, once it is on screen with its `CelebrationSlot` for
  /// `CelebrationScope.repair(attemptId)` mounted: the controller spends an id when it accepts
  /// it, so firing from [finish] could spend the moment with nothing there to show it. Skipped
  /// while the student has turned the weekly rhythm off, so the moment waits for a later run.
  Future<Celebration?> celebrateEnding() async {
    final s = state;
    if (s == null || s.phase != RepairPhase.ending || s.repairedCount == 0) return null;
    RepairStep? first;
    for (final step in s.steps) {
      if (step.countsAsRepaired && step.outcome is OutcomeExplained && (step.outcome as OutcomeExplained).requestId != null) {
        first = step;
        break;
      }
    }
    final at = s.lastAckedAt;
    if (first == null || at == null) return null;
    try {
      final event = CelebrationEvent.repairFinished(
        attemptId: attemptId,
        firstRequestId: (first.outcome as OutcomeExplained).requestId!,
        // The receipt reads the student's clock, the same time the ending screen shows.
        at: ref.read(reviewClockProvider).local(at),
        firstEver: !s.repairedBefore,
      );
      await ref.read(rhythmPrefsProvider.notifier).ensureLoaded();
      if (!ref.mounted || !ref.read(rhythmVisibleProvider)) return null;
      final scope = CelebrationScope.repair(attemptId);
      // The same ending drawn again (a rebuilt route): keep the moment that is already showing.
      final showing = ref.read(celebrationControllerProvider).byScope[scope];
      if (showing != null && showing.id == event.id) return showing;
      // A later run on the same paper ends with a new id in the same scope.
      final controller = ref.read(celebrationControllerProvider.notifier)..clearScope(scope);
      return await controller.celebrate(event);
    } on Object {
      // The ending is already on screen; a missed moment never breaks it.
      return null;
    }
  }

  bool _isCurrent(RepairStep step) {
    final s = state;
    return ref.mounted && s != null && s.phase == RepairPhase.working && s.current?.item.key == step.item.key;
  }

  /// A repair call answered after the run moved on (the student finished or backed out while it
  /// was in flight). By then [_call] has already stored the acknowledgement and the server has
  /// charged the credit, so the answer is never thrown away: an acknowledged outcome is kept on
  /// its step while the ending is up (the count and the receipt then include it), and the wallet
  /// and the week row, which the ending already refreshed, are read again.
  void _lateAnswer(RepairStep step, MistakeOutcome? outcome) {
    if (!ref.mounted) return;
    final s = state;
    final counted = outcome is OutcomeExplained && !outcome.reopened;
    if (s != null && s.phase == RepairPhase.ending && (outcome is OutcomeExplained || outcome is OutcomeSetAside || outcome is OutcomeNotExplained)) {
      final at = s.steps.indexWhere((x) => x.item.key == step.item.key);
      if (at >= 0 && s.steps[at].outcome is! OutcomeExplained) {
        final next = [...s.steps];
        next[at] = next[at].withOutcome(outcome);
        state = s.copyWith(steps: next);
      }
    }
    if (counted) {
      unawaited(ref.read(rhythmRepositoryProvider.notifier).refresh());
      unawaited(ref.read(creditsRepositoryProvider.notifier).refresh());
    }
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
    if (!_isCurrent(step)) return _lateAnswer(step, outcome);
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
          return OutcomeExplained(r, ackedAt: ackedAt, reopened: wasRepaired, requestId: requestId);
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
      final outcome = _mapError(e);
      // `charged: 0` means the server released this request, so reusing its id would only answer
      // `operation_released` and waste the student's next tap. Store a fresh id now; the retry
      // reads it. A call with no answer (offline, a timeout) has no such body and keeps its id, so
      // it can never be charged twice. A reopened repair never touches its record.
      if (outcome is OutcomeFailed && e.chargedNothing && !wasRepaired) {
        try {
          await _repo.release(attemptId, qid);
        } on Object {
          // The failure still shows; the retry then falls back to one `operation_released` round trip.
        }
      }
      return outcome;
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
    // A repair that ran out of time on the server, or one the app stopped waiting for: not "offline".
    if (e.hasCode(ApiCodes.providerTimeout) || e.kind == ApiErrorKind.timeout) return const OutcomeFailed(RepairFailure.tookTooLong);
    // Each of these keeps the run going; the server's own sentence says what happened to the credit.
    if (e.hasCode(ApiCodes.budgetReached)) {
      return OutcomeFailed(RepairFailure.budgetReached, message: e.serverMessage ?? ReviewCopy.repairsPausedUntil(_nextBudgetMonth()));
    }
    if (e.hasCode(ApiCodes.walletUnavailable)) return OutcomeFailed(RepairFailure.walletUnavailable, message: e.serverMessage);
    if (e.hasCode(ApiCodes.providerUnavailable)) return OutcomeFailed(RepairFailure.providerUnavailable, message: e.serverMessage);
    if (e.isOffline) return const OutcomeFailed(RepairFailure.offline);
    return switch (e.kind) {
      ApiErrorKind.notFound => const OutcomeFailed(RepairFailure.notFound),
      ApiErrorKind.validation => const OutcomeFailed(RepairFailure.cannotRepair),
      ApiErrorKind.server || ApiErrorKind.unavailable => OutcomeFailed(RepairFailure.unavailable, message: e.serverMessage),
      _ => const OutcomeFailed(RepairFailure.unknown),
    };
  }

  /// "1 November": the first day of the next month in India, when the monthly student-AI budget
  /// resets. Only used when a `budget_reached` answer arrives without its own sentence.
  String _nextBudgetMonth() => repairBudgetResetLabel(ref.read(nowProvider)());

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

/// "1 November": the first day of the month after [now] on the Indian calendar, when the monthly
/// student-AI budget resets (the server counts its month in IST, `nextMonthStart` in
/// `data/repair_failures.js`).
String repairBudgetResetLabel(DateTime now) {
  final ist = now.toUtc().add(const Duration(hours: 5, minutes: 30));
  return formatDayMonth(DateTime.utc(ist.year, ist.month + 1));
}

final repairRunProvider = NotifierProvider.family<RepairRun, RepairRunState?, String>(RepairRun.new);
