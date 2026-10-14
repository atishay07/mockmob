// The ring that closes when a week is met: one 500 ms sweep, then a check. Ink, not volt, and
// one transform-free painter on a RepaintBoundary. Reduced motion shows the finished ring.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

class RingSweep extends StatefulWidget {
  const RingSweep({super.key, this.size = 44, this.animate = true, this.label});

  final double size;

  /// What the ring means, read by screen readers ("Week done" for a met week). Null leaves the
  /// ring to the words beside it, so it is never read out for a moment it does not describe.
  final String? label;

  /// False draws the finished ring at once.
  final bool animate;

  @override
  State<RingSweep> createState() => _RingSweepState();
}

class _RingSweepState extends State<RingSweep> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: Motion.milestone);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final ring = ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size.square(widget.size),
          painter: _RingPainter(progress: CurvedAnimation(parent: _controller, curve: Motion.out), color: colors.ink, track: colors.line),
        ),
      ),
    );
    final label = widget.label;
    return label == null ? ring : Semantics(label: label, image: true, child: ring);
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color, required this.track}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.075;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(rect, 0, 6.283185307179586, false, base..color = track);
    final t = progress.value;
    canvas.drawArc(
      rect,
      -1.5707963267948966,
      6.283185307179586 * t,
      false,
      base
        ..color = color
        ..strokeCap = StrokeCap.round,
    );
    // The check draws in over the last 30% of the sweep.
    final k = ((t - 0.7) / 0.3).clamp(0.0, 1.0);
    if (k <= 0) return;
    final c = size.center(Offset.zero);
    final u = size.width / 44;
    final a = c + Offset(-7 * u, 0.5 * u);
    final b = c + Offset(-2 * u, 5.5 * u);
    final d = c + Offset(7.5 * u, -5 * u);
    final path = Path()..moveTo(a.dx, a.dy);
    final firstLeg = (b - a).distance;
    final secondLeg = (d - b).distance;
    final drawn = (firstLeg + secondLeg) * k;
    if (drawn <= firstLeg) {
      final p = a + (b - a) * (drawn / firstLeg);
      path.lineTo(p.dx, p.dy);
    } else {
      path.lineTo(b.dx, b.dy);
      final p = b + (d - b) * ((drawn - firstLeg) / secondLeg);
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color || old.track != track;
}
