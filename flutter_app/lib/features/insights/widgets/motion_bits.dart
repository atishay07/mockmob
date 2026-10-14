import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';

/// Rises into place once, when it is first built: a fade and a short translate (transform and
/// opacity only), [delay] after it appears. Used for things that arrive as a set (Ask's prompts
/// and follow-ups), never for text that is scrolled to: a lazily built list does not fade its
/// sections in. Under reduced motion (or a test with animations off) it is simply there.
class RiseIn extends StatefulWidget {
  const RiseIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = Motion.glideDuration,
    this.dy = 12,
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

/// Calls [onVisible] once, when this widget's top edge is [lead] dp inside the viewport of the
/// nearest vertical scrollable (at once when there is none, or when it already is). A lazily built
/// list builds a little ahead of the screen, so a chart that started drawing when it was built had
/// finished before anyone scrolled to it; this starts it when it can be seen.
class WhenInView extends StatefulWidget {
  const WhenInView({super.key, required this.onVisible, required this.child, this.lead = 72});

  final VoidCallback onVisible;
  final Widget child;

  /// How far above the viewport's bottom edge the widget's top must be.
  final double lead;

  @override
  State<WhenInView> createState() => _WhenInViewState();
}

class _WhenInViewState extends State<WhenInView> {
  ScrollPosition? _position;
  bool _fired = false;
  bool _queued = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_fired) return;
    final position = Scrollable.maybeOf(context, axis: Axis.vertical)?.position;
    if (!identical(position, _position)) {
      _position?.removeListener(_queue);
      _position = position;
      _position?.addListener(_queue);
    }
    _queue();
  }

  @override
  void dispose() {
    _position?.removeListener(_queue);
    super.dispose();
  }

  /// The scroll position tells us before the frame has laid the list out, so where this box is is
  /// still where it was a moment ago: look after the frame, never inside the notification.
  void _queue() {
    if (_queued || _fired) return;
    _queued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _queued = false;
      _check();
    });
  }

  void _check() {
    if (_fired || !mounted) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) {
      _queue();
      return;
    }
    final scrollable = Scrollable.maybeOf(context, axis: Axis.vertical);
    final viewport = scrollable?.context.findRenderObject();
    var visible = true;
    if (viewport is RenderBox && viewport.hasSize) {
      final top = box.localToGlobal(Offset.zero, ancestor: viewport).dy;
      visible = top <= viewport.size.height - widget.lead;
    }
    if (!visible) return;
    _fired = true;
    _position?.removeListener(_queue);
    _position = null;
    widget.onVisible();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// A value that runs from 0 to 1 over [duration] once its place is in view (once per visit, never
/// under reduced motion, where it is complete at once), for bars and charts whose painters take a
/// 0 to 1 progress. Before it is seen, the painter gets 0: the empty track.
class GrowIn extends StatefulWidget {
  const GrowIn({
    super.key,
    required this.builder,
    this.delay = Duration.zero,
    this.duration = Motion.drawIn,
    this.curve = Motion.emphasized,
  });

  /// Receives the eased progress, 0 to 1.
  final Widget Function(BuildContext context, double t) builder;
  final Duration delay;
  final Duration duration;
  final Curve curve;

  @override
  State<GrowIn> createState() => _GrowInState();
}

class _GrowInState extends State<GrowIn> with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + widget.duration);
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(widget.delay.inMicroseconds / (widget.delay + widget.duration).inMicroseconds, 1, curve: widget.curve),
  );
  bool _started = false;
  bool _drawn = false;

  /// Once drawn, a chart stays built while it scrolls away, so it never draws a second time.
  @override
  bool get wantKeepAlive => _drawn;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) _c.value = 1;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _seen() {
    if (!mounted || _c.value >= 1 || _c.isAnimating) return;
    _drawn = true;
    updateKeepAlive();
    _c.forward();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return WhenInView(
      onVisible: _seen,
      child: AnimatedBuilder(animation: _t, builder: (context, _) => widget.builder(context, _t.value)),
    );
  }
}

/// A whole-number-or-formatted figure that counts up to [value] once its place is in view, then
/// follows [value] whenever it changes (from the number it showed, never from 0 on a refresh).
/// Under reduced motion it shows the value. Tabular figures, so the width never jitters.
class CountOnView extends StatefulWidget {
  const CountOnView({super.key, required this.value, required this.style, this.format, this.delay = Duration.zero, this.textAlign});

  final int value;
  final TextStyle style;
  final String Function(num value)? format;
  final Duration delay;
  final TextAlign? textAlign;

  @override
  State<CountOnView> createState() => _CountOnViewState();
}

class _CountOnViewState extends State<CountOnView> with AutomaticKeepAliveClientMixin {
  bool _seen = false;

  @override
  bool get wantKeepAlive => _seen;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    // Before it is seen the figure rests at 0 (the same box, so nothing moves); once seen it
    // counts from there to its value.
    return WhenInView(
      onVisible: () {
        if (!mounted) return;
        setState(() => _seen = true);
        updateKeepAlive();
      },
      child: MmCountUp(
        value: _seen || Motion.reduced(context) ? widget.value : 0,
        style: widget.style,
        format: widget.format,
        delay: widget.delay,
        textAlign: widget.textAlign,
        semanticsLabel: (widget.format ?? (n) => n.round().toString())(widget.value),
      ),
    );
  }
}
