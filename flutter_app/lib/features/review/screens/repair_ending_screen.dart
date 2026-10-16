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
import '../data/repair_state.dart';
import '../data/review_providers.dart';
import '../widgets/ending_sheet.dart';
import '../widgets/foil_burst.dart';
import '../widgets/life_row.dart';
import '../again/review_again_copy.dart';
import '../widgets/review_bits.dart' show FlushKey;
import '../widgets/review_layout.dart';
import '../widgets/review_moment.dart';
import '../widgets/share_card.dart';
import '../data/ending_model.dart';

/// `/review/repair/:attemptId/ending` (spec 5.8 ending, celebration L1/L2): the handed-back
/// sheet with tonight's repairs ringing in, the count, the life row, the receipt from the last
/// acknowledgement, one proud Mobi, and the next move. Nothing here claims the repair holds.
///
/// The beat, when the celebration is on (a T2 moment, [RepairEndingTiming]): the sheet arrives, the
/// rings draw one by one (at most three ticks), the thread draws to its Repaired node, the number
/// rolls in, and as it lands the foil burst opens behind it (centred on the digits, under the
/// type, with no bloom and no sweep) and Mobi stands proud.
///
/// The `repairFinished` moment is fired from here, after the first frame, into the
/// `CelebrationSlot` this screen mounts in the receipt's place, so it is never spent unseen.
class RepairEndingScreen extends ConsumerStatefulWidget {
  const RepairEndingScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<RepairEndingScreen> createState() => _RepairEndingScreenState();
}

/// The ending's beat, from the first frame. The moment is the rings through the end of the burst
/// and stays inside the T2 ceiling of 1200 ms (MOTION.md 1.2); the sheet's own arrival comes
/// before it.
abstract final class RepairEndingTiming {
  /// The handed-back sheet rises in.
  static const Duration arrive = Motion.result;

  /// The rings start drawing, and take this long between them.
  static const Duration ringsStart = Duration(milliseconds: 200);
  static const Duration rings = Duration(milliseconds: 400);

  /// The number holds this long, then rolls for [Motion.numberRoll] and lands.
  static const Duration numberDelay = Duration(milliseconds: 300);
  static const Duration numberLands = Duration(milliseconds: 300 + 500);

  /// The burst opens as the number lands.
  static const Duration end = Duration(milliseconds: 300 + 500 + 600);

  /// Rings, roll and burst together: the length of the moment.
  static const Duration moment = Duration(milliseconds: 300 + 500 + 600 - 200);

  /// At most this many selection ticks while the rings draw.
  static const int maxRingTicks = 3;
}

class _RepairEndingScreenState extends ConsumerState<RepairEndingScreen> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: RepairEndingTiming.rings);

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
  Timer? _ringsTimer;

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
      // The sheet arrives (320 ms) and the rings draw one by one a moment into it, with at most
      // three ticks. When the last ring closes the thread draws to Repaired; the number rolls in
      // on its own clock and its landing opens the burst and stands Mobi proud.
      _ringsTimer = Timer(RepairEndingTiming.ringsStart, () {
        if (mounted) _ink.forward();
      });
      final ticks = math.min(model.repairedNowIds.length, RepairEndingTiming.maxRingTicks);
      _ink.addListener(() {
        if (!mounted || ticks == 0 || _ticked >= ticks) return;
        if (_ink.value >= _ticked / ticks) {
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
    _ringsTimer?.cancel();
    _ink.dispose();
    _pop.dispose();
    _mobi.dispose();
    super.dispose();
  }

  EndingModel _model() =>
      EndingModel.of(attemptId: widget.attemptId, run: ref.read(repairRunProvider(widget.attemptId)), index: ref.read(reviewIndexProvider));

  void _finish() => context.go(AppRoutes.review);

  /// "Try the same mistakes again": a fresh run over exactly [questionIds] (those still open),
  /// opened at its entry, so the plan and the wallet are said again before anything is spent.
  void _tryAgain(List<String> questionIds) {
    final first = ref.read(repairRunProvider(widget.attemptId).notifier).prepareRetry(questionIds);
    if (first == null) return _finish();
    context.pushReplacement(AppRoutes.reviewRepair(widget.attemptId, first));
  }

  /// The number has landed: the burst opens behind it, it swells a little and Mobi stands proud.
  /// Once: a later change of the count rolls the digits but does not celebrate again.
  void _landed() {
    if (!mounted || !_celebrating || _beat) return;
    setState(() => _beat = true);
    _pop.forward(from: 0);
    // The repair the server acknowledged lands: Mobi stands proud (calmed under Quiet).
    _mobi.setMood(MobiMood.proud);
    _mobi.react(MobiMoments.act(MobiEvent.milestone), key: 'repairEnding:milestone');
  }

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
    // What is still open in this chapter: in this paper (what the run covered) and in other papers,
    // said apart so the line never contradicts the entry's count.
    final open = chapterOpenSplit(
      index,
      attemptId: widget.attemptId,
      chapter: model.chapter,
      subjectId: model.subjectId,
      resolved: model.resolvedKeys,
    );
    // The same mistakes again: after nothing was repaired, the run's own mistakes still open; after
    // a run with misses (a failed call, one the server could not explain), those misses. Only
    // mistakes Review still has open, from the run itself.
    final run = ref.read(repairRunProvider(widget.attemptId));
    final retry = retryQuestionIds(run, index);
    final reviewAgainKeys = [
      for (final step in run?.steps ?? const <RepairStep>[])
        if (step.countsAsRepaired) step.item.key,
    ];
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
            text: ReviewCopy.bindTime(
              firstNote ? 'Recorded at ${formatTime12(clock.local(ackedAt))}.' : Receipts.repairFinished(clock.local(ackedAt)),
            ),
          );

    final showMobi = full && !(momentShown && moment.mobiHop);

    // The pinned action band: the one volt key and the quiet one under it. Only these sit at the
    // bottom; everything else is the centred block above.
    final band = Padding(
      padding: const EdgeInsets.fromLTRB(ReviewSpace.moment, MmSpace.s4, ReviewSpace.moment, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (retry.isNotEmpty) ...[
            KeyButton(
              label: ReviewCopy.trySameAgain,
              semanticsLabel: '${ReviewCopy.trySameAgain}. ${ReviewCopy.trySameAgainLine(retry.length, model.chapter)}',
              onPressed: () => _tryAgain(retry),
            ),
            const SizedBox(height: MmSpace.s4),
            ExcludeSemantics(
              child: Text(
                ReviewCopy.trySameAgainLine(retry.length, model.chapter),
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
              semanticsLabel: '${ReviewCopy.repairMore(next.items.length)}. ${ReviewCopy.repairMoreLine(next.chapter, repairMinutes(next.items.length))}',
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
          // The mistakes repaired in this run, asked once more with the key hidden: a quiet way on,
          // under the keys, never a second volt key.
          if (reviewAgainKeys.isNotEmpty)
            Align(
              child: KeyButton.quiet(
                label: ReviewAgainCopy.reviewThese,
                onPressed: () => context.push(Uri(path: ReviewAgainCopy.path, queryParameters: {'keys': reviewAgainKeys.join(',')}).toString()),
              ),
            ),
        ],
      ),
    );

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
              // One block, centred at the optical middle of the room above the keys (2 parts of
              // air above, 3 below): the sheet, the count, the thread, then directly under it the
              // receipt and the share key. Nothing is stacked at the top above a hole.
              child: MomentBody(
                content: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (attempt != null)
                      _Arrive(
                        child: EndingSheet(
                          title: '${model.source}, ${subjectName(model.subjectId)}',
                          cells: sheetCells(
                            attempt,
                            repairedNow: model.repairedNowIds,
                            repairedBefore: model.repairedEarlierIds,
                          ),
                          progress: _ink,
                          firstRepair: !model.repairedBefore && !nothing,
                        ),
                      ),
                    if (nothing) ...[
                      const SizedBox(height: MmSpace.s32),
                      _NothingHero(
                        title: ReviewCopy.nothingRepairedTitle,
                        line: ReviewCopy.nothingRepaired(model.setAside, model.reviewed),
                        showMobi: full,
                        mobi: _mobi,
                      ),
                    ] else ...[
                      const SizedBox(height: MmSpace.s32),
                      _NumberHero(
                        value: model.repaired,
                        roll: full,
                        pop: _pop,
                        burstPlay: _celebrating && _beat,
                        celebrating: _celebrating,
                        onLanded: _landed,
                        mobi: showMobi
                            ? MobiCharacter(
                                size: 128,
                                controller: _mobi,
                                // Standing at rest until the beat, then proud; with the
                                // celebration off or motion reduced, proud at once.
                                entrance: _celebrating ? MobiAct.rest : MobiAct.proud,
                                seed: 19,
                                // A tap is answered (a hello, a tilt, a hop), never a new claim.
                                interactive: true,
                                tapCycle: MobiTapCycle.standard,
                                semanticLabel: ReviewCopy.mobiEndingRepaired,
                              )
                            : null,
                      ),
                      const SizedBox(height: MmSpace.s12),
                      Text(
                        ReviewCopy.endingFact(
                          model.chapter,
                          open?.here,
                          elsewhere: open?.elsewhere ?? 0,
                          setAside: model.setAside,
                          reviewed: model.reviewed,
                        ),
                        style: type.lead,
                      ),
                      const SizedBox(height: MmSpace.s24),
                      LifeRow(stage: _lifeInked ? MistakeStage.repaired : MistakeStage.found),
                      const SizedBox(height: MmSpace.s12),
                      Text(ReviewCopy.checkedLater, style: type.small.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s24),
                      if (mobiLine != null) ...[Text(mobiLine, style: type.body), const SizedBox(height: MmSpace.s12)],
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
                            data: ShareCardData.repair(
                              repaired: model.repaired,
                              day: clock.now(),
                              subject: subjectName(model.subjectId),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                bar: band,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The question ids "Try the same mistakes again" opens, in the run's order: with nothing
/// repaired, every step of the run; otherwise only the run's misses ([RepairRunState.missed]).
/// Only those Review still has open. Empty when there is nothing to try again (or no run).
List<String> retryQuestionIds(RepairRunState? run, ReviewIndex? index) {
  if (run == null || index == null) return const [];
  final steps = run.repairedCount == 0 ? run.steps : run.missed;
  return [
    for (final s in steps)
      if (index.item(run.attemptId, s.item.questionId)?.stage.isOpen ?? false) s.item.questionId,
  ];
}

/// The count as the hero: the digits and their unit, with Mobi at the right. On the beat the
/// number swells a little and settles ([pop]) while the foil burst opens behind it, centred on the
/// digits and drawn under the type.
class _NumberHero extends StatelessWidget {
  const _NumberHero({
    required this.value,
    required this.roll,
    required this.pop,
    required this.burstPlay,
    required this.celebrating,
    required this.onLanded,
    this.mobi,
  });

  final int value;
  final bool roll;
  final Animation<double> pop;
  final bool burstPlay;

  /// The celebration is on (so the burst is mounted at all).
  final bool celebrating;

  /// The roll has landed.
  final VoidCallback onLanded;
  final Widget? mobi;

  static const double _burstBox = 260;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    // The digits sit in fixed-width slots of the hero size: the burst is centred on that block.
    final base = type.hero;
    final size = MediaQuery.textScalerOf(context).scale(base.fontSize ?? 112);
    final probe = TextPainter(
      text: TextSpan(
        text: '0',
        style: base.copyWith(fontSize: size),
      ),
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
      // The roll holds while the rings draw, then lands as the beat.
      delay: RepairEndingTiming.numberDelay,
      onLanded: onLanded,
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
  const _NothingHero({required this.title, required this.line, required this.showMobi, required this.mobi});

  final String title;
  final String line;
  final bool showMobi;
  final MobiController mobi;

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
            if (showMobi) ...[
              const SizedBox(width: MmSpace.s8),
              // Leans in to encourage (never sad), and answers a tap.
              MobiCharacter(
                size: 140,
                controller: mobi,
                entrance: MobiAct.encourage,
                seed: 19,
                interactive: true,
                tapCycle: MobiTapCycle.standard,
                semanticLabel: ReviewCopy.mobiEndingNothing,
              ),
            ],
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
        Semantics(
          container: true,
          header: true,
          child: Text(ReviewCopy.firstRepair, style: type.headline.copyWith(fontSize: 22, height: 26 / 22)),
        ),
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
