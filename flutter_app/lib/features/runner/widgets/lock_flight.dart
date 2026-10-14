import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import 'runner_motion.dart';

/// The lock-in (runner.md 3.3): when an answer is chosen, a volt dot lifts off the option's
/// bubble and flies to that question's cell on the track, trailing a short tail, and the cell
/// sparks as it lands. The student's answer goes onto the sheet.
///
/// It lies over the runner, takes no touches, owns one controller and one painter inside its own
/// repaint boundary, and is never built under reduced motion (the layout does not call it).
class LockFlightLayer extends StatefulWidget {
  const LockFlightLayer({super.key});

  @override
  State<LockFlightLayer> createState() => LockFlightLayerState();
}

class LockFlightLayerState extends State<LockFlightLayer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: RunnerMotion.flight);
  Offset _from = Offset.zero;
  Offset _to = Offset.zero;
  VoidCallback? _onLanded;

  /// Sends a dot from [from] to [to] (both in global coordinates). [onLanded] runs when it
  /// arrives; a newer flight replaces one still in the air (its landing runs at once so the
  /// track never waits for a dot that is gone).
  void launch({required Offset from, required Offset to, required VoidCallback onLanded}) {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) {
      onLanded();
      return;
    }
    final pending = _onLanded;
    _onLanded = null;
    pending?.call();
    _from = box.globalToLocal(from);
    _to = box.globalToLocal(to);
    _onLanded = onLanded;
    _controller.forward(from: 0).whenComplete(() {
      if (!mounted || _controller.status != AnimationStatus.completed) return;
      final landed = _onLanded;
      _onLanded = null;
      landed?.call();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _FlightPainter(
            animation: _controller,
            volt: colors.volt,
            from: () => _from,
            to: () => _to,
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

class _FlightPainter extends CustomPainter {
  _FlightPainter({required this.animation, required this.volt, required this.from, required this.to}) : super(repaint: animation);

  final Animation<double> animation;
  final Color volt;
  final Offset Function() from;
  final Offset Function() to;

  /// How many soft circles trail the dot.
  static const int _tail = 5;

  @override
  void paint(Canvas canvas, Size size) {
    final t = animation.value;
    if (t <= 0 || t >= 1) return;
    final a = from();
    final b = to();
    // The path bows out to the side the dot leaves from, so it reads as a lift, not a laser.
    final mid = Offset.lerp(a, b, 0.5)!;
    final bow = (b - a).distance * 0.12;
    final control = mid + Offset(a.dx < b.dx ? -bow : bow, 0);
    Offset at(double u) {
      final v = 1 - u;
      return a * (v * v) + control * (2 * v * u) + b * (u * u);
    }

    for (var i = _tail; i >= 0; i--) {
      final u = Motion.glide.transform(math.max(0, t - i * 0.035));
      final fade = i == 0 ? 1.0 : (1 - i / (_tail + 1)) * 0.42;
      // The dot shrinks into the cell as it lands.
      final landing = t > 0.82 ? lerpDouble(1, 0.55, (t - 0.82) / 0.18)! : 1.0;
      final radius = (i == 0 ? 4.5 : 4.0 - i * 0.45) * landing;
      canvas.drawCircle(at(u), math.max(0.8, radius), Paint()..color = volt.withValues(alpha: fade));
    }
  }

  @override
  bool shouldRepaint(_FlightPainter old) => old.volt != volt;
}
