import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/state_words.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/platform/review_prompt.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart'
    show CelebrationMode, CelebrationScope, CelebrationSlot, celebrationControllerProvider, celebrationModeProvider, rhythmVisibleProvider;
import '../../you/you_providers.dart' show lateNightLinesProvider;
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/repair_run.dart';
import '../data/review_providers.dart';
import '../widgets/ending_sheet.dart';
import '../widgets/foil_burst.dart';
import '../widgets/life_row.dart';
import '../widgets/share_card.dart';
import '../data/ending_model.dart';

/// `/review/repair/:attemptId/ending` (spec 5.8 ending, celebration L1/L2): the handed-back
/// sheet with tonight's repairs ringing in, the count, the life row, the receipt from the last
/// acknowledgement, one proud Mobi, and the next move. Nothing here claims the repair holds.
///
/// The `repairFinished` moment is fired from here, after the first frame, into the
/// `CelebrationSlot` this screen mounts in the receipt's place, so it is never spent unseen.
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

  /// The full celebration is playing (rings, a tick per ring, the foil burst): only when the
  /// student has it on, something was repaired, and motion is not reduced.
  bool _celebrating = false;
  int _ticked = 0;
  Timer? _reviewAsk;

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
      _celebrating = true;
      // The sheet arrives (320 ms), then the rings draw one by one (each with a tick), then the
      // thread draws to Repaired and the foil burst plays once.
      Future<void>.delayed(Motion.result, () {
        if (mounted) _ink.forward();
      });
      final rings = model.repairedNowIds.length;
      _ink.addListener(() {
        if (!mounted || rings == 0 || _ticked >= math.min(rings, 6)) return;
        if (_ink.value >= _ticked / (rings + 1)) {
          _ticked++;
          unawaited(ref.read(hapticsProvider).tick());
        }
      });
      _ink.addStatusListener((s) {
        if (s == AnimationStatus.completed && mounted) setState(() => _lifeInked = true);
      });
    }
    if (model.repaired > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_celebrate()));
      // A finished repair is a good moment for the store review ask, once the celebration has
      // played. The prompt itself decides whether it is allowed (3 days in, once in 60 days).
      _reviewAsk = Timer(const Duration(seconds: 4), () {
        if (mounted) unawaited(ref.read(reviewPromptProvider).maybeAsk(ReviewMoment.repairFinished));
      });
    }
  }

  /// Fires the moment now that its slot is on screen. A Full moment opens with its own haptic;
  /// otherwise every count here is a server acknowledgement, so the success pattern fires once.
  Future<void> _celebrate() async {
    if (!mounted) return;
    final shown = await ref.read(repairRunProvider(widget.attemptId).notifier).celebrateEnding();
    if (!mounted || (shown != null && !shown.textOnly)) return;
    if (ref.read(celebrationModeProvider) != CelebrationMode.off) unawaited(ref.read(hapticsProvider).success());
  }

  @override
  void dispose() {
    _reviewAsk?.cancel();
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
    // A repair answered after the ending came up is added to the run: the count follows it.
    ref.watch(repairRunProvider(widget.attemptId));
    final model = _model();
    final index = ref.read(reviewIndexProvider);
    final attempt = index?.attempt(widget.attemptId);
    final full = ref.watch(celebrationModeProvider) == CelebrationMode.full;
    final lateNight = clock.isLateNight && ref.watch(lateNightLinesProvider);
    final next = index?.nextAfter(widget.attemptId, model.touchedKeys);
    final ackedAt = model.lastAckedAt;
    final nothing = model.repaired == 0;
    // The fired moment takes the receipt's place and, for a first repair, says so with its own
    // sentence and Mobi hop; the screen then leaves those out rather than say them twice.
    final scope = CelebrationScope.repair(widget.attemptId);
    final moment = ref.watch(celebrationControllerProvider.select((s) => s.byScope[scope]));
    final momentShown = moment != null && moment.showsMoment && ref.watch(rhythmVisibleProvider);
    final momentSays = momentShown && moment.sentence != null;
    // A first repair with no fired moment gets the same card the moment would draw (sentence and
    // receipt together), so the message looks the same either way.
    final firstCard = !model.repairedBefore && !nothing && !momentShown;
    final mobiLine = firstCard
        ? null
        : !model.repairedBefore && !nothing
        ? (momentSays ? null : ReviewCopy.firstRepair)
        : (lateNight && !nothing ? ReviewCopy.goodPlaceToStop(clock.now()) : null);
    final receipt = ackedAt == null ? const ReceiptLine.pending() : ReceiptLine(text: Receipts.repairFinished(clock.local(ackedAt)));

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
                          // Mobi stands proud beside the number (the repair is acknowledged by the server), not
                          // squeezed above the keys.
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              // Behind the number, never over it: the foil burst plays once when the
                              // rings have all drawn.
                              if (_celebrating)
                                Positioned(left: -40, right: -40, top: -90, bottom: -90, child: FoilBurst(play: _lifeInked)),
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
                                  if (full && !(momentShown && moment.mobiHop))
                                    const MobiCharacter(size: 96, entrance: MobiAct.proud, seed: 19),
                                ],
                              ),
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
                          if (momentShown)
                            CelebrationSlot(scope: scope)
                          else if (firstCard)
                            _FirstRepairCard(receipt: receipt)
                          else
                            receipt,
                          const SizedBox(height: MmSpace.s12),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: KeyButton.secondary(
                              label: 'Share a card',
                              expanded: false,
                              minHeight: MmTarget.min,
                              onPressed: () => unawaited(
                                showShareCardSheet(
                                  context,
                                  data: ShareCardData.repair(repaired: model.repaired, day: clock.now(), subject: subjectName(model.subjectId)),
                                ),
                              ),
                            ),
                          ),
                        ],
                        if (mobiLine != null) ...[
                          const SizedBox(height: MmSpace.s16),
                          Text(mobiLine, style: type.body),
                        ],
                        // The pinned keys below carry their own top padding: a taller spacer here
                        // left Share a card floating above a dead gap.
                        const SizedBox(height: MmSpace.s4),
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

/// The first-repair message as a card: the sentence and the receipt, in the same raised panel
/// the fired moment uses.
class _FirstRepairCard extends StatelessWidget {
  const _FirstRepairCard({required this.receipt});

  final Widget receipt;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return SizedBox(
      width: double.infinity,
      child: MmSurface.plain(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(container: true, header: true, child: Text(ReviewCopy.firstRepair, style: type.subhead)),
            const SizedBox(height: MmSpace.s4),
            receipt,
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
