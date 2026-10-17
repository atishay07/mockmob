import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../sheet/sheet_geometry.dart';
import '../widgets/answer_map.dart';

/// The answer map alone, for the "Every answer" fold of the result (RESULT-1017 4.6): ten to a row, numbered like
/// the exam hall's sheet, every bubble opening its question. No Mobi: the result has none (F11).
class ResultAnswersMap extends StatelessWidget {
  const ResultAnswersMap({super.key, required this.model, required this.onOpen, this.onPeek});

  final RecapModel model;
  final ValueChanged<int> onOpen;
  final ValueChanged<int>? onPeek;

  @override
  Widget build(BuildContext context) =>
      _AnswersMap(model: model, onOpen: onOpen, arrival: false, onPeek: onPeek);
}

/// The paper's answers as one map on the page itself, ten to a row and numbered like the sheet in
/// the exam hall: no dark panel, so on Daylight it is ink on the warm page and on Night it is
/// bubbles on the ground. The recap's printed sheet is the object; here the result is simply read
/// and every bubble opens its question.
class _AnswersMap extends StatelessWidget {
  const _AnswersMap({required this.model, required this.onOpen, required this.arrival, this.onPeek});

  final RecapModel model;
  final ValueChanged<int>? onOpen;
  final bool arrival;
  final ValueChanged<int>? onPeek;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.small.copyWith(color: colors.ink3);
    final cells = model.cells;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(ResultCopy.answers, style: label),
                      const SizedBox(width: MmSpace.s8),
                      Text(ResultCopy.range(cells.length), style: label),
                    ],
                  ),
                  if (onOpen != null) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(ResultCopy.mapHint, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        if (onOpen == null)
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
          )
        else
          AnswerMap(cells: cells, subject: model.subjectName, onOpen: onOpen!, arrival: arrival, onPeek: onPeek),
      ],
    );
  }
}
