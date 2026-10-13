import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/state_words.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../../you/you_providers.dart' show lateNightLinesProvider;
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/repair_run.dart';
import '../data/review_providers.dart';
import '../widgets/ending_sheet.dart';
import '../widgets/life_row.dart';
import '../data/ending_model.dart';

/// `/review/repair/:attemptId/ending` (spec 5.8 ending, celebration L1/L2): the handed-back
/// sheet with tonight's repairs ringing in, the count, the life row, the receipt from the last
/// acknowledgement, one Mobi hop, and the next move. Nothing here claims the repair holds.
class RepairEndingScreen extends ConsumerStatefulWidget {
  const RepairEndingScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<RepairEndingScreen> createState() => _RepairEndingScreenState();
}

class _RepairEndingScreenState extends ConsumerState<RepairEndingScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  bool _started = false;
  bool _lifeInked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final model = _model();
    final celebrate = model.repaired > 0 && ref.read(celebrationModeProvider) == CelebrationMode.full;
    if (!celebrate || Motion.reduced(context)) {
      _ink.value = 1;
      _lifeInked = true;
    } else {
      // The sheet arrives (320 ms), then the rings draw, then the life row inks.
      Future<void>.delayed(Motion.result, () {
        if (mounted) _ink.forward();
      });
      _ink.addStatusListener((s) {
        if (s == AnimationStatus.completed && mounted) setState(() => _lifeInked = true);
      });
    }
    // Every count here is a server acknowledgement, so the success pattern may fire once.
    if (model.repaired > 0 && ref.read(celebrationModeProvider) != CelebrationMode.off) unawaited(ref.read(hapticsProvider).success());
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  EndingModel _model() =>
      EndingModel.of(attemptId: widget.attemptId, run: ref.read(repairRunProvider(widget.attemptId)), index: ref.read(reviewIndexProvider));

  void _finish() => context.go(AppRoutes.review);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final clock = ref.watch(reviewClockProvider);
    ref.watch(reviewIndexProvider);
    final model = _model();
    final index = ref.read(reviewIndexProvider);
    final attempt = index?.attempt(widget.attemptId);
    final full = ref.watch(celebrationModeProvider) == CelebrationMode.full;
    final lateNight = clock.isLateNight && ref.watch(lateNightLinesProvider);
    final next = index?.nextAfter(widget.attemptId, model.touchedKeys);
    final ackedAt = model.lastAckedAt;
    final nothing = model.repaired == 0;
    final mobiLine = !model.repairedBefore && !nothing
        ? ReviewCopy.firstRepair
        : (lateNight && !nothing ? ReviewCopy.goodPlaceToStop(clock.now()) : null);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish();
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: Stack(
          children: [
            Positioned.fill(child: LampScene(strength: nothing ? 0.5 : 1)),
            Positioned.fill(
              child: IgnorePointer(child: Grain(opacity: colors.grain)),
            ),
            SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s12, MmSpace.cardGutter, MmSpace.s16),
                      children: [
                        if (attempt != null)
                          _Arrive(
                            child: EndingSheet(
                              title: '${model.source}, ${subjectName(model.subjectId)}',
                              cells: sheetCells(attempt, repairedNow: model.repairedNowIds, repairedBefore: model.repairedEarlierIds),
                              progress: _ink,
                              firstRepair: !model.repairedBefore && !nothing,
                            ),
                          ),
                        const SizedBox(height: MmSpace.s20),
                        if (nothing) ...[
                          Semantics(header: true, child: Text(ReviewCopy.nothingRepairedTitle, style: type.headline)),
                          const SizedBox(height: MmSpace.s8),
                          Text(ReviewCopy.nothingRepaired(model.setAside, model.reviewed), style: type.body.copyWith(color: colors.ink2)),
                        ] else ...[
                          // Mobi celebrates beside the number, not squeezed above the keys.
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Expanded(
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: MonumentalNumber(
                                    value: '${model.repaired}',
                                    unit: 'repaired',
                                    roll: full,
                                    semanticsLabel: '${model.repaired} ${ReviewCopy.endingUnit(model.repaired)}',
                                  ),
                                ),
                              ),
                              if (full) const MobiCharacter(size: 96, entrance: MobiAct.celebrate, seed: 19),
                            ],
                          ),
                          const SizedBox(height: MmSpace.s8),
                          Text(
                            ReviewCopy.endingLine(
                              model.chapter,
                              model.repaired,
                              model.total,
                              now: clock.now(),
                              setAside: model.setAside,
                              reviewed: model.reviewed,
                            ),
                            style: type.lead,
                          ),
                          const SizedBox(height: MmSpace.s16),
                          LifeRow(stage: _lifeInked ? MistakeStage.repaired : MistakeStage.found),
                          const SizedBox(height: MmSpace.s12),
                          Text(ReviewCopy.checkedLater, style: type.small.copyWith(color: colors.ink2)),
                          const SizedBox(height: MmSpace.s12),
                          ackedAt == null ? const ReceiptLine.pending() : ReceiptLine(text: Receipts.repairFinished(clock.local(ackedAt))),
                        ],
                        if (mobiLine != null) ...[
                          const SizedBox(height: MmSpace.s16),
                          Text(mobiLine, style: type.body),
                        ],
                        const SizedBox(height: MmSpace.s24),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (next != null) ...[
                          KeyButton(
                            label: ReviewCopy.repairMore(next.items.length),
                            semanticsLabel:
                                '${ReviewCopy.repairMore(next.items.length)}. ${ReviewCopy.repairMoreLine(next.chapter, repairMinutes(next.items.length))}',
                            onPressed: () => context.pushReplacement(AppRoutes.reviewRepair(next.attemptId, next.items.first.questionId)),
                          ),
                          const SizedBox(height: MmSpace.s4),
                          ExcludeSemantics(
                            child: Text(
                              ReviewCopy.repairMoreLine(next.chapter, repairMinutes(next.items.length)),
                              style: type.caption.copyWith(color: colors.ink2),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          Align(
                            child: KeyButton.quiet(label: ReviewCopy.finishFor(clock.now()), onPressed: _finish),
                          ),
                        ] else
                          KeyButton(label: ReviewCopy.finishFor(clock.now()), onPressed: _finish),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The ending's one entrance: 320 ms, rising 12 dp into place. Reduced motion shows it at once.
class _Arrive extends StatefulWidget {
  const _Arrive({required this.child});

  final Widget child;

  @override
  State<_Arrive> createState() => _ArriveState();
}

class _ArriveState extends State<_Arrive> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.result);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.value > 0 || _c.isAnimating) return;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
    child: AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = Motion.emphasized.transform(_c.value);
        return Opacity(
          opacity: t,
          child: Transform.translate(offset: Offset(0, 12 * (1 - t)), child: child),
        );
      },
    ),
  );
}
