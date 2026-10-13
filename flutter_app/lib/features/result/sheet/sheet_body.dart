import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'paper.dart';
import 'sheet_geometry.dart';

/// The lower part of the answer sheet: one bubble per question in rows of ten, numbered like the
/// sheet in the exam hall, [sealed] keeps every
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
              // The number lines grow with the text size; when the rows with them would not fit
              // the body, the numbers give way (the sheet keeps its summary) rather than overflow.
              Expanded(
                child: LayoutBuilder(
                  builder: (context, box) {
                    final rows = (cells.length / geometry.columns).ceil();
                    final withNumbers = BubbleGrid.heightFor(
                      rows: rows,
                      bubbleSize: geometry.bubble,
                      rowGap: SheetGeometry.rowGap,
                      numberHeight: BubbleGrid.numberHeightFor(MediaQuery.textScalerOf(context)),
                    );
                    return Align(
                      alignment: Alignment.topCenter,
                      child: BubbleGrid(
                        states: cells,
                        columns: geometry.columns,
                        bubbleSize: geometry.bubble,
                        minGap: 4,
                        maxGap: 18,
                        rowGap: SheetGeometry.rowGap,
                        numbers: !box.hasBoundedHeight || withNumbers <= box.maxHeight,
                        sealed: sealed,
                        reveal: sealed ? null : reveal,
                        semanticsLabel: semanticsLabel,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
