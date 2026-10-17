import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/marks_at_stake.dart';
import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/attempt.dart' show AttemptDetail;
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/paper_when.dart';
import '../data/mistake_index.dart' show MistakeStage;
import '../data/repair_run.dart';
import '../data/repair_state.dart';
import '../data/review_providers.dart';
import '../widgets/mistake_view.dart';
import '../widgets/repair_entry_view.dart';
import '../widgets/review_state_view.dart';

/// `/review/repair/:attemptId/:questionId`: the repair flow (spec 5.8). Full screen, no dock,
/// no art: the work layer is calm and solid. Entry, then one mistake at a time, then the
/// ending route.
class RepairScreen extends ConsumerStatefulWidget {
  const RepairScreen({super.key, required this.attemptId, required this.questionId, this.count});

  final String attemptId;
  final String questionId;

  /// How many mistakes the run covers, from `?count=` (Today's duration chips, the result's
  /// repair key). Null means every open mistake in the chapter.
  final int? count;

  @override
  ConsumerState<RepairScreen> createState() => _RepairScreenState();
}

class _RepairScreenState extends ConsumerState<RepairScreen> {
  bool _missing = false;
  bool _opened = false;

  RepairRun get _run => ref.read(repairRunProvider(widget.attemptId).notifier);

  void _tryOpen() {
    if (_opened || ref.read(reviewIndexProvider) == null) return;
    _opened = true;
    final ok = _run.open(widget.questionId, count: widget.count);
    if (!ok && mounted) {
      setState(() => _missing = true);
      return;
    }
    _openSavedAtOnce();
    // The account may already say it holds a repair for this mistake (the detail can be on hand).
    _applySaved(ref.read(attemptDetailProvider(widget.attemptId)).value);
  }

  /// A repair already made opens its saved repair at once: no entry that could offer a paid one,
  /// no try step, the free reopen (F17).
  void _openSavedAtOnce() {
    final run = ref.read(repairRunProvider(widget.attemptId));
    if (run == null || run.phase != RepairPhase.entry || run.retry || run.steps.length != 1 || run.steps.first.item.stage.isOpen) return;
    _run.begin();
  }

  /// Applies what the account says it holds (a saved repair made elsewhere) to this run and to the
  /// phone's own record.
  void _applySaved(AttemptDetail? detail) {
    final saved = detail?.savedRepairs;
    if (saved == null || saved.isEmpty) return;
    unawaited(_run.recordSaved(saved, ref.read(reviewInputsProvider).records));
    if (_run.adoptSaved(saved)) _run.begin();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tryOpen();
      // The wallet line on the entry, and the key rule for answer reviews.
      ref.read(creditsRepositoryProvider.notifier).refresh();
    });
  }

  void _close() => context.canPop() ? context.pop() : context.go(AppRoutes.review);

  @override
  Widget build(BuildContext context) {
    ref.listen(reviewIndexProvider, (_, next) {
      if (next != null) _tryOpen();
    });
    // The account's saved repairs arrive with the paper's detail: a mistake it already holds opens
    // as a saved repair, never as a paid one.
    ref.listen(attemptDetailProvider(widget.attemptId).select((s) => s.value?.savedRepairs), (_, next) {
      if (_opened && next != null) _applySaved(ref.read(attemptDetailProvider(widget.attemptId)).value);
    });
    ref.listen(repairRunProvider(widget.attemptId).select((s) => s?.phase), (prev, phase) {
      if (phase == RepairPhase.ending && prev != RepairPhase.ending && mounted) {
        context.pushReplacement(AppRoutes.reviewRepairEnding(widget.attemptId));
      }
    });

    final colors = context.mmColors;
    final run = ref.watch(repairRunProvider(widget.attemptId));
    final active = run != null && (run.steps.any((s) => s.item.questionId == widget.questionId) || run.phase == RepairPhase.working);

    Widget body;
    if (_missing) {
      body = ReviewStateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: ReviewCopy.notFound,
        primary: StateAction(ReviewCopy.backToReview, () => context.go(AppRoutes.review)),
      );
    } else if (!active || run.phase == RepairPhase.ending || _isReopenEntry(run)) {
      body = Center(
        child: Semantics(label: ReviewCopy.loadingRepair, liveRegion: true, child: MmSpinner(color: context.mmColors.ink2)),
      );
    } else if (run.phase == RepairPhase.entry) {
      body = _entry(run);
    } else {
      body = _mistake(run);
    }

    return PopScope(
      canPop: run == null || run.phase != RepairPhase.working || run.repairedCount == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _run.finish();
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          // The entry hands over to the run (and the run to its ending) in 160 ms with the two
          // overlapping, so no frame is ever blank, and the leaving one takes no touch. Within the
          // run the page stays: MistakeView moves only the mistake itself, so the track and the key
          // carry on from one mistake to the next.
          child: MmOverlapSwitcher(
            duration: Motion.of(context, Motion.runner),
            outDuration: Motion.of(context, const Duration(milliseconds: 90)),
            child: KeyedSubtree(key: ValueKey(_stage(run, active)), child: body),
          ),
        ),
      ),
    );
  }

  /// A saved repair waiting at the entry: it opens at once, so the entry (which could talk about a
  /// cost) is never drawn for it.
  bool _isReopenEntry(RepairRunState run) =>
      run.phase == RepairPhase.entry && !run.retry && run.steps.length == 1 && !run.steps.first.item.stage.isOpen;

  /// What the screen is showing, for the hand-over between its stages: a new mistake of the run is
  /// not a new stage.
  String _stage(RepairRunState? run, bool active) {
    if (_missing) return 'missing';
    if (run == null || !active || run.phase == RepairPhase.ending || _isReopenEntry(run)) return 'loading';
    return run.phase.name;
  }

  /// With nothing done yet there is nothing to end on: close and keep the place.
  void _finishForNow(RepairRunState run) {
    final touched = run.steps.any((s) => s.outcome != null && s.outcome is! OutcomeLoading && s.outcome is! OutcomeFailed);
    if (touched) {
      _run.finish();
    } else {
      _close();
    }
  }

  Widget _entry(RepairRunState run) {
    final credits = ref.watch(creditsRepositoryProvider).value;
    final plan = EntryPlan.of(run.steps.length, credits, ref.watch(reviewClockProvider));
    final clock = ref.watch(reviewClockProvider);
    return RepairEntryView(
      run: run,
      plan: plan,
      attempted: run.steps.isEmpty ? null : ReviewCopy.attemptedAt(whenText(clock, run.steps.first.item.foundAt)),
      onClose: _close,
      onBegin: () => _run.begin(limit: plan.limit, keyOnly: plan.keyOnly),
      onReadKeys: () => _run.begin(keyOnly: true),
    );
  }

  /// The track and the swipe: back to a mistake already reached, with one selection tick.
  bool _goTo(int i) {
    final moved = _run.goTo(i);
    if (moved) ref.read(hapticsProvider).tick();
    return moved;
  }

  /// The newest other paper where this question was also answered wrong, from the student's own
  /// attempts. Null when it was missed once.
  EarlierMiss? _earlier(RepairRunState run) {
    final index = ref.watch(reviewIndexProvider);
    final item = run.current?.item;
    if (index == null || item == null) return null;
    final others = index.missedElsewhere(item);
    if (others.isEmpty) return null;
    final last = others.first;
    final clock = ref.watch(reviewClockProvider);
    return EarlierMiss(
      line: ReviewCopy.missedBefore(last.source, formatDayMonth(clock.local(last.foundAt))),
      onOpen: () => context.push(AppRoutes.result(last.attemptId)),
    );
  }

  Widget _mistake(RepairRunState run) {
    final index = ref.watch(reviewIndexProvider);
    final detail = ref.watch(attemptDetailProvider(widget.attemptId)).value;
    final credits = ref.watch(creditsRepositoryProvider).value;
    final clock = ref.watch(reviewClockProvider);
    final reset = credits?.resetAt;
    return MistakeView(
      run: run,
      question: questionIn(index?.attempt(widget.attemptId), run.current!.item.questionId),
      detail: detail,
      scheme: markingSchemeOf(index?.attempt(widget.attemptId)),
      renewDate: reset == null ? null : formatDayMonth(clock.local(reset)),
      earlier: _earlier(run),
      attempted: paperWhen(clock, run.current!.item.source, run.current!.item.foundAt),
      savedWhen: run.current!.item.stageAt == null || run.current!.item.stage != MistakeStage.repaired ? null : whenText(clock, run.current!.item.stageAt!),
      // What "Check my answer" costs, said before the paid call: the key explanation is free, an
      // unknown balance never shows as zero.
      tryNote: run.keyOnly
          ? ReviewCopy.keyExplanationFree
          : credits?.explanationBalance == null
              ? null
              : ReviewCopy.reasonCost(credits!.explanationBalance!),
      actions: MistakeActions(
        onNext: _run.next,
        onFinishForNow: () => _finishForNow(run),
        onRetry: _run.retry,
        onReadKey: _run.readKey,
        onGoTo: _goTo,
        onSelectTry: _run.selectTry,
        onCheckTry: _run.confirmTry,
        onSkipTry: _run.skipTry,
      ),
    );
  }
}
