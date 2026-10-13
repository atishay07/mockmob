import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/repair_run.dart';
import '../data/repair_state.dart';
import '../data/review_providers.dart';
import '../widgets/mistake_view.dart';
import '../widgets/repair_entry_view.dart';

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
    if (!ok && mounted) setState(() => _missing = true);
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
      body = StateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: ReviewCopy.notFound,
        primary: StateAction(ReviewCopy.mistakesTitle, () => context.go(AppRoutes.review)),
      );
    } else if (!active || run.phase == RepairPhase.ending) {
      body = Center(child: MmSpinner(color: context.mmColors.ink2));
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
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.ui),
            switchInCurve: Motion.glide,
            switchOutCurve: Motion.exit,
            child: KeyedSubtree(key: ValueKey('${run?.phase}-${run?.current?.item.key}'), child: body),
          ),
        ),
      ),
    );
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
    return RepairEntryView(
      run: run,
      plan: plan,
      onClose: _close,
      onBegin: () => _run.begin(limit: plan.limit, keyOnly: plan.keyOnly),
      onReadKeys: () => _run.begin(keyOnly: true),
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
      renewLine: reset == null ? null : ReviewCopy.renewsOn(formatDayMonth(clock.local(reset))),
      actions: MistakeActions(onNext: _run.next, onFinishForNow: () => _finishForNow(run), onRetry: _run.retry, onReadKey: _run.readKey),
    );
  }
}
