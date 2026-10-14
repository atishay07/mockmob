import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The beats of the stamp, as fractions of [FinishCeremony.stampDuration]: the figure lifts
/// (anticipation), then lands; the ring and the burst start as it lands.
abstract final class FinishCeremony {
  /// The whole stamp, from lift to the last shard fading.
  static const Duration stampDuration = Duration(milliseconds: 760);

  /// The figure is back at rest (and the haptic lands) at this fraction.
  static const double landAt = 0.36;

  /// Lift ends here.
  static const double liftEnd = 0.16;

  /// How far the figure lifts before it lands.
  static const double liftScale = 0.12;

  /// The figure's scale at stamp progress [t].
  static double figureScale(double t) {
    if (t <= 0 || t >= 1) return 1;
    if (t < liftEnd) return 1 + liftScale * Curves.easeOut.transform(t / liftEnd);
    if (t < landAt) return 1 + liftScale * (1 - Curves.easeInCubic.transform((t - liftEnd) / (landAt - liftEnd)));
    // A small settle after the landing: down to 0.985 and back.
    final s = (t - landAt) / (1 - landAt);
    return 1 - 0.015 * math.sin(math.pi * s.clamp(0.0, 1.0)) * (1 - s);
  }

  /// 0 before the landing, then 0 to 1 across the rest of the stamp.
  static double afterLanding(double t) => t <= landAt ? 0 : ((t - landAt) / (1 - landAt)).clamp(0.0, 1.0);
}

/// The figure, stamped: it lifts a little and lands, an ink ring spreads from behind it and, for a
/// good set, a burst of volt shards and answer bubbles flies out (14 pieces on one canvas, under a
/// second). [stamp] runs 0 to 1 once; at rest (0 or 1) nothing extra is drawn.
class StampedFigure extends StatelessWidget {
  const StampedFigure({super.key, required this.stamp, required this.burst, required this.digits, required this.child});

  final Animation<double> stamp;

  /// Celebrate: shards and bubbles, a volt ring. Otherwise a quiet ink ring only.
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

  static const int pieces = 24;

  @override
  void paint(Canvas canvas, Size size) {
    final a = FinishCeremony.afterLanding(stamp.value);
    if (a <= 0 || a >= 1) return;
    final c = Offset(centerX, size.height * 0.5);
    final volt = colors.isNight ? colors.volt : colors.accentText;
    final base = size.height * 0.42;

    // The ink ring: spreads and thins as it fades.
    final ringT = Curves.easeOutCubic.transform(a);
    final ringColor = burst ? volt : colors.ink3;
    if (burst) {
      // A flash of volt light behind the figure as it lands, gone by the time the shards slow.
      final flash = math.pow(1 - a, 1.6).toDouble();
      final radius = base * (1.6 + 1.4 * ringT);
      canvas.drawCircle(
        c,
        radius,
        Paint()
          ..shader = ui.Gradient.radial(c, radius, [
            volt.withValues(alpha: (colors.isNight ? 0.34 : 0.3) * flash),
            volt.withValues(alpha: 0),
          ]),
      );
    }
    canvas.drawCircle(
      c,
      base * (0.9 + 0.9 * ringT),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = (burst ? 5 : 3.2) * (1 - ringT) + 0.8
        ..color = ringColor.withValues(alpha: ringColor.a * (burst ? 0.85 : 0.55) * (1 - ringT)),
    );
    if (!burst) return;
    // A second, later ring for a good set.
    final ring2 = Curves.easeOutCubic.transform(((a - 0.12) / 0.88).clamp(0.0, 1.0));
    if (ring2 > 0) {
      canvas.drawCircle(
        c,
        base * (0.9 + 1.5 * ring2),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4 * (1 - ring2) + 0.6
          ..color = volt.withValues(alpha: volt.a * 0.6 * (1 - ring2)),
      );
    }

    // The burst: shards and bubbles thrown out from the figure, slowing, fading.
    final travel = Curves.easeOutQuart.transform(a);
    final fade = 1 - Curves.easeInQuad.transform(a);
    for (var i = 0; i < pieces; i++) {
      // Fixed, uneven angles and reaches, so the burst never looks like a clock face.
      final angle = -math.pi / 2 + i * (2 * math.pi / pieces) + (i.isEven ? 0.11 : -0.08);
      final reach = base * (1.05 + 1.3 * travel * (0.7 + 0.3 * ((i * 7) % 5) / 4));
      final dir = Offset(math.cos(angle), math.sin(angle));
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
              ..color = colors.voltInk.withValues(alpha: 0.5 * fade),
          );
      } else {
        final len = 15 * (1 - 0.55 * a);
        final shardVolt = i % 3 == 1;
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
  }

  @override
  bool shouldRepaint(StampPainter old) => old.stamp != stamp || old.colors != colors || old.burst != burst || old.centerX != centerX;
}

/// A soft band of light crossing the sheet card once (700 ms), for a good set only. Painted over
/// the card's own fill, inside its shape; no layer.
class SheetSweepPainter extends CustomPainter {
  SheetSweepPainter({required this.sweep, required this.colors, required this.radius}) : super(repaint: sweep);

  final Animation<double> sweep;
  final MmColors colors;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final t = sweep.value;
    if (t <= 0 || t >= 1) return;
    final x = -size.width * 0.4 + (size.width * 1.8) * Motion.sweepCurve.transform(t);
    final band = Rect.fromLTWH(x - 60, 0, 120, size.height);
    final light = colors.isNight ? const Color(0xFFFFF6E4) : const Color(0xFFFFFFFF);
    final strength = colors.isNight ? 0.10 : 0.45;
    final shader = LinearGradient(
      begin: Alignment.centerLeft,
      end: Alignment.centerRight,
      colors: [
        light.withValues(alpha: 0),
        light.withValues(alpha: strength),
        light.withValues(alpha: 0),
      ],
    ).createShader(band);
    canvas
      ..save()
      ..clipRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)))
      ..drawRect(band, Paint()..shader = shader)
      ..restore();
  }

  @override
  bool shouldRepaint(SheetSweepPainter old) => old.sweep != sweep || old.colors != colors || old.radius != radius;
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
