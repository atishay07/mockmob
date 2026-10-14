import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';

/// The whole answer sheet on the submit page: the answered count, every bubble as it will be
/// handed in, and the two counts that matter before letting go. The one lit edge on the page.
class SubmitSheetCard extends StatelessWidget {
  const SubmitSheetCard({super.key, required this.session, this.lit = true});

  final RunnerSession session;

  /// The volt edge; off once the sheet could not be handed in.
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cells = sheetCellsOf(session);
    final counts = sheetCountsOf(cells);
    final states = [
      for (final c in cells)
        c.answered
            ? BubbleState.filled
            : c.marked
            ? BubbleState.marked
            : BubbleState.blank,
    ];
    final title = RunnerCopy.sessionLabel(isMock: session.isMock, mode: session.mode, mockNumber: session.mockNumber);

    final card = DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.panelAll,
          side: BorderSide(color: colors.line),
        ),
        shadows: colors.cardShadow,
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('$title, ${RunnerCopy.subjectLine(session.subject, null)}', style: type.caption.copyWith(color: colors.ink3)),
            const SizedBox(height: MmSpace.s8),
            Align(
              alignment: Alignment.centerLeft,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: MonumentalNumber(
                  value: '${counts.answered}',
                  unit: RunnerCopy.answeredOf(counts.total),
                  style: type.figure,
                  unitColor: colors.ink2,
                  semanticsLabel: '${counts.answered} ${RunnerCopy.answeredOf(counts.total)}',
                ),
              ),
            ),
            const SizedBox(height: MmSpace.s20),
            BubbleGrid(
              states: states,
              bubbleSize: 17,
              semanticsLabel: RunnerCopy.sheetSummary(answered: counts.answered, notAnswered: counts.notAnswered, marked: counts.marked),
            ),
            const SizedBox(height: MmSpace.s20),
            Divider(height: 1, thickness: 1, color: colors.line),
            const SizedBox(height: MmSpace.s12),
            if (counts.marked > 0) ...[
              _CountRow(
                glyph: Icon(LucideIcons.flag, size: 15, color: colors.ink),
                text: RunnerCopy.markedCount(counts.marked),
              ),
              const SizedBox(height: MmSpace.s8),
            ],
            _CountRow(
              glyph: const Bubble(state: BubbleState.blank, size: 15, animate: false),
              text: RunnerCopy.notAnsweredCount(counts.notAnswered),
            ),
          ],
        ),
      ),
    );
    return lit ? LitEdge(borderRadius: MmRadius.panelAll, child: card) : card;
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({required this.glyph, required this.text});

  final Widget glyph;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      children: [
        SizedBox.square(dimension: 20, child: Center(child: glyph)),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Text(text, style: context.mmType.labelLarge.copyWith(color: colors.ink)),
        ),
      ],
    );
  }
}
