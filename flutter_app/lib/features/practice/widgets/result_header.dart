import 'package:flutter/material.dart';

import '../../../core/copy/copy.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show LateNightLine;
import '../copy.dart';
import 'sheet_glyph.dart';

/// The top of the practice result (spec 5.4.1): one figure, what was wrong and what was left
/// blank (never merged), the chapter when there was one, the answer sheet, and the receipt.
/// No Mobi and no celebration: the sheet fills in order in 320 ms and that is all.
class ResultHeader extends StatelessWidget {
  const ResultHeader({
    super.key,
    required this.correct,
    required this.total,
    required this.wrong,
    required this.blank,
    required this.cells,
    required this.recordedAt,
    this.chapter,
    this.reveal,
    this.onCellTap,
  });

  final int correct;
  final int total;
  final int wrong;
  final int blank;
  final List<QuestionCell> cells;
  final DateTime recordedAt;
  final String? chapter;

  /// Drives the in-order fill of the sheet. Null shows it complete.
  final Animation<double>? reveal;

  /// Tapping a cell of the sheet opens that question below. The rows themselves are the
  /// accessible path, so this is a convenience, not the only way.
  final ValueChanged<int>? onCellTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          label: PracticeCopy.figureSemantics(correct, total),
          excludeSemantics: true,
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: PracticeCopy.figureNumber(correct), style: type.figureCompact),
                TextSpan(
                  text: PracticeCopy.figureRest(total),
                  style: type.title.copyWith(color: colors.ink2),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(PracticeCopy.countsLine(wrong, blank), style: type.body.copyWith(color: colors.ink2)),
        if (chapter != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(PracticeCopy.chapterLine(chapter!), style: type.body.copyWith(color: colors.ink2)),
        ],
        if (cells.isNotEmpty) ...[const SizedBox(height: MmSpace.s24), _Sheet(cells: cells, reveal: reveal, onCellTap: onCellTap)],
        const SizedBox(height: MmSpace.s24),
        ReceiptLine(text: Receipts.practiceRecorded(recordedAt)),
        const LateNightLine(),
      ],
    );
  }
}

class _Sheet extends StatelessWidget {
  const _Sheet({required this.cells, this.reveal, this.onCellTap});

  final List<QuestionCell> cells;
  final Animation<double>? reveal;
  final ValueChanged<int>? onCellTap;

  static const double gap = 4;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = sheetColumns(cells.length);
        final cell = ((constraints.maxWidth - (columns - 1) * gap) / columns).clamp(18.0, 28.0);
        final strip = QuestionStrip(cells: cells, columns: columns, cellSize: cell, gap: gap, reveal: reveal);
        if (onCellTap == null) return strip;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (details) {
            final col = details.localPosition.dx ~/ (cell + gap);
            final row = details.localPosition.dy ~/ (cell + gap);
            final index = row * columns + col;
            if (col >= 0 && col < columns && index >= 0 && index < cells.length) onCellTap!(index);
          },
          child: strip,
        );
      },
    );
  }
}
