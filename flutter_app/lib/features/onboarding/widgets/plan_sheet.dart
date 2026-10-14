import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/plan.dart';
import 'engraved_text.dart';
import 'entrance.dart';
import 'foil_seal.dart';
import 'glyphs.dart';

/// The back of the sheet: the plan, printed like the rows of an answer sheet. Each row's
/// numbered bubble inks in turn and its line engraves after it; timing marks run down the left
/// edge; the lamp pools behind the card. While the student holds to seal, a volt light runs
/// around the edge ([seal]); when the seal lands ([stamp]) the foil seal drops into the corner
/// with a ring wave. Volt appears only in the inked bubbles, the edge light and the seal.
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
    this.stamp,
  });

  final PlanSummary plan;
  final Animation<double> seal;
  final bool sealed;

  /// "Tuesday, 13 October": the day week one starts.
  final String from;

  /// The overline: built from the answers (and defaults, when a step was skipped).
  final String lead;

  /// False until the flip has landed: the rows wait, then print.
  final bool revealed;
  final bool animate;

  /// Tighter rows and a smaller seal, for a short window.
  final bool compact;

  /// 0 to 1 as the seal lands (the ring wave); null draws it at rest.
  final Animation<double>? stamp;

  static const BorderRadius radius = MmRadius.panelAll;
  static const Duration stagger = Duration(milliseconds: 160);

  /// How long the rows take to print after the flip lands.
  static Duration printTime(int rows) => stagger * rows + Motion.engrave;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final card = FakeGlass(
      borderRadius: radius,
      lamp: true,
      opacity: colors.isNight ? 0.7 : 0.84,
      child: Builder(
        builder: (context) => Stack(
          children: [
            Positioned(
              left: 8,
              top: MmSpace.s20,
              bottom: MmSpace.s20,
              child: TimingMarks(color: colors.ink.withValues(alpha: colors.isNight ? 0.14 : 0.18)),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(MmSpace.s20, compact ? MmSpace.s16 : MmSpace.s24, MmSpace.s20, MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(lead, style: type.caption.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  _Headline(
                    plan.headline,
                    style: type.moment.copyWith(fontSize: compact ? 28 : 36, height: compact ? 30 / 28 : 38 / 36),
                    textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
                    rise: animate && !sealed,
                  ),
                  const SizedBox(height: MmSpace.s8),
                  Text(OnboardingCopy.planFrom(from), style: type.small.copyWith(color: colors.ink3)),
                  SizedBox(height: compact ? MmSpace.s12 : MmSpace.s20),
                  for (var i = 0; i < plan.lines.length; i++)
                    _PlanRow(
                      number: i + 1,
                      text: plan.lines[i],
                      show: revealed,
                      delay: stagger * i,
                      animate: animate,
                      gap: compact ? MmSpace.s8 : MmSpace.s12,
                      last: i == plan.lines.length - 1,
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
                      _StampedSeal(sealed: sealed, size: compact ? 56 : 72, animate: animate, stamp: stamp),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    // The glass card is cached in its own layer, so the edge light, the lamp sweep and the sink
    // under the finger repaint only themselves, never the card.
    return CustomPaint(
      foregroundPainter: _SealTrace(progress: seal, color: colors.isNight ? colors.volt : colors.accentText),
      child: RepaintBoundary(
        child: _LampSweep(run: revealed && animate && !sealed, child: RepaintBoundary(child: card)),
      ),
    );
  }
}

/// The plan's headline. As the sheet turns face up its words rise into place one after another
/// (the moment-type rise, as on Welcome), so the plan lands with its name; at rest, a return, a
/// sealed sheet or reduced motion it is plain text.
class _Headline extends StatelessWidget {
  const _Headline(this.text, {required this.style, required this.textScaler, required this.rise});

  final String text;
  final TextStyle style;
  final TextScaler textScaler;
  final bool rise;

  @override
  Widget build(BuildContext context) {
    final words = RiseHeadline(text, style: style, textScaler: textScaler, at: const Duration(milliseconds: 120));
    return Semantics(
      header: true,
      label: text,
      excludeSemantics: true,
      child: rise ? StepEntrance(child: words) : words,
    );
  }
}

/// One soft band of lamp light crossing the sheet once as it lands face up (700 ms), the moment
/// layer's light sweep. Never repeats; off under reduced motion.
class _LampSweep extends StatefulWidget {
  const _LampSweep({required this.run, required this.child});

  final bool run;
  final Widget child;

  @override
  State<_LampSweep> createState() => _LampSweepState();
}

class _LampSweepState extends State<_LampSweep> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: Motion.sweep);
  bool _done = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybeRun();
  }

  @override
  void didUpdateWidget(_LampSweep old) {
    super.didUpdateWidget(old);
    _maybeRun();
  }

  void _maybeRun() {
    if (_done || !widget.run) return;
    _done = true;
    if (!Motion.reduced(context)) _t.forward();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return CustomPaint(
      foregroundPainter: _SweepPainter(progress: _t, color: colors.lamp.withValues(alpha: colors.isNight ? 0.16 : 0.22)),
      child: widget.child,
    );
  }
}

class _SweepPainter extends CustomPainter {
  _SweepPainter({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = progress.value;
    if (p <= 0 || p >= 1) return;
    final x = -size.width * 0.6 + size.width * 2.2 * Motion.sweepCurve.transform(p);
    final band = size.width * 0.45;
    canvas.save();
    canvas.clipRRect(PlanSheet.radius.toRRect(Offset.zero & size));
    final rect = Rect.fromLTWH(x - band, 0, band * 2, size.height);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: const Alignment(-1, -0.3),
          end: const Alignment(1, 0.3),
          colors: [color.withValues(alpha: 0), color, color.withValues(alpha: 0)],
        ).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.color != color || old.progress != progress;
}

/// One printed row: a numbered answer bubble that inks at its turn, then the line engraving.
class _PlanRow extends StatefulWidget {
  const _PlanRow({
    required this.number,
    required this.text,
    required this.show,
    required this.delay,
    required this.animate,
    required this.gap,
    required this.last,
  });

  final bool last;
  final int number;
  final String text;
  final bool show;
  final Duration delay;
  final bool animate;
  final double gap;

  @override
  State<_PlanRow> createState() => _PlanRowState();
}

class _PlanRowState extends State<_PlanRow> with SingleTickerProviderStateMixin {
  /// Made only when a row has to wait its turn.
  AnimationController? _wait;
  bool _printed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybePrint();
  }

  @override
  void didUpdateWidget(_PlanRow old) {
    super.didUpdateWidget(old);
    _maybePrint();
  }

  void _maybePrint() {
    if (_printed || !widget.show) return;
    if (!widget.animate || Motion.reduced(context) || widget.delay == Duration.zero) {
      _printed = true;
      return;
    }
    if (_wait != null) return;
    // The wait is a controller run (no timers), so a test clock and a disposal both stop it.
    final wait = _wait = AnimationController(vsync: this, duration: widget.delay);
    wait.forward().whenCompleteOrCancel(() {
      if (mounted && !_printed) setState(() => _printed = true);
    });
  }

  @override
  void dispose() {
    _wait?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const size = 24.0;
    final on = _printed;
    // Ruled like a form: a hairline under each answer but the last, from the text to the edge.
    final half = widget.gap / 2;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: widget.last ? null : Border(bottom: BorderSide(color: colors.line)),
      ),
      child: Padding(
      padding: EdgeInsets.fromLTRB(0, half - 1, 0, half - 1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: SizedBox(
              width: 36,
              child: Align(
                alignment: Alignment.topLeft,
                child: SizedBox.square(
                  dimension: size,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Bubble(state: on ? BubbleState.filled : BubbleState.hollow, size: size, animate: widget.animate, inkOrigin: const Offset(-1, 0)),
                      Text(
                        '${widget.number}',
                        style: type.caption.copyWith(
                          fontSize: 11,
                          height: 1,
                          fontWeight: FontWeight.w800,
                          color: on ? colors.voltInk : colors.ink3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: widget.show
                ? (on
                    ? EngravedText(widget.text, animate: widget.animate, style: type.small.copyWith(color: colors.ink, height: 1.4))
                    : Text(widget.text, style: type.small.copyWith(color: Colors.transparent, height: 1.4)))
                : Text(widget.text, style: type.small.copyWith(color: Colors.transparent, height: 1.4)),
          ),
        ],
      ),
      ),
    );
  }
}

/// The foil seal in the sheet's corner, landing with a ring wave as [stamp] runs: it drops from
/// 1.35x to its size on the overshoot curve while a volt ring spreads from it and fades.
class _StampedSeal extends StatelessWidget {
  const _StampedSeal({required this.sealed, required this.size, required this.animate, required this.stamp});

  final bool sealed;
  final double size;
  final bool animate;
  final Animation<double>? stamp;

  static const Cubic _land = Cubic(0.3, 1.35, 0.46, 1);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (!sealed) {
      // Where the seal will land: a dashed ring, like the box on a form that waits for a stamp.
      return ExcludeSemantics(
        child: CustomPaint(size: Size.square(size), painter: _DashedRing(color: colors.ink3.withValues(alpha: 0.7))),
      );
    }
    final seal = FoilSeal(sealed: sealed, size: size, animate: animate && stamp == null);
    final s = stamp;
    if (s == null) return seal;
    return AnimatedBuilder(
      animation: s,
      child: seal,
      builder: (context, child) {
        final t = s.value;
        if (t <= 0) return Opacity(opacity: 0, child: child);
        if (t >= 1) return child!;
        final scale = 1.35 - 0.35 * _land.transform(t);
        return CustomPaint(
          foregroundPainter: _WavePainter(t: t, color: colors.isNight ? colors.volt : colors.accentText),
          child: Opacity(opacity: (t * 4).clamp(0.0, 1.0), child: Transform.scale(scale: scale, child: child)),
        );
      },
    );
  }
}

class _DashedRing extends CustomPainter {
  const _DashedRing({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const dashes = 24;
    final r = size.shortestSide / 2 - 6;
    final c = size.center(Offset.zero);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..color = color;
    const sweep = 2 * math.pi / dashes;
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), i * sweep, sweep * 0.5, false, paint);
    }
  }

  @override
  bool shouldRepaint(_DashedRing old) => old.color != color;
}

class _WavePainter extends CustomPainter {
  const _WavePainter({required this.t, required this.color});

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = ((t - 0.25) / 0.75).clamp(0.0, 1.0);
    if (w <= 0) return;
    final e = Motion.out.transform(w);
    canvas.drawCircle(
      size.center(Offset.zero),
      size.shortestSide * (0.45 + 0.9 * e),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3 * (1 - e) + 0.5
        ..color = color.withValues(alpha: 0.8 * (1 - w)),
    );
  }

  @override
  bool shouldRepaint(_WavePainter old) => old.t != t || old.color != color;
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
