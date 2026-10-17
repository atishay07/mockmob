import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/analytics/analytics.dart';
import '../../core/api/api_providers.dart' show nowProvider;
import '../../core/models/models.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/attempts_repository.dart';
import '../../core/repositories/pending_result_repository.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../insights/data/saved_repository.dart'
    show SaveDone, SaveLimitReached, SaveFailed, saveControllerProvider, savedRepositoryProvider;
import '../result/data/move_state.dart';
import '../result/layers_copy.dart';
import '../result/model/move_inputs.dart';
import '../result/model/next_move.dart';
import '../result/move_nav.dart';
import '../result/widgets/fold_section.dart';
import '../result/widgets/mistake_row.dart';
import '../result/widgets/next_move_panel.dart';
import '../result/widgets/result_head.dart';
import 'copy.dart';
import 'data/default_subject.dart' show publicIdOf;
import 'data/practice_catalog.dart';
import 'data/practice_notes.dart';
import 'data/result_actions.dart';
import 'model/finish_reaction.dart' show FinishMarks, FinishTone, finishToneFor;
import 'model/practice_result_model.dart';
import 'model/session_analysis.dart';
import 'widgets/numbered_sheet.dart';
import 'widgets/observations_panel.dart';
import 'widgets/practice_app_bar.dart';
import 'widgets/prove_card.dart';
import 'widgets/result_foot.dart';
import 'widgets/result_list.dart';
import 'widgets/report_key.dart';
import 'widgets/result_question_card.dart';
import 'widgets/result_states.dart';
import 'widgets/top_edge_fade.dart';
import 'widgets/save_key.dart';

/// When the server acknowledged the attempt on this phone ("Recorded 11:51 PM").
final resultReceivedAtProvider = FutureProvider.autoDispose.family<DateTime?, String>((ref, attemptId) async {
  final pending = await ref.watch(pendingResultRepositoryProvider).find(attemptId);
  return pending?.receivedAt;
});

/// True when this result was acknowledged on this phone and has not been opened yet: the
/// student is arriving straight from the submit, so the arrival plays. Read once, before
/// the result is marked opened.
final finishFreshProvider = FutureProvider.autoDispose.family<bool, String>((ref, attemptId) async {
  try {
    final pending = await ref.read(pendingResultRepositoryProvider).find(attemptId);
    return pending != null && !pending.isOpened;
  } on Object {
    return false;
  }
});

/// `/practice/result/:attemptId` (RESULT-1017, packet A1): the result of Quick, Smart and chapter practice in four
/// layers, the same order as a full mock's. (1) What happened in one glance: the one receipt, the marks with their
/// denominator, the marks bar and the chapter that cost the most. (2) The one next move, chosen by stated rules, as the
/// foot's volt key, with why and (for a repair) what a repair gives before paying. (3) The mistakes in repair order,
/// each with its repair inline and its status. (4) Everything else, folded under plain names. Nothing is removed:
/// what this set shows, the proof set, the answer map and the right answers all sit in the folds.
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

  /// The first rows of the mistakes show; "Show all" opens the rest in place.
  static const int _firstRows = 4;
  bool _showAll = false;
  bool _blankOpen = false;

  /// The arrival has ended: the layers below the head come in (a result opened again, or reduced
  /// motion, shows them at once).
  bool _settled = false;
  Timer? _settleTimer;

  /// Whether the arrival plays, read once from the pending-result row on the first build that has
  /// it and then held, so marking the result opened can never flip it mid-arrival.
  bool? _fresh;
  Timer? _leaveTimer;
  PracticeResultModel? _model;

  @override
  void initState() {
    super.initState();
    // A row opened or a blank tried changes what the page builds: rebuild the page, not only the list.
    _list.addListener(_onListChanged);
  }

  void _onListChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _list.removeListener(_onListChanged);
    _leaveTimer?.cancel();
    _settleTimer?.cancel();
    _scroll.dispose();
    _list.dispose();
    super.dispose();
  }

  /// First data: mark the result opened (after the arrival has read whether it is fresh) so Today
  /// and the Review tab stop pointing at it.
  void _onFirstData(Attempt attempt) {
    if (_seeded) return;
    _seeded = true;
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

  /// Opens [q] where it lives (a mistake past the first rows, the folded blanks, or the right answers inside the
  /// "Every answer" fold) and scrolls it under the bar.
  void _jumpTo(ResultQuestion q, {List<ResultQuestion> alsoOpen = const []}) {
    final model = _model;
    setState(() {
      for (final item in [q, ...alsoOpen]) {
        switch (item.verdict) {
          case Verdict.wrong:
            final index = model?.wrong.indexWhere((w) => w.qid == item.qid) ?? 0;
            if (index >= _firstRows) _showAll = true;
          case Verdict.blank:
            _blankOpen = true;
          case Verdict.correct:
            FoldMemory.instance.set(_Folds.every, open: true);
        }
        _list.open.add(item.qid);
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // A row inside a fold arrives while the fold is still opening: scroll once it has settled.
      Future<void>.delayed(q.verdict == Verdict.wrong ? Duration.zero : FoldSection.openDuration + const Duration(milliseconds: 30), () {
        final ctx = _list.keyFor(q.qid).currentContext;
        if (ctx != null && ctx.mounted) {
          Scrollable.ensureVisible(ctx, duration: Motion.of(ctx, Motion.card), curve: Motion.out, alignment: 0.08);
        }
      });
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

  void _go(String location) {
    _track(AnalyticsEvents.nextMoveStarted, {'screen': 'practice_result'});
    unawaited(context.push(location));
  }

  /// The arrival ends 520 ms in (the panel's cue in RESULT-1017 4.8); the layers below then rise in.
  void _scheduleSettle(bool staged) {
    if (!staged || _settleTimer != null) return;
    _settleTimer = Timer(const Duration(milliseconds: 520), () {
      if (mounted && !_settled) setState(() => _settled = true);
    });
  }

  /// One wrong (or blank) row: the plain row with the mistake's summary as its face and its repair inline.
  Widget _row(
    ResultQuestion q, {
    required Attempt attempt,
    required AttemptDetail? detail,
    required SessionAnalysis analysis,
    MistakeStatus? status,
    String? cohort,
    String? cost,
  }) {
    final keyView = KeyView.of(detail, q.qid);
    final isBlank = q.verdict == Verdict.blank;
    final yours = letterOf(q.givenIndex);
    final answer = keyView.state == KeyState.ready ? letterOf(keyView.keyIndex) : null;
    final summary = status == null
        ? null
        : MistakeSummary(
            number: q.number,
            chapter: q.chapter,
            stem: q.question?.question,
            yours: yours,
            answer: answer,
            cohort: cohort,
            status: status,
            expanded: _list.open.contains(q.qid),
            onChip: chipActionOf(
              status,
              onRepair: () => _go(Uri(path: AppRoutes.reviewRepair(attempt.id, q.qid), queryParameters: const {'count': '1'}).toString()),
              onOpenSaved: () => _go(AppRoutes.reviewRepair(attempt.id, q.qid)),
            ),
          );
    return KeyedSubtree(
      key: _list.keyFor(q.qid),
      child: ResultQuestionRow(
        item: q,
        keyView: keyView,
        expanded: _list.open.contains(q.qid),
        onToggle: () => _list.toggle(q.qid),
        blankMode: isBlank ? (_list.blank[q.qid] ?? BlankMode.question) : BlankMode.question,
        tried: _list.tried[q.qid],
        onTry: isBlank ? () => _list.setBlank(q.qid, BlankMode.trying) : null,
        onShowAnswer: isBlank ? () => _list.setBlank(q.qid, BlankMode.answer) : null,
        onTryPick: isBlank ? (j) => _list.pick(q.qid, j) : null,
        save: _saveFor(q.qid),
        report: _reportFor(attempt, detail, q),
        time: analysis.timeLabel(q.qid),
        changed: analysis.changed(q.qid),
        summary: summary,
        summarySemantics: status == null
            ? null
            : MistakeSummary.spoken(number: q.number, chapter: q.chapter, yours: yours, answer: answer, cohort: cohort, status: status),
        repair: status == null
            ? null
            : MistakeRepairEntry(
                number: q.number,
                status: status,
                letter: yours,
                cost: cost,
                onRepair: status == MistakeStatus.keyHeld || status == MistakeStatus.corrected
                    ? null
                    : () => _go(Uri(path: AppRoutes.reviewRepair(attempt.id, q.qid), queryParameters: const {'count': '1'}).toString()),
                onOpenSaved: () => _go(AppRoutes.reviewRepair(attempt.id, q.qid)),
              ),
      ),
    );
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
    // Time per question: the server's own read (`lab.time`) once the detail is here, else the
    // same one time rule over the attempt's record.
    final analysis = SessionAnalysis.of(attempt, serverTime: detail?.lab?.time);
    _onFirstData(attempt);
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
    final rowsSettled = model.hasRows || detail != null || failedKeys;
    final isFresh = _fresh;
    final reduced = Motion.reduced(context);
    final staged = isFresh == true && !_settled && !reduced;
    _scheduleSettle(staged);

    // The rules' inputs: the paper's rows in the order this screen numbers them, the key reviews, the server's repair
    // order, what is repaired and checked, and the balances.
    final subjectId = _publicSubject(attempt);
    final subjectName = subjectNameFor(subjectId, ref.watch(practiceSubjectsProvider).value);
    final rows = MoveAnalysis([
      for (final q in model.questions)
        MoveRow(
          qid: q.qid,
          number: q.number,
          chapter: q.chapter,
          verdict: switch (q.verdict) {
            Verdict.correct => RowVerdict.correct,
            Verdict.wrong => RowVerdict.wrong,
            Verdict.blank => RowVerdict.skipped,
          },
          givenIndex: q.givenIndex,
        ),
    ]);
    final reviews = moveReviewsOf(detail);
    final order = moveOrderOf(detail?.lab?.repairOrder);
    final state = MoveState.watch(ref, attemptId: attempt.id, wrongQids: [for (final q in model.wrong) q.qid]);
    final now = ref.watch(nowProvider)();
    final move = nextMove(
      analysis: rows,
      reviews: reviews,
      order: order,
      repaired: state.repaired,
      checks: state.checks,
      aiCredits: state.aiCredits,
      practiceCredits: state.practiceCredits,
      isPremium: state.isPro,
      mode: attempt.mode,
      subjectName: subjectName,
      labReady: detail?.lab != null,
      hour: now.hour,
    );
    // The receipt waits for the time the server acknowledged; it never shows the attempt's own time meanwhile.
    final receipt = receiptLine(subjectName: subjectName, mode: attempt.mode, at: recordedAt, duration: timeOnPaper(attempt), now: now);
    final notice = keyNotice(reviews, (qid) => model.questions.where((q) => q.qid == qid).firstOrNull?.number);
    final wrong = inRepairOrder(rows.rows.where((r) => r.verdict == RowVerdict.wrong).toList(), order);
    final byQid = {for (final q in model.questions) q.qid: q};
    final shownWrong = _showAll ? wrong : wrong.take(_firstRows).toList();
    final repairCost = repairCostLine(state.aiCredits);
    final proveChapter = model.wrong.isEmpty ? null : ref.watch(replayInventoryProvider(attempt.id)).value?.firstAvailable;
    final m = rows.marks;
    final tone = finishToneFor(
      FinishMarks(correct: attempt.correct, wrong: attempt.wrong, blank: attempt.unattempted, total: attempt.total),
      previousAccuracy: _previousAccuracy(attempt),
    );

    // What is below the head waits for the arrival, then rises in: the list never gives the result away while the score
    // still counts up.
    Widget gate(Widget child) => IgnorePointer(
      ignoring: staged || isFresh == null,
      child: AnimatedOpacity(
        opacity: staged || isFresh == null ? 0 : 1,
        duration: isFresh == true ? Motion.of(context, const Duration(milliseconds: 280)) : Duration.zero,
        curve: Motion.out,
        child: child,
      ),
    );

    final layers = <Widget>[
      // Layer 2: the one next move, why, and what a repair gives before paying.
      const SizedBox(height: MmSpace.s24),
      NextMovePanel(
        move: move,
        onAlt: switch (move.alt) {
          final alt? => switch (MoveNav.forAlt(alt, attemptId: attempt.id, subject: subjectId)) {
            final to? => () => _go(to),
            null => null,
          },
          null => null,
        },
      ),
      // Layer 3: the mistakes, in repair order, each with its repair inline.
      const SizedBox(height: MmSpace.group),
      MistakesHead(
        count: wrong.length,
        repairedCount: wrong.where((r) => state.repaired.contains(r.qid)).length,
        cohort: order?.cohort ?? false,
        nothingAnswered: m.answered == 0,
      ),
      const SizedBox(height: MmSpace.s8),
      for (final r in shownWrong) ...[
        Divider(height: 1, thickness: 1, color: colors.line),
        _row(
          byQid[r.qid]!,
          attempt: attempt,
          detail: detail,
          analysis: analysis,
          status: mistakeStatusOf(qid: r.qid, reviews: reviews, repaired: state.repaired, checks: state.checks, move: move),
          cohort: cohortLine(order, r.qid),
          cost: repairCost,
        ),
      ],
      if (wrong.length > _firstRows) ShowAllRow(count: wrong.length, open: _showAll, onTap: () => setState(() => _showAll = !_showAll)),
      if (model.blank.isNotEmpty)
        LeftBlankRow(
          count: model.blank.length,
          open: _blankOpen,
          onTap: () => setState(() => _blankOpen = !_blankOpen),
          children: [
            for (final q in model.blank) ...[
              Divider(height: 1, thickness: 1, color: colors.line),
              _row(q, attempt: attempt, detail: detail, analysis: analysis),
            ],
          ],
        ),
      // Layer 4: everything else, folded under plain names.
      const SizedBox(height: MmSpace.group),
      const FoldsHeading(),
      if (analysis.observations.isNotEmpty || analysis.dwellMs.isNotEmpty)
        FoldSection(
          id: _Folds.where,
          title: LayersCopy.foldWhere,
          teaser: LayersCopy.answeredRight(m.right, m.answered),
          builder: (_) => ObservationsPanel(analysis: analysis, onShow: _showQuestions),
        ),
      if (proveChapter != null)
        FoldSection(
          id: _Folds.proof,
          title: LayersCopy.foldProof,
          teaser: LayersCopy.proveTeaser(proveChapter),
          builder: (_) => ProveCard(attemptId: attempt.id, subjectId: subjectId),
        ),
      FoldSection(
        id: _Folds.every,
        title: LayersCopy.foldEvery(model.questions.length),
        teaser: LayersCopy.everyTeaser(m.right, m.wrong, m.blank),
        builder: (_) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            NumberedSheet(cells: model.cells, onCellTap: _tapCell),
            if (model.correct.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s20),
              Text(LayersCopy.rightAnswers(model.correct.length), style: context.mmType.cardTitle.copyWith(fontSize: 16)),
              const SizedBox(height: MmSpace.s4),
              ResultPanel(children: [for (final q in model.correct) _row(q, attempt: attempt, detail: detail, analysis: analysis)]),
            ],
          ],
        ),
      ),
      Divider(height: 1, thickness: 1, color: colors.line),
      if (large) ...[
        const SizedBox(height: MmSpace.s24),
        KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: _finish),
      ],
    ];

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
                            child: Builder(
                              builder: (context) => ListView(
                                controller: _scroll,
                                // The app owns this scroll, so it bounces (F3) instead of Android's stretch.
                                physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                                // The last row scrolls fully clear of the fade above the foot.
                                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, BarFade.extent + MmSpace.s16),
                                children: [
                                  // The failure is said first, where the page opens.
                                  if (failedKeys) ...[
                                    ResultLoadFailed(onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true)),
                                    const SizedBox(height: MmSpace.s16),
                                  ],
                                  // Layer 1: what happened. It waits the few milliseconds it takes to know whether this is
                                  // the first open (so the arrival never plays twice or not at all), and for the rows.
                                  if (isFresh != null && rowsSettled)
                                    ResultHead(
                                      receipt: receipt,
                                      marks: m,
                                      scored: attempt.marks,
                                      max: attempt.maxMarks,
                                      costliest: costliestLine(rows, reviews: reviews),
                                      notice: notice,
                                      arrival: isFresh,
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
                                  if (model.hasRows && !failedKeys) gate(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: layers)),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const BarFade(),
                      ],
                    ),
                  ),
                  ResultFoot(
                    primary: ResultFootAction(
                      move.label,
                      () => _go(MoveNav.forMove(move, attemptId: attempt.id, subject: subjectId)),
                      note: LayersCopy.footNote(move.cost),
                    ),
                    showFinish: !large,
                    onFinish: _finish,
                    // After a calm or good set only, and once the arrival is over.
                    lateLine: isFresh != null && !staged && (tone == FinishTone.good || tone == FinishTone.great),
                  ),
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

/// The folds' names in the session's memory.
abstract final class _Folds {
  static const where = 'practice.where';
  static const proof = 'practice.proof';
  static const every = 'practice.every';
}
