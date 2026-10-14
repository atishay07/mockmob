import 'package:flutter/material.dart';

/// A thin rounded bar that is full at [fraction] 1 and empties from the right: the last five
/// minutes of a mock, under the timer's digits. A fill and a track, nothing else; it repaints
/// once a second with the clock.
class DrainBar extends StatelessWidget {
  const DrainBar({super.key, required this.fraction, required this.track, required this.fill});

  final double fraction;
  final Color track;
  final Color fill;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _DrainPainter(fraction.clamp(0.0, 1.0), track, fill));
  }
}

class _DrainPainter extends CustomPainter {
  const _DrainPainter(this.fraction, this.track, this.fill);

  final double fraction;
  final Color track;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final radius = Radius.circular(size.height / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, radius), Paint()..color = track);
    if (fraction <= 0) return;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, size.width * fraction, size.height), radius), Paint()..color = fill);
  }

  @override
  bool shouldRepaint(_DrainPainter old) => old.fraction != fraction || old.track != track || old.fill != fill;
}
