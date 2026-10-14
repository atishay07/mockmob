import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import 'runner_motion.dart';

/// Plays a question's arrival (runner.md 3.4): each [EnterItem] below it rises 10 dp and fades in,
/// travelling from the side the student came from, one step later than the item above. It plays
/// once, when this widget is first built (the runner keys it by question), so choosing an answer
/// on the same question never replays it. Under reduced motion everything is simply there.
class QuestionEnter extends StatefulWidget {
  const QuestionEnter({super.key, required this.direction, required this.child, this.animate = true});

  /// 1 when the student moved forward (content comes in from the right), -1 when back.
  final int direction;
  final Widget child;

  /// False for the first question of a session: the page's own transition is already playing.
  final bool animate;

  /// The most items that stagger; later ones share the last slot.
  static const int maxSteps = 7;

  @override
  State<QuestionEnter> createState() => _QuestionEnterState();
}

class _QuestionEnterState extends State<QuestionEnter> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: RunnerMotion.enter + RunnerMotion.stagger * QuestionEnter.maxSteps,
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || RunnerMotion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _EnterScope(controller: _controller, direction: widget.direction, child: widget.child);
}

class _EnterScope extends InheritedWidget {
  const _EnterScope({required this.controller, required this.direction, required super.child});

  final AnimationController controller;
  final int direction;

  @override
  bool updateShouldNotify(_EnterScope old) => old.controller != controller || old.direction != direction;
}

/// One piece of a question that arrives with it: [order] 0 is the first to appear.
class EnterItem extends StatelessWidget {
  const EnterItem({super.key, required this.order, required this.child});

  final int order;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_EnterScope>();
    if (scope == null) return child;
    final controller = scope.controller;
    final total = controller.duration!.inMicroseconds;
    final start = (RunnerMotion.stagger * order.clamp(0, QuestionEnter.maxSteps)).inMicroseconds / total;
    final end = start + RunnerMotion.enter.inMicroseconds / total;
    final interval = Interval(start, end.clamp(0.0, 1.0), curve: Motion.glide);
    return AnimatedBuilder(
      animation: controller,
      child: child,
      builder: (context, child) {
        // The structure never changes once built, so a child that keeps state (an option's ink)
        // is never re-created when the arrival ends.
        final t = interval.transform(controller.value);
        // Screen readers meet the question at once; only the picture eases in.
        return Opacity(
          opacity: t,
          alwaysIncludeSemantics: true,
          child: Transform.translate(
            offset: Offset(scope.direction * RunnerMotion.enterShift * (1 - t), RunnerMotion.enterRise * (1 - t)),
            child: child,
          ),
        );
      },
    );
  }
}
