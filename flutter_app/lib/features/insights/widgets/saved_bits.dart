import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The free plan's save slots as a row of bubble pips: one per slot, the used ones inked in order
/// (the same bubbles as the answer sheet, from [BubblePaint]). They ink left to right once when
/// the page opens; when the server acknowledges a change in the count, only the pip that changed
/// pops (inks, or empties) and the rest stay still. Under reduced motion the pips are simply
/// inked. One picture for screen readers: "12 of 25 free save slots used".
class SlotMeter extends StatefulWidget {
  const SlotMeter({super.key, required this.count, required this.limit});

  final int count;
  final int limit;

  @override
  State<SlotMeter> createState() => _SlotMeterState();
}

class _SlotMeterState extends State<SlotMeter> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 600), value: 1);
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 320), value: 1);
  int _changed = -1;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _ink.forward(from: 0);
  }

  @override
  void didUpdateWidget(SlotMeter old) {
    super.didUpdateWidget(old);
    if (old.count == widget.count) return;
    // Inking adds pip [count - 1]; removing empties pip [count].
    _changed = widget.count > old.count ? widget.count - 1 : widget.count;
    if (!Motion.reduced(context)) _pop.forward(from: 0);
  }

  @override
  void dispose() {
    _ink.dispose();
    _pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final limit = math.max(1, widget.limit);
    return Semantics(
      label: InsightsCopy.slotsLabel(widget.count, widget.limit),
      image: true,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: LayoutBuilder(
            builder: (context, box) {
              const gap = 3.0;
              final d = math.min(14.0, (box.maxWidth - (limit - 1) * gap) / limit);
              return SizedBox(
                width: box.maxWidth,
                height: d + 6,
                child: AnimatedBuilder(
                  animation: Listenable.merge([_ink, _pop]),
                  builder: (context, _) => CustomPaint(
                    painter: SlotMeterPainter(
                      count: widget.count.clamp(0, limit),
                      limit: limit,
                      gap: gap,
                      colors: colors,
                      ink: _ink.value,
                      changed: _changed,
                      pop: _pop.value,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class SlotMeterPainter extends CustomPainter {
  SlotMeterPainter({required this.count, required this.limit, required this.gap, required this.colors, required this.ink, required this.changed, required this.pop});

  final int count;
  final int limit;
  final double gap;
  final MmColors colors;

  /// The page-open inking, 0 to 1.
  final double ink;

  /// The pip that just changed, and how far its pop has run (0 to 1).
  final int changed;
  final double pop;

  @override
  void paint(Canvas canvas, Size size) {
    final d = math.min(14.0, (size.width - (limit - 1) * gap) / limit);
    final r = d / 2;
    final paint = BubblePaint(colors);
    for (var i = 0; i < limit; i++) {
      final c = Offset(i * (d + gap) + r, size.height / 2);
      final isChanged = i == changed && pop < 1;
      final bump = isChanged ? 1 + 0.38 * math.sin(math.pi * pop) : 1.0;
      if (i >= count) {
        // An emptied pip empties as the pop passes its peak.
        if (isChanged && pop < 0.5) {
          paint.paint(canvas, c, r * bump, BubbleState.filled, fill: 1);
        } else {
          paint.paint(canvas, c, r * bump, BubbleState.hollow);
        }
        continue;
      }
      // Each used pip starts a little after the one before, over the first 70% of the run.
      final start = i / limit * 0.7;
      final f = ((ink - start) / 0.3).clamp(0.0, 1.0);
      if (isChanged) {
        paint.paint(canvas, c, r * bump, BubbleState.filled, fill: Motion.out.transform((pop * 1.6).clamp(0.0, 1.0)));
      } else if (f <= 0) {
        paint.paint(canvas, c, r, BubbleState.hollow);
      } else {
        paint.paint(canvas, c, r, BubbleState.filled, fill: Motion.out.transform(f));
      }
    }
  }

  @override
  bool shouldRepaint(SlotMeterPainter old) =>
      old.count != count || old.limit != limit || old.ink != ink || old.pop != pop || old.changed != changed || old.colors != colors;
}

/// A removal in flight: the bookmark key dips and rises while a thin ring turns around it. It
/// replaces the old half-faded row, so the row stays readable while the server answers. Still
/// under reduced motion (the ring is drawn part-way and the dip is gone).
class PendingBookmark extends StatefulWidget {
  const PendingBookmark({super.key});

  @override
  State<PendingBookmark> createState() => _PendingBookmarkState();
}

class _PendingBookmarkState extends State<PendingBookmark> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: 28,
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final t = _c.value;
              return CustomPaint(
                painter: _RingPainter(turn: t, color: colors.ink2),
                child: Center(
                  child: Transform.translate(
                    offset: Offset(0, 2.5 * math.sin(2 * math.pi * t)),
                    child: Icon(LucideIcons.bookmarkMinus, size: 16, color: colors.ink2),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.turn, required this.color});

  final double turn;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(1.2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..color = color.withValues(alpha: 0.28);
    canvas.drawArc(rect, 0, 2 * math.pi, false, paint);
    paint.color = color;
    canvas.drawArc(rect, 2 * math.pi * turn - math.pi / 2, 1.5, false, paint);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.turn != turn || old.color != color;
}
