import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../sheet/flap_faces.dart' show MarksMeter;
import '../sheet/sheet_geometry.dart';
import '../widgets/answer_map.dart';
import '../widgets/result_space.dart';

/// The top of the full result (spec 5.7, Lab order): the figure with its denominator, the counts
/// with theirs, the arithmetic, and the answer sheet itself, flat and settled.
class SummarySection extends StatelessWidget {
  const SummarySection({super.key, required this.model, this.mobi, this.mobiPose = MobiPose.read, this.onOpenQuestion, this.arrival = false, this.onPeek});

  final RecapModel model;

  /// Drives the reader Mobi beside the answers heading; null leaves Mobi out (an NTA result).
  final MobiController? mobi;

  /// How that Mobi stands: reading the sheet, or sleepy late at night.
  final MobiPose mobiPose;

  /// A bubble of the answer map was tapped (1-based). Null leaves the grid plain.
  final ValueChanged<int>? onOpenQuestion;

  /// The result has just been opened: the map plays its one arrival ripple.
  final bool arrival;
  final ValueChanged<int>? onPeek;

  /// The reader Mobi's height.
  static const double mobiSize = 56;

  /// The subject emblem's side beside the figure: the tile size of the emblem scale (audit X5).
  static const double emblemSize = ResultSpace.emblem;

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
        _AnswersMap(model: m, mobi: mobi, mobiPose: mobiPose, onOpen: onOpenQuestion, arrival: arrival, onPeek: onPeek),
      ],
    );
  }
}

/// The paper's answers as one map on the page itself, ten to a row and numbered like the sheet in
/// the exam hall: no dark panel, so on Daylight it is ink on the warm page and on Night it is
/// bubbles on the ground. The recap's printed sheet is the object; here the result is simply read
/// and every bubble opens its question. Mobi, when it is there (never on an NTA result), reads
/// beside the heading and turns to whichever answer is opened.
class _AnswersMap extends StatelessWidget {
  const _AnswersMap({required this.model, required this.mobi, required this.mobiPose, required this.onOpen, required this.arrival, this.onPeek});

  final RecapModel model;
  final MobiController? mobi;
  final MobiPose mobiPose;
  final ValueChanged<int>? onOpen;
  final bool arrival;
  final ValueChanged<int>? onPeek;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.small.copyWith(color: colors.ink3);
    final cells = model.cells;
    final mobi = this.mobi;
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
            if (mobi != null) ...[
              const SizedBox(width: MmSpace.s8),
              Mobi(pose: mobiPose, size: SummarySection.mobiSize, controller: mobi),
            ],
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
