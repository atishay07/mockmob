// The place beside the week ring where Mobi stands: one fixed 76 dp box, so nothing around it
// moves when he arrives or goes. What he does comes from the pure `mobiForWeek`; here he only
// cross-fades (300 ms) between one standing and the next, and answers a day that has just been
// counted with one small right-answer hop for 1.2 s. A sleeping Mobi wakes when tapped (the
// screen shows his line then). Under reduced motion he is the still pose and the reaction is
// skipped: the same information is in the words.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/week_mobi.dart';
import 'proud_mobi.dart';

class WeekMobiSlot extends StatefulWidget {
  const WeekMobiSlot({
    super.key,
    required this.mobi,
    this.reaction = 0,
    this.proudDelay = Duration.zero,
    this.onWake,
  });

  /// Who stands here now (from `mobiForWeek`).
  final WeekMobi mobi;

  /// Goes up by one each time a day is counted while the screen is open: Mobi answers with the
  /// right-answer hop for [reactionFor].
  final int reaction;

  /// How long a proud Mobi waits before he acts: the ring has to finish inking first.
  final Duration proudDelay;

  /// A tap on a sleeping Mobi.
  final VoidCallback? onWake;

  /// The fixed box: 76 dp tall.
  static const double size = 76;

  /// How long the answer to a counted day shows.
  static const Duration reactionFor = Duration(milliseconds: 1200);

  /// The cross-fade between two standings.
  static const Duration fade = Duration(milliseconds: 300);

  @override
  State<WeekMobiSlot> createState() => _WeekMobiSlotState();
}

class _WeekMobiSlotState extends State<WeekMobiSlot> {
  Timer? _reacting;
  bool _reactionOn = false;

  @override
  void didUpdateWidget(WeekMobiSlot old) {
    super.didUpdateWidget(old);
    if (widget.reaction == old.reaction || Motion.reduced(context)) return;
    // A day that met the goal belongs to the proud Mobi, not the small hop.
    if (widget.mobi.kind == WeekMobiKind.proud) return;
    _reacting?.cancel();
    _reactionOn = true;
    _reacting = Timer(WeekMobiSlot.reactionFor, () {
      if (mounted) setState(() => _reactionOn = false);
    });
  }

  @override
  void dispose() {
    _reacting?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mobi = widget.mobi;
    final Widget child;
    if (_reactionOn) {
      child = const _SlotMobi(key: ValueKey('correct'), entrance: MobiAct.correct);
    } else if (!mobi.present) {
      child = const SizedBox.shrink(key: ValueKey('none'));
    } else if (mobi.kind == WeekMobiKind.proud) {
      child = ProudMobi(key: const ValueKey('proud'), size: WeekMobiSlot.size, delay: widget.proudDelay);
    } else {
      child = _SlotMobi(key: ValueKey(mobi.kind), entrance: mobi.act!, onTap: mobi.tapWakes ? widget.onWake : null);
    }
    return SizedBox(
      width: MobiFigure.widthFor(WeekMobiSlot.size),
      height: WeekMobiSlot.size,
      child: AnimatedSwitcher(
        duration: Motion.of(context, WeekMobiSlot.fade),
        layoutBuilder: (current, previous) => Stack(alignment: Alignment.bottomCenter, children: [...previous, ?current]),
        child: child,
      ),
    );
  }
}

class _SlotMobi extends StatelessWidget {
  const _SlotMobi({super.key, required this.entrance, this.onTap});

  final MobiAct entrance;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    Widget mobi = MobiCharacter(
      size: WeekMobiSlot.size,
      entrance: entrance,
      // Only a sleeping Mobi answers a touch (he wakes); the others stay still for the ring.
      interactive: onTap != null,
      watchTaps: false,
      seed: 11,
    );
    if (onTap != null) {
      // A Listener, so the tap reaches the screen even though the character's own gesture takes
      // the touch to wake him.
      mobi = Listener(behavior: HitTestBehavior.translucent, onPointerDown: (_) => onTap!(), child: mobi);
    }
    return mobi;
  }
}
