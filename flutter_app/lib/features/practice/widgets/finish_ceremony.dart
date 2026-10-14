import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The beats of the stamp, as fractions of [FinishCeremony.stampDuration] (MOTION.md 4.7, a T2
/// moment): the figure stamps from 1.12 to 1 over the first 420 ms (a short lift, the landing, a
/// settle); as it lands one ink ring spreads and, for a good set with Celebrations on Full, 14
/// shards fly out for 600 ms. No flash, no sweep, no second ring: three channels at most (the
/// number, one light event, Mobi).
abstract final class FinishCeremony {
  /// The whole stamp: 240 ms to the landing, then 600 ms of ring and shards.
  static const Duration stampDuration = Duration(milliseconds: 840);

  /// The figure's own stamp (1.12 to 1), inside [stampDuration].
  static const Duration figureDuration = Duration(milliseconds: 420);

  /// The figure touches down (the haptic lands) at this fraction.
  static const double landAt = 240 / 840;

  /// Lift ends here.
  static const double liftEnd = 80 / 840;

  /// The figure is at rest from here on.
  static const double settleEnd = 420 / 840;

  /// How far the figure lifts before it lands.
  static const double liftScale = 0.12;

  /// The figure's scale at stamp progress [t].
  static double figureScale(double t) {
    if (t <= 0 || t >= settleEnd) return 1;
    if (t < liftEnd) return 1 + liftScale * Curves.easeOut.transform(t / liftEnd);
    if (t < landAt) return 1 + liftScale * (1 - Curves.easeInCubic.transform((t - liftEnd) / (landAt - liftEnd)));
    // A small settle after the landing: down to 0.985 and back.
    final s = (t - landAt) / (settleEnd - landAt);
    return 1 - 0.015 * math.sin(math.pi * s.clamp(0.0, 1.0)) * (1 - s);
  }

  /// 0 before the landing, then 0 to 1 across the rest of the stamp.
  static double afterLanding(double t) => t <= landAt ? 0 : ((t - landAt) / (1 - landAt)).clamp(0.0, 1.0);
}

/// The figure, stamped: it lifts a little and lands; for a good set with Celebrations on Full one
/// ink ring spreads from behind it and 14 volt shards and answer bubbles fly out (one canvas,
/// 600 ms). Otherwise the stamp alone. [stamp] runs 0 to 1 once; at rest (0 or 1) nothing extra
/// is drawn.
class StampedFigure extends StatelessWidget {
  const StampedFigure({super.key, required this.stamp, required this.burst, required this.digits, required this.child});

  final Animation<double> stamp;

  /// Celebrate: one volt ring, shards and bubbles. Otherwise nothing behind the figure.
  final bool burst;

  /// Digits in the figure, to find its centre.
  final int digits;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = MediaQuery.textScalerOf(context).scale(type.hero.fontSize ?? 112);
    final probe = TextPainter(
      text: TextSpan(
        text: '0' * math.max(digits, 1),
        style: type.hero.copyWith(fontSize: size),
      ),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
    final digitsWidth = probe.width;
    probe.dispose();
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(
              child: CustomPaint(
                painter: StampPainter(stamp: stamp, colors: colors, burst: burst, centerX: digitsWidth / 2),
              ),
            ),
          ),
        ),
        AnimatedBuilder(
          animation: stamp,
          child: child,
          builder: (context, child) {
            // Scaled about the digits' centre, so the unit beside them never swings.
            final s = FinishCeremony.figureScale(stamp.value);
            final cx = digitsWidth / 2;
            final cy = size * 0.45;
            return Transform(
              alignment: Alignment.topLeft,
              transform: Matrix4.translationValues(cx, cy, 0)
                ..multiply(Matrix4.diagonal3Values(s, s, 1))
                ..multiply(Matrix4.translationValues(-cx, -cy, 0)),
              child: child,
            );
          },
        ),
      ],
    );
  }
}

/// The ring and the burst behind the figure.
class StampPainter extends CustomPainter {
  StampPainter({required this.stamp, required this.colors, required this.burst, required this.centerX}) : super(repaint: stamp);

  final Animation<double> stamp;
  final MmColors colors;
  final bool burst;
  final double centerX;

  /// The burst's pieces (MOTION.md P0-5: 14, one painter).
  static const int pieces = 14;

  /// How far past the figure's own box the ring and the burst may reach: a hair into the page
  /// gutter on the left (the figure starts at the gutter, so the screen edge is 16 dp beyond), and
  /// into the gaps above and below it (16 and 20 dp), never as far as the lines around it.
  static const double _leftRoom = 8;
  static const double _vertRoom = 14;
  static const double _shard = 15;

  @override
  void paint(Canvas canvas, Size size) {
    final a = FinishCeremony.afterLanding(stamp.value);
    // A calm stamp (a mixed set, Quiet) draws nothing behind the figure.
    if (!burst || a <= 0 || a >= 1) return;
    final c = Offset(centerX, size.height * 0.5);
    // Volt is a fill in both themes; on Daylight each volt piece gets a 1 dp olive rim so it reads
    // on paper (MOTION.md 1.4). The ring is a stroke on the ground, so it takes the readable accent.
    final volt = colors.volt;
    final rim = colors.isNight ? null : colors.accentText;
    final ringColor = colors.isNight ? colors.volt : colors.accentText;
    final base = size.height * 0.42;

    // The burst lives in this room and nowhere else, so it is never cut by the screen edge and
    // never lands on the caption above or the counts line below.
    final room = Rect.fromLTRB(-_leftRoom, -_vertRoom, size.width, size.height + _vertRoom);
    final rxLeft = c.dx - room.left;
    final ry = math.min(c.dy - room.top, room.bottom - c.dy);
    canvas
      ..save()
      ..clipRect(room);

    // The one ink ring: spreads and thins as it fades, as an ellipse that fits the room.
    final ringT = Curves.easeOutCubic.transform(a);
    Rect ringRect(double r) => Rect.fromCenter(center: c, width: 2 * math.min(r, rxLeft), height: 2 * math.min(r, ry));
    canvas.drawOval(
      ringRect(base * (0.9 + 0.9 * ringT)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5 * (1 - ringT) + 0.8
        ..color = ringColor.withValues(alpha: ringColor.a * 0.85 * (1 - ringT)),
    );

    // The burst: shards and bubbles thrown out from the figure, slowing, fading, each held to the
    // room (a piece aimed at the screen edge stops short of it).
    final travel = Curves.easeOutQuart.transform(a);
    final fade = 1 - Curves.easeInQuad.transform(a);
    for (var i = 0; i < pieces; i++) {
      // Fixed, uneven angles and reaches, so the burst never looks like a clock face.
      final angle = -math.pi / 2 + i * (2 * math.pi / pieces) + (i.isEven ? 0.11 : -0.08);
      final dir = Offset(math.cos(angle), math.sin(angle));
      final wanted = base * (1.05 + 1.3 * travel * (0.7 + 0.3 * ((i * 7) % 5) / 4));
      final alongY = dir.dy.abs() < 1e-3 ? double.infinity : ry / dir.dy.abs();
      final alongX = dir.dx.abs() < 1e-3 ? double.infinity : (dir.dx < 0 ? rxLeft : room.right - c.dx) / dir.dx.abs();
      final reach = math.max(0.0, math.min(wanted, math.min(alongX, alongY) - _shard - 2));
      final p = c + dir * reach;
      if (i % 3 == 0) {
        // An answer bubble, with a dark core so it reads as a bubble and not a dot.
        final r = 5.2 * (1 - 0.4 * a);
        canvas
          ..drawCircle(p, r, Paint()..color = volt.withValues(alpha: volt.a * fade))
          ..drawCircle(
            p,
            r,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1
              ..color = (rim ?? colors.voltInk).withValues(alpha: (rim == null ? 0.5 : 1) * fade),
          );
      } else {
        final len = _shard * (1 - 0.55 * a);
        final shardVolt = i % 3 == 1;
        if (shardVolt && rim != null) {
          canvas.drawLine(
            p,
            p + dir * len,
            Paint()
              ..strokeWidth = 5
              ..strokeCap = StrokeCap.round
              ..color = rim.withValues(alpha: fade),
          );
        }
        canvas.drawLine(
          p,
          p + dir * len,
          Paint()
            ..strokeWidth = 3
            ..strokeCap = StrokeCap.round
            ..color = (shardVolt ? volt : colors.ink).withValues(alpha: fade * (shardVolt ? 1 : 0.85)),
        );
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(StampPainter old) => old.stamp != stamp || old.colors != colors || old.burst != burst || old.centerX != centerX;
}

/// The question numbers under a single row of sheet bubbles, painted (not text widgets: they
/// are decoration; each bubble's row in the list below is the accessible path). Laid out from the
/// same geometry as the strip.
class SheetNumeralsPainter extends CustomPainter {
  SheetNumeralsPainter({
    required this.count,
    required this.left,
    required this.cell,
    required this.gap,
    required this.color,
    required this.style,
  });

  final int count;
  final double left;
  final double cell;
  final double gap;
  final Color color;
  final TextStyle style;

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < count; i++) {
      final tp = TextPainter(
        text: TextSpan(
          text: '${i + 1}',
          style: style.copyWith(color: color),
        ),
        textDirection: TextDirection.ltr,
        textScaler: TextScaler.noScaling,
      )..layout();
      final cx = left + i * (cell + gap) + cell / 2;
      tp.paint(canvas, Offset(cx - tp.width / 2, (size.height - tp.height) / 2));
      tp.dispose();
    }
  }

  @override
  bool shouldRepaint(SheetNumeralsPainter old) =>
      old.count != count || old.left != left || old.cell != cell || old.gap != gap || old.color != color || old.style != style;
}
