import 'package:flutter/physics.dart' show SpringDescription, SpringSimulation;
import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// A picked state that lands on a spring. [builder] gets a value that follows [on] (1 picked, 0
/// not) on [spring], so a pick carries its own small overshoot and a quick change of mind
/// reverses from wherever the value is, with its velocity, instead of restarting a fixed curve.
/// The value may pass a hair beyond 0 or 1: clamp it where a colour or an alpha needs 0 to 1.
///
/// Snaps under reduced motion. One unbounded controller, idle at rest.
class SpringPick extends StatefulWidget {
  const SpringPick({super.key, required this.on, required this.builder, this.spring, this.child});

  final bool on;

  /// Defaults to [Springs.smooth] (cards and tiles: 360 ms, bounce 0.12).
  final SpringDescription? spring;
  final Widget Function(BuildContext context, double t, Widget? child) builder;
  final Widget? child;

  /// A pop that peaks halfway through a change and is 0 at rest either side: for a chip that
  /// swells a little as it is picked and is its own size again once it lands (pure).
  static double popAt(double t) {
    final x = t.clamp(0.0, 1.0);
    return 4 * x * (1 - x);
  }

  @override
  State<SpringPick> createState() => _SpringPickState();
}

class _SpringPickState extends State<SpringPick> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController.unbounded(vsync: this, value: widget.on ? 1 : 0);

  @override
  void didUpdateWidget(SpringPick old) {
    super.didUpdateWidget(old);
    if (old.on == widget.on) return;
    final target = widget.on ? 1.0 : 0.0;
    if (Motion.reduced(context)) {
      _t.value = target;
      return;
    }
    _t.animateWith(SpringSimulation(widget.spring ?? Springs.smooth, _t.value, target, _t.velocity));
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _t,
        child: widget.child,
        builder: (context, child) => widget.builder(context, _t.value, child),
      );
}
