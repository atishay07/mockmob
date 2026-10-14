import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// Rises into place once, when it is first built: a fade and a short translate (transform and
/// opacity only), [delay] after it appears. A lazily built list therefore reveals each section
/// as it nears the viewport. Under reduced motion (or a test with animations off) it is simply
/// there.
class RiseIn extends StatefulWidget {
  const RiseIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 320),
    this.dy = 14,
    this.dx = 0,
    this.curve = Motion.glide,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;

  /// How far below its place it starts, in dp.
  final double dy;

  /// How far to the side of its place it starts, in dp (a student's bubble comes from the right).
  final double dx;
  final Curve curve;

  @override
  State<RiseIn> createState() => _RiseInState();
}

class _RiseInState extends State<RiseIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + widget.duration);
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(widget.delay.inMicroseconds / (widget.delay + widget.duration).inMicroseconds, 1, curve: widget.curve),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _t,
      child: AnimatedBuilder(
        animation: _t,
        child: widget.child,
        builder: (context, child) => Transform.translate(
          offset: Offset(widget.dx * (1 - _t.value), widget.dy * (1 - _t.value)),
          child: child,
        ),
      ),
    );
  }
}

/// A value that counts up from 0 to [to] over [duration] (once per visit, never under reduced
/// motion), for bars and charts whose painters take a 0 to 1 progress.
class GrowIn extends StatefulWidget {
  const GrowIn({
    super.key,
    required this.builder,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 420),
    this.curve = Motion.out,
  });

  /// Receives the eased progress, 0 to 1.
  final Widget Function(BuildContext context, double t) builder;
  final Duration delay;
  final Duration duration;
  final Curve curve;

  @override
  State<GrowIn> createState() => _GrowInState();
}

class _GrowInState extends State<GrowIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + widget.duration);
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(widget.delay.inMicroseconds / (widget.delay + widget.duration).inMicroseconds, 1, curve: widget.curve),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(animation: _t, builder: (context, _) => widget.builder(context, _t.value));
}
