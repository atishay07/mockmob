import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'paper.dart';
import 'sheet_geometry.dart';

/// The lower part of the answer sheet: one bubble per question in rows of ten, numbered like the
/// sheet in the exam hall, with the printed timing track down the left edge. [sealed] keeps every
/// bubble hollow and dim, so nothing leaks before the student opens it; [reveal] inks them in
/// question order.
class SheetBody extends StatelessWidget {
  const SheetBody({super.key, required this.geometry, required this.cells, required this.sealed, this.reveal, this.semanticsLabel});

  final SheetGeometry geometry;
  final List<BubbleState> cells;
  final bool sealed;
  final Animation<double>? reveal;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.caption.copyWith(color: colors.ink3, fontSize: 11.5, letterSpacing: 0.4);
    return PaperFace(
      edge: false,
      child: CustomPaint(
        painter: _TimingTrack(geometry: geometry, color: colors.ink4),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(26, SheetGeometry.pad, SheetGeometry.pad, SheetGeometry.pad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: SheetGeometry.headerHeight,
                child: Row(
                  children: [
                    Text(ResultCopy.answers, style: label),
                    const Spacer(),
                    Text(ResultCopy.range(cells.length), style: label),
                  ],
                ),
              ),
              const SizedBox(height: SheetGeometry.headerGap),
              BubbleGrid(
                states: cells,
                columns: geometry.columns,
                bubbleSize: geometry.bubble,
                minGap: 4,
                maxGap: 18,
                rowGap: SheetGeometry.rowGap,
                sealed: sealed,
                reveal: sealed ? null : reveal,
                semanticsLabel: semanticsLabel,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The black timing marks an OMR reader uses to find each row, printed down the left margin.
class _TimingTrack extends CustomPainter {
  const _TimingTrack({required this.geometry, required this.color});

  final SheetGeometry geometry;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color.withValues(alpha: 0.55);
    final top = SheetGeometry.pad + SheetGeometry.headerHeight + SheetGeometry.headerGap + SheetGeometry.numberSpace;
    for (var r = 0; r < geometry.rows; r++) {
      final y = top + r * (geometry.bubble + SheetGeometry.numberSpace + SheetGeometry.rowGap) + geometry.bubble / 2;
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(9, y - 2, 8, 4), const Radius.circular(1)), paint);
    }
  }

  @override
  bool shouldRepaint(_TimingTrack old) => old.geometry != geometry || old.color != color;
}
