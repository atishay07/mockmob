import 'package:flutter/widgets.dart';

import 'reduced_motion.dart';

/// An [AnimatedSize] that is safe under reduced motion: with a zero [duration], or when the
/// student has asked for less motion, it is the child itself. A size animation with no duration
/// re-dirties its own layout (RenderAnimatedSize asserts in debug), so there is nothing to wrap.
///
/// Pass the same duration a screen would give [AnimatedSize], including `Motion.of(context, d)`.
class MmSizeEase extends StatelessWidget {
  const MmSizeEase({super.key, required this.duration, required this.child, this.curve = Curves.linear, this.alignment = Alignment.center, this.clipBehavior = Clip.hardEdge});

  final Duration duration;
  final Curve curve;
  final AlignmentGeometry alignment;
  final Clip clipBehavior;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) == true || ReducedMotionSetting.of(context);
    if (reduced || duration == Duration.zero) return child;
    return AnimatedSize(duration: duration, curve: curve, alignment: alignment, clipBehavior: clipBehavior, child: child);
  }
}
