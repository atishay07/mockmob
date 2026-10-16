import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/mascot/mascot.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show MmMark;
import '../copy.dart';

/// The road to CUET, one tick per week from today: a marker where the May 2027 window opens and
/// one for May 2028. Choosing a stage lights the ticks up to its window, so the student sees how
/// much road they have, not only a number. Drawn in one paint; the light travels in 520 ms (at
/// once under reduced motion). The student's place on the road is the 16 dp mo mark: it stands at
/// Today and travels to the chosen window in the same 520 ms. Mobi himself is not on the road: the
/// step already has him in the guide bar, and one Mobi per screen means the largest one answers.
/// So when the mark arrives, the guide's Mobi ([mobi]) reacts: a small hop at the near window, a
/// look down the road at the far one. Decorative: each tile already says its weeks to TalkBack.
class WeekTrack extends StatefulWidget {
  const WeekTrack({super.key, required this.nearWeeks, required this.farWeeks, required this.litWeeks, this.mobi});

  /// The screen's one Mobi (the guide bar's), who answers the arrival. Null: nobody reacts.
  final MobiController? mobi;

  /// Weeks to the closer window (May 2027), and to the next one (May 2028).
  final int nearWeeks;
  final int farWeeks;

  /// Weeks to the chosen stage's window, or null before a choice.
  final int? litWeeks;

  static const double height = 58;

  /// The mark's side on the road, and how long its travel takes (the light's own 520 ms).
  static const double walker = 16;
  static const Duration walk = Duration(milliseconds: 520);

  @override
  State<WeekTrack> createState() => _WeekTrackState();
}

class _WeekTrackState extends State<WeekTrack> {
  /// The window he stood at before the latest choice (null: he stands at Today).
  int? _from;

  int get nearWeeks => widget.nearWeeks;
  int get farWeeks => widget.farWeeks;
  int? get litWeeks => widget.litWeeks;

  @override
  void didUpdateWidget(WeekTrack old) {
    super.didUpdateWidget(old);
    if (old.litWeeks != widget.litWeeks) _from = old.litWeeks;
  }

  final GlobalKey _mark = GlobalKey();

  /// The guide's Mobi answers the arrival: a small hop at the near window, a look down the road to
  /// the mark at the far one, nothing elsewhere. The Class 11 note under the road is the step's own
  /// words.
  void _arrived() {
    final lit = litWeeks;
    final mobi = widget.mobi;
    if (lit == null || mobi == null || !mounted) return;
    if (lit == nearWeeks) {
      mobi.react(MobiMoments.act(MobiEvent.answerRight));
    } else if (lit == farWeeks) {
      mobi.glanceAtWidget(_mark, hold: const Duration(milliseconds: 1400));
    }
  }

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
        height: WeekTrack.height,
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth;
            final nearX = (w - 2) * (nearWeeks / farWeeks) + 1;
            double xOf(int? weeks) => weeks == null ? 0 : (w - 2) * (weeks / farWeeks) + 1;
            const markW = WeekTrack.walker;
            // The mark's left edge: just before a window's tick (so its marker stays in view), kept
            // inside the road.
            double leftFor(int? weeks) => (xOf(weeks) - markW - 2).clamp(0.0, math.max(0.0, w - markW));
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
                // The mark stands on the road line (the road is drawn 34 dp down), over the ticks. A
                // new travel per choice, so each one starts where the last one ended; at once under
                // reduced motion, and the guide's Mobi still answers.
                TweenAnimationBuilder<double>(
                  key: ValueKey(litWeeks),
                  tween: Tween(begin: leftFor(_from), end: leftFor(litWeeks)),
                  duration: Motion.of(context, WeekTrack.walk),
                  curve: Motion.emphasized,
                  // After the frame: under reduced motion the travel ends inside the build.
                  onEnd: () => WidgetsBinding.instance.addPostFrameCallback((_) => _arrived()),
                  builder: (context, x, child) => Positioned(left: x, top: 34 + 3 - markW, child: child!),
                  child: IgnorePointer(child: MmMark(key: _mark, size: markW)),
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
