import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// Text engraved onto the screen: revealed left to right by a clip (brief section 7, 280 ms), after
/// [delay]. Only the clip moves, so the text is laid out once. Reduced motion shows it at once.
class Engrave extends StatefulWidget {
  const Engrave({super.key, required this.child, this.delay = Duration.zero, this.duration = Motion.engrave});

  final Widget child;
  final Duration delay;
  final Duration duration;

  @override
  State<Engrave> createState() => _EngraveState();
}

class _EngraveState extends State<Engrave> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Motion.out);
  Timer? _wait;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      _wait = Timer(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRect(clipper: _WidthClip(_t), child: widget.child);
  }
}

class _WidthClip extends CustomClipper<Rect> {
  _WidthClip(this.t) : super(reclip: t);

  final Animation<double> t;

  @override
  Rect getClip(Size size) {
    final v = t.value;
    if (v >= 1) return Rect.fromLTRB(-size.width, -size.height, size.width * 2, size.height * 2);
    // A little room above and below for ascenders and descenders.
    return Rect.fromLTRB(-8, -size.height * 0.5, size.width * v, size.height * 1.5);
  }

  @override
  bool shouldReclip(_WidthClip old) => old.t != t;
}

/// Content that arrives once: rises [rise] dp and fades in over [duration] after [delay], on the
/// emphasized curve. Transform and opacity only.
class Arrive extends StatefulWidget {
  const Arrive({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 420),
    this.rise = 14,
    this.turn = 0,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final double rise;

  /// A small rotation it settles out of, in radians (a sheet set down on the desk).
  final double turn;

  @override
  State<Arrive> createState() => _ArriveState();
}

class _ArriveState extends State<Arrive> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration);
  Timer? _wait;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      _wait = Timer(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final v = _c.value;
        if (v >= 1) return child!;
        final t = Motion.emphasized.transform(v);
        final fade = Motion.glide.transform((v / 0.6).clamp(0.0, 1.0));
        // Semantics stay in while it arrives, so TalkBack never waits on the motion.
        return Opacity(
          opacity: fade,
          alwaysIncludeSemantics: true,
          child: Transform(
            alignment: Alignment.bottomCenter,
            transform: Matrix4.translationValues(0, widget.rise * (1 - t), 0)..rotateZ(widget.turn * (1 - t)),
            child: child,
          ),
        );
      },
    );
  }
}
