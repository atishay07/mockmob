import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

/// Small reactions the Practice screens share. Transform and opacity only, one RepaintBoundary
/// each, nothing ticks at rest, and nothing moves under reduced motion (the state they announce
/// is carried by text and ink elsewhere).

/// Squashes [child] once each time [trigger] changes (a thumb press into soft clay: down to
/// 0.9 tall and 1.08 wide in 90 ms, then a spring back), with a light sparkle of four glints
/// thrown off the upper right in [glint]. The first value never plays.
class PracticeSquash extends StatefulWidget {
  const PracticeSquash({super.key, required this.trigger, required this.glint, required this.child, this.alignment = Alignment.bottomCenter});

  /// Change this to play the reaction.
  final int trigger;

  /// The glints' colour: the subject's light.
  final Color glint;
  final Alignment alignment;
  final Widget child;

  /// The whole reaction, in milliseconds.
  static const int totalMs = 520;

  /// The squash's scale (x, y) at progress [t] in 0..1 (pure, for tests).
  static Offset scaleAt(double t) {
    t = t.clamp(0.0, 1.0);
    // Down in the first 17%, then a damped spring to rest.
    if (t < 0.17) {
      final p = Curves.easeOut.transform(t / 0.17);
      return Offset(1 + 0.08 * p, 1 - 0.1 * p);
    }
    final p = (t - 0.17) / 0.83;
    final k = math.exp(-5 * p) * math.cos(p * math.pi * 2.2);
    return Offset(1 + 0.08 * k, 1 - 0.1 * k);
  }

  @override
  State<PracticeSquash> createState() => _PracticeSquashState();
}

class _PracticeSquashState extends State<PracticeSquash> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: PracticeSquash.totalMs));

  @override
  void didUpdateWidget(PracticeSquash old) {
    super.didUpdateWidget(old);
    if (old.trigger != widget.trigger && !Motion.reduced(context)) _c.forward(from: 0);
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
      child: RepaintBoundary(child: widget.child),
      builder: (context, child) {
        final running = _c.isAnimating;
        final s = running ? PracticeSquash.scaleAt(_c.value) : const Offset(1, 1);
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Transform(alignment: widget.alignment, transform: Matrix4.diagonal3Values(s.dx, s.dy, 1), child: child),
            if (running)
              Positioned.fill(
                child: IgnorePointer(child: CustomPaint(painter: _GlintPainter(t: _c.value, color: widget.glint))),
              ),
          ],
        );
      },
    );
  }
}

class _GlintPainter extends CustomPainter {
  const _GlintPainter({required this.t, required this.color});

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // Four four-point glints leaving the upper right of the object and fading as they rise.
    final origin = Offset(size.width * 0.72, size.height * 0.3);
    const angles = [-1.25, -0.7, -0.15, -1.75];
    final p = Curves.easeOut.transform(((t - 0.1) / 0.9).clamp(0.0, 1.0));
    final fade = (1 - p).clamp(0.0, 1.0);
    for (var i = 0; i < angles.length; i++) {
      final reach = 14 + 9.0 * i;
      final c = origin + Offset(math.cos(angles[i]), math.sin(angles[i])) * (reach * p);
      final r = (3.2 + (i % 2) * 1.6) * (0.6 + 0.4 * fade);
      final paint = Paint()..color = color.withValues(alpha: 0.9 * fade);
      final path = Path()
        ..moveTo(c.dx, c.dy - r)
        ..quadraticBezierTo(c.dx, c.dy, c.dx + r, c.dy)
        ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy + r)
        ..quadraticBezierTo(c.dx, c.dy, c.dx - r, c.dy)
        ..quadraticBezierTo(c.dx, c.dy, c.dx, c.dy - r);
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(_GlintPainter old) => old.t != t || old.color != color;
}

/// Shakes [child] sideways once each time [trigger] changes: a limit reached, a refusal that has
/// its own line of text. 4 dp, three swings, 320 ms. Nothing under reduced motion.
class PracticeShake extends StatefulWidget {
  const PracticeShake({super.key, required this.trigger, required this.child});

  final int trigger;
  final Widget child;

  /// The sideways offset (dp) at progress [t] (pure, for tests).
  static double offsetAt(double t) => 4 * math.sin(t.clamp(0.0, 1.0) * math.pi * 6) * (1 - t.clamp(0.0, 1.0));

  @override
  State<PracticeShake> createState() => _PracticeShakeState();
}

class _PracticeShakeState extends State<PracticeShake> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 320));

  @override
  void didUpdateWidget(PracticeShake old) {
    super.didUpdateWidget(old);
    if (old.trigger != widget.trigger && !Motion.reduced(context)) _c.forward(from: 0);
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
      builder: (context, child) => Transform.translate(offset: Offset(_c.isAnimating ? PracticeShake.offsetAt(_c.value) : 0, 0), child: child),
    );
  }
}
