import 'dart:math' as math;
import 'dart:ui' show PathMetric, lerpDouble;

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
  _FlightRoute? _route;
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
    _route = _FlightRoute(box.globalToLocal(from), box.globalToLocal(to), lane: MmSpace.gutter / 2);
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
          painter: _FlightPainter(animation: _controller, volt: colors.volt, route: () => _route),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

/// The dot's way from the chosen option's badge to its cell. It never crosses the question: it
/// leaves the badge sideways into the empty gutter, rises along it past the text, then runs along
/// the track to the cell. A cell close to the option (or to the gutter) gets one bowed curve.
class _FlightRoute {
  _FlightRoute(Offset a, Offset b, {required double lane}) {
    final path = Path()..moveTo(a.dx, a.dy);
    const turn = 18.0;
    final rises = a.dy - b.dy > 4 * turn;
    final clear = b.dx > lane + 2 * turn && a.dx > lane + turn;
    if (rises && clear) {
      path
        ..quadraticBezierTo(lane, a.dy, lane, a.dy - turn)
        ..lineTo(lane, b.dy + turn)
        ..quadraticBezierTo(lane, b.dy, lane + turn, b.dy)
        ..lineTo(b.dx, b.dy);
    } else {
      final mid = Offset.lerp(a, b, 0.5)!;
      final bow = (b - a).distance * 0.12;
      final control = mid + Offset(a.dx < b.dx ? -bow : bow, 0);
      path.quadraticBezierTo(control.dx, control.dy, b.dx, b.dy);
    }
    _metric = path.computeMetrics().first;
    length = _metric.length;
  }

  late final PathMetric _metric;
  late final double length;

  /// The point [distance] dp along the route (clamped to its ends).
  Offset at(double distance) => _metric.getTangentForOffset(distance.clamp(0.0, length))!.position;
}

class _FlightPainter extends CustomPainter {
  _FlightPainter({required this.animation, required this.volt, required this.route}) : super(repaint: animation);

  final Animation<double> animation;
  final Color volt;
  final _FlightRoute? Function() route;

  /// How many soft circles trail the dot, and the distance between them along the route.
  static const int _tail = 5;
  static const double _spacing = 9;

  @override
  void paint(Canvas canvas, Size size) {
    final t = animation.value;
    final r = route();
    if (r == null || t <= 0 || t >= 1) return;
    // The head is ahead by distance, and each tail circle sits a fixed way behind it along the
    // same route, so the trail is one unbroken line that starts at the badge (at the first
    // frames every circle is still on it) and ends on the head.
    final head = Motion.glide.transform(t) * r.length;
    for (var i = _tail; i >= 0; i--) {
      final fade = i == 0 ? 1.0 : (1 - i / (_tail + 1)) * 0.42;
      // The dot shrinks into the cell as it lands.
      final landing = t > 0.82 ? lerpDouble(1, 0.55, (t - 0.82) / 0.18)! : 1.0;
      final radius = (i == 0 ? 4.5 : 4.0 - i * 0.45) * landing;
      canvas.drawCircle(r.at(head - i * _spacing), math.max(0.8, radius), Paint()..color = volt.withValues(alpha: fade));
    }
  }

  @override
  bool shouldRepaint(_FlightPainter old) => old.volt != volt;
}
