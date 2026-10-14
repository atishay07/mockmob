import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Mobi's face as a small painted mark: the lime folded diamond with its black visor and two
/// white eyes. It marks every reply that Mobi wrote, so a conversation reads as with someone,
/// and costs one paint (the living Mobi stays in the header).
class MobiMark extends StatelessWidget {
  const MobiMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(painter: _MobiMarkPainter(volt: colors.volt, ink: colors.isNight ? const Color(0xFF0B0B08) : const Color(0xFF17150F), night: colors.isNight)),
      ),
    );
  }
}

class _MobiMarkPainter extends CustomPainter {
  const _MobiMarkPainter({required this.volt, required this.ink, required this.night});

  final Color volt;
  final Color ink;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final c = size.center(Offset.zero);
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(math.pi / 4);
    final side = s * 0.68;
    final body = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: side, height: side), Radius.circular(s * 0.17));
    canvas.drawRRect(
      body,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color.lerp(volt, Colors.white, 0.3)!, volt, Color.lerp(volt, Colors.black, 0.18)!],
          stops: const [0, 0.5, 1],
        ).createShader(body.outerRect),
    );
    canvas.restore();
    final visor = RRect.fromRectAndRadius(Rect.fromCenter(center: c.translate(0, s * 0.02), width: s * 0.5, height: s * 0.24), Radius.circular(s * 0.12));
    canvas.drawRRect(visor, Paint()..color = ink);
    final eye = Paint()..color = const Color(0xFFFFFFFF);
    canvas.drawCircle(c.translate(-s * 0.1, s * 0.02), s * 0.045, eye);
    canvas.drawCircle(c.translate(s * 0.1, s * 0.02), s * 0.045, eye);
    // The antenna: a short stalk and a lime ball.
    canvas.drawLine(
      c.translate(0, -s * 0.34),
      c.translate(s * 0.05, -s * 0.46),
      Paint()
        ..color = ink
        ..strokeWidth = math.max(1, s * 0.04)
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(c.translate(s * 0.06, -s * 0.47), s * 0.055, Paint()..color = volt);
  }

  @override
  bool shouldRepaint(_MobiMarkPainter old) => old.volt != volt || old.ink != ink || old.night != night;
}

/// Three answer bubbles inking in turn: Mobi is working on a reply. Loops while it is on screen;
/// under reduced motion the three sit half inked.
class InkDots extends StatefulWidget {
  const InkDots({super.key, this.size = 12});

  final double size;

  @override
  State<InkDots> createState() => _InkDotsState();
}

class _InkDotsState extends State<InkDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = Motion.reduced(context);
    if (_reduced) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final size = widget.size;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox(
          width: size * 3 + 10 * 2,
          height: size,
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) => CustomPaint(painter: _InkDotsPainter(colors: colors, t: _reduced ? 0.5 : _c.value)),
          ),
        ),
      ),
    );
  }
}

class _InkDotsPainter extends CustomPainter {
  const _InkDotsPainter({required this.colors, required this.t});

  final MmColors colors;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = BubblePaint(colors);
    final r = size.height / 2;
    for (var i = 0; i < 3; i++) {
      final c = Offset(r + i * (size.height + 10), r);
      // Each bubble inks over the first half of its slot, holds, then the sheet resets together.
      final start = i * 0.18;
      final fill = ((t - start) / 0.28).clamp(0.0, 1.0);
      final out = t > 0.86 ? ((1 - t) / 0.14).clamp(0.0, 1.0) : 1.0;
      paint.paint(canvas, c, r, fill > 0 ? BubbleState.filled : BubbleState.hollow, fill: Curves.easeOut.transform(fill), dim: out);
      if (fill == 0 || out < 1) {
        // A resetting bubble shows its ring.
        paint.paint(canvas, c, r, BubbleState.hollow, dim: 1 - out);
      }
    }
  }

  @override
  bool shouldRepaint(_InkDotsPainter old) => old.t != t || old.colors != colors;
}
