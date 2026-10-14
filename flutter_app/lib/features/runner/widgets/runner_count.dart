import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'runner_motion.dart';

/// "19 of 20" in the top bar. When the number changes the old one slides out and the new one
/// rises in from the side the student is travelling towards (180 ms, glide), never a roll from
/// zero. Settled, it is the condensed [MonumentalNumber] and never moves. "of 20" is not part of
/// that slide (it does not change): it is set in the body face at 13 sp, semibold, ink 2, with its
/// cap line on the figure's, so it reads at a glance beside the 30 sp figure.
class RunnerCount extends StatefulWidget {
  const RunnerCount({
    super.key,
    required this.current,
    required this.total,
    required this.style,
    required this.unitColor,
    required this.semanticsLabel,
  });

  final int current;
  final int total;
  final TextStyle style;
  final Color unitColor;
  final String semanticsLabel;

  @override
  State<RunnerCount> createState() => _RunnerCountState();
}

class _RunnerCountState extends State<RunnerCount> {
  int _direction = 1;

  @override
  void didUpdateWidget(RunnerCount old) {
    super.didUpdateWidget(old);
    if (old.current != widget.current) _direction = widget.current >= old.current ? 1 : -1;
  }

  @override
  Widget build(BuildContext context) {
    final reduced = RunnerMotion.reduced(context);
    final incoming = ValueKey<int>(widget.current);
    final number = MonumentalNumber(
      key: incoming,
      value: '${widget.current}',
      roll: false,
      style: widget.style,
      semanticsLabel: widget.semanticsLabel,
    );
    final scale = MediaQuery.textScalerOf(context).scale(1);
    final unit = Padding(
      // The unit's cap line meets the figure's: the figure's ink starts about 17% of its size below
      // its box top, the 13 sp unit's about 15% of its own.
      padding: EdgeInsets.only(top: ((widget.style.fontSize ?? 30) * 0.17 - 13 * 0.15) * scale),
      child: Text(
        'of ${widget.total}',
        style: context.mmType.label.copyWith(fontSize: 13, height: 1, fontWeight: FontWeight.w600, color: widget.unitColor),
        maxLines: 1,
        softWrap: false,
      ),
    );
    Widget pair(Widget figure) => Semantics(
      label: widget.semanticsLabel,
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [figure, const SizedBox(width: MmSpace.s4), unit],
      ),
    );
    if (reduced) return pair(number);
    final direction = _direction;
    // Clipped to the number's own box: whatever slides out of it is cut, not smeared over the bar.
    return pair(ClipRect(
      child: AnimatedSwitcher(
        duration: RunnerMotion.countFlip,
        switchInCurve: Motion.glide,
        switchOutCurve: Motion.exit,
        layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
        transitionBuilder: (child, animation) {
          final entering = child.key == incoming;
          // Forward: the new number rises from below and the old one leaves upward; back is the
          // mirror. The outgoing child's animation runs in reverse, so one tween serves both.
          // A full line of travel and a fade split in two halves: the old number is gone before the
          // new one appears, so there is never a frame with two counters printed over each other.
          final shift = (entering ? direction : -direction) * 0.9;
          final slide = Tween<Offset>(begin: Offset(0, shift), end: Offset.zero).animate(animation);
          final fade = CurvedAnimation(parent: animation, curve: const Interval(0.5, 1));
          final faded = FadeTransition(
            opacity: fade,
            alwaysIncludeSemantics: true,
            child: SlideTransition(position: slide, child: child),
          );
          // The leaving number is a picture only: one question never has two labels for a reader.
          return entering ? faded : ExcludeSemantics(child: faded);
        },
        child: number,
      ),
    ));
  }
}
