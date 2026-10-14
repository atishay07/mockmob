import 'package:flutter/widgets.dart';

import 'motion.dart';

/// What drives an [MmStagger].
enum MmStaggerDriver {
  /// Plays once when the group is first built (content that just loaded), then rests.
  self,

  /// Rides the enclosing route's own transition: the items arrive while the page or sheet comes
  /// in, and nothing moves on a route that has already finished (a screen that is up stays put).
  route,
}

/// A group of staggered entrances driven by one controller (or by the route's animation), so a
/// list of twenty items costs one ticker, not twenty. Wrap the group; mark each item with
/// [MmStaggerItem] and its order.
///
/// Choreography: the lead element is index 0 (the hero or the monumental number), then its
/// meaning, then the action, then the list. One authored entrance per screen; scrolling never
/// re-triggers it. Under reduced motion everything is simply there.
///
/// ```dart
/// MmStagger(
///   child: Column(children: [
///     MmStaggerItem(index: 0, child: hero),
///     MmStaggerItem(index: 1, child: meaning),
///     for (final (i, row) in rows.indexed) MmStaggerItem(index: 2 + i, child: row),
///   ]),
/// )
/// ```
class MmStagger extends StatefulWidget {
  const MmStagger({
    super.key,
    required this.child,
    this.driver = MmStaggerDriver.self,
    this.delay = Duration.zero,
    this.enabled = true,
    this.replayKey,
    this.routeStart = 0.3,
    this.routeStep = 0.06,
    this.routeLength = 0.5,
  });

  final Widget child;
  final MmStaggerDriver driver;

  /// Waits this long before the first item ([MmStaggerDriver.self] only).
  final Duration delay;

  /// False shows every item at rest.
  final bool enabled;

  /// A change replays the entrance ([MmStaggerDriver.self] only): pass the loaded data's
  /// identity to stagger a fresh page of results, never a value that changes while scrolling.
  final Object? replayKey;

  /// [MmStaggerDriver.route]: where on the route's 0..1 the first item starts, the share each
  /// later item waits, and each item's own share.
  final double routeStart;
  final double routeStep;
  final double routeLength;

  @override
  State<MmStagger> createState() => _MmStaggerState();
}

class _MmStaggerState extends State<MmStagger> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  Animation<double>? _route;
  bool _active = false;
  bool _decided = false;

  Duration get _total =>
      widget.delay + Motion.staggerStep * Motion.staggerCap + Motion.enterDuration;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    final route = widget.driver == MmStaggerDriver.route ? ModalRoute.of(context) : null;
    // A pushed page is first built offstage (the hero controller measures it) with its
    // animation standing at 1, and the page is not rebuilt when it comes onstage. Look again
    // after that frame, when the route's own animation is running.
    if (route != null && route.offstage) {
      if (widget.enabled && !Motion.reduced(context)) _lookAgain(route, 3);
      return;
    }
    if (!widget.enabled || Motion.reduced(context)) return;
    switch (widget.driver) {
      case MmStaggerDriver.self:
        _controller = AnimationController(vsync: this, duration: _total)..forward();
        _active = true;
      case MmStaggerDriver.route:
        final animation = route?.animation;
        // Only while the route is still arriving: a finished route never moves its content.
        if (animation != null && animation.status == AnimationStatus.forward) {
          _route = animation;
          _active = true;
        }
    }
  }

  void _lookAgain(ModalRoute<Object?> route, int tries) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (route.offstage) {
        if (tries > 1) _lookAgain(route, tries - 1);
        return;
      }
      final animation = route.animation;
      if (animation != null && animation.status == AnimationStatus.forward) {
        setState(() {
          _route = animation;
          _active = true;
        });
      }
    });
  }

  @override
  void didUpdateWidget(MmStagger oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.driver != MmStaggerDriver.self || widget.replayKey == oldWidget.replayKey) return;
    if (!widget.enabled || Motion.reduced(context)) return;
    final controller = _controller ??= AnimationController(vsync: this, duration: _total);
    controller.duration = _total;
    _active = true;
    controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final parent = _controller ?? _route;
    return _StaggerScope(
      parent: _active ? parent : null,
      timing: widget.driver == MmStaggerDriver.self
          ? _SelfTiming(delay: widget.delay, total: _total)
          : _RouteTiming(start: widget.routeStart, step: widget.routeStep, length: widget.routeLength),
      child: widget.child,
    );
  }
}

abstract class _Timing {
  const _Timing();

  Interval intervalFor(int index);
}

class _SelfTiming extends _Timing {
  const _SelfTiming({required this.delay, required this.total});

  final Duration delay;
  final Duration total;

  @override
  Interval intervalFor(int index) {
    final ms = total.inMicroseconds.toDouble();
    final start = (delay + Motion.staggerStep * index.clamp(0, Motion.staggerCap)).inMicroseconds / ms;
    final end = start + Motion.enterDuration.inMicroseconds / ms;
    return Interval(start.clamp(0.0, 1.0), end.clamp(0.0, 1.0), curve: Motion.emphasized);
  }

  @override
  bool operator ==(Object other) => other is _SelfTiming && other.delay == delay && other.total == total;

  @override
  int get hashCode => Object.hash(delay, total);
}

class _RouteTiming extends _Timing {
  const _RouteTiming({required this.start, required this.step, required this.length});

  final double start;
  final double step;
  final double length;

  @override
  Interval intervalFor(int index) {
    final s = (start + step * index.clamp(0, Motion.staggerCap)).clamp(0.0, 0.95);
    return Interval(s, (s + length).clamp(s + 0.05, 1.0), curve: Motion.emphasized);
  }

  @override
  bool operator ==(Object other) => other is _RouteTiming && other.start == start && other.step == step && other.length == length;

  @override
  int get hashCode => Object.hash(start, step, length);
}

class _StaggerScope extends InheritedWidget {
  const _StaggerScope({required this.parent, required this.timing, required super.child});

  /// Null while the group is at rest.
  final Animation<double>? parent;
  final _Timing timing;

  static _StaggerScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_StaggerScope>();

  @override
  bool updateShouldNotify(_StaggerScope old) => old.parent != parent || old.timing != timing;
}

/// One item of an [MmStagger]: fades in and rises [rise] from [scale] at its turn. Outside a
/// group, or once the group is at rest, it is just its child (the wrappers stay, so the child's
/// state is never lost).
class MmStaggerItem extends StatefulWidget {
  const MmStaggerItem({
    super.key,
    required this.index,
    required this.child,
    this.rise = Motion.enterRise,
    this.scale = Motion.enterScale,
  });

  final int index;
  final Widget child;
  final double rise;
  final double scale;

  @override
  State<MmStaggerItem> createState() => _MmStaggerItemState();
}

class _MmStaggerItemState extends State<MmStaggerItem> {
  Animation<double> _progress = kAlwaysCompleteAnimation;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _bind();
  }

  @override
  void didUpdateWidget(MmStaggerItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index) _bind();
  }

  void _bind() {
    final scope = _StaggerScope.maybeOf(context);
    final parent = scope?.parent;
    _progress = parent == null ? kAlwaysCompleteAnimation : _ItemProgress(parent, scope!.timing.intervalFor(widget.index));
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _progress,
      child: _RiseTransition(progress: _progress, rise: widget.rise, scale: widget.scale, child: widget.child),
    );
  }
}

/// An item's 0..1 inside its parent: its interval while arriving, then 1 for good once the
/// parent has landed (a sheet dragged afterwards, or a page leaving, takes its content with it;
/// nothing un-staggers).
class _ItemProgress extends Animation<double> with AnimationWithParentMixin<double> {
  _ItemProgress(this.parent, this.interval);

  @override
  final Animation<double> parent;
  final Interval interval;
  bool _landed = false;

  @override
  double get value {
    if (_landed) return 1;
    final v = parent.value;
    if (v >= 1 || parent.status == AnimationStatus.completed || parent.status == AnimationStatus.reverse) {
      _landed = true;
      return 1;
    }
    return interval.transform(v.clamp(0.0, 1.0));
  }
}

class _RiseTransition extends AnimatedWidget {
  const _RiseTransition({required Animation<double> progress, required this.rise, required this.scale, required this.child})
      : super(listenable: progress);

  final double rise;
  final double scale;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    // One shape at rest and in motion, so the child is never remounted when the item lands.
    final t = (listenable as Animation<double>).value.clamp(0.0, 1.0);
    return Transform.translate(
      offset: Offset(0, rise * (1 - t)),
      child: Transform.scale(scale: scale + (1 - scale) * t, child: child),
    );
  }
}

/// A single entrance without a group: fades in and rises once, after [delay].
class MmEntrance extends StatelessWidget {
  const MmEntrance({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.driver = MmStaggerDriver.self,
    this.rise = Motion.enterRise,
  });

  final Widget child;
  final Duration delay;
  final MmStaggerDriver driver;
  final double rise;

  @override
  Widget build(BuildContext context) {
    return MmStagger(driver: driver, delay: delay, child: MmStaggerItem(index: 0, rise: rise, child: child));
  }
}
