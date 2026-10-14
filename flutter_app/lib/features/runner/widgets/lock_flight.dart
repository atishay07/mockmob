import 'dart:ui' show PathMetric, lerpDouble;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import 'runner_motion.dart';

/// The lock-in (runner.md 3.3, MOTION.md 4.6): when an answer is chosen in a practice, a single
/// 6 dp volt dot lifts off the option's bubble and flies to that question's cell on the track, and
/// the cell sparks as it lands. The student's answer goes onto the sheet. No tail: the dot is one
/// small thing, and it keeps to the empty gutter so no pixel of it crosses the question.
///
/// It lies over the runner, takes no touches, owns one controller and one painter inside its own
/// repaint boundary, and is never built under reduced motion or in a timed mock (the layout does
/// not call it there: a timed paper has no flight at all).
class LockFlightLayer extends StatefulWidget {
  const LockFlightLayer({super.key});

  @override
  State<LockFlightLayer> createState() => LockFlightLayerState();
}

class LockFlightLayerState extends State<LockFlightLayer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: RunnerMotion.flight);
  FlightRoute? _route;
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
    _route = FlightRoute(box.globalToLocal(from), box.globalToLocal(to), lane: MmSpace.gutter / 2);
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
          painter: _FlightPainter(animation: _controller, volt: colors.volt, rim: colors.isNight ? null : colors.accentText, route: () => _route),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

/// The dot's way from the chosen option's badge to its cell. It never crosses the question: it
/// leaves the badge sideways into the empty gutter, rises along it past the text, then runs along
/// the track to the cell. Every flight takes that way, near cells included, so the dot's whole
/// path is either in the gutter or on the track.
@visibleForTesting
class FlightRoute {
  FlightRoute(Offset a, Offset b, {required double lane}) {
    final path = Path()..moveTo(a.dx, a.dy);
    const turn = 12.0;
    if (a.dy - b.dy > 2 * turn && a.dx > lane + turn) {
      path
        ..quadraticBezierTo(lane, a.dy, lane, a.dy - turn)
        ..lineTo(lane, b.dy + turn);
      if (b.dx >= lane + turn) {
        path
          ..quadraticBezierTo(lane, b.dy, lane + turn, b.dy)
          ..lineTo(b.dx, b.dy);
      } else {
        path.quadraticBezierTo(lane, b.dy, b.dx, b.dy);
      }
    } else {
      // Nothing above the option to rise past (not a layout the runner makes): one short bow.
      final mid = Offset.lerp(a, b, 0.5)!;
      final bow = (b - a).distance * 0.12;
      final control = mid + Offset(a.dx < b.dx ? -bow : bow, 0);
      path.quadraticBezierTo(control.dx, control.dy, b.dx, b.dy);
    }
    _metric = path.computeMetrics().first;
    length = _metric.length;
  }

  late final PathMetric _metric;

  /// How long the route is, in dp.
  late final double length;

  /// The point [distance] dp along the route (clamped to its ends).
  Offset at(double distance) => _metric.getTangentForOffset(distance.clamp(0.0, length))!.position;
}

class _FlightPainter extends CustomPainter {
  _FlightPainter({required this.animation, required this.volt, required this.rim, required this.route}) : super(repaint: animation);

  final Animation<double> animation;
  final Color volt;

  /// A 1 dp edge round the dot on Daylight, where volt alone is too pale on paper; null at Night.
  final Color? rim;
  final FlightRoute? Function() route;

  /// The dot is 6 dp across.
  static const double _radius = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final t = animation.value;
    final r = route();
    if (r == null || t <= 0 || t >= 1) return;
    final at = r.at(Motion.glide.transform(t) * r.length);
    // The dot shrinks into the cell as it lands.
    final landing = t > 0.82 ? lerpDouble(1, 0.55, (t - 0.82) / 0.18)! : 1.0;
    final radius = _radius * landing;
    canvas.drawCircle(at, radius, Paint()..color = volt);
    if (rim != null) {
      canvas.drawCircle(
        at,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = rim!,
      );
    }
  }

  @override
  bool shouldRepaint(_FlightPainter old) => old.volt != volt || old.rim != rim;
}
