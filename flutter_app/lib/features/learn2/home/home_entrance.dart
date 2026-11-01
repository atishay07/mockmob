import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// Learn home's one entrance (the web's `lh-rise`): the first [cap] blocks and rows rise [rise] dp and fade in, each
/// [step] after the one before; everything past them is simply there. It plays once, when the content first lands, and
/// never again for a re-read or a subject change (an entrance per visit, not per refresh). One controller serves the
/// whole page, so twenty rows cost one ticker.
///
/// When the content follows a skeleton the page's own cross-fade already carries the opacity, so the rows only rise
/// ([fade] false): nothing fades in twice. Under reduced motion everything is at rest.
class HomeEntrance extends StatefulWidget {
  const HomeEntrance({super.key, required this.child, this.play = true, this.fade = true});

  final Widget child;

  /// False: the content is just there (it has played before).
  final bool play;

  /// False when something else already fades the content in (a skeleton's cross-fade).
  final bool fade;

  /// The first blocks that move; the rest arrive with the last of them.
  static const int cap = 12;
  static const Duration step = Duration(milliseconds: 24);
  static const Duration length = Duration(milliseconds: 260);
  static const double rise = 6;

  static Duration get total => step * (cap - 1) + length;

  /// True while this visit's entrance is the one running (or has run) around [context]: a block that animates once per
  /// visit (the pick-up track's fill) asks here, so a page rebuilt later never replays it.
  static bool playingIn(BuildContext context) => _EntranceScope.maybeOf(context)?.parent != null;

  @override
  State<HomeEntrance> createState() => _HomeEntranceState();
}

class _HomeEntranceState extends State<HomeEntrance> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  bool _decided = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    if (!widget.play || Motion.reduced(context)) return;
    _controller = AnimationController(vsync: this, duration: HomeEntrance.total)..forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _EntranceScope(parent: _controller, fade: widget.fade, child: widget.child);
}

class _EntranceScope extends InheritedWidget {
  const _EntranceScope({required this.parent, required this.fade, required super.child});

  /// Null while the page is at rest.
  final Animation<double>? parent;
  final bool fade;

  static _EntranceScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_EntranceScope>();

  @override
  bool updateShouldNotify(_EntranceScope old) => old.parent != parent || old.fade != fade;
}

/// One block of [HomeEntrance], at its place in reading order: the suggestion tiles, the chapters head, the first rows.
/// Outside an entrance, or once it has played, it is just its child.
class HomeRise extends StatelessWidget {
  const HomeRise({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scope = _EntranceScope.maybeOf(context);
    final parent = scope?.parent;
    if (parent == null) return child;
    final at = index.clamp(0, HomeEntrance.cap - 1);
    final total = HomeEntrance.total.inMicroseconds.toDouble();
    final begin = (HomeEntrance.step * at).inMicroseconds / total;
    final end = begin + HomeEntrance.length.inMicroseconds / total;
    final progress = parent.drive(CurveTween(curve: Interval(begin, end.clamp(0.0, 1.0), curve: Motion.out)));
    final moving = AnimatedBuilder(
      animation: progress,
      child: child,
      builder: (context, child) => Transform.translate(offset: Offset(0, HomeEntrance.rise * (1 - progress.value)), child: child),
    );
    return scope!.fade ? FadeTransition(opacity: progress, child: moving) : moving;
  }
}
