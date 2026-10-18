import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
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
/// around the edge ([seal]); when the seal lands ([stamp]) the foil seal drops into the corner,
/// with one ring wave when [wave] (the Celebrations setting is Full). That wave is the screen's
/// one light event (MOTION.md 1.1), so the sheet turning face up has no sweep of its own.
/// Volt appears only in the inked bubbles, the edge light and the seal.
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
    this.wave = true,
    this.allLines = false,
    this.onAllLines,
    this.onChange,
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

  /// 0 to 1 as the seal lands; null draws it at rest.
  final Animation<double>? stamp;

  /// A ring wave spreads from the seal as it lands.
  final bool wave;

  /// Every line of the plan, not just the three that lead (design critic 20).
  final bool allLines;

  /// Toggles [allLines] from the "See all 6" link under the rows; null hides the link.
  final VoidCallback? onAllLines;

  /// "Change" under the rows, at the right; null hides it (a sealed plan).
  final VoidCallback? onChange;

  /// How many lines lead the plan before "See all".
  static const int leadLines = 3;

  /// The indexes into [PlanSummary.lines] shown: week one, the pace and the last line (the aim,
  /// or what stands in for it), or all of them in order.
  static List<int> shownLines(int count, {required bool all}) {
    if (all || count <= leadLines) return [for (var i = 0; i < count; i++) i];
    return [0, 1, count - 1];
  }

  static const BorderRadius radius = MmRadius.panelAll;

  /// On the "See all" link, for tests.
  static const Key allLinesKey = ValueKey('plan-all-lines');
  static const Duration stagger = Duration(milliseconds: 160);

  /// How long the rows take to print after the flip lands.
  static Duration printTime(int rows) => stagger * rows + Motion.engrave;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = shownLines(plan.lines.length, all: allLines);
    final more = plan.lines.length > leadLines;
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
                  _FootGrow(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final (n, i) in shown.indexed)
                          _PlanRow(
                            key: ValueKey('plan-line-$i'),
                            number: n + 1,
                            text: plan.lines[i],
                            show: revealed,
                            // The leading rows print in turn after the flip; a row unfolded by
                            // "See all" engraves at once.
                            delay: allLines && n >= leadLines - 1 ? Duration.zero : stagger * n,
                            animate: animate,
                            gap: compact ? MmSpace.s8 : MmSpace.s12,
                            last: n == shown.length - 1,
                          ),
                      ],
                    ),
                  ),
                  // Two quiet words on the sheet itself, under its rows: the rest of the plan, and
                  // the way to change an answer. Hold to seal stays the one action under the card.
                  // Each word's text lines up with the rows; its target overhangs the padding.
                  if ((more && onAllLines != null) || onChange != null)
                    Row(
                      children: [
                        // Both read as buttons (v15 taste pass, F5): "See all 7" with a chevron
                        // that turns as the list opens, "Change" a quiet key with a pencil.
                        if (more && onAllLines != null)
                          Transform.translate(
                            offset: const Offset(-MmSpace.s12, 0),
                            child: _CardLink(
                              key: PlanSheet.allLinesKey,
                              label: allLines ? OnboardingCopy.fewerLines : OnboardingCopy.seeAllLines(plan.lines.length),
                              icon: LucideIcons.chevronDown,
                              turns: allLines ? 0.5 : 0,
                              onTap: onAllLines!,
                            ),
                          ),
                        const Spacer(),
                        if (onChange != null)
                          Transform.translate(
                            offset: const Offset(MmSpace.s12, 0),
                            child: _CardLink(
                              label: OnboardingCopy.change,
                              semanticsLabel: OnboardingCopy.changeSomething,
                              icon: LucideIcons.pencil,
                              iconFirst: true,
                              boxed: true,
                              onTap: onChange!,
                            ),
                          ),
                      ],
                    )
                  else
                    const SizedBox(height: MmSpace.s4),
                  // The foil seal joins the caption only when it lands (the card grows to take
                  // it), so there is no empty target waiting in the corner.
                  _FootGrow(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: MmSpace.s4),
                            child: Text(OnboardingCopy.sharpens, style: type.caption.copyWith(color: colors.ink3)),
                          ),
                        ),
                        if (sealed) ...[
                          const SizedBox(width: MmSpace.s12),
                          _StampedSeal(sealed: true, size: compact ? 56 : 72, animate: animate, stamp: stamp, wave: wave),
                        ],
                      ],
                    ),
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
      foregroundPainter: _SealTrace(progress: seal, color: colors.accentText),
      child: RepaintBoundary(child: card),
    );
  }
}

/// Grows to its content on the emphasized curve (at once under reduced motion).
/// A quiet action on the plan card that still looks pressable: its words with a 16 dp glyph,
/// 44 dp tall, sinking to 0.97 under the finger. [boxed] gives it a hairline key shape (Change);
/// [turns] turns its glyph (See all's chevron, 220 ms).
class _CardLink extends ConsumerWidget {
  const _CardLink({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.semanticsLabel,
    this.iconFirst = false,
    this.boxed = false,
    this.turns = 0,
  });

  final String label;
  final String? semanticsLabel;
  final IconData icon;
  final VoidCallback onTap;
  final bool iconFirst;
  final bool boxed;
  final double turns;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final glyph = AnimatedRotation(
      turns: turns,
      duration: Motion.of(context, const Duration(milliseconds: 220)),
      curve: Motion.glide,
      child: Icon(icon, size: 16, color: colors.ink2),
    );
    final words = Text(label, maxLines: 1, style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink));
    return MmPressable(
      semanticsLabel: semanticsLabel ?? label,
      pressedScale: 0.97,
      focusRadius: MmRadius.pillAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => Container(
        constraints: const BoxConstraints(minHeight: 44, minWidth: 48),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2.withValues(alpha: 0.6) : Colors.transparent,
          shape: StadiumBorder(side: boxed ? BorderSide(color: colors.lineStrong) : BorderSide.none),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: iconFirst
              ? [glyph, const SizedBox(width: MmSpace.s8), words]
              : [words, const SizedBox(width: MmSpace.s4), glyph],
        ),
      ),
    );
  }
}

class _FootGrow extends StatelessWidget {
  const _FootGrow({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return AnimatedSize(duration: Motion.glideDuration, curve: Motion.emphasized, alignment: Alignment.topCenter, child: child);
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

/// One printed row: a numbered answer bubble that inks at its turn, then the line engraving.
class _PlanRow extends StatefulWidget {
  const _PlanRow({
    super.key,
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
  const _StampedSeal({required this.sealed, required this.size, required this.animate, required this.stamp, required this.wave});

  final bool sealed;
  final double size;
  final bool animate;
  final Animation<double>? stamp;
  final bool wave;

  static const Cubic _land = Cubic(0.3, 1.35, 0.46, 1);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (!sealed) return SizedBox.square(dimension: size);
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
          // A stroke on the ground: volt Night, olive Day (SPACING.md 8.3).
          foregroundPainter: wave ? _WavePainter(t: t, color: colors.accentText) : null,
          child: Opacity(opacity: (t * 4).clamp(0.0, 1.0), child: Transform.scale(scale: scale, child: child)),
        );
      },
    );
  }
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
