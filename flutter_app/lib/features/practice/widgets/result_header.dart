import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show LateNightLine;
import '../copy.dart';

/// The top of the practice result: the number of right answers as the one monumental number,
/// right, wrong and not attempted kept apart, the chapter when there was one, the answer sheet
/// inking in order, and the receipt. Feedback arrives here, after finishing, never during.
/// Calm: no sweep, no celebration.
class ResultHeader extends StatelessWidget {
  const ResultHeader({
    super.key,
    required this.correct,
    required this.total,
    required this.wrong,
    required this.blank,
    required this.cells,
    required this.recordedAt,
    this.subject,
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
  final String? subject;
  final String? chapter;

  /// Drives the in-order fill of the sheet. Null shows it complete.
  final Animation<double>? reveal;

  /// Tapping a bubble opens that question below. The rows are the accessible path.
  final ValueChanged<int>? onCellTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (subject != null) Text(PracticeCopy.resultOverline(subject!), style: type.caption.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s4),
        Semantics(
          header: true,
          label: PracticeCopy.figureSemantics(correct, total),
          excludeSemantics: true,
          child: MonumentalNumber(value: PracticeCopy.figureNumber(correct), unit: PracticeCopy.figureUnit(total)),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(PracticeCopy.countsLine(correct, wrong, blank), style: type.lead.copyWith(color: colors.ink)),
        if (chapter != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(PracticeCopy.chapterResultLine(chapter!), style: type.body.copyWith(color: colors.ink2)),
        ],
        if (cells.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s24),
          _SheetCard(cells: cells, reveal: reveal, onCellTap: onCellTap),
        ],
        const SizedBox(height: MmSpace.s20),
        ReceiptLine(text: PracticeCopy.recorded(recordedAt)),
        const LateNightLine(),
      ],
    );
  }
}

/// The student's sheet on a smoked card: one bubble per question, in order.
class _SheetCard extends StatelessWidget {
  const _SheetCard({required this.cells, this.reveal, this.onCellTap});

  final List<QuestionCell> cells;
  final Animation<double>? reveal;
  final ValueChanged<int>? onCellTap;

  static const double gap = 6;

  @override
  Widget build(BuildContext context) {
    return FakeGlass(
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final columns = sheetColumns(cells.length);
            final cell = ((constraints.maxWidth - (columns - 1) * gap) / columns).clamp(16.0, 26.0);
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
        ),
      ),
    );
  }
}

/// Columns that keep a sheet of [count] bubbles even: one row up to 10, then rows of 10 (or 8
/// for 15, so the last row is not a stub).
int sheetColumns(int count) {
  if (count <= 10) return count < 1 ? 1 : count;
  if (count == 15) return 8;
  return 10;
}
