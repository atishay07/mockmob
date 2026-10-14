import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'mobi_acts.dart';
import 'mobi_character.dart';
import 'mobi_controller.dart';
import 'mobi_figure.dart';
import 'mobi_geometry.dart';
import 'mobi_palette.dart';

/// Mobi walking along a row: from [fromX] to [toX] (the left edge of his box, in dp from the
/// walker's left) over [duration], stepping with the walk bob, looking where he is going, a
/// short trail of light behind the antenna bulb. On arrival he looks ahead again and
/// [onArrive] gets his controller for the arrival act (a nod, a point, a hello).
///
/// Under reduced motion he simply stands at [toX] and [onArrive] runs after the first frame.
/// The walker is as wide as the trip plus Mobi; it lays out once, and the trip itself is paint
/// only (a transform and the trail painter).
class MobiWalker extends StatefulWidget {
  const MobiWalker({
    super.key,
    this.size = 72,
    required this.fromX,
    required this.toX,
    this.duration = const Duration(milliseconds: 1400),
    this.onArrive,
    this.controller,
    this.seed = 7,
    this.semanticLabel,
  });

  /// Mobi's height in dp.
  final double size;
  final double fromX;
  final double toX;
  final Duration duration;
  final ValueChanged<MobiController>? onArrive;

  /// Drives Mobi during and after the walk; the walker makes its own when null.
  final MobiController? controller;
  final int seed;
  final String? semanticLabel;

  @override
  State<MobiWalker> createState() => _MobiWalkerState();
}

class _MobiWalkerState extends State<MobiWalker> with SingleTickerProviderStateMixin {
  late final AnimationController _trip = AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _x = CurvedAnimation(parent: _trip, curve: Curves.easeInOutSine);
  MobiController? _own;
  MobiController get _mobi => widget.controller ?? (_own ??= MobiController());
  final GlobalKey _figure = GlobalKey();
  bool _begun = false;
  bool _arrived = false;

  @override
  void initState() {
    super.initState();
    _trip.addStatusListener((s) {
      if (s == AnimationStatus.completed) _arrive();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    final reduced = Motion.reduced(context);
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (reduced) {
        _trip.value = 1;
        _arrive();
        return;
      }
      // Look the way he is going: a point far off along the row, at eye height.
      final box = _figure.currentContext?.findRenderObject();
      if (box is RenderBox && box.hasSize) {
        final dir = widget.toX >= widget.fromX ? 1.0 : -1.0;
        _mobi.lookAt(box.localToGlobal(Offset(box.size.width / 2 + dir * 600, box.size.height * 0.3)));
      }
      _mobi.playFor(MobiAct.walk, widget.duration);
      _trip.forward();
    });
  }

  void _arrive() {
    if (_arrived || !mounted) return;
    _arrived = true;
    _mobi.lookAt(null);
    widget.onArrive?.call(_mobi);
  }

  @override
  void dispose() {
    _trip.dispose();
    _own?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = MobiFigure.widthFor(widget.size);
    final night = context.mmColors.isNight;
    final mobi = MobiCharacter(
      key: _figure,
      controller: _mobi,
      size: widget.size,
      entrance: MobiAct.idle,
      seed: widget.seed,
      semanticLabel: widget.semanticLabel,
      watchTaps: false,
    );
    return SizedBox(
      width: math.max(widget.fromX, widget.toX) + w,
      height: widget.size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: RepaintBoundary(
              child: CustomPaint(
                painter: _TrailPainter(raw: _trip, fromX: widget.fromX, toX: widget.toX, size: widget.size, night: night),
              ),
            ),
          ),
          Positioned(
            left: 0,
            top: 0,
            child: AnimatedBuilder(
              animation: _x,
              builder: (context, child) => Transform.translate(offset: Offset(widget.fromX + (widget.toX - widget.fromX) * _x.value, 0), child: child),
              child: mobi,
            ),
          ),
        ],
      ),
    );
  }
}

/// A few fading dots where the antenna bulb just was: only while Mobi is moving.
class _TrailPainter extends CustomPainter {
  _TrailPainter({required this.raw, required this.fromX, required this.toX, required this.size, required this.night})
      : super(repaint: raw);

  final Animation<double> raw;
  final double fromX;
  final double toX;
  final double size;
  final bool night;

  @override
  void paint(Canvas canvas, Size box) {
    final t = raw.value;
    if (t <= 0 || t >= 1) return;
    final moving = math.sin(math.pi * t);
    final scale = size / MobiGeo.height;
    final tip = MobiGeo.antennaTip + const Offset(0, MobiGeo.bodyDrop);
    final color = night ? MobiPalette.lime : MobiPalette.limeDeep;
    for (var i = 1; i <= 4; i++) {
      final ti = (t - i * 0.035).clamp(0.0, 1.0);
      final xi = fromX + (toX - fromX) * Curves.easeInOutSine.transform(ti);
      final alpha = (night ? 0.42 : 0.5) * moving * (1 - i / 5);
      if (alpha < 0.02) continue;
      canvas.drawCircle(
        Offset(xi + tip.dx * scale, tip.dy * scale),
        MobiGeo.antennaBall * scale * (0.85 - i * 0.14),
        Paint()..color = color.withValues(alpha: alpha),
      );
    }
  }

  @override
  bool shouldRepaint(_TrailPainter old) => old.fromX != fromX || old.toX != toX || old.size != size || old.night != night;
}
