import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'finish_ceremony.dart';
import 'sheet_columns.dart';

/// The student's sheet as bubbles, one per question, laid out the way the finish moment and the
/// filed sheet both show it: ten or fewer spread evenly in one row with each bubble's number
/// under it (like the real sheet), more in the sheet's columns. [reveal] inks them in order. A tap
/// on a bubble reports its index when [onCellTap] is set.
class NumberedSheet extends StatelessWidget {
  const NumberedSheet({super.key, required this.cells, this.reveal, this.onCellTap, this.onCellLongPress, this.stripKey});

  final List<QuestionCell> cells;
  final Animation<double>? reveal;
  final ValueChanged<int>? onCellTap;

  /// A long press on a bubble reports its index (Mobi points at it and says its verdict).
  final ValueChanged<int>? onCellLongPress;

  /// Keys the strip alone (its width is the geometry's width), for pointing at one bubble.
  final Key? stripKey;

  static const double gap = 6;

  /// Where the bubbles sit in a strip [width] wide: ten or fewer spread evenly across it (no
  /// half-empty row), more in the sheet's columns.
  static ({int columns, double cell, double gap, double left}) geometry(int count, double width) {
    if (count <= 10) {
      // The bubbles shrink a little rather than run past the right edge.
      final cell = ((width - (count - 1) * gap) / count).clamp(16.0, 28.0);
      final spread = count <= 1 ? 0.0 : ((width - count * cell) / (count - 1)).clamp(gap, 40.0);
      final used = count * cell + (count - 1) * spread;
      return (columns: count, cell: cell, gap: spread, left: ((width - used) / 2).clamp(0.0, width));
    }
    final columns = sheetColumns(count);
    final cell = ((width - (columns - 1) * gap) / columns).clamp(16.0, 28.0);
    return (columns: columns, cell: cell, gap: gap, left: 0.0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return LayoutBuilder(
      builder: (context, constraints) {
        final g = geometry(cells.length, constraints.maxWidth);
        Widget strip = Padding(
          key: stripKey,
          padding: EdgeInsets.only(left: g.left),
          child: QuestionStrip(cells: cells, columns: g.columns, cellSize: g.cell, gap: g.gap, reveal: reveal),
        );
        // One row of ten or fewer reads like the real sheet: each bubble has its number under it.
        if (cells.length <= 10) {
          strip = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              strip,
              const SizedBox(height: MmSpace.s6),
              ExcludeSemantics(
                child: CustomPaint(
                  size: const Size.fromHeight(14),
                  painter: SheetNumeralsPainter(
                    count: cells.length,
                    left: g.left,
                    cell: g.cell,
                    gap: g.gap,
                    color: colors.ink3,
                    style: type.caption.copyWith(fontSize: 11, height: 1.2),
                  ),
                ),
              ),
            ],
          );
        }
        final onTap = onCellTap;
        final onLong = onCellLongPress;
        if (onTap == null && onLong == null) return strip;
        // The bubble under [local], or null in the gaps and past the last one.
        int? indexAt(Offset local) {
          final x = local.dx - g.left;
          final col = x < 0 ? -1 : x ~/ (g.cell + g.gap);
          final row = local.dy ~/ (g.cell + g.gap);
          final index = row * g.columns + col;
          return col >= 0 && col < g.columns && index >= 0 && index < cells.length ? index : null;
        }

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: onTap == null
              ? null
              : (details) {
                  final index = indexAt(details.localPosition);
                  if (index != null) onTap(index);
                },
          onLongPressStart: onLong == null
              ? null
              : (details) {
                  final index = indexAt(details.localPosition);
                  if (index != null) onLong(index);
                },
          child: strip,
        );
      },
    );
  }
}
