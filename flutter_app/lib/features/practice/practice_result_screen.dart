import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/analytics/analytics.dart';
import '../../core/models/models.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/attempts_repository.dart';
import '../../core/repositories/pending_result_repository.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../insights/data/saved_repository.dart' show SaveDone, SaveLimitReached, SaveFailed, saveControllerProvider, savedRepositoryProvider;
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

  void _jumpTo(ResultQuestion q) {
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
    final wrong = model.wrong;
    if (wrong.isNotEmpty) {
      // Mistake Repair, starting at the first wrong answer and walking the rest of this set.
      final location = Uri(
        path: AppRoutes.reviewRepair(attempt.id, wrong.first.qid),
        queryParameters: {'count': '${wrong.length}'},
      ).toString();
      return ResultFootAction(PracticeCopy.repairThese(wrong.length), () => context.push(location));
    }
    if (model.blank.isNotEmpty) {
      return ResultFootAction(PracticeCopy.tryTheBlanks, () => _jumpTo(model.blank.first));
    }
    final location = Uri(path: AppRoutes.practiceSetup('chapter'), queryParameters: {'subject': _publicSubject(attempt)}).toString();
    return ResultFootAction(PracticeCopy.practiseAnotherChapter, () => context.go(location));
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

    if (_finished) return ResultClosing(text: PracticeCopy.finished(recordedAt ?? attempt.completedAt.toLocal()));

    final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
    final failedKeys = detail == null && detailState.error != null && !detailState.loading;
    final marks = FinishMarks(correct: attempt.correct, wrong: attempt.wrong, blank: attempt.unattempted, total: attempt.total);

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
                        child: ListView(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                          children: [
                            // The moment waits the few milliseconds it takes to know whether
                            // this is the first open, so it never plays twice or not at all.
                            if (fresh.hasValue)
                              FinishStage(
                                marks: marks,
                                cells: model.cells,
                                tone: finishToneFor(marks, previousAccuracy: _previousAccuracy(attempt)),
                                recordedAt: recordedAt,
                                fresh: fresh.requireValue,
                                subject: subjectNameFor(_publicSubject(attempt), ref.watch(practiceSubjectsProvider).value),
                                chapter: chapter,
                                onCellTap: model.hasRows ? _tapCell : null,
                              )
                            else
                              const SizedBox(height: 320),
                            if (detailState.isStale && detailState.fetchedAt != null) ...[
                              const SizedBox(height: MmSpace.s12),
                              Text(
                                PracticeCopy.lastLoaded(detailState.fetchedAt!.toLocal()),
                                style: context.mmType.small.copyWith(color: colors.ink3),
                              ),
                            ],
                            if (failedKeys) ...[
                              const SizedBox(height: MmSpace.s20),
                              ResultLoadFailed(onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true)),
                            ],
                            if (model.hasRows && !failedKeys) ...[
                              const SizedBox(height: MmSpace.group),
                              ResultList(
                                model: model,
                                controller: _list,
                                keyFor: (qid) => KeyView.of(detail, qid),
                                saveFor: _saveFor,
                                reportFor: (q) => _reportFor(attempt, detail, q),
                                analysis: analysis,
                              ),
                            ],
                            // After the answers: what the set shows as a whole, then the way to prove
                            // a repair held. Each claim opens the questions behind it.
                            if (model.hasRows) ObservationsPanel(analysis: analysis, onShow: (numbers) => _tapCell(numbers.first - 1)),
                            if (model.wrong.isNotEmpty) ProveCard(attemptId: attempt.id, subjectId: _publicSubject(attempt)),
                            if (large) ...[
                              const SizedBox(height: MmSpace.s24),
                              KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: _finish),
                            ],
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
