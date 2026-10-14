import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'motion.dart';

/// The first [t] (0 to 1) of [path] by length, contour after contour in drawing order, so an
/// outline, a check or a rail draws in as one pen stroke.
Path mmPathPrefix(Path path, double t, {List<PathMetric>? metrics}) {
  final all = metrics ?? path.computeMetrics().toList(growable: false);
  if (t >= 1) return path;
  final out = Path();
  if (t <= 0) return out;
  final total = all.fold<double>(0, (sum, m) => sum + m.length);
  var left = total * t;
  for (final m in all) {
    if (left <= 0) break;
    final take = math.min(left, m.length);
    out.addPath(m.extractPath(0, take), Offset.zero);
    left -= take;
  }
  return out;
}

/// Paths the motion primitives draw, in a box of [size].
abstract final class MmPaths {
  /// A check mark centred in [rect]: short stroke down, long stroke up.
  static Path check(Rect rect) {
    final w = rect.width;
    final h = rect.height;
    return Path()
      ..moveTo(rect.left + w * 0.22, rect.top + h * 0.53)
      ..lineTo(rect.left + w * 0.42, rect.top + h * 0.72)
      ..lineTo(rect.left + w * 0.78, rect.top + h * 0.32);
  }

  /// [check] filling a box of [size], for [MmStrokeDraw.path].
  static Path checkFor(Size size) => check(Offset.zero & size);

  /// [ring] filling a box of [size], for [MmStrokeDraw.path].
  static Path ringFor(Size size) => ring(Offset.zero & size);

  /// A circle that starts at twelve o'clock and runs clockwise.
  static Path ring(Rect rect) {
    final r = rect.shortestSide / 2;
    return Path()..addArc(Rect.fromCircle(center: rect.center, radius: r), -math.pi / 2, math.pi * 2 - 0.0001);
  }
}

/// Paints the first [progress] of a path built for the canvas size.
class MmStrokeDrawPainter extends CustomPainter {
  MmStrokeDrawPainter({
    required this.path,
    required this.progress,
    required this.color,
    this.strokeWidth = 2,
    this.cap = StrokeCap.round,
  }) : super(repaint: progress);

  final Path Function(Size size) path;
  final Animation<double> progress;
  final Color color;
  final double strokeWidth;
  final StrokeCap cap;

  Size? _cachedFor;
  Path? _path;
  List<PathMetric>? _metrics;

  @override
  void paint(Canvas canvas, Size size) {
    final t = progress.value.clamp(0.0, 1.0);
    if (t <= 0) return;
    if (_cachedFor != size) {
      _cachedFor = size;
      _path = path(size);
      _metrics = _path!.computeMetrics().toList(growable: false);
    }
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = cap
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    canvas.drawPath(t >= 1 ? _path! : mmPathPrefix(_path!, t, metrics: _metrics), paint);
  }

  @override
  bool shouldRepaint(MmStrokeDrawPainter old) =>
      old.progress != progress || old.color != color || old.strokeWidth != strokeWidth || old.cap != cap || old.path != path;
}

/// A stroke that draws itself in: an outline, a check, a rail. It draws once when it first builds
/// (after [delay]) while [drawn] is true, draws back out when [drawn] turns false, and in again when
/// it turns true. Under reduced motion it is simply there (or not). [onDrawn] fires when a draw
/// lands. Painted on its own layer; nothing is laid out per frame.
class MmStrokeDraw extends StatefulWidget {
  const MmStrokeDraw({
    super.key,
    required this.path,
    required this.color,
    this.size,
    this.strokeWidth = 2,
    this.cap = StrokeCap.round,
    this.drawn = true,
    this.duration = Motion.drawIn,
    this.curve = Motion.emphasized,
    this.delay = Duration.zero,
    this.animateFirst = true,
    this.onDrawn,
  });

  /// The path for a box of the given size. Keep it a stable function (a static or a top-level
  /// one) so the cached metrics survive rebuilds.
  final Path Function(Size size) path;
  final Color color;

  /// The box. Null takes the parent's constraints.
  final Size? size;
  final double strokeWidth;
  final StrokeCap cap;
  final bool drawn;
  final Duration duration;
  final Curve curve;
  final Duration delay;

  /// False shows the first build already drawn (a list that rebuilds should not redraw).
  final bool animateFirst;
  final VoidCallback? onDrawn;

  @override
  State<MmStrokeDraw> createState() => _MmStrokeDrawState();
}

class _MmStrokeDrawState extends State<MmStrokeDraw> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: widget.duration)..addStatusListener(_status);
  late final CurvedAnimation _curved = CurvedAnimation(parent: _t, curve: widget.curve, reverseCurve: Motion.exit);
  bool _begun = false;

  void _status(AnimationStatus s) {
    if (s == AnimationStatus.completed) widget.onDrawn?.call();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    if (!widget.drawn) return;
    if (!widget.animateFirst || Motion.reduced(context)) {
      _t.value = 1;
      return;
    }
    // The delay is the lead of one timeline (no timer), so nothing is left pending if the stroke
    // leaves the tree first.
    final total = widget.delay + widget.duration;
    final lead = total.inMicroseconds == 0 ? 0.0 : widget.delay.inMicroseconds / total.inMicroseconds;
    _t.duration = total;
    _curved.curve = Interval(lead, 1, curve: widget.curve);
    _t.forward();
  }

  @override
  void didUpdateWidget(MmStrokeDraw old) {
    super.didUpdateWidget(old);
    if (old.drawn == widget.drawn) return;
    _t.duration = widget.duration;
    _curved.curve = widget.curve;
    if (Motion.reduced(context)) {
      _t.value = widget.drawn ? 1 : 0;
    } else if (widget.drawn) {
      _t.forward();
    } else {
      _t.reverse();
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final paint = CustomPaint(
      size: widget.size ?? Size.zero,
      painter: MmStrokeDrawPainter(
        path: widget.path,
        progress: _curved,
        color: widget.color,
        strokeWidth: widget.strokeWidth,
        cap: widget.cap,
      ),
    );
    return RepaintBoundary(child: widget.size == null ? SizedBox.expand(child: paint) : paint);
  }
}

/// A one-shot ring that expands from the centre of its child and fades: a tap landing on a bubble,
/// a mark being set, an object being touched. Each change of [pulse] plays it once; it paints over
/// nothing but its own band (no layout change, no text covered: the ring runs outside the child's
/// face and is gone in [duration]). Nothing under reduced motion.
class MmRippleRing extends StatefulWidget {
  const MmRippleRing({
    super.key,
    required this.child,
    required this.pulse,
    required this.color,
    this.from = 0.5,
    this.to = 1.0,
    this.strokeWidth = 2,
    this.duration = const Duration(milliseconds: 520),
  });

  final Widget child;
  final ValueListenable<int> pulse;
  final Color color;

  /// Start and end radius as a share of the child's shortest side (0.5 starts at the face's edge,
  /// 1.0 ends one face radius beyond it).
  final double from;
  final double to;
  final double strokeWidth;
  final Duration duration;

  @override
  State<MmRippleRing> createState() => _MmRippleRingState();
}

class _MmRippleRingState extends State<MmRippleRing> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: widget.duration, value: 1);

  @override
  void initState() {
    super.initState();
    widget.pulse.addListener(_play);
  }

  @override
  void didUpdateWidget(MmRippleRing old) {
    super.didUpdateWidget(old);
    _t.duration = widget.duration;
    if (old.pulse != widget.pulse) {
      old.pulse.removeListener(_play);
      widget.pulse.addListener(_play);
    }
  }

  void _play() {
    if (!mounted || Motion.reduced(context)) return;
    _t.forward(from: 0);
  }

  @override
  void dispose() {
    widget.pulse.removeListener(_play);
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      foregroundPainter: _RingPainter(
        t: _t,
        color: widget.color,
        from: widget.from,
        to: widget.to,
        strokeWidth: widget.strokeWidth,
      ),
      child: widget.child,
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.t, required this.color, required this.from, required this.to, required this.strokeWidth})
      : super(repaint: t);

  final Animation<double> t;
  final Color color;
  final double from;
  final double to;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final v = t.value;
    if (v <= 0 || v >= 1) return;
    final e = Motion.out.transform(v);
    final half = size.shortestSide / 2;
    final r = half * (from + (to - from) * e) * 2;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth * (1 - 0.6 * e)
      ..color = color.withValues(alpha: color.a * (1 - v) * (1 - v));
    canvas.drawCircle(size.center(Offset.zero), r, paint);
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.t != t || old.color != color || old.from != from || old.to != to || old.strokeWidth != strokeWidth;
}
