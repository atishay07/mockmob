import 'package:flutter/material.dart';

import '../../motion/motion.dart';

/// The one indicator of a segmented control or a tab row (owner, 17 Oct night, N5).
///
/// It is ONE box that slides from the old option to the new one: a single translate (no layout, no
/// second box arriving, nothing overlapping), ease-out over [duration] (220 ms). A change that
/// arrives mid-slide carries on from where the indicator is, so a quick second tap never snaps it
/// back. Under reduced motion it jumps.
///
/// The indicator is [child], sized to one slot (`1 / count` of the width of this widget) and
/// aligned by [verticalAlign] (or filling the height with [fillHeight]); it is the parent's job to size this widget to
/// the track the options sit in.
class MmSlidingIndicator extends StatefulWidget {
  const MmSlidingIndicator({
    super.key,
    required this.index,
    required this.count,
    required this.child,
    this.verticalAlign = 0,
    this.fillHeight = false,
  });

  /// How long the slide takes (owner, N5: ease-out, 220 ms).
  static const Duration duration = Duration(milliseconds: 220);

  /// The slide's curve: the app's ease-out (starts fast, settles slowly).
  static const Curve curve = Motion.out;

  /// The 0-based position of the chosen option.
  final int index;
  final int count;
  final Widget child;

  /// -1 top, 0 middle, 1 bottom: where the indicator sits when it is shorter than the track.
  final double verticalAlign;

  /// True: the indicator takes the track's full height (a thumb). False: its own height (an underline).
  final bool fillHeight;

  @override
  State<MmSlidingIndicator> createState() => _MmSlidingIndicatorState();
}

class _MmSlidingIndicatorState extends State<MmSlidingIndicator> with SingleTickerProviderStateMixin {
  // The value IS the position in slots, so a re-aimed slide starts where the box is now.
  late final AnimationController _pos = AnimationController(vsync: this, lowerBound: 0, upperBound: 32, value: widget.index.toDouble());

  @override
  void didUpdateWidget(MmSlidingIndicator old) {
    super.didUpdateWidget(old);
    if (widget.index == old.index) return;
    final target = widget.index.toDouble();
    if (Motion.reduced(context)) {
      _pos.value = target;
    } else {
      _pos.animateTo(target, duration: MmSlidingIndicator.duration, curve: MmSlidingIndicator.curve);
    }
  }

  @override
  void dispose() {
    _pos.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.count < 1 ? 1 : widget.count;
    return Align(
      alignment: Alignment(-1, widget.verticalAlign),
      child: FractionallySizedBox(
        widthFactor: 1 / n,
        heightFactor: widget.fillHeight ? 1 : null,
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _pos,
            child: widget.child,
            // FractionalTranslation moves by a share of the box's own width: one slot per step.
            builder: (context, child) => FractionalTranslation(translation: Offset(_pos.value, 0), child: child),
          ),
        ),
      ),
    );
  }
}
