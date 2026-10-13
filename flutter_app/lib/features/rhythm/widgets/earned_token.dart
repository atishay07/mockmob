// The earned moment of a milestone path (owner 13 Oct: milestones should feel earned, Mobi
// animated like Duo). When a step lands, the path's brass token settles into place while one
// ring sweeps round it, once, within the 500 ms milestone ceiling. The ring then stays as a thin
// mark of "landed on this visit". Under reduced motion the finished state is drawn at once:
// token in place, ring closed. One painter on a RepaintBoundary, no loops.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

class EarnedToken extends StatefulWidget {
  const EarnedToken({super.key, required this.child, this.size = 64, this.animate = true});

  /// The token art, drawn at [size] minus the ring's room.
  final Widget child;
  final double size;

  /// False draws the finished state at once.
  final bool animate;

  @override
  State<EarnedToken> createState() => _EarnedTokenState();
}

class _EarnedTokenState extends State<EarnedToken> with SingleTickerProviderStateMixin {
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
    // The settle: from 0.94 and a little below its place, with a soft overshoot. Never from 0.
    final settle = CurvedAnimation(parent: _controller, curve: const Interval(0, 0.8, curve: Curves.easeOutBack));
    final sweep = CurvedAnimation(parent: _controller, curve: Motion.out);
    final ring = colors.isNight ? colors.volt : colors.accentText;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: widget.size,
        child: RepaintBoundary(
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned.fill(
                child: CustomPaint(painter: _SweepPainter(progress: sweep, color: ring, track: colors.line)),
              ),
              AnimatedBuilder(
                animation: settle,
                builder: (context, child) {
                  final t = settle.value;
                  return Opacity(
                    opacity: (0.4 + 0.6 * _controller.value).clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, 4 * (1 - t)),
                      child: Transform.scale(scale: 0.94 + 0.06 * t, child: child),
                    ),
                  );
                },
                child: Padding(padding: const EdgeInsets.all(5), child: widget.child),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SweepPainter extends CustomPainter {
  _SweepPainter({required this.progress, required this.color, required this.track}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 2.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 2 * math.pi, false, paint..color = track);
    final t = progress.value;
    if (t <= 0) return;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * t, false, paint..color = color);
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.color != color || old.track != track;
}
