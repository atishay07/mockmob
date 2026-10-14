import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../sheet/flap_faces.dart' show MarksMeter;
import '../sheet/sheet_geometry.dart';

/// The top of the full result (spec 5.7, Lab order): the figure with its denominator, the counts
/// with theirs, the arithmetic, and the answer sheet itself, flat and settled.
class SummarySection extends StatelessWidget {
  const SummarySection({super.key, required this.model});

  final RecapModel model;

  /// The subject emblem's side beside the figure.
  static const double emblemSize = 104;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = model;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The paper's subject stands beside the date and the figure: its code-drawn emblem on its
        // own light, drifting slowly (one moving emblem on this screen).
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
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
                            style: type.figureHero,
                            roll: false,
                            semanticsLabel: ResultCopy.figureLabel(m.marks, m.maxMarks),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            SubjectEmblem(subject: m.subjectId, size: SummarySection.emblemSize, framed: false, animate: true),
          ],
        ),
        if (!m.isHeld) ...[
          const SizedBox(height: MmSpace.s8),
          // The same meter as the sheet's marks box, so the recap and the record agree.
          MarksMeter(marks: m.marks, max: m.maxMarks),
          const SizedBox(height: MmSpace.s12),
          Text(ResultCopy.countsWithDenominators(m.correct, m.wrong, m.unattempted, m.questionCount), style: type.body),
          const SizedBox(height: MmSpace.s4),
          Text('${ResultCopy.arithmetic(m.correct, m.wrong, m.marks)}. ${ResultCopy.scheme}', style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        _AnswersGrid(cells: m.cells),
      ],
    );
  }
}

/// The paper's answers as one grid on the page itself, ten to a row and numbered like the sheet in
/// the exam hall: no dark panel, so on Daylight it is ink on the warm page and on Night it is
/// bubbles on the ground. The recap's printed sheet is the object; here the result is simply read.
class _AnswersGrid extends StatelessWidget {
  const _AnswersGrid({required this.cells});

  final List<BubbleState> cells;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.small.copyWith(color: colors.ink3);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(ResultCopy.answers, style: label),
            const Spacer(),
            Text(ResultCopy.range(cells.length), style: label),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        LayoutBuilder(
          builder: (context, c) {
            final g = SheetGeometry.fit(maxWidth: c.maxWidth, maxHeight: 2000, questions: cells.length);
            return Center(
              child: BubbleGrid(
                states: cells,
                columns: g.columns,
                bubbleSize: g.bubble,
                minGap: 4,
                maxGap: 18,
                rowGap: SheetGeometry.rowGap,
                numbers: true,
                sealed: false,
              ),
            );
          },
        ),
      ],
    );
  }
}
