import 'package:flutter/widgets.dart';

import '../motion/motion.dart';

/// How an emblem arrives on a hero (MOTION 4.1, item P0-9): it scales from 0.94 to 1 about its
/// own centre and rises 8 dp into place, over 420 ms on the emphasized curve,
/// starting [delay] after the card (160 ms, so the card leads and the object follows).
///
/// It never travels sideways, so it cannot cross the corner it rests in, and it is on its
/// resting pose after `delay + 420 ms` and stays there. It plays once, when first built: a rebuild,
/// a data refresh, a tab reselect or a return from a pushed page does not replay it (those keep the
/// same state). Under reduced motion (system or in-app) it is simply there. Offstage (TickerMode
/// off) it holds its pose. It adds no hit target of its own, so a tap on the card during the arrival lands as usual.
///
/// Wrap the `SubjectEmblem`, not the whole art box, so parallax and positioning stay the
/// caller's:
///
///     EmblemArrive(child: SubjectEmblem(subject: id, size: EmblemSizes.hero, framed: false))
class EmblemArrive extends StatefulWidget {
  const EmblemArrive({
    super.key,
    required this.child,
    this.delay = const Duration(milliseconds: 160),
    this.rise = 8,
    this.from = 0.94,
  });

  final Widget child;

  /// The wait before the object starts, so the card it sits on arrives first.
  final Duration delay;

  /// How far below its resting place it starts, in dp.
  final double rise;

  /// The scale it starts at (1 at rest).
  final double from;

  /// How long the arrival itself takes once it starts.
  static const Duration duration = Motion.emphasizedDuration;

  /// The pose [elapsed] after the widget was built: scale, downward offset in dp and opacity.
  /// This is the one function the widget animates with, exposed so a frame sheet can draw the
  /// same frames the phone plays.
  static ({double scale, double dy, double opacity}) poseAt(
    Duration elapsed, {
    Duration delay = const Duration(milliseconds: 160),
    double rise = 8,
    double from = 0.94,
  }) {
    final into = (elapsed - delay).inMicroseconds / duration.inMicroseconds;
    final t = Motion.emphasized.transform(into.clamp(0.0, 1.0));
    // The fade is over the first half of the move: the object is solid before it has settled.
    final fade = Curves.easeOut.transform((into * 2).clamp(0.0, 1.0));
    return (scale: from + (1 - from) * t, dy: rise * (1 - t), opacity: fade);
  }

  @override
  State<EmblemArrive> createState() => _EmblemArriveState();
}

class _EmblemArriveState extends State<EmblemArrive> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: widget.delay + EmblemArrive.duration);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      // The reduced setting can be switched on while it plays: finish at once.
      if (Motion.reduced(context) && _c.isAnimating) _c.value = 1;
      return;
    }
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
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        // The same widgets at rest as in flight: swapping the shape of the tree at the end would
        // rebuild the emblem under it and restart its idle drift.
        final pose = EmblemArrive.poseAt(_c.duration! * _c.value, delay: widget.delay, rise: widget.rise, from: widget.from);
        return Opacity(
          opacity: pose.opacity,
          child: Transform.translate(
            offset: Offset(0, pose.dy),
            child: Transform.scale(scale: pose.scale, child: child),
          ),
        );
      },
    );
  }
}
