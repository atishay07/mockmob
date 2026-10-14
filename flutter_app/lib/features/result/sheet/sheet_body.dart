import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'paper.dart';
import 'read_line.dart';
import 'sheet_geometry.dart';

/// The lower part of the answer sheet: one bubble per question in rows of ten, numbered like the
/// sheet in the exam hall. [sealed] keeps every bubble hollow and dim, so nothing leaks before
/// the student opens it; [reveal] inks them in question order. [scan] instead runs the reader:
/// a line passes down the sheet once and each row inks as it is read.
class SheetBody extends StatelessWidget {
  const SheetBody({
    super.key,
    required this.geometry,
    required this.cells,
    required this.sealed,
    this.reveal,
    this.scan,
    this.semanticsLabel,
  });

  final SheetGeometry geometry;
  final List<BubbleState> cells;
  final bool sealed;
  final Animation<double>? reveal;
  final Animation<double>? scan;
  final String? semanticsLabel;

  static const double _padLeft = 26;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.caption.copyWith(color: colors.ink3, fontSize: 11.5, letterSpacing: 0.4);
    return PaperFace(
      edge: false,
      child: CustomPaint(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(_padLeft, SheetGeometry.pad, SheetGeometry.pad, SheetGeometry.pad),
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
                    final withNumbersFit = !box.hasBoundedHeight || withNumbers <= box.maxHeight;
                    final numberHeight = withNumbersFit ? BubbleGrid.numberHeightFor(MediaQuery.textScalerOf(context)) : 0.0;
                    final gridRows = GridRows(
                      count: rows,
                      columns: geometry.columns,
                      questions: cells.length,
                      bubble: geometry.bubble,
                      rowGap: SheetGeometry.rowGap,
                      numberSpace: numberHeight > 0 ? numberHeight + 3 : 0,
                    );
                    final reader = sealed ? null : scan;
                    // With the numbers gone (large text) the grid is shorter than the body, so it
                    // sits in the middle of the sheet rather than leaving a band under it.
                    final grid = Align(
                      alignment: withNumbersFit ? Alignment.topCenter : Alignment.center,
                      child: BubbleGrid(
                        states: cells,
                        columns: geometry.columns,
                        bubbleSize: geometry.bubble,
                        minGap: 4,
                        maxGap: 18,
                        rowGap: SheetGeometry.rowGap,
                        numbers: withNumbersFit,
                        sealed: sealed,
                        reveal: sealed ? null : (reader == null ? reveal : ScanInk(reader, gridRows)),
                        semanticsLabel: semanticsLabel,
                      ),
                    );
                    if (reader == null) return grid;
                    final top = withNumbersFit || !box.hasBoundedHeight ? 0.0 : (box.maxHeight - gridRows.height) / 2;
                    return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned.fill(child: grid),
                        Positioned.fill(
                          child: IgnorePointer(
                            child: RepaintBoundary(
                              child: CustomPaint(
                                painter: ReadLinePainter(
                                  scan: reader,
                                  rows: gridRows,
                                  top: top,
                                  bleedLeft: _padLeft,
                                  bleedRight: SheetGeometry.pad,
                                  volt: colors.volt,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
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
