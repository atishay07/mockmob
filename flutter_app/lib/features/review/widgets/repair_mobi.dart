import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mascot/mascot.dart';
import '../../../core/theme/theme.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../data/repair_state.dart';

/// Which act Mobi plays for a repair outcome (the website's `repairMood`, so both surfaces react
/// alike). Success only for a repair the server acknowledged and counted.
enum RepairMobiBeat { think, slow, correct, hello, oops, rest }

RepairMobiBeat repairMobiBeat(MistakeOutcome? outcome, {bool slow = false}) => switch (outcome) {
  null || OutcomeLoading() => slow ? RepairMobiBeat.slow : RepairMobiBeat.think,
  OutcomeExplained(:final reopened) => reopened ? RepairMobiBeat.hello : RepairMobiBeat.correct,
  OutcomeFailed() => RepairMobiBeat.oops,
  OutcomeKeyReview() || OutcomeSetAside() || OutcomeNotExplained() => RepairMobiBeat.rest,
};

/// Mobi in a fixed 80 dp slot above the outcome, reacting to what really happened: thinking while
/// the explanation is made (and "Still working on this one" after 8 s), one small correct hop
/// for a repair the server acknowledged, a wave for a reopened stored repair, a shrug then a
/// "come on" after a failure, and sitting for a key review or a set-aside question. The slot
/// keeps its height whatever plays, so nothing below it moves. With large text, or with the
/// celebration turned off, it is not shown; the outcome's own words carry the same facts.
class RepairMobi extends ConsumerStatefulWidget {
  const RepairMobi({super.key, required this.stepKey, required this.outcome});

  /// The mistake on screen: a new one starts its reaction afresh.
  final String stepKey;
  final MistakeOutcome? outcome;

  /// How long a wait is before it is said.
  static const slowAfter = Duration(seconds: 8);

  /// How long the shrug holds before the encouragement.
  static const oopsHold = Duration(milliseconds: 1400);

  static const slot = 80.0;

  @override
  ConsumerState<RepairMobi> createState() => _RepairMobiState();
}

class _RepairMobiState extends ConsumerState<RepairMobi> {
  final MobiController _mobi = MobiController();
  final Set<String> _cheered = {};
  Timer? _slowTimer;
  Timer? _oopsTimer;
  bool _slow = false;
  RepairMobiBeat? _played;

  @override
  void initState() {
    super.initState();
    _react();
  }

  @override
  void didUpdateWidget(RepairMobi old) {
    super.didUpdateWidget(old);
    if (old.stepKey != widget.stepKey) {
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
    final beat = repairMobiBeat(widget.outcome, slow: _slow);
    if (beat == _played) return;
    _played = beat;
    _oopsTimer?.cancel();
    switch (beat) {
      case RepairMobiBeat.think:
        _mobi.setMood(MobiMood.curious);
        _mobi.play(MobiAct.think);
      case RepairMobiBeat.slow:
        _mobi.play(MobiAct.loading);
      case RepairMobiBeat.correct:
        _mobi.setMood(MobiMood.happy);
        // Once per mistake: a rebuild or a return to it never celebrates again.
        if (_cheered.add(widget.stepKey)) {
          _mobi.play(MobiAct.correct);
        } else {
          _mobi.play(MobiAct.idle);
        }
      case RepairMobiBeat.hello:
        _mobi.setMood(MobiMood.calm);
        _mobi.play(MobiAct.hello);
      case RepairMobiBeat.oops:
        _mobi.setMood(MobiMood.concerned);
        _mobi.play(MobiAct.oops);
        _oopsTimer = Timer(RepairMobi.oopsHold, () {
          if (mounted) _mobi.play(MobiAct.encourage);
        });
      case RepairMobiBeat.rest:
        _mobi.setMood(MobiMood.calm);
        _mobi.play(MobiAct.rest);
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
    final colors = context.mmColors;
    final type = context.mmType;
    final largeText = MediaQuery.textScalerOf(context).scale(16) > 16 * 1.3;
    final off = ref.watch(celebrationModeProvider) == CelebrationMode.off;
    final showMobi = !largeText && !off;
    final slowLine = _slow ? Text(ReviewCopy.stillWorkingSlow, style: type.small.copyWith(color: colors.ink2)) : null;
    if (!showMobi) {
      return slowLine == null
          ? const SizedBox.shrink()
          : Padding(padding: const EdgeInsets.only(top: MmSpace.s16), child: Semantics(liveRegion: true, child: slowLine));
    }
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: SizedBox(
        height: RepairMobi.slot,
        child: Row(
          children: [
            ExcludeSemantics(
              child: RepaintBoundary(
                child: MobiCharacter(size: 76, controller: _mobi, entrance: MobiAct.appear, interactive: true, seed: 23),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            if (slowLine != null) Expanded(child: Semantics(liveRegion: true, child: slowLine)),
          ],
        ),
      ),
    );
  }
}
