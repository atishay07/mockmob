import 'package:flutter/material.dart';

import '../motion/motion.dart';

/// A small ring spinner for real in-flight work (a key that is loading, a save that is sending).
/// Under reduced motion it becomes a static three-quarter ring.
class MmSpinner extends StatelessWidget {
  const MmSpinner({super.key, required this.color, this.size = 18, this.strokeWidth = 2.5});

  final Color color;
  final double size;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return SizedBox.square(
      dimension: size,
      child: ExcludeSemantics(
        child: CircularProgressIndicator(
          strokeWidth: strokeWidth,
          strokeCap: StrokeCap.round,
          color: color,
          value: reduced ? 0.75 : null,
        ),
      ),
    );
  }
}
