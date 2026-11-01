/// The stage's small motions, the web's keyframes in `stage.css` (A1 3.11): `st-in` (a 4 dp rise and fade), `st-pop`
/// (a key that turns on swells to 1.15 and back), `st-count` (a number that changes rises 45% into place), and the
/// line that opens in place (height and opacity). Transform and opacity only, on `Motion.out`; under reduced motion
/// each one is simply there.
library;

import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// `st-in`: [child] fades in while rising [rise] dp, over [duration] after [delay]. It plays when it is first
/// built and again whenever [replay] changes; [enabled] false shows it at rest (a page built already answered).
class StageIn extends StatefulWidget {
  const StageIn({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 200),
    this.delay = Duration.zero,
    this.rise = 4,
    this.replay,
    this.enabled = true,
  });

  final Widget child;
  final Duration duration;
  final Duration delay;
  final double rise;
  final Object? replay;
  final bool enabled;

  @override
  State<StageIn> createState() => _StageInState();
}

class _StageInState extends State<StageIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + widget.duration, value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.enabled) _play();
  }

  @override
  void didUpdateWidget(StageIn old) {
    super.didUpdateWidget(old);
    if (widget.replay != old.replay && widget.enabled) _play();
  }

  void _play() {
    if (Motion.reduced(context)) {
      _c.value = 1;
      return;
    }
    _c
      ..duration = widget.delay + widget.duration
      ..forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double _progress() {
    final total = widget.delay + widget.duration;
    if (total == Duration.zero) return 1;
    final start = widget.delay.inMicroseconds / total.inMicroseconds;
    final raw = ((_c.value - start) / (1 - start)).clamp(0.0, 1.0);
    return Motion.out.transform(raw);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = _progress();
        if (t >= 1) return child!;
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, widget.rise * (1 - t)), child: child));
      },
    );
  }
}

/// `st-pop`: when [on] turns true, [child] swells to [peak] and back over [duration] (180 ms, 1.15).
class StagePop extends StatefulWidget {
  const StagePop({super.key, required this.on, required this.child, this.peak = 1.15, this.duration = const Duration(milliseconds: 180)});

  final bool on;
  final Widget child;
  final double peak;
  final Duration duration;

  @override
  State<StagePop> createState() => _StagePopState();
}

class _StagePopState extends State<StagePop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration, value: 1);

  @override
  void didUpdateWidget(StagePop old) {
    super.didUpdateWidget(old);
    if (widget.on && !old.on && !Motion.reduced(context)) _c.forward(from: 0);
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
        final v = _c.value;
        if (v >= 1) return child!;
        // Up to the peak in the first half, back down in the second, each half on the out curve.
        final half = v < 0.5 ? Motion.out.transform(v * 2) : 1 - Motion.out.transform((v - 0.5) * 2);
        return Transform.scale(scale: 1 + (widget.peak - 1) * half, child: child);
      },
    );
  }
}

/// `st-count`: a number that changes rises 45% of its height into place and fades in over 160 ms. Keyed on
/// [value]; the first value is simply there.
class StageCount extends StatefulWidget {
  const StageCount({super.key, required this.value, required this.child});

  final Object value;
  final Widget child;

  @override
  State<StageCount> createState() => _StageCountState();
}

class _StageCountState extends State<StageCount> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 160), value: 1);

  @override
  void didUpdateWidget(StageCount old) {
    super.didUpdateWidget(old);
    if (widget.value != old.value && !Motion.reduced(context)) _c.forward(from: 0);
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
        final t = Motion.out.transform(_c.value);
        if (t >= 1) return child!;
        return Opacity(
          opacity: t,
          child: FractionalTranslation(translation: Offset(0, 0.45 * (1 - t)), child: child),
        );
      },
    );
  }
}

/// A block that opens in place: its height grows from 0 and it fades in over [duration] after [delay] (the line
/// you needed: 240 ms after 180 ms, A1 3.11). It opens when [open] turns true; built already open it is simply
/// there. [onOpened] runs once the block has its full height.
class StageReveal extends StatefulWidget {
  const StageReveal({
    super.key,
    required this.open,
    required this.child,
    this.duration = const Duration(milliseconds: 240),
    this.delay = const Duration(milliseconds: 180),
    this.onOpened,
  });

  final bool open;
  final Widget child;
  final Duration duration;
  final Duration delay;
  final VoidCallback? onOpened;

  @override
  State<StageReveal> createState() => _StageRevealState();
}

class _StageRevealState extends State<StageReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + widget.duration, value: widget.open ? 1 : 0);

  @override
  void didUpdateWidget(StageReveal old) {
    super.didUpdateWidget(old);
    if (widget.open == old.open) return;
    if (!widget.open) {
      _c.value = 0;
      return;
    }
    if (Motion.reduced(context)) {
      _c.value = 1;
      _opened();
      return;
    }
    unawaited(_c.forward(from: 0).then((_) => _opened()));
  }

  void _opened() {
    if (!mounted) return;
    widget.onOpened?.call();
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
        if (_c.value <= 0) return const SizedBox(width: double.infinity);
        final total = widget.delay + widget.duration;
        final start = total == Duration.zero ? 0.0 : widget.delay.inMicroseconds / total.inMicroseconds;
        final t = Motion.out.transform(((_c.value - start) / (1 - start)).clamp(0.0, 1.0));
        if (t >= 1) return child!;
        return ClipRect(
          child: Align(
            alignment: Alignment.topCenter,
            heightFactor: t,
            child: Opacity(opacity: t, child: child),
          ),
        );
      },
    );
  }
}
