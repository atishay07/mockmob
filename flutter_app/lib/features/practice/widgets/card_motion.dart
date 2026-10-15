import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The suggestion card's own move: the one sheen across Start.

/// One light sweep across the Start key, [after] a quiet 4 s with no touch anywhere, once for
/// the life of the card. A touch before then cancels it for good (the student is already here).
/// Not when [enabled] is false (an offline key is quiet) and not under reduced motion.
class StartSheen extends StatefulWidget {
  const StartSheen({super.key, required this.child, this.enabled = true, this.after = const Duration(seconds: 4)});

  final Widget child;
  final bool enabled;
  final Duration after;

  /// Where the band's centre is, as a share of the key's width, at progress [t] (pure).
  static double bandAt(double t) => -0.3 + 1.6 * Motion.sweepCurve.transform(t.clamp(0.0, 1.0));

  @override
  State<StartSheen> createState() => _StartSheenState();
}

class _StartSheenState extends State<StartSheen> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.sweep);
  Timer? _timer;
  bool _done = false;
  bool _listening = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _arm();
  }

  @override
  void didUpdateWidget(StartSheen old) {
    super.didUpdateWidget(old);
    if (!old.enabled && widget.enabled) _arm();
    if (old.enabled && !widget.enabled) _stop();
  }

  void _arm() {
    if (_done || _listening || !widget.enabled || Motion.reduced(context) || !TickerMode.valuesOf(context).enabled) return;
    _listening = true;
    GestureBinding.instance.pointerRouter.addGlobalRoute(_onPointer);
    _timer = Timer(widget.after, _play);
  }

  void _onPointer(PointerEvent event) {
    if (event is! PointerDownEvent) return;
    _done = true;
    _stop();
  }

  void _stop() {
    _timer?.cancel();
    if (_listening) {
      _listening = false;
      GestureBinding.instance.pointerRouter.removeGlobalRoute(_onPointer);
    }
  }

  void _play() {
    _stop();
    if (!mounted || _done) return;
    _done = true;
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _stop();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        Positioned.fill(
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                if (!_c.isAnimating) return const SizedBox.shrink();
                return RepaintBoundary(
                  child: ClipRRect(
                    borderRadius: MmRadius.pillAll,
                    child: CustomPaint(painter: _SheenPainter(t: _c.value, color: Colors.white)),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _SheenPainter extends CustomPainter {
  const _SheenPainter({required this.t, required this.color});

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = StartSheen.bandAt(t) * size.width;
    final half = size.height * 0.9;
    // A soft skewed band: transparent, a faint white, transparent.
    final rect = Rect.fromLTWH(center - half, 0, half * 2, size.height);
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [color.withValues(alpha: 0), color.withValues(alpha: 0.34), color.withValues(alpha: 0)],
      ).createShader(rect);
    canvas.save();
    canvas.translate(center, size.height / 2);
    canvas.transform(Matrix4.skewX(-0.35).storage);
    canvas.translate(-center, -size.height / 2);
    canvas.drawRect(rect, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SheenPainter old) => old.t != t;
}
