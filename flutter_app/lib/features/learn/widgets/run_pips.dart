import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

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
                Expanded(
                  child: _Pip(filled: i < done, current: i == done),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Pip extends StatefulWidget {
  const _Pip({required this.filled, required this.current});

  final bool filled;
  final bool current;

  @override
  State<_Pip> createState() => _PipState();
}

/// One pip. Its fill is a spring on the app's smooth physics ([Springs.smooth]), not a timed
/// tween: it eases off the left edge and settles without a stop, and a run reopened part-way shows
/// its done pips already full (nothing replays). Reduced motion fills at once. Transform only, on
/// its own layer.
class _PipState extends State<_Pip> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(
    vsync: this,
    value: widget.filled ? 1 : 0,
  );

  @override
  void didUpdateWidget(_Pip old) {
    super.didUpdateWidget(old);
    if (old.filled == widget.filled) return;
    final to = widget.filled ? 1.0 : 0.0;
    if (Motion.reduced(context)) {
      _fill.value = to;
      return;
    }
    _fill.animateWith(SpringSimulation(Springs.smooth, _fill.value, to, 0));
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

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
            border: widget.current ? Border.all(color: colors.ink, width: 1.5) : null,
          ),
        ),
        AnimatedBuilder(
          animation: _fill,
          builder: (context, child) => Transform(
            alignment: Alignment.centerLeft,
            transform: Matrix4.diagonal3Values(_fill.value, 1, 1),
            child: _fill.value == 0 ? const SizedBox.shrink() : child,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.ink,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
      ],
    );
  }
}

/// The pips of a finished run, filling one after another once when the screen opens (70 ms
/// apart): one pip per card or step put away. With reduced motion they are simply full.
/// [onSettled] runs once the last pip is in, so the ending can follow the inking.
class SettlingPips extends StatefulWidget {
  const SettlingPips({
    super.key,
    required this.total,
    this.onSettled,
    this.animate = true,
    this.skip = false,
  });

  final int total;
  final VoidCallback? onSettled;

  /// False shows every pip full at once (the Celebrations setting is Off).
  final bool animate;

  /// True jumps to the end state: the student tapped the moment away.
  final bool skip;

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
    if (!widget.animate || Motion.reduced(context) || widget.total <= 0) {
      _filled = widget.total;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onSettled?.call();
      });
      return;
    }
    _timer = Timer.periodic(const Duration(milliseconds: 70), (t) {
      if (!mounted) return;
      setState(() => _filled++);
      if (_filled >= widget.total) {
        t.cancel();
        widget.onSettled?.call();
      }
    });
  }

  @override
  void didUpdateWidget(SettlingPips old) {
    super.didUpdateWidget(old);
    if (widget.skip && !old.skip && _filled < widget.total) {
      _timer?.cancel();
      setState(() => _filled = widget.total);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onSettled?.call();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RunPips(total: widget.total, done: _filled);
}
