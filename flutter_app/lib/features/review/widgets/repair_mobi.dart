import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mascot/mascot.dart';
import '../../../core/theme/theme.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../data/repair_state.dart';
import 'retry_first.dart' show RetryVerdict;

/// Which act Mobi plays for a repair outcome (the website's `repairMood`, so both surfaces react
/// alike). Success only for a repair the server acknowledged and counted.
enum RepairMobiBeat { think, slow, correct, hello, oops, rest, listen, sympathy, encourage, idea }

///
/// On the try step ([trying]) he listens. A repair that landed after a checked try reacts to the
/// verdict ([verdict]): a hop for right, a sympathetic beat for the same wrong pick, an encouraging
/// one for a different wrong pick; "Show the reason now" ([skippedTry]) lands on an idea.
RepairMobiBeat repairMobiBeat(MistakeOutcome? outcome, {bool slow = false, bool trying = false, RetryVerdict? verdict, bool skippedTry = false}) {
  if (trying) return RepairMobiBeat.listen;
  return switch (outcome) {
    null || OutcomeLoading() => slow ? RepairMobiBeat.slow : RepairMobiBeat.think,
    OutcomeExplained(:final reopened) =>
      reopened
          ? RepairMobiBeat.hello
          : switch (verdict) {
              RetryVerdict.right => RepairMobiBeat.correct,
              RetryVerdict.still => RepairMobiBeat.sympathy,
              RetryVerdict.different => RepairMobiBeat.encourage,
              null => skippedTry ? RepairMobiBeat.idea : RepairMobiBeat.correct,
            },
    OutcomeFailed() => RepairMobiBeat.oops,
    OutcomeKeyReview() || OutcomeSetAside() || OutcomeNotExplained() => RepairMobiBeat.rest,
  };
}

/// Mobi in a fixed 80 dp slot beside the outcome's own line ([beside]): the wait line while the
/// explanation is made, the four steps once a repair lands, the notice after a failure. The same
/// placement as the website, where he stands beside the wait line, the note or the repair's
/// heading (MistakeRepair.jsx), never in a row of his own. He reacts to what really happened:
/// thinking while the explanation is made (a longer wait after 8 s, when [RepairWaitLine] changes
/// its words), one small correct hop for a repair the server acknowledged (as the thread beside him
/// draws to Repaired), a wave for a reopened stored repair, a shrug then a "come on" after a
/// failure, and sitting when there is nothing to explain. Mobi says nothing himself: the words are
/// the line's own. The slot keeps its size whatever plays, so nothing moves. With large text, or
/// with the celebration turned off, only the line is shown.
class RepairMobi extends ConsumerStatefulWidget {
  const RepairMobi({
    super.key,
    required this.stepKey,
    required this.outcome,
    required this.beside,
    this.trying = false,
    this.verdict,
    this.skippedTry = false,
  });

  /// The try step is on screen: he listens while the options are live.
  final bool trying;

  /// The verdict of a checked try, once the phone or the server can tell it.
  final RetryVerdict? verdict;

  /// "Show the reason now" was chosen: no verdict, an idea when the reason lands.
  final bool skippedTry;

  /// The mistake on screen: a new one starts its reaction afresh.
  final String stepKey;
  final MistakeOutcome? outcome;

  /// The line Mobi stands beside. It takes the rest of the row and is shown even when he is not.
  final Widget beside;

  /// How long a wait is before Mobi shows it (the moment [RepairWaitLine] says "Still writing").
  static const slowAfter = Duration(seconds: 8);

  /// How long the shrug holds before the encouragement.
  static const oopsHold = Duration(milliseconds: 1400);

  static const slot = 80.0;

  /// Mobi's width in the row, and the air between him and the line.
  static const width = 76.0;
  static const gap = MmSpace.s12;

  @override
  ConsumerState<RepairMobi> createState() => _RepairMobiState();
}

class _RepairMobiState extends ConsumerState<RepairMobi> {
  final MobiController _mobi = MobiController();
  Timer? _slowTimer;
  Timer? _oopsTimer;
  bool _slow = false;
  RepairMobiBeat? _played;

  /// The gap that makes a reaction keyed to one mistake play once for the whole run.
  static const Duration _oncePerMistake = Duration(days: 1);

  @override
  void initState() {
    super.initState();
    _react();
  }

  @override
  void didUpdateWidget(RepairMobi old) {
    super.didUpdateWidget(old);
    if (old.stepKey != widget.stepKey) {
      // A new mistake starts its wait from zero: the last one's clocks are not carried over.
      _slowTimer?.cancel();
      _slow = false;
      _played = null;
    }
    _react();
  }

  void _react() {
    final loading = widget.outcome == null || widget.outcome is OutcomeLoading;
    if (loading && !_slow && !(_slowTimer?.isActive ?? false)) {
      _slowTimer = Timer(RepairMobi.slowAfter, () {
        if (!mounted) return;
        setState(() => _slow = true);
        _react();
      });
    }
    if (!loading) {
      _slowTimer?.cancel();
      _slow = false;
    }
    final beat = repairMobiBeat(widget.outcome, slow: _slow, trying: widget.trying, verdict: widget.verdict, skippedTry: widget.skippedTry);
    if (beat == _played) return;
    _played = beat;
    _oopsTimer?.cancel();
    switch (beat) {
      case RepairMobiBeat.think:
        _mobi.setMood(MobiMood.curious);
        _mobi.play(MobiAct.think);
      case RepairMobiBeat.slow:
        _mobi.react(MobiMoments.act(MobiEvent.waitLong));
      case RepairMobiBeat.correct:
        _mobi.setMood(MobiMood.happy);
        // Once per mistake: a rebuild, or coming back to it, never plays it again (the gate lives
        // for the app run, so a new screen state for the same mistake stays calm too).
        if (!_mobi.react(MobiMoments.act(MobiEvent.answerRight), key: 'repair:${widget.stepKey}', gap: _oncePerMistake)) {
          _mobi.play(MobiAct.idle);
        }
      case RepairMobiBeat.listen:
        _mobi.setMood(MobiMood.calm);
        _mobi.play(MobiAct.listen);
      case RepairMobiBeat.sympathy:
        _mobi.setMood(MobiMood.concerned);
        _mobi.play(MobiAct.sympathy);
      case RepairMobiBeat.encourage:
        _mobi.setMood(MobiMood.calm);
        _mobi.react(MobiMoments.act(MobiEvent.answerWrong));
      case RepairMobiBeat.idea:
        _mobi.setMood(MobiMood.happy);
        _mobi.play(MobiAct.idea);
      case RepairMobiBeat.hello:
        _mobi.setMood(MobiMood.calm);
        _mobi.react(MobiMoments.act(MobiEvent.arrive));
      case RepairMobiBeat.oops:
        _mobi.setMood(MobiMood.concerned);
        // The shrug once per run: a retry that fails again goes straight to the "come on".
        final shrug = MobiRation.oopsRun('repair');
        if (shrug) _mobi.react(MobiMoments.act(MobiEvent.setback));
        _oopsTimer = Timer(shrug ? RepairMobi.oopsHold : Duration.zero, () {
          if (mounted) _mobi.react(MobiMoments.act(MobiEvent.answerWrong));
        });
      case RepairMobiBeat.rest:
        _mobi.setMood(MobiMood.calm);
        _mobi.react(MobiMoments.act(MobiEvent.allClear));
    }
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    _oopsTimer?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final largeText = MediaQuery.textScalerOf(context).scale(16) > 16 * 1.3;
    final off = ref.watch(celebrationModeProvider) == CelebrationMode.off;
    if (largeText || off) return Padding(padding: const EdgeInsets.only(top: MmSpace.s24), child: widget.beside);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: RepairMobi.slot),
        child: Row(
          children: [
            SizedBox(
              width: RepairMobi.width,
              height: RepairMobi.slot,
              child: ExcludeSemantics(
                child: RepaintBoundary(
                  child: MobiCharacter(size: 76, controller: _mobi, entrance: MobiAct.appear, interactive: true, seed: 23),
                ),
              ),
            ),
            const SizedBox(width: RepairMobi.gap),
            Expanded(child: widget.beside),
          ],
        ),
      ),
    );
  }
}

/// The one line while a repair is written, exactly as on the website (`REPAIR_LOADING` and
/// `repairLoadingLine` in data/repair_presentation.mjs): "Writing the repair for Q7." at once,
/// "Still writing. You are charged only if it arrives." after 8 s, "Taking longer than usual.
/// Still trying." after 45 s. The line replaces itself on real elapsed time; it is never a label
/// with more lines added under it. A screen reader hears each change. Keyed per mistake by the
/// caller, so a new mistake starts its wait from zero.
class RepairWaitLine extends StatefulWidget {
  const RepairWaitLine({super.key, required this.number});

  /// The question number on screen ("Q7").
  final int number;

  /// The website's `REPAIR_LOADING.slowAfterMs`; Mobi's longer wait starts at the same moment.
  static const slowAfter = RepairMobi.slowAfter;

  /// The website's `REPAIR_LOADING.longAfterMs`.
  static const longAfter = Duration(seconds: 45);

  /// The line for a wait of [elapsed] (the website's `repairLoadingLine`).
  static String lineFor(Duration elapsed, int number) {
    if (elapsed >= longAfter) return ReviewCopy.takingLonger;
    if (elapsed >= slowAfter) return ReviewCopy.stillWriting;
    return ReviewCopy.writingRepair(number);
  }

  @override
  State<RepairWaitLine> createState() => _RepairWaitLineState();
}

class _RepairWaitLineState extends State<RepairWaitLine> {
  Timer? _slowTimer;
  Timer? _longTimer;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _slowTimer = Timer(RepairWaitLine.slowAfter, () {
      if (mounted) setState(() => _elapsed = RepairWaitLine.slowAfter);
    });
    _longTimer = Timer(RepairWaitLine.longAfter, () {
      if (mounted) setState(() => _elapsed = RepairWaitLine.longAfter);
    });
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    _longTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Text(RepairWaitLine.lineFor(_elapsed, widget.number), style: type.label.copyWith(color: colors.ink2)),
    );
  }
}
