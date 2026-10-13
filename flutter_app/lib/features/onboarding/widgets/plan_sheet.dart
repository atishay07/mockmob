import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/plan.dart';
import 'engraved_text.dart';

/// The back of the sheet: the plan, engraved line by line, each line with its own bubble that
/// inks as it lands. While the student holds to seal, a volt light runs around the edge
/// ([seal]); once sealed, the lime-and-gold foil seal is pressed onto the corner.
class PlanSheet extends StatelessWidget {
  const PlanSheet({
    super.key,
    required this.plan,
    required this.seal,
    required this.sealed,
    required this.from,
    this.revealed = true,
    this.animate = true,
  });

  final PlanSummary plan;
  final Animation<double> seal;
  final bool sealed;

  /// "Tuesday, 13 October": the day week one starts.
  final String from;

  /// False until the flip has landed: the lines wait, then engrave.
  final bool revealed;
  final bool animate;

  static const BorderRadius radius = MmRadius.panelAll;
  static const Duration stagger = Duration(milliseconds: 140);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final card = LitEdge(
      glow: true,
      borderRadius: radius,
      child: FakeGlass(
        borderRadius: radius,
        opacity: colors.isNight ? 0.66 : 0.82,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(OnboardingCopy.planFrom(from), style: type.label.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
              Padding(
                padding: const EdgeInsets.only(right: MmSpace.s40),
                child: Semantics(
                  header: true,
                  child: Text(plan.headline, style: type.headline.copyWith(fontSize: 26, height: 29 / 26)),
                ),
              ),
              const SizedBox(height: MmSpace.s16),
              for (var i = 0; i < plan.lines.length; i++)
                _PlanLine(
                  text: plan.lines[i],
                  show: revealed,
                  delay: stagger * i,
                  animate: animate,
                ),
              const SizedBox(height: MmSpace.s4),
              Text(OnboardingCopy.sharpens, style: type.caption.copyWith(color: colors.ink3)),
            ],
          ),
        ),
      ),
    );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        CustomPaint(foregroundPainter: _SealTrace(progress: seal, color: colors.isNight ? colors.volt : colors.accentText), child: card),
        Positioned(top: -22, right: -8, child: _FoilSeal(sealed: sealed, animate: animate)),
      ],
    );
  }
}

class _PlanLine extends StatelessWidget {
  const _PlanLine({required this.text, required this.show, required this.delay, required this.animate});

  final String text;
  final bool show;
  final Duration delay;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Bubble(state: show ? BubbleState.filled : BubbleState.hollow, size: 14, inkOrigin: const Offset(-1, 0), animate: animate),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: show
                ? EngravedText(text, delay: delay, animate: animate, style: type.small.copyWith(color: colors.ink, height: 1.4))
                : Text(text, style: type.small.copyWith(color: Colors.transparent, height: 1.4)),
          ),
        ],
      ),
    );
  }
}

/// The foil seal, pressed on with a short settle once the sheet is sealed.
class _FoilSeal extends StatelessWidget {
  const _FoilSeal({required this.sealed, required this.animate});

  final bool sealed;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(end: sealed ? 1 : 0),
      duration: animate ? Motion.of(context, Motion.emphasizedDuration) : Duration.zero,
      curve: Motion.emphasized,
      builder: (context, t, child) => t == 0
          ? const SizedBox.square(dimension: 76)
          : Opacity(
              opacity: t.clamp(0.0, 1.0),
              child: Transform.rotate(angle: -0.18, child: Transform.scale(scale: 1.35 - 0.35 * t, child: child)),
            ),
      child: const ArtImage(MmArt.foilSeal, width: 76, height: 76, semanticLabel: OnboardingCopy.sealed),
    );
  }
}

/// The light that runs around the sheet's edge while the student holds to seal.
class _SealTrace extends CustomPainter {
  _SealTrace({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = progress.value;
    if (p <= 0) return;
    final rect = (Offset.zero & size).deflate(0.75);
    final path = Path()..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(MmRadius.panel)));
    final metric = path.computeMetrics().first;
    final length = metric.length * math.min(1, p);
    canvas.drawPath(
      _from(metric, length),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  Path _from(PathMetric metric, double length) => metric.extractPath(0, length);

  @override
  bool shouldRepaint(_SealTrace old) => old.color != color || old.progress != progress;
}
