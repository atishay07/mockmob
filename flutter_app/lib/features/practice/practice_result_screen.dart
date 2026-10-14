import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/analytics/analytics.dart';
import '../../core/domain/repair_candidates.dart' show RepairCandidates, RepairKeyScope;
import '../../core/models/models.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/attempts_repository.dart';
import '../../core/repositories/pending_result_repository.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../insights/data/saved_repository.dart'
    show SaveDone, SaveLimitReached, SaveFailed, saveControllerProvider, savedRepositoryProvider;
import '../review/data/repair_key_plan.dart';
import '../review/data/review_providers.dart' show reviewIndexProvider;
import 'copy.dart';
import 'data/default_subject.dart' show publicIdOf;
import 'data/practice_catalog.dart';
import 'data/practice_notes.dart';
import 'data/result_actions.dart';
import 'model/finish_reaction.dart';
import 'model/practice_result_model.dart';
import 'model/session_analysis.dart';
import 'widgets/finish_stage.dart';
import 'widgets/observations_panel.dart';
import 'widgets/practice_app_bar.dart';
import 'widgets/prove_card.dart';
import 'widgets/result_foot.dart';
import 'widgets/result_list.dart';
import 'widgets/report_key.dart';
import 'widgets/result_states.dart';
import 'widgets/top_edge_fade.dart';
import 'widgets/save_key.dart';

/// When the server acknowledged the attempt on this phone ("Recorded at 11:51 PM").
final resultReceivedAtProvider = FutureProvider.autoDispose.family<DateTime?, String>((ref, attemptId) async {
  final pending = await ref.watch(pendingResultRepositoryProvider).find(attemptId);
  return pending?.receivedAt;
});

/// True when this result was acknowledged on this phone and has not been opened yet: the
/// student is arriving straight from the submit, so the finish moment plays. Read once, before
/// the result is marked opened.
final finishFreshProvider = FutureProvider.autoDispose.family<bool, String>((ref, attemptId) async {
  try {
    final pending = await ref.read(pendingResultRepositoryProvider).find(attemptId);
    return pending != null && !pending.isOpened;
  } on Object {
    return false;
  }
});

/// `/practice/result/:attemptId`: the finish moment of Quick, Smart and chapter practice, then
/// every answer with its explanation. Correctness appears here for the first time, because
/// feedback while answering is off.
class PracticeResultScreen extends ConsumerStatefulWidget {
  const PracticeResultScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<PracticeResultScreen> createState() => _PracticeResultScreenState();
}

class _PracticeResultScreenState extends ConsumerState<PracticeResultScreen> {
  final ResultListController _list = ResultListController();
  final ScrollController _scroll = ScrollController();
  bool _seeded = false;
  bool _finished = false;

  /// The finish moment has ended: the answers below it come in (a result opened again, or reduced
  /// motion, shows them at once).
  bool _settled = false;

  /// Whether the moment plays, read once from the pending-result row on the first build that has
  /// it and then held, so marking the result opened can never flip it mid-moment.
  bool? _fresh;
  Timer? _leaveTimer;
  PracticeResultModel? _model;

  @override
  void dispose() {
    _leaveTimer?.cancel();
    _scroll.dispose();
    _list.dispose();
    super.dispose();
  }

  /// First data: open the first wrong answer, and mark the result opened (after the moment has
  /// read whether it is fresh) so Today and the Review tab stop pointing at it.
  void _onFirstData(Attempt attempt, PracticeResultModel model) {
    if (_seeded) return;
    _seeded = true;
    final wrong = model.wrong;
    if (wrong.isNotEmpty) _list.open.add(wrong.first.qid);
    // With nothing wrong or blank the correct group is the whole list, so it starts open.
    if (wrong.isEmpty && model.blank.isEmpty) _list.correctGroupOpen = true;
    scheduleMicrotask(() async {
      // Bookkeeping must never break the screen: the result is already on display.
      try {
        await ref.read(finishFreshProvider(widget.attemptId).future);
        await ref.read(pendingResultRepositoryProvider).markOpened(widget.attemptId);
      } on Object {
        // The review dot clears on the next successful open.
      }
      _track(AnalyticsEvents.resultOpened, {'mode': attempt.mode ?? 'quick', 'variant': 'practice'});
    });
  }

  void _track(String event, Map<String, Object?> props) {
    try {
      unawaited(ref.read(analyticsClientProvider).track(event, props: props).catchError((_) => false));
    } on Object {
      // Usage data is optional and never blocks the student.
    }
  }

  void _jumpTo(ResultQuestion q, {List<ResultQuestion> alsoOpen = const []}) {
    for (final other in alsoOpen) {
      _list.reveal(other);
    }
    _list.reveal(q);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _list.keyFor(q.qid).currentContext;
      if (ctx != null && ctx.mounted) {
        Scrollable.ensureVisible(ctx, duration: Motion.of(ctx, Motion.card), curve: Motion.out, alignment: 0.08);
      }
    });
  }

  void _tapCell(int index) {
    final model = _model;
    if (model == null || index >= model.questions.length) return;
    _jumpTo(model.questions[index]);
  }

  /// "Show me" under an observation: every question it names opens, and the list scrolls to the
  /// first. Numbers are 1-based; any outside the paper are ignored.
  void _showQuestions(List<int> numbers) {
    final model = _model;
    if (model == null) return;
    final shown = [
      for (final n in numbers)
        if (n >= 1 && n <= model.questions.length) model.questions[n - 1],
    ];
    if (shown.isEmpty) return;
    _jumpTo(shown.first, alsoOpen: shown.skip(1).toList());
  }

  String _publicSubject(Attempt attempt) => publicIdOf(attempt.subject, ref.read(practiceSubjectsProvider).value);

  /// The share right in the student's previous practice in this subject, for the tone.
  double? _previousAccuracy(Attempt attempt) {
    final all = ref.read(attemptsRepositoryProvider).value;
    if (all == null) return null;
    Attempt? best;
    for (final a in all) {
      if (a.id == attempt.id || a.isMock || a.subject != attempt.subject || a.total == 0) continue;
      if (!a.completedAt.isBefore(attempt.completedAt)) continue;
      if (best == null || a.completedAt.isAfter(best.completedAt)) best = a;
    }
    return best == null ? null : best.correct / best.total;
  }

  Future<void> _toggleSave(String qid, bool saved) async {
    final outcome = await ref.read(saveControllerProvider.notifier).set(qid, saved: !saved, source: 'result');
    if (!mounted) return;
    final message = switch (outcome) {
      SaveDone() => null,
      SaveLimitReached() => PracticeCopy.saveFull,
      SaveFailed(:final error) => error.isOffline ? PracticeCopy.saveOffline : PracticeCopy.saveFailed,
    };
    if (message != null) {
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));
    }
  }

  Widget? _saveFor(String qid) {
    final marks = ref.watch(saveControllerProvider);
    final ids = ref.watch(savedRepositoryProvider.select((s) => s.value?.ids)) ?? const <String>[];
    final saved = marks.acked[qid] ?? ids.contains(qid);
    return SaveKey(saved: saved, busy: marks.pending.contains(qid), onTap: () => _toggleSave(qid, saved));
  }

  /// "Report a problem" for one answer, sent as the website's result analysis sends it.
  Widget _reportFor(Attempt attempt, AttemptDetail? detail, ResultQuestion q) => ReportKey(
    build: (reason) => ResultReport(
      questionId: q.qid,
      attemptId: attempt.id,
      sessionId: attempt.selectionMeta.sessionId,
      subject: attempt.subject,
      verdict: switch (q.verdict) {
        Verdict.correct => 'correct',
        Verdict.wrong => 'wrong',
        Verdict.blank => 'skipped',
      },
      note: reason,
      givenIndex: q.givenIndex,
      correctIndex: KeyView.of(detail, q.qid).keyIndex,
    ),
  );

  void _finish() {
    _track(AnalyticsEvents.finishForNow, {'screen': 'practice_result'});
    setState(() => _finished = true);
    // The ending is one plain line. It stays long enough to read, then Today takes over.
    _leaveTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) context.go(AppRoutes.today);
    });
  }

  ResultFootAction _primary(Attempt attempt, PracticeResultModel model) {
    // The key opens one repair run: one chapter of this paper (the chapter with the most open
    // mistakes), so its count and its caption name that run, not every wrong answer on the page.
    final plan = RepairKeyPlan.of(
      [for (final q in model.wrong) RepairKeyRow(qid: q.qid, number: q.number, chapter: q.question?.chapter)],
      attemptId: attempt.id,
      index: ref.watch(reviewIndexProvider),
    );
    if (plan != null) {
      final location = Uri(
        path: AppRoutes.reviewRepair(attempt.id, plan.firstQid),
        queryParameters: {'count': '${plan.count}'},
      ).toString();
      // The key says what it opens in the words every other repair key uses (count, chapter,
      // minutes, and what stays in Review): one sentence for one run.
      final scope = RepairKeyScope(chapter: plan.chapter, firstQuestionId: plan.firstQid, count: plan.count, othersInPaper: plan.others);
      return ResultFootAction(RepairCandidates.keyLabel(scope), () => context.push(location), note: RepairCandidates.describe(scope));
    }
    if (model.blank.isNotEmpty) {
      return ResultFootAction(PracticeCopy.tryTheBlanks, () => _jumpTo(model.blank.first));
    }
    final location = Uri(path: AppRoutes.practiceSetup('chapter'), queryParameters: {'subject': _publicSubject(attempt)}).toString();
    return ResultFootAction(PracticeCopy.practiceAnotherChapter, () => context.go(location));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final id = widget.attemptId;
    final detailState = ref.watch(attemptDetailProvider(id));
    final cached = ref.watch(attemptsRepositoryProvider.select((s) => s.value?.where((a) => a.id == id).firstOrNull));
    final detail = detailState.value;
    final attempt = detail?.attempt ?? cached;
    final receivedState = ref.watch(resultReceivedAtProvider(id));
    final fresh = ref.watch(finishFreshProvider(id));
    if (fresh.hasValue) _fresh ??= fresh.requireValue;

    if (attempt == null) {
      return ResultNoAttempt(state: detailState, onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true));
    }

    final model = PracticeResultModel.from(attempt);
    _model = model;
    final analysis = SessionAnalysis.of(attempt);
    _onFirstData(attempt, model);
    // The receipt waits for the time the server acknowledged on this phone; only a result with
    // no record here (opened later from Review) falls back to the attempt's own time.
    final recordedAt = receivedState.hasValue ? (receivedState.value ?? attempt.completedAt).toLocal() : null;
    final chapter = ref.watch(practiceNoteProvider(id)).value?.chapter;

    if (_finished) {
      return ResultClosing(
        text: PracticeCopy.finished(recordedAt ?? attempt.completedAt.toLocal(), chapter: chapter),
        cells: model.cells,
        marks: FinishMarks(correct: attempt.correct, wrong: attempt.wrong, blank: attempt.unattempted, total: attempt.total),
      );
    }

    final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
    final failedKeys = detail == null && detailState.error != null && !detailState.loading;
    final marks = FinishMarks(correct: attempt.correct, wrong: attempt.wrong, blank: attempt.unattempted, total: attempt.total);
    // The moment plays on the real sheet: straight from the cached attempt (the submit put it
    // there with its rows), without waiting for the full result read. Only when the cache has no
    // rows does the moment, fresh or reopened, wait for them, and only until the read has settled
    // either way (a reopened result would otherwise mount with no bubbles and jump when they arrive).
    final rowsSettled = model.hasRows || detail != null || failedKeys;
    final isFresh = _fresh;
    final staged = isFresh == true && !_settled && !Motion.reduced(context);
    // What is below the moment waits for it, then rises in: the list never gives the result away
    // while the score still counts up.
    Widget gate(Widget child) => IgnorePointer(
      ignoring: staged || isFresh == null,
      child: AnimatedOpacity(
        opacity: staged || isFresh == null ? 0 : 1,
        duration: isFresh == true ? Motion.of(context, Motion.card) : Duration.zero,
        curve: Motion.out,
        child: child,
      ),
    );

    return PopScope(
      // Opened by link or straight after a session there is nothing to go back to: back
      // leads to the Practice tab instead of leaving the app.
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.practice);
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: Stack(
          children: [
            Positioned(top: 0, left: 0, right: 0, height: 440, child: IgnorePointer(child: LightField.lamp(context, strength: 0.75))),
            SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: Column(
                    children: [
                      const PracticeAppBar(),
                      Expanded(
                        // The rows dim into the ground over the last 24 dp above the pinned foot,
                        // never a half row cut at a hard edge (SPACING-AUDIT G10, P5).
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: TopEdgeFade(
                          controller: _scroll,
                          child: ListView(
                            controller: _scroll,
                            // The last row scrolls fully clear of the fade above the foot.
                            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, BarFade.extent + MmSpace.s16),
                            children: [
                              // The moment waits the few milliseconds it takes to know whether
                              // this is the first open (so it never plays twice or not at all), and
                              // for the sheet's rows; meanwhile Mobi reads the sheet. Keyed by the
                              // number of bubbles, so rows that arrive late ink in from the start.
                              // The failure is said first, where the page opens: below the moment it
                              // would sit past the fold, half behind the keys.
                              if (failedKeys) ...[
                                ResultLoadFailed(onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true)),
                                const SizedBox(height: MmSpace.s16),
                              ],
                              if (isFresh != null && rowsSettled)
                                FinishStage(
                                  key: ValueKey('finish-${model.cells.length}'),
                                  marks: marks,
                                  cells: model.cells,
                                  tone: finishToneFor(marks, previousAccuracy: _previousAccuracy(attempt)),
                                  recordedAt: recordedAt,
                                  fresh: isFresh,
                                  subject: subjectNameFor(_publicSubject(attempt), ref.watch(practiceSubjectsProvider).value),
                                  chapter: chapter,
                                  onCellTap: model.hasRows ? _tapCell : null,
                                  onSettled: () {
                                    if (mounted && !_settled) setState(() => _settled = true);
                                  },
                                )
                              else
                                const ResultReading(),
                              if (detailState.isStale && detailState.fetchedAt != null) ...[
                                const SizedBox(height: MmSpace.s12),
                                Text(
                                  PracticeCopy.lastLoaded(detailState.fetchedAt!.toLocal()),
                                  style: context.mmType.small.copyWith(color: colors.ink3),
                                ),
                              ],
                              if (model.hasRows && !failedKeys) ...[
                                const SizedBox(height: MmSpace.group),
                                gate(
                                  ResultList(
                                    model: model,
                                    controller: _list,
                                    keyFor: (qid) => KeyView.of(detail, qid),
                                    saveFor: _saveFor,
                                    reportFor: (q) => _reportFor(attempt, detail, q),
                                    analysis: analysis,
                                  ),
                                ),
                              ],
                              // After the answers: what the set shows as a whole, then the way to prove
                              // a repair held. Each claim opens the questions behind it.
                              if (model.hasRows) gate(ObservationsPanel(analysis: analysis, onShow: _showQuestions)),
                              if (model.wrong.isNotEmpty) gate(ProveCard(attemptId: attempt.id, subjectId: _publicSubject(attempt))),
                              if (large) ...[
                                const SizedBox(height: MmSpace.s24),
                                KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: _finish),
                              ],
                            ],
                          ),
                        ),
                            ),
                            const BarFade(),
                          ],
                        ),
                      ),
                      ResultFoot(primary: _primary(attempt, model), showFinish: !large, onFinish: _finish),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
