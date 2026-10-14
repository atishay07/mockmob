import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';

/// A placeholder in the warm well colour, drawn in the shape of what will replace it (a line, a
/// tile, a circle for an avatar or a bubble). Static by itself; inside a
/// `SkeletonGroup(shimmer: true)` one warm light band crosses it and its neighbours as a single
/// field of light.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius = MmRadius.small, this.shape});

  final double? width;
  final double height;
  final double radius;

  /// The final layout's shape. Null is a rounded rectangle with [radius].
  final ShapeBorder? shape;

  /// A text-line placeholder.
  const Skeleton.line({super.key, this.width, this.height = 14})
      : radius = 7,
        shape = null;

  /// A round placeholder (an avatar, a bubble, Mobi's spot).
  const Skeleton.circle({super.key, required double size})
      : width = size,
        height = size,
        radius = 0,
        shape = const CircleBorder();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final scope = _ShimmerScope.maybeOf(context);
    final resolved = shape ?? RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));
    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: scope == null
          ? DecoratedBox(decoration: ShapeDecoration(color: colors.raised2, shape: resolved))
          : _ShimmerBlock(
              shape: resolved,
              base: colors.raised2,
              // A band the eye can follow on the ground: warm paper light on Night (24%), white on
              // Daylight (70%).
              band: colors.isNight
                  ? Color.lerp(colors.ink, colors.lamp, 0.35)!.withValues(alpha: 0.24)
                  : const Color(0xFFFFFFFF).withValues(alpha: 0.7),
              progress: scope.progress,
              group: scope.group,
            ),
    );
  }
}

/// Wraps a group of [Skeleton]s so a screen reader hears one "Loading" instead of nothing.
///
/// With [shimmer] (or [SkeletonGroup.shimmerByDefault]) one soft warm band sweeps across every
/// skeleton in the group, in one continuous field: each block paints its own slice of the same
/// band, so there are no layers. It sweeps at most [Motion.shimmerSweeps] times and then rests
/// (a slow network should say so in words, not with a light show). Static under reduced motion.
class SkeletonGroup extends StatefulWidget {
  const SkeletonGroup({super.key, required this.child, this.label = 'Loading', this.shimmer});

  final Widget child;
  final String label;

  /// Null follows [shimmerByDefault].
  final bool? shimmer;

  /// Flip once in `main()` to light every group in the app (tests keep the static default).
  static bool shimmerByDefault = false;

  @override
  State<SkeletonGroup> createState() => _SkeletonGroupState();
}

class _SkeletonGroupState extends State<SkeletonGroup> with SingleTickerProviderStateMixin {
  final GlobalKey _group = GlobalKey(debugLabel: 'skeleton-group');
  AnimationController? _controller;
  bool _decided = false;

  bool get _wanted => widget.shimmer ?? SkeletonGroup.shimmerByDefault;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    if (!_wanted || Motion.reduced(context)) return;
    // One controller runs every sweep and rest in a single pass, then stops for good.
    _controller = AnimationController(vsync: this, duration: (Motion.shimmerSweep + Motion.shimmerRest) * Motion.shimmerSweeps)
      ..forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  RenderBox? _groupBox() {
    final box = _group.currentContext?.findRenderObject();
    return box is RenderBox && box.hasSize ? box : null;
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    Widget child = RepaintBoundary(key: _group, child: widget.child);
    if (controller != null) child = _ShimmerScope(progress: controller, group: _groupBox, child: child);
    return Semantics(container: true, label: widget.label, excludeSemantics: true, child: child);
  }
}

class _ShimmerScope extends InheritedWidget {
  const _ShimmerScope({required this.progress, required this.group, required super.child});

  final Animation<double> progress;
  final RenderBox? Function() group;

  static _ShimmerScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_ShimmerScope>();

  @override
  bool updateShouldNotify(_ShimmerScope old) => old.progress != progress;
}

class _ShimmerBlock extends LeafRenderObjectWidget {
  const _ShimmerBlock({required this.shape, required this.base, required this.band, required this.progress, required this.group});

  final ShapeBorder shape;
  final Color base;
  final Color band;
  final Animation<double> progress;
  final RenderBox? Function() group;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderShimmerBlock(shape: shape, base: base, band: band, progress: progress, group: group);

  @override
  void updateRenderObject(BuildContext context, _RenderShimmerBlock renderObject) {
    renderObject
      ..shape = shape
      ..base = base
      ..band = band
      ..progress = progress
      ..group = group;
  }
}

class _RenderShimmerBlock extends RenderBox {
  _RenderShimmerBlock({
    required this._shape,
    required this._base,
    required this._band,
    required this._progress,
    required this.group,
  });

  ShapeBorder _shape;
  set shape(ShapeBorder value) {
    if (value == _shape) return;
    _shape = value;
    markNeedsPaint();
  }

  Color _base;
  set base(Color value) {
    if (value == _base) return;
    _base = value;
    markNeedsPaint();
  }

  Color _band;
  set band(Color value) {
    if (value == _band) return;
    _band = value;
    markNeedsPaint();
  }

  Animation<double> _progress;
  set progress(Animation<double> value) {
    if (value == _progress) return;
    if (attached) {
      _progress.removeListener(markNeedsPaint);
      value.addListener(markNeedsPaint);
    }
    _progress = value;
    markNeedsPaint();
  }

  RenderBox? Function() group;

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _progress.addListener(markNeedsPaint);
  }

  @override
  void detach() {
    _progress.removeListener(markNeedsPaint);
    super.detach();
  }

  @override
  bool get sizedByParent => true;

  @override
  Size computeDryLayout(BoxConstraints constraints) => constraints.biggest.isFinite ? constraints.biggest : constraints.smallest;

  @override
  void paint(PaintingContext context, Offset offset) {
    final rect = offset & size;
    final path = _shape.getOuterPath(rect);
    final canvas = context.canvas;
    canvas.drawPath(path, Paint()..color = _base);

    // The band runs only during the sweep part of the cycle, then rests out of sight.
    final cycle = Motion.shimmerSweep.inMicroseconds / (Motion.shimmerSweep + Motion.shimmerRest).inMicroseconds;
    final whole = _progress.value;
    if (whole <= 0 || whole >= 1) return;
    // Where this sweep is: the controller runs every sweep in one pass.
    final raw = ((whole * Motion.shimmerSweeps) % 1.0) / cycle;
    if (raw <= 0 || raw >= 1) return;
    final t = Curves.easeInOut.transform(raw);

    final groupBox = group();
    final origin = groupBox == null || !groupBox.attached ? Offset.zero : localToGlobal(Offset.zero, ancestor: groupBox);
    final width = groupBox?.size.width ?? size.width;
    final half = (width * 0.35).clamp(80.0, 220.0);
    final centre = -half + (width + 2 * half) * t;
    // The band in this block's coordinates: the same light crosses every block at once.
    final left = offset.dx + centre - half - origin.dx;
    final bandRect = Rect.fromLTWH(left, rect.top - origin.dy, half * 2, (groupBox?.size.height ?? size.height));
    final transparent = _band.withValues(alpha: 0);
    canvas.drawPath(
      path,
      Paint()
        ..shader = LinearGradient(
          begin: const Alignment(-1, -0.25),
          end: const Alignment(1, 0.25),
          colors: [transparent, _band, transparent],
        ).createShader(bandRect),
    );
  }
}

/// A ready-made placeholder in the shape of what will arrive, with no box around it (a card of
/// grey bars announces nothing; the real screen's text and numbers sit on the ground, so the
/// placeholder does too). Put several in one `SkeletonGroup`.
///
/// [hero] mirrors the focal block of a screen: a small caption, the title, one monumental
/// number with its meaning beside it, and the action pill. Otherwise it mirrors a plain block: a
/// heading line and two lines of text.
class MmSkeletonCard extends StatelessWidget {
  const MmSkeletonCard({super.key, this.hero = false});

  final bool hero;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (hero) ...[
          const Skeleton.line(width: 84, height: 11),
          const SizedBox(height: 10),
          const Skeleton.line(width: 168, height: 22),
          const SizedBox(height: 22),
          const Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Skeleton(width: 92, height: 88, radius: 20),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [Skeleton.line(width: 132, height: 16), SizedBox(height: 10), Skeleton.line(width: 96, height: 12)],
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          const Skeleton(height: 52, radius: 26),
        ] else ...[
          const Skeleton.line(width: 120, height: 18),
          const SizedBox(height: 14),
          const Skeleton.line(),
          const SizedBox(height: 8),
          const Skeleton.line(width: 220),
        ],
      ],
    );
  }
}

/// Placeholder rows in the shape of an `MmRowGroup`, without its box: a leading mark, a title and
/// a note per row, divided by inset hairlines, the line widths varying so the stack does not read
/// as a table of identical bars.
class MmSkeletonRows extends StatelessWidget {
  const MmSkeletonRows({super.key, this.rows = 3});

  final int rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < rows; i++) ...[
          if (i > 0)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 56),
              child: SizedBox(height: 1, child: ColoredBox(color: colors.line.withValues(alpha: 0.8))),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                const Skeleton.circle(size: 40),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Skeleton.line(width: 110 + 28.0 * (i % 3), height: 14),
                      const SizedBox(height: 8),
                      Skeleton.line(width: 190 - 24.0 * (i % 2), height: 12),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
