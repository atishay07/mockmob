import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';

/// The wait while questions are drawn: a row of ten answer bubbles inking one after another,
/// then clearing, on a loop. Under reduced motion the row sits still, half inked.
class InkingSheet extends StatefulWidget {
  const InkingSheet({super.key, this.count = 10, this.size = 14});

  final int count;
  final double size;

  @override
  State<InkingSheet> createState() => _InkingSheetState();
}

class _InkingSheetState extends State<InkingSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _loop = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _loop.stop();
      _loop.value = 0.5;
    } else if (!_loop.isAnimating) {
      _loop.repeat();
    }
  }

  @override
  void dispose() {
    _loop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _loop,
          builder: (context, _) {
            // First 80% inks left to right; the last 20% holds, then the row clears at once.
            final inked = (_loop.value / 0.8 * widget.count).floor().clamp(0, widget.count);
            return BubbleRow(
              states: [for (var i = 0; i < widget.count; i++) i < inked ? BubbleState.filled : BubbleState.hollow],
              bubbleSize: widget.size,
              gap: 8,
            );
          },
        ),
      ),
    );
  }
}
