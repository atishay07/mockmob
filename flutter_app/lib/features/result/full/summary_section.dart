import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../sheet/paper.dart';
import '../sheet/sheet_body.dart';
import '../sheet/sheet_geometry.dart';

/// The top of the full result (spec 5.7, Lab order): the figure with its denominator, the counts
/// with theirs, the arithmetic, and the answer sheet itself, flat and settled.
class SummarySection extends StatelessWidget {
  const SummarySection({super.key, required this.model});

  final RecapModel model;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = model;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(ResultCopy.submittedOn(m.submittedAt), style: type.small.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s12),
        if (m.isHeld) ...[
          Text(ResultCopy.heldTitle, style: type.headline),
          const SizedBox(height: MmSpace.s6),
          Text(ResultCopy.heldBody(m.heldCount), style: type.body.copyWith(color: colors.ink2)),
        ] else ...[
          Semantics(
            container: true,
            child: Align(
              alignment: Alignment.centerLeft,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: MonumentalNumber(
                  value: formatSignedNumber(m.marks),
                  unit: ResultCopy.outOf(m.maxMarks),
                  style: type.figure,
                  roll: false,
                  semanticsLabel: ResultCopy.figureLabel(m.marks, m.maxMarks),
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(ResultCopy.countsWithDenominators(m.correct, m.wrong, m.unattempted, m.questionCount), style: type.body),
          const SizedBox(height: MmSpace.s4),
          Text(
            '${ResultCopy.arithmetic(m.correct, m.wrong, m.marks)}. ${ResultCopy.scheme}',
            style: type.small.copyWith(color: colors.ink2),
          ),
        ],
        const SizedBox(height: MmSpace.s20),
        LayoutBuilder(
          builder: (context, c) {
            final g = SheetGeometry.fit(maxWidth: c.maxWidth, maxHeight: 2000, questions: m.cells.length);
            return Center(
              child: NightObject(
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.all(Radius.circular(10)),
                    boxShadow: [BoxShadow(color: Color(0x4D000000), blurRadius: 24, offset: Offset(4, 12), spreadRadius: -8)],
                  ),
                  child: SizedBox(
                    width: g.width,
                    height: g.naturalBodyHeight,
                    child: SheetBody(geometry: g, cells: m.cells, sealed: false),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
