import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/formatters.dart' show formatTime12;
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
import '../widgets/review_bits.dart' show FlushKey;
import '../widgets/share_card.dart';
import '../data/ending_model.dart';

/// `/review/repair/:attemptId/ending` (spec 5.8 ending, celebration L1/L2): the handed-back
/// sheet with tonight's repairs ringing in, the count, the life row, the receipt from the last
/// acknowledgement, one proud Mobi, and the next move. Nothing here claims the repair holds.
///
/// The beat, when the celebration is on: the sheet arrives, the rings draw one by one, the thread
/// lights its Repaired node, and then, together, the number lands with a small pop, the foil burst
/// opens behind it (centred on the digits, under the type) and Mobi stands proud.
///
/// The `repairFinished` moment is fired from here, after the first frame, into the
/// `CelebrationSlot` this screen mounts in the receipt's place, so it is never spent unseen.
class RepairEndingScreen extends ConsumerStatefulWidget {
  const RepairEndingScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<RepairEndingScreen> createState() => _RepairEndingScreenState();
}

class _RepairEndingScreenState extends ConsumerState<RepairEndingScreen> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  /// The number's pop on the beat: a small swell and settle, 360 ms.
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 360));
  final MobiController _mobi = MobiController();
  bool _started = false;

  /// The thread has lit its Repaired node (before the rings finish, so it leads the beat).
  bool _lifeInked = false;

  /// The beat has landed: the burst plays, the number pops and Mobi stands proud.
  bool _beat = false;

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
      _beat = true;
    } else {
      _celebrating = true;
      // The sheet arrives (320 ms), then the rings draw one by one (each with a tick). The thread
      // lights Repaired at 60% of the rings, so it leads; when the last ring closes the beat lands.
      Future<void>.delayed(Motion.result, () {
        if (mounted) _ink.forward();
      });
      final rings = model.repairedNowIds.length;
      _ink.addListener(() {
        if (!mounted) return;
        if (!_lifeInked && _ink.value >= 0.6) setState(() => _lifeInked = true);
        if (rings == 0 || _ticked >= math.min(rings, 6)) return;
        if (_ink.value >= _ticked / (rings + 1)) {
          _ticked++;
          unawaited(ref.read(hapticsProvider).tick());
        }
      });
      _ink.addStatusListener((s) {
        if (s == AnimationStatus.completed && mounted) {
          setState(() {
            _lifeInked = true;
            _beat = true;
          });
          _pop.forward(from: 0);
          _mobi.play(MobiAct.proud);
        }
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
    _pop.dispose();
    _mobi.dispose();
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
    // What is still open in this chapter, across papers: the one fact the number does not carry.
    int? left;
    if (index != null && model.chapter.isNotEmpty) {
      left = 0;
      for (final g in index.openGroups) {
        if (g.chapter == model.chapter && g.subjectId == model.subjectId) left = g.openCount;
      }
    }
    // After nothing was repaired, the same mistakes can be tried again: the first one still open.
    final retry = nothing && index != null ? index.openIn(widget.attemptId, model.chapter) : const <MistakeItem>[];
    // The fired moment takes the receipt's place and, for a first repair, says so with its own
    // sentence and Mobi hop; the screen then leaves those out rather than say them twice.
    final scope = CelebrationScope.repair(widget.attemptId);
    final moment = ref.watch(celebrationControllerProvider.select((s) => s.byScope[scope]));
    final momentShown = moment != null && moment.showsMoment && ref.watch(rhythmVisibleProvider);
    final momentSays = momentShown && moment.sentence != null;
    // A first repair with no fired moment says so in plain type, with the recorded line under it:
    // the same words the moment would draw, with no box around them.
    final firstNote = !model.repairedBefore && !nothing && !momentShown;
    final mobiLine = firstNote
        ? null
        : !model.repairedBefore && !nothing
        ? (momentSays ? null : ReviewCopy.firstRepair)
        : (lateNight && !nothing ? ReviewCopy.goodPlaceToStop(clock.now()) : null);
    final receipt = ackedAt == null
        ? const ReceiptLine.pending()
        : ReceiptLine(
            text: ReviewCopy.bindTime(firstNote ? 'Recorded at ${formatTime12(clock.local(ackedAt))}.' : Receipts.repairFinished(clock.local(ackedAt))),
          );

    final showMobi = full && !(momentShown && moment.mobiHop);

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
                    child: CustomScrollView(
                      slivers: [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s12, MmSpace.cardGutter, MmSpace.s16),
                          // The hero and the sheet sit at the top; the close (what was recorded, and
                          // sharing) sits at the bottom, just above the key. Short content leaves its
                          // air between the two, on purpose.
                          sliver: SliverFillRemaining(
                            hasScrollBody: false,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
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
                                if (nothing) ...[
                                  // The hero sits in the air under the sheet, not stuck to it.
                                  const Spacer(flex: 2),
                                  _NothingHero(
                                    title: ReviewCopy.nothingRepairedTitle,
                                    line: ReviewCopy.nothingRepaired(model.setAside, model.reviewed),
                                    showMobi: full,
                                  ),
                                ] else ...[
                                  const SizedBox(height: MmSpace.s24),
                                  _NumberHero(
                                    value: model.repaired,
                                    roll: full,
                                    pop: _pop,
                                    burstPlay: _celebrating && _beat,
                                    celebrating: _celebrating,
                                    mobi: showMobi
                                        ? MobiCharacter(
                                            size: 96,
                                            controller: _mobi,
                                            // Standing at rest until the beat, then proud; with the
                                            // celebration off or motion reduced, proud at once.
                                            entrance: _celebrating ? MobiAct.rest : MobiAct.proud,
                                            seed: 19,
                                          )
                                        : null,
                                  ),
                                  const SizedBox(height: MmSpace.s12),
                                  Text(
                                    ReviewCopy.endingFact(model.chapter, left, setAside: model.setAside, reviewed: model.reviewed),
                                    style: type.lead,
                                  ),
                                  const SizedBox(height: MmSpace.s20),
                                  LifeRow(stage: _lifeInked ? MistakeStage.repaired : MistakeStage.found),
                                  const SizedBox(height: MmSpace.s12),
                                  Text(ReviewCopy.checkedLater, style: type.small.copyWith(color: colors.ink2)),
                                ],
                                Spacer(flex: nothing ? 3 : 1),
                                if (!nothing) ...[
                                  const SizedBox(height: MmSpace.s24),
                                  if (mobiLine != null) ...[
                                    Text(mobiLine, style: type.body),
                                    const SizedBox(height: MmSpace.s12),
                                  ],
                                  if (momentShown)
                                    CelebrationSlot(scope: scope)
                                  else if (firstNote)
                                    _FirstRepairNote(receipt: receipt)
                                  else
                                    receipt,
                                  const SizedBox(height: MmSpace.s4),
                                  FlushKey(
                                    label: 'Share a card',
                                    onPressed: () => unawaited(
                                      showShareCardSheet(
                                        context,
                                        data: ShareCardData.repair(repaired: model.repaired, day: clock.now(), subject: subjectName(model.subjectId)),
                                      ),
                                    ),
                                  ),
                                ],
                                // The pinned keys below carry their own top padding: a taller spacer here
                                // left Share a card floating above a dead gap.
                                const SizedBox(height: MmSpace.s4),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (retry.isNotEmpty) ...[
                          KeyButton(
                            label: ReviewCopy.tryAgainKey,
                            semanticsLabel: '${ReviewCopy.tryAgainKey}. ${ReviewCopy.repairMoreLine(model.chapter, repairMinutes(retry.length))}',
                            onPressed: () => context.pushReplacement(AppRoutes.reviewRepair(widget.attemptId, retry.first.questionId)),
                          ),
                          const SizedBox(height: MmSpace.s4),
                          ExcludeSemantics(
                            child: Text(
                              ReviewCopy.repairMoreLine(model.chapter, repairMinutes(retry.length)),
                              style: type.caption.copyWith(color: colors.ink2),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          Align(
                            child: KeyButton.quiet(label: ReviewCopy.finishFor(clock.now()), onPressed: _finish),
                          ),
                        ] else if (next != null) ...[
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

/// The count as the hero: the digits and their unit, with Mobi at the right. On the beat the
/// number swells a little and settles ([pop]) while the foil burst opens behind it, centred on the
/// digits and drawn under the type.
class _NumberHero extends StatelessWidget {
  const _NumberHero({required this.value, required this.roll, required this.pop, required this.burstPlay, required this.celebrating, this.mobi});

  final int value;
  final bool roll;
  final Animation<double> pop;
  final bool burstPlay;

  /// The celebration is on (so the burst is mounted at all).
  final bool celebrating;
  final Widget? mobi;

  static const double _burstBox = 260;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    // The digits sit in fixed-width slots of the hero size: the burst is centred on that block.
    final base = type.hero;
    final size = MediaQuery.textScalerOf(context).scale(base.fontSize ?? 112);
    final probe = TextPainter(
      text: TextSpan(text: '0', style: base.copyWith(fontSize: size)),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    final digitsWidth = probe.width * '$value'.length;
    final slotHeight = probe.height;
    probe.dispose();

    final number = MonumentalNumber(
      value: '$value',
      unit: 'repaired',
      roll: roll,
      semanticsLabel: '$value ${ReviewCopy.endingUnit(value)}',
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Behind the number, never over it.
                if (celebrating)
                  Positioned(
                    left: digitsWidth / 2 - _burstBox / 2,
                    top: slotHeight / 2 - _burstBox / 2,
                    width: _burstBox,
                    height: _burstBox,
                    child: FoilBurst(play: burstPlay, origin: Alignment.center),
                  ),
                AnimatedBuilder(
                  animation: pop,
                  child: number,
                  builder: (context, child) {
                    // 1 to 1.06 and back: easing out up, easing in down.
                    final t = pop.value;
                    final swell = t <= 0 || t >= 1 ? 0.0 : math.sin(math.pi * Curves.easeOutCubic.transform(t));
                    return Transform.scale(scale: 1 + 0.06 * swell, alignment: Alignment.centerLeft, child: child);
                  },
                ),
              ],
            ),
          ),
        ),
        if (mobi != null) ...[const SizedBox(width: MmSpace.s8), mobi!],
      ],
    );
  }
}

/// Nothing was repaired: the same hero grammar as the other endings (the sheet above, Mobi at the
/// right, one large word), calm and short. Mobi leans in, never sad.
class _NothingHero extends StatelessWidget {
  const _NothingHero({required this.title, required this.line, required this.showMobi});

  final String title;
  final String line;
  final bool showMobi;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(title, style: type.display.copyWith(fontSize: 44, height: 46 / 44)),
              ),
            ),
            if (showMobi) ...[const SizedBox(width: MmSpace.s8), const Mobi(pose: MobiPose.encourage, size: 132, motion: MobiMotion.settle)],
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        Text(line, style: type.lead.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The first-repair message on the ground, no box: the sentence, then what was recorded and when.
class _FirstRepairNote extends StatelessWidget {
  const _FirstRepairNote({required this.receipt});

  final Widget receipt;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(container: true, header: true, child: Text(ReviewCopy.firstRepair, style: type.headline.copyWith(fontSize: 22, height: 26 / 22))),
        const SizedBox(height: MmSpace.s8),
        receipt,
      ],
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
