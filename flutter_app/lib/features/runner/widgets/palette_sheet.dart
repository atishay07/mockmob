import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';
import 'sheet_cell.dart';

/// The palette (spec 5.5) as the student's own answer sheet: five columns of 48 dp bubbles, the
/// legend with counts, and the submit key at the foot.
class PaletteSheet extends StatelessWidget {
  const PaletteSheet({super.key, required this.cells, required this.onJump, required this.onReview});

  final List<SheetCell> cells;
  final ValueChanged<int> onJump;
  final VoidCallback onReview;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final counts = sheetCountsOf(cells);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The legend shows the same counts; this sentence is what TalkBack reads.
        Semantics(
          container: true,
          label: RunnerCopy.legendSummary(
            answered: counts.answered,
            notAnswered: counts.notAnswered - counts.notVisited,
            notVisited: counts.notVisited,
            marked: counts.marked,
            total: counts.total,
          ),
          child: ExcludeSemantics(child: _Legend(counts: counts)),
        ),
        const SizedBox(height: MmSpace.s16),
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s12),
        for (var row = 0; row * 5 < cells.length; row++)
          Row(
            children: [
              for (var col = 0; col < 5; col++)
                Expanded(
                  child: row * 5 + col < cells.length
                      ? SheetCellKey(cell: cells[row * 5 + col], onTap: () => onJump(row * 5 + col))
                      : const SizedBox.shrink(),
                ),
            ],
          ),
        const SizedBox(height: MmSpace.s20),
        KeyButton(label: RunnerCopy.reviewAndSubmit, onPressed: onReview, hapticOnCommit: false),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.counts});

  final SheetCounts counts;

  @override
  Widget build(BuildContext context) {
    Widget item(SheetCell sample, String label, int count) => _LegendItem(sample: sample, label: label, count: count);
    const base = SheetCell(number: 0, answered: false, visited: true, marked: false, unsynced: false, current: false);
    return Wrap(
      spacing: MmSpace.s16,
      runSpacing: MmSpace.s8,
      children: [
        item(
          const SheetCell(number: 0, answered: true, visited: true, marked: false, unsynced: false, current: false),
          RunnerCopy.answered,
          counts.answered,
        ),
        item(base, RunnerCopy.notAnswered, counts.notAnswered - counts.notVisited),
        item(
          const SheetCell(number: 0, answered: false, visited: false, marked: false, unsynced: false, current: false),
          RunnerCopy.notVisited,
          counts.notVisited,
        ),
        _FlagLegend(count: counts.marked),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.sample, required this.label, required this.count});

  final SheetCell sample;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(
          dimension: 22,
          child: CustomPaint(
            painter: _MiniBubble(sample: sample, colors: colors),
          ),
        ),
        const SizedBox(width: MmSpace.s6),
        Text('$label $count', style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

class _MiniBubble extends CustomPainter {
  const _MiniBubble({required this.sample, required this.colors});

  final SheetCell sample;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 2;
    final b = BubblePaint(colors);
    if (sample.answered) {
      b.paint(canvas, c, r, BubbleState.filled);
    } else if (sample.visited) {
      b.paint(canvas, c, r, BubbleState.hollow);
    } else {
      canvas.drawCircle(c, r, Paint()..color = colors.sunken);
      b.paint(canvas, c, r, BubbleState.blank);
    }
  }

  @override
  bool shouldRepaint(_MiniBubble old) => old.colors != colors || old.sample != sample;
}

class _FlagLegend extends StatelessWidget {
  const _FlagLegend({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(dimension: 22, child: Icon(LucideIcons.flag, size: 15, color: colors.ink)),
        const SizedBox(width: MmSpace.s6),
        Text('${RunnerCopy.markedShort} $count', style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}
