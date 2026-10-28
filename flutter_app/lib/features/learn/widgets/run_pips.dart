import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// One slim segment per step of the run. Finished steps fill with ink from the left, the step
/// in front is outlined, the rest wait. State is carried by fill weight and outline, never by
/// colour alone, and the row is decoration: the position text beside it carries the meaning.
class RunPips extends StatelessWidget {
  const RunPips({super.key, required this.total, required this.done});

  final int total;

  /// Steps finished; also the index of the current step.
  final int done;

  @override
  Widget build(BuildContext context) {
    if (total <= 0) return const SizedBox(height: 6);
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          height: 6,
          child: Row(
            children: [
              for (var i = 0; i < total; i++) ...[
                if (i > 0) SizedBox(width: total > 12 ? 2 : 4),
                Expanded(child: _Pip(filled: i < done, current: i == done)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Pip extends StatelessWidget {
  const _Pip({required this.filled, required this.current});

  final bool filled;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.line,
            borderRadius: BorderRadius.circular(3),
            border: current ? Border.all(color: colors.ink, width: 1.5) : null,
          ),
        ),
        TweenAnimationBuilder<double>(
          tween: Tween(end: filled ? 1 : 0),
          duration: Motion.of(context, Motion.ui),
          curve: Motion.out,
          builder: (context, t, child) => Transform(
            alignment: Alignment.centerLeft,
            transform: Matrix4.diagonal3Values(t, 1, 1),
            child: t == 0 ? const SizedBox.shrink() : child,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(3)),
          ),
        ),
      ],
    );
  }
}

/// The pips of a finished run, filling one after another once when the screen opens (about 70 ms
/// apart). With reduced motion they are simply full. A quiet picture of cards put away, not a
/// celebration.
class SettlingPips extends StatefulWidget {
  const SettlingPips({super.key, required this.total});

  final int total;

  @override
  State<SettlingPips> createState() => _SettlingPipsState();
}

class _SettlingPipsState extends State<SettlingPips> {
  int _filled = 0;
  Timer? _timer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _filled = widget.total;
      return;
    }
    _timer = Timer.periodic(const Duration(milliseconds: 70), (t) {
      if (!mounted) return;
      setState(() => _filled++);
      if (_filled >= widget.total) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RunPips(total: widget.total, done: _filled);
}
