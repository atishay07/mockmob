import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatSignedNumber;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../model/next_move.dart';

/// Layer 1 of the result (RESULT-1017 4.2): what happened, in one glance. One receipt line, the score with its
/// denominator, a three-part marks bar with a worded legend, and the one thing that cost the most marks. Shared by
/// the practice result and the full mock result, so the two read the same.
///
/// On the first open after the paper ([arrival]) the receipt and score fade in, the score counts up from 0 over
/// 600 ms, the bar grows from the left (scored, then wrong, then blank, 520 ms each, 60 ms apart, from 120 ms) and
/// the counts and the costliest line rise 8 dp at 420 ms. Opened again, or under reduced motion, it is still.
class ResultHead extends StatefulWidget {
  const ResultHead({
    super.key,
    required this.receipt,
    required this.marks,
    required this.costliest,
    this.notice,
    this.onNotice,
    this.arrival = false,
    this.beside,
  });

  final String receipt;
  final MoveMarks marks;
  final CostliestLine costliest;

  /// One line with a warning glyph under the costliest line: a key under re-check, or a corrected key.
  final String? notice;
  final VoidCallback? onNotice;
  final bool arrival;

  /// Drawn at the score's right (the subject's emblem on a mock).
  final Widget? beside;

  /// The whole arrival, from the first frame to the last part landing.
  static const Duration arrivalDuration = Duration(milliseconds: 760);

  @override
  State<ResultHead> createState() => _ResultHeadState();
}

class _ResultHeadState extends State<ResultHead> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: ResultHead.arrivalDuration);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.arrival && !Motion.reduced(context)) {
      _c.forward();
    } else {
      _c.value = 1;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Animation<double> _part(int fromMs, int ms) {
    final total = ResultHead.arrivalDuration.inMilliseconds;
    return CurvedAnimation(
      parent: _c,
      curve: Interval(fromMs / total, ((fromMs + ms) / total).clamp(0.0, 1.0), curve: Motion.out),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.marks;
    final count = _part(0, 600);
    final rise = _part(420, 240);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FadeTransition(
          opacity: _part(0, 160),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ResultReceipt(text: widget.receipt),
              const SizedBox(height: MmSpace.s12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AnimatedBuilder(
                      animation: count,
                      builder: (context, _) => ResultScore(scored: (m.scored * count.value).round(), max: m.max, finalScored: m.scored),
                    ),
                  ),
                  if (widget.beside != null) ...[const SizedBox(width: MmSpace.s8), widget.beside!],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        ResultMarksBar(marks: m, scored: _part(120, 520), wrong: _part(180, 520), blank: _part(240, 520)),
        const SizedBox(height: MmSpace.s8),
        _Rise(animation: rise, child: MarksLegend(marks: m)),
        const SizedBox(height: MmSpace.s20),
        _Rise(
          animation: rise,
          child: CostliestBlock(costliest: widget.costliest, notice: widget.notice, onNotice: widget.onNotice),
        ),
      ],
    );
  }
}

/// Fades in and rises 8 dp with [animation].
class _Rise extends StatelessWidget {
  const _Rise({required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: animation,
    child: child,
    builder: (context, child) => Opacity(
      opacity: animation.value,
      child: Transform.translate(offset: Offset(0, 8 * (1 - animation.value)), child: child),
    ),
  );
}

/// "Accountancy full mock. Recorded 9:41 PM, 46m 36s." The only receipt on the screen.
class ResultReceipt extends StatelessWidget {
  const ResultReceipt({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Text(text, style: context.mmType.small.copyWith(color: context.mmColors.ink2));
}

/// "128 of 250 marks": the score in the app's display cut with its denominator beside it, read as one heading.
class ResultScore extends StatelessWidget {
  const ResultScore({super.key, required this.scored, required this.max, int? finalScored}) : finalScored = finalScored ?? scored;

  /// The value drawn now (it counts up on arrival).
  final int scored;
  final int max;

  /// The real score, for a screen reader at every frame.
  final int finalScored;

  /// The score's size: the moment figure (112 sp), so the stamp's ring sits on it.
  static double sizeOf(BuildContext context) => context.mmType.hero.fontSize ?? 112;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = sizeOf(context);
    return Semantics(
      header: true,
      label: '${formatSignedNumber(finalScored)} of $max marks',
      excludeSemantics: true,
      child: Align(
        alignment: Alignment.centerLeft,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                formatSignedNumber(scored),
                style: type.hero.copyWith(fontSize: size, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              const SizedBox(width: MmSpace.s8),
              Text('of $max marks', style: type.title.copyWith(fontSize: 26, color: colors.ink3)),
            ],
          ),
        ),
      ),
    );
  }
}

/// The marks bar: scored, lost to wrong answers (6 each) and left on blanks (5 each), in proportion to the paper's
/// maximum, with 3 dp gaps. Each part grows from the left with its own animation. A negative score draws scored as 0.
class ResultMarksBar extends StatelessWidget {
  const ResultMarksBar({super.key, required this.marks, this.scored, this.wrong, this.blank});

  final MoveMarks marks;
  final Animation<double>? scored;
  final Animation<double>? wrong;
  final Animation<double>? blank;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final m = marks;
    if (m.max <= 0) return const SizedBox.shrink();
    final s = m.scored.clamp(0, m.max);
    final w = m.gapWrong.clamp(0, m.max - s);
    final b = m.gapBlank.clamp(0, m.max - s - w);
    return ExcludeSemantics(
      child: SizedBox(
        height: 10,
        child: CustomPaint(
          painter: _BarPainter(
            parts: [s / m.max, w / m.max, b / m.max],
            grow: [scored, wrong, blank],
            colors: colors,
          ),
          size: const Size(double.infinity, 10),
        ),
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({required this.parts, required this.grow, required this.colors})
    : super(repaint: Listenable.merge([for (final g in grow) ?g]));

  final List<double> parts;
  final List<Animation<double>?> grow;
  final MmColors colors;

  static const double gap = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    final r = Radius.circular(h / 2);
    // The track: the whole paper, so the place the marks land never reads as a hole.
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = colors.ink.withValues(alpha: 0.07));
    final shown = [for (final p in parts) if (p > 0) p];
    final gaps = gap * (shown.isEmpty ? 0 : shown.length - 1);
    final usable = size.width - gaps;
    var x = 0.0;
    for (var i = 0; i < 3; i++) {
      final p = parts[i];
      if (p <= 0) continue;
      final full = usable * p;
      final t = grow[i]?.value ?? 1;
      final w = full * t;
      if (w > 0.5) {
        final rect = RRect.fromRectAndRadius(Rect.fromLTWH(x, 0, w, h), r);
        switch (i) {
          case 0:
            canvas.drawRRect(rect, Paint()..color = colors.volt);
            // On Daylight a 1 dp ink edge keeps the volt apart from the paper.
            if (!colors.isNight) {
              canvas.drawRRect(rect.deflate(0.5), Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 1
                ..color = colors.ink.withValues(alpha: 0.24));
            }
          case 1:
            canvas.drawRRect(rect, Paint()..color = colors.wrongMark);
          default:
            _hatch(canvas, rect, colors);
        }
      }
      x += full + gap;
    }
  }

  /// Blanks: diagonal ink hatching on a faint fill, so they read apart from wrong answers without colour.
  static void _hatch(Canvas canvas, RRect rect, MmColors colors) {
    canvas.save();
    canvas.clipRRect(rect);
    canvas.drawRRect(rect, Paint()..color = colors.ink3.withValues(alpha: 0.22));
    final p = Paint()
      ..color = colors.ink3
      ..strokeWidth = 1.4;
    final b = rect.outerRect;
    for (var x = b.left - b.height; x < b.right + b.height; x += 4.5) {
      canvas.drawLine(Offset(x, b.bottom), Offset(x + b.height, b.top), p);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.colors != colors || old.parts.join() != parts.join();
}

/// "28 right, 12 wrong, 10 blank" with the bar's swatches beside the words, so colour is never the only signal.
class MarksLegend extends StatelessWidget {
  const MarksLegend({super.key, required this.marks});

  final MoveMarks marks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]);
    Widget item(int kind, String text) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(dimension: 10, child: CustomPaint(painter: _Swatch(kind, colors))),
        const SizedBox(width: MmSpace.s6),
        Text(text, style: style),
      ],
    );
    return Semantics(
      label: '${marks.right} right, ${marks.wrong} wrong, ${marks.blank} blank',
      excludeSemantics: true,
      child: Wrap(
        spacing: MmSpace.s16,
        runSpacing: MmSpace.s4,
        children: [
          item(0, '${marks.right} right'),
          item(1, '${marks.wrong} wrong'),
          item(2, '${marks.blank} blank'),
        ],
      ),
    );
  }
}

class _Swatch extends CustomPainter {
  _Swatch(this.kind, this.colors);

  final int kind;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(2.5));
    switch (kind) {
      case 0:
        canvas.drawRRect(rect, Paint()..color = colors.volt);
        if (!colors.isNight) {
          canvas.drawRRect(rect.deflate(0.5), Paint()
            ..style = PaintingStyle.stroke
            ..color = colors.ink.withValues(alpha: 0.3));
        }
      case 1:
        canvas.drawRRect(rect, Paint()..color = colors.wrongMark);
      default:
        _BarPainter._hatch(canvas, rect, colors);
    }
  }

  @override
  bool shouldRepaint(_Swatch old) => old.kind != kind || old.colors != colors;
}

/// "Share Capital cost 29 of the 122 marks you missed." with its detail line, and the re-check notice under it.
class CostliestBlock extends StatelessWidget {
  const CostliestBlock({super.key, required this.costliest, this.notice, this.onNotice});

  final CostliestLine costliest;
  final String? notice;
  final VoidCallback? onNotice;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(costliest.line, style: type.cardTitle.copyWith(fontSize: 18, height: 24 / 18)),
        if (costliest.detail != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(costliest.detail!, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (notice != null) ...[
          const SizedBox(height: MmSpace.s16),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s12),
          _Notice(text: notice!, onTap: onNotice),
        ],
      ],
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text, this.onTap});

  final String text;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: ExcludeSemantics(child: Icon(LucideIcons.triangleAlert, size: 16, color: colors.warnText)),
        ),
        const SizedBox(width: MmSpace.s8),
        Expanded(child: Text(text, style: context.mmType.small.copyWith(color: colors.ink2))),
      ],
    );
    if (onTap == null) return Semantics(liveRegion: true, child: row);
    return Semantics(
      button: true,
      child: InkWell(onTap: onTap, borderRadius: MmRadius.smallAll, child: ConstrainedBox(constraints: const BoxConstraints(minHeight: MmTarget.min), child: Align(alignment: Alignment.centerLeft, child: row))),
    );
  }
}
