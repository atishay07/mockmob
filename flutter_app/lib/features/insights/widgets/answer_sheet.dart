import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// How many questions each bubble of the sheet stands for, and how many bubbles of each kind.
class SheetCounts {
  const SheetCounts({required this.right, required this.wrong, required this.blank, required this.perBubble});

  final int right;
  final int wrong;
  final int blank;

  /// Questions behind each bubble: 1 until there are more questions than the sheet has room for.
  final int perBubble;

  int get cells => right + wrong + blank;

  /// Splits [right], [wrong] and [blank] questions over at most [maxCells] bubbles in proportion
  /// (largest remainder), keeping at least one bubble for each kind that has any question.
  factory SheetCounts.of(int right, int wrong, int blank, {int maxCells = 120}) {
    final total = right + wrong + blank;
    if (total <= maxCells) return SheetCounts(right: right, wrong: wrong, blank: blank, perBubble: 1);
    final per = (total / maxCells).ceil();
    final parts = [right, wrong, blank];
    final cells = [for (final p in parts) p == 0 ? 0 : (p / per).floor().clamp(1, maxCells)];
    // Hand the remainder to the kinds with the largest leftover, until the sheet is as full as
    // the proportion allows.
    final want = (total / per).round();
    var have = cells.fold<int>(0, (a, b) => a + b);
    final order = [0, 1, 2]..sort((a, b) => (parts[b] % per).compareTo(parts[a] % per));
    for (final i in order) {
      if (have >= want) break;
      if (parts[i] > 0) {
        cells[i]++;
        have++;
      }
    }
    return SheetCounts(right: cells[0], wrong: cells[1], blank: cells[2], perBubble: per);
  }
}

/// The student's answer sheet for the record: one bubble per answered question, inked volt for
/// right, a coral cross for wrong and a dashed ring for left blank, in that order. When there are
/// more questions than room, each bubble stands for several and the caption says how many.
///
/// The bubbles ink in reading order over 700 ms once per visit; a rebuild with the same counts
/// does not repeat it, and under reduced motion the sheet is simply inked.
class AnswerSheet extends StatefulWidget {
  const AnswerSheet({super.key, required this.right, required this.wrong, required this.blank, this.columns = 12, this.gap = 6});

  final int right;
  final int wrong;
  final int blank;
  final int columns;
  final double gap;

  @override
  State<AnswerSheet> createState() => _AnswerSheetState();
}

class _AnswerSheetState extends State<AnswerSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: const Duration(milliseconds: 900), value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _ink.forward(from: 0);
  }

  @override
  void didUpdateWidget(AnswerSheet old) {
    super.didUpdateWidget(old);
    final same = old.right == widget.right && old.wrong == widget.wrong && old.blank == widget.blank;
    if (!same && !Motion.reduced(context)) _ink.forward(from: 0);
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final counts = SheetCounts.of(widget.right, widget.wrong, widget.blank);
    final cells = counts.cells;
    if (cells == 0) return const SizedBox.shrink();
    return Semantics(
      label: '${widget.right} right, ${widget.wrong} wrong, ${widget.blank} left blank',
      image: true,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: LayoutBuilder(
            builder: (context, box) {
              final cols = widget.columns;
              final d = (box.maxWidth - (cols - 1) * widget.gap) / cols;
              final rows = (cells / cols).ceil();
              final height = rows * d + (rows - 1) * widget.gap;
              return SizedBox(
                width: box.maxWidth,
                height: height,
                child: AnimatedBuilder(
                  animation: _ink,
                  builder: (context, _) => CustomPaint(
                    painter: _SheetPainter(counts: counts, columns: cols, gap: widget.gap, colors: colors, t: _ink.value),
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

class _SheetPainter extends CustomPainter {
  _SheetPainter({required this.counts, required this.columns, required this.gap, required this.colors, required this.t});

  final SheetCounts counts;
  final int columns;
  final double gap;
  final MmColors colors;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final d = (size.width - (columns - 1) * gap) / columns;
    final r = d / 2;
    final paint = BubblePaint(colors);
    final total = counts.cells;
    for (var i = 0; i < total; i++) {
      final row = i ~/ columns, col = i % columns;
      final c = Offset(col * (d + gap) + r, row * (d + gap) + r);
      final state = i < counts.right ? BubbleState.filled : (i < counts.right + counts.wrong ? BubbleState.wrong : BubbleState.blank);
      // Each bubble starts a little after the one before and takes 0.25 of the run to ink.
      final start = i / total * 0.72;
      final f = ((t - start) / 0.28).clamp(0.0, 1.0);
      if (f <= 0) {
        paint.paint(canvas, c, r, BubbleState.hollow);
      } else if (state == BubbleState.blank) {
        paint.paint(canvas, c, r, BubbleState.blank, dim: Curves.easeOut.transform(f));
      } else {
        paint.paint(canvas, c, r, state, fill: Motion.out.transform(f));
      }
    }
  }

  @override
  bool shouldRepaint(_SheetPainter old) => old.t != t || old.counts != counts || old.colors != colors || old.columns != columns;
}
