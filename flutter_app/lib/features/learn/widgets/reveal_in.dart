import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// Brings its child in with a 200 ms fade and an 8 dp rise (spec 5.9: no 3D flip). With reduced
/// motion the child only fades, over 120 ms, and does not move. Plays once, when first built.
class RevealIn extends StatelessWidget {
  const RevealIn({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: reduced ? Motion.reducedFade : Motion.ui,
      curve: reduced ? Curves.linear : Motion.out,
      child: child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, reduced ? 0 : 8 * (1 - t)), child: child),
      ),
    );
  }
}
