import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// A box that grows and shrinks to its child over [Motion.ui] on Glide (an answer opening, a
/// strip arriving), anchored at the top. Under reduced motion it is the child itself: a size
/// animation with no duration re-dirties its own layout, so there is nothing to wrap.
class SizeReveal extends StatelessWidget {
  const SizeReveal({super.key, required this.child, this.duration = Motion.ui});

  final Widget child;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return AnimatedSize(duration: duration, curve: Motion.glide, alignment: Alignment.topCenter, child: child);
  }
}
