import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// A small pile of paper cards, drawn with plain shapes. The pile is taller when more cards
/// are due (one, two or three layers), a quiet picture of the count and never a meter. The top
/// card carries a folded corner, the same notch Mobi's folded sheet has.
///
/// The pile is alive in three honest ways, all on transform and opacity inside one painter:
/// when it first appears the cards fan out from behind the top one (500 ms, once); the top card
/// then breathes, a slow 1.5 dp lift three times and then rests (it never loops on a resting
/// screen); and while [leaving] is true (Start was pressed) the top card slides off to the right
/// and fades, and comes back if Start did not go through. Under reduced motion the pile is
/// simply still.
class CardStackMark extends StatefulWidget {
  const CardStackMark({
    super.key,
    required this.count,
    this.size = const Size(72, 64),
    this.leaving = false,
  });

  final int count;
  final Size size;

  /// The top card has been sent off (Start is running).
  final bool leaving;

  int get layers => count <= 0 ? 1 : (count < 5 ? 2 : 3);

  /// Breaths of the top card before it rests.
  static const int breaths = 3;

  @override
  State<CardStackMark> createState() => _CardStackMarkState();
}

class _CardStackMarkState extends State<CardStackMark>
    with TickerProviderStateMixin {
  late final AnimationController _fan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
    value: 1,
  );
  late final AnimationController _breath = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3000 * CardStackMark.breaths),
    value: 1,
  );
  late final AnimationController _leave = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 320),
    reverseDuration: const Duration(milliseconds: 260),
    value: 0,
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      if (widget.leaving) _leave.value = 1;
      return;
    }
    _fan.forward(from: 0).whenComplete(() {
      // The top card breathes once the pile has settled.
      if (mounted) _breath.forward(from: 0);
    });
    if (widget.leaving) _leave.forward();
  }

  @override
  void didUpdateWidget(CardStackMark old) {
    super.didUpdateWidget(old);
    if (old.leaving == widget.leaving) return;
    if (Motion.reduced(context)) {
      _leave.value = widget.leaving ? 1 : 0;
    } else if (widget.leaving) {
      _leave.forward();
    } else {
      _leave.reverse();
    }
  }

  @override
  void dispose() {
    _fan.dispose();
    _breath.dispose();
    _leave.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: Listenable.merge([_fan, _breath, _leave]),
          builder: (context, _) => CustomPaint(
            size: widget.size,
            painter: StackPainter(
              layers: widget.layers,
              top: colors.raised,
              under: colors.raised2,
              edge: colors.lineStrong,
              notch: colors.sunken,
              fan: Motion.out.transform(_fan.value),
              // Three slow breaths over the run, resting at zero.
              breath: _breath.value >= 1
                  ? 0
                  : math.sin(2 * math.pi * CardStackMark.breaths * _breath.value),
              leave: Motion.out.transform(_leave.value),
            ),
          ),
        ),
      ),
    );
  }
}

/// Paints the pile. Public so tests can read what a frame was asked to draw.
class StackPainter extends CustomPainter {
  const StackPainter({
    required this.layers,
    required this.top,
    required this.under,
    required this.edge,
    required this.notch,
    this.fan = 1,
    this.breath = 0,
    this.leave = 0,
  });

  final int layers;
  final Color top;
  final Color under;
  final Color edge;
  final Color notch;

  /// How far the back cards have fanned out from behind the top card, 0 to 1.
  final double fan;

  /// The top card's breath, -1 to 1 (0 at rest).
  final double breath;

  /// How far the top card has slid off, 0 to 1.
  final double leave;

  static const double _lift = 7;
  static const double _radius = 10;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.25
      ..color = edge;
    final inset = (layers - 1) * _lift;
    final cardHeight = size.height - inset;
    // Back cards peek out above the top card, a little narrower each. While fanning, each one
    // starts level with the top card and rises to its place a beat after the one in front.
    for (var i = layers - 1; i >= 0; i--) {
      final shrink = i * 6.0;
      final own = i == 0
          ? 1.0
          : ((fan - (i - 1) * 0.18) / 0.64).clamp(0.0, 1.0);
      final lift = i * _lift * own;
      final rect = Rect.fromLTWH(
        shrink * own,
        inset - lift,
        size.width - shrink * own * 2,
        cardHeight,
      );
      final rrect = RRect.fromRectAndRadius(
        rect,
        const Radius.circular(_radius),
      );
      if (i == 0) {
        canvas.save();
        // The top card: a breath lifts it 1.5 dp; Start slides it off, tilting a little.
        final dx = leave * size.width * 1.15;
        canvas.translate(dx, -1.5 * breath.clamp(0.0, 1.0));
        if (leave > 0) {
          canvas.translate(rect.center.dx, rect.center.dy);
          canvas.rotate(leave * 0.16);
          canvas.translate(-rect.center.dx, -rect.center.dy);
          canvas.saveLayer(
            rect.inflate(4),
            Paint()..color = Color.fromRGBO(0, 0, 0, 1 - leave * 0.85),
          );
        }
        canvas.drawRRect(rrect, Paint()..color = top);
        canvas.drawRRect(rrect, stroke);
        _foldedCorner(canvas, rect);
        if (leave > 0) canvas.restore();
        canvas.restore();
      } else {
        canvas.drawRRect(rrect, Paint()..color = under);
        canvas.drawRRect(rrect, stroke);
      }
    }
  }

  void _foldedCorner(Canvas canvas, Rect r) {
    const n = 14.0;
    final path = Path()
      ..moveTo(r.right - n, r.top)
      ..lineTo(r.right, r.top + n)
      ..lineTo(r.right - n, r.top + n)
      ..close();
    canvas.drawPath(path, Paint()..color = notch);
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.25
        ..strokeJoin = StrokeJoin.round
        ..color = edge,
    );
  }

  @override
  bool shouldRepaint(StackPainter old) =>
      old.layers != layers ||
      old.top != top ||
      old.under != under ||
      old.edge != edge ||
      old.notch != notch ||
      old.fan != fan ||
      old.breath != breath ||
      old.leave != leave;
}
