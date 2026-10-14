import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// The road to CUET, one tick per week from today: a marker where the May 2027 window opens and
/// one for May 2028. Choosing a stage lights the ticks up to its window, so the student sees how
/// much road they have, not only a number. Drawn in one paint; the light travels in 520 ms (at
/// once under reduced motion). Decorative: each tile already says its weeks to TalkBack.
class WeekTrack extends StatelessWidget {
  const WeekTrack({super.key, required this.nearWeeks, required this.farWeeks, required this.litWeeks});

  /// Weeks to the closer window (May 2027), and to the next one (May 2028).
  final int nearWeeks;
  final int farWeeks;

  /// Weeks to the chosen stage's window, or null before a choice.
  final int? litWeeks;

  static const double height = 58;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Lit ticks are strokes on the ground: the text accent (volt Night, olive Day). The chosen
    // window's bubble is a fill: volt in both themes, rimmed olive on Day (SPACING.md 8.3).
    final accent = colors.accentText;
    final label = type.caption.copyWith(color: colors.ink3, fontSize: 11.5);
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth;
            final nearX = (w - 2) * (nearWeeks / farWeeks) + 1;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(end: (litWeeks ?? 0).toDouble()),
                    duration: Motion.of(context, const Duration(milliseconds: 520)),
                    curve: Motion.emphasized,
                    builder: (context, lit, _) => CustomPaint(
                      painter: _TrackPainter(
                        far: farWeeks,
                        near: nearWeeks,
                        lit: lit,
                        chosen: litWeeks,
                        dim: colors.ink3.withValues(alpha: 0.45),
                        lamp: colors.lamp,
                        accent: accent,
                        fill: colors.volt,
                        rim: colors.isNight ? null : colors.accentText,
                        ground: colors.ground,
                      ),
                    ),
                  ),
                ),
                Positioned(left: 0, bottom: 0, child: Text(OnboardingCopy.trackToday, style: label)),
                Positioned(
                  left: (nearX - 22).clamp(52.0, w - 140),
                  bottom: 0,
                  child: Text(
                    OnboardingCopy.trackMay(2027),
                    style: label.copyWith(color: litWeeks == nearWeeks ? colors.ink : colors.ink3),
                  ),
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Text(
                    OnboardingCopy.trackMay(2028),
                    style: label.copyWith(color: litWeeks == farWeeks ? colors.ink : colors.ink3),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  const _TrackPainter({
    required this.far,
    required this.near,
    required this.lit,
    required this.chosen,
    required this.dim,
    required this.lamp,
    required this.accent,
    required this.fill,
    required this.rim,
    required this.ground,
  });

  final int far;
  final int near;
  final double lit;
  final int? chosen;
  final Color dim;
  final Color lamp;
  final Color accent;
  final Color fill;
  final Color? rim;
  final Color ground;

  @override
  void paint(Canvas canvas, Size size) {
    const base = 34.0;
    final w = size.width;
    double x(num weeks) => (w - 2) * (weeks / far) + 1;

    // The lamp's light pooling over the road the student chose.
    if (lit > 0) {
      final r = Rect.fromLTRB(0, 0, x(lit), base + 4);
      canvas.drawRect(
        r,
        Paint()..shader = LinearGradient(colors: [lamp.withValues(alpha: 0), lamp.withValues(alpha: 0.16)]).createShader(r),
      );
    }

    final tick = Paint()..strokeCap = StrokeCap.round;
    for (var i = 0; i <= far; i++) {
      final isMarker = i == near || i == far;
      tick
        ..strokeWidth = isMarker ? 2 : 1.2
        ..color = i <= lit ? accent : dim;
      final h = isMarker ? 22.0 : (i % 4 == 0 ? 11.0 : 7.0);
      canvas.drawLine(Offset(x(i), base), Offset(x(i), base - h), tick);
    }

    // The two windows, each a bubble on its tick: inked when it is the chosen one.
    void bubble(double px, bool inked) {
      final c = Offset(px.clamp(6.0, w - 6), base - 23);
      canvas.drawCircle(c, 6.5, Paint()..color = ground);
      if (inked) {
        canvas.drawCircle(c, 6, Paint()..color = fill);
        final r = rim;
        if (r != null) {
          canvas.drawCircle(
            c,
            5.5,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1
              ..color = r,
          );
        }
      } else {
        canvas.drawCircle(
          c,
          5.5,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = dim.withValues(alpha: 0.9),
        );
      }
    }

    bubble(x(near), chosen == near);
    bubble(x(far), chosen == far);
    canvas.drawLine(
      Offset(0, base + 2),
      Offset(w, base + 2),
      Paint()
        ..color = dim.withValues(alpha: 0.5)
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_TrackPainter old) =>
      old.far != far || old.near != near || old.lit != lit || old.chosen != chosen || old.dim != dim || old.accent != accent || old.fill != fill || old.rim != rim;
}
