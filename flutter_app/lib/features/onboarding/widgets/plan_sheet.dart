import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/plan.dart';
import 'engraved_text.dart';
import 'foil_seal.dart';

/// The back of the sheet: the plan, written like the rows of an answer sheet. Each line has its
/// row number in the gutter and engraves in turn; timing marks run down the left edge; the lamp
/// pools behind the card. While the student holds to seal, a volt light runs around the edge
/// ([seal]); once sealed, the foil seal is stamped into the corner. Volt appears only on the
/// newest engraved line's number and the seal.
class PlanSheet extends StatelessWidget {
  const PlanSheet({
    super.key,
    required this.plan,
    required this.seal,
    required this.sealed,
    required this.from,
    this.lead = OnboardingCopy.planLead,
    this.revealed = true,
    this.animate = true,
    this.compact = false,
  });

  final PlanSummary plan;
  final Animation<double> seal;
  final bool sealed;

  /// "Tuesday, 13 October": the day week one starts.
  final String from;

  /// The overline: built from the answers (and defaults, when a step was skipped).
  final String lead;

  /// False until the flip has landed: the lines wait, then engrave.
  final bool revealed;
  final bool animate;

  /// Tighter rows and a smaller seal, for a short window.
  final bool compact;

  static const BorderRadius radius = MmRadius.panelAll;
  static const Duration stagger = Duration(milliseconds: 140);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final card = FakeGlass(
      borderRadius: radius,
      lamp: true,
      opacity: colors.isNight ? 0.7 : 0.84,
      child: Builder(
        builder: (context) => Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(lead, style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
              Semantics(
                header: true,
                child: Text(plan.headline, style: type.headline.copyWith(fontSize: 26, height: 29 / 26)),
              ),
              const SizedBox(height: MmSpace.s4),
              Text(OnboardingCopy.planFrom(from), style: type.small.copyWith(color: colors.ink3)),
              const SizedBox(height: MmSpace.s16),
              for (var i = 0; i < plan.lines.length; i++)
                _PlanLine(
                  number: i + 1,
                  text: plan.lines[i],
                  newest: i == plan.lines.length - 1,
                  show: revealed,
                  delay: stagger * i,
                  animate: animate,
                  gap: compact ? MmSpace.s8 : MmSpace.s12,
                ),
              const SizedBox(height: MmSpace.s4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: MmSpace.s4),
                      child: Text(OnboardingCopy.sharpens, style: type.caption.copyWith(color: colors.ink3)),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  FoilSeal(sealed: sealed, size: compact ? 56 : 72, animate: animate),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    return CustomPaint(foregroundPainter: _SealTrace(progress: seal, color: colors.isNight ? colors.volt : colors.accentText), child: card);
  }
}

class _PlanLine extends StatelessWidget {
  const _PlanLine({
    required this.number,
    required this.text,
    required this.newest,
    required this.show,
    required this.delay,
    required this.animate,
    required this.gap,
  });

  final int number;
  final String text;
  final bool newest;
  final bool show;
  final Duration delay;
  final bool animate;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final numberStyle = type.figure.copyWith(
      fontSize: 13,
      height: 1.6,
      letterSpacing: 0,
      color: colors.ink3,
    );
    return Padding(
      padding: EdgeInsets.only(bottom: gap),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 28, child: ExcludeSemantics(child: Text('$number', style: numberStyle))),
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
