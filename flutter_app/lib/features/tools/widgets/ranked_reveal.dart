import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// A ranked row arriving: a fade and an 8 dp rise on Glide, the first [Motion.staggerCap] rows
/// 40 ms apart and every later row with the last, so a long list never takes long.
///
/// A list of programmes that changes under a filter, a sort, a stream or a category keys each row
/// by what it is and wraps it here:
///
/// * a row that is new to the list ([animateOnMount]) arrives;
/// * a row that stays plays the arrival again when [replayKey] changes (a re-sort or a new
///   category), so the order the student asked for is seen settling, not jumping;
/// * a row on screen when the page opens does not play at all, because the page's own entrance
///   already did.
///
/// Opacity and transform only; once it has landed the row is returned as it is, with no layer.
/// Under reduced motion it never plays.
class RankedReveal extends StatefulWidget {
  const RankedReveal({super.key, required this.index, required this.child, this.replayKey, this.animateOnMount = true});

  /// The row's place in its list.
  final int index;
  final Widget child;

  /// A change replays the arrival. Pass the filter, sort and category together.
  final Object? replayKey;

  /// False when the row is part of the page as it opens.
  final bool animateOnMount;

  /// How far the row rises.
  static const double rise = 8;

  /// Gap between neighbours, and one row's own travel.
  static const Duration step = Duration(milliseconds: 40);
  static const Duration travel = Duration(milliseconds: 280);

  /// The delay row [index] waits (the first eight stagger, the rest arrive with the eighth).
  static Duration delayFor(int index) => step * index.clamp(0, Motion.staggerCap);

  @override
  State<RankedReveal> createState() => _RankedRevealState();
}

class _RankedRevealState extends State<RankedReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, value: 1);
  bool _begun = false;

  Duration get _total => RankedReveal.delayFor(widget.index) + RankedReveal.travel;

  void _play() {
    if (Motion.reduced(context)) {
      _t.value = 1;
      return;
    }
    _t.duration = _total;
    _t.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    if (widget.animateOnMount) _play();
  }

  @override
  void didUpdateWidget(RankedReveal old) {
    super.didUpdateWidget(old);
    if (old.replayKey != widget.replayKey) _play();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) {
        if (_t.value >= 1) return child!;
        final lead = RankedReveal.delayFor(widget.index).inMicroseconds / _total.inMicroseconds;
        final p = Interval(lead, 1, curve: Motion.glide).transform(_t.value);
        return Opacity(
          opacity: p,
          child: Transform.translate(offset: Offset(0, RankedReveal.rise * (1 - p)), child: child),
        );
      },
    );
  }
}
