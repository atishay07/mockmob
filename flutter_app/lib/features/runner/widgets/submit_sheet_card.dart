import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import 'answer_sheet_view.dart';

/// The whole answer sheet on the submit page: the answered count, every bubble as it will be
/// handed in, and the two counts that matter before letting go. The one lit edge on the page.
///
/// While the student can still change their mind ([onGoTo] given) each count is also a way back:
/// "5 not answered" takes them to question 9, the first without an answer.
class SubmitSheetCard extends StatelessWidget {
  const SubmitSheetCard({super.key, required this.session, this.lit = true, this.phase = SheetPhase.review, this.onGoTo});

  final RunnerSession session;

  /// The volt edge; off once the sheet could not be handed in.
  final bool lit;

  /// What the sheet is showing: pencil marks, the scan while sending, or the ink once received.
  final SheetPhase phase;

  /// Zero-based question to go back to; null while the page is no longer a review.
  final ValueChanged<int>? onGoTo;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cells = sheetCellsOf(session);
    final counts = sheetCountsOf(cells);
    final firstOpen = cells.indexWhere((c) => !c.answered);
    final firstMarked = cells.indexWhere((c) => c.marked);
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
            AnswerSheetView(
              cells: cells,
              phase: phase,
              bubbleSize: 17,
              semanticsLabel: RunnerCopy.sheetSummary(answered: counts.answered, notAnswered: counts.notAnswered, marked: counts.marked),
            ),
            const SizedBox(height: MmSpace.s16),
            Divider(height: 1, thickness: 1, color: colors.line),
            const SizedBox(height: MmSpace.s8),
            if (counts.marked > 0) ...[
              _CountRow(
                glyph: Icon(LucideIcons.flag, size: 15, color: colors.ink),
                text: RunnerCopy.markedCount(counts.marked),
                goTo: onGoTo == null || firstMarked < 0 ? null : () => onGoTo!(firstMarked),
                goToLabel: firstMarked < 0 ? null : RunnerCopy.goToQuestion(firstMarked + 1),
              ),
            ],
            _CountRow(
              glyph: const Bubble(state: BubbleState.blank, size: 15, animate: false),
              text: RunnerCopy.notAnsweredCount(counts.notAnswered),
              goTo: onGoTo == null || firstOpen < 0 ? null : () => onGoTo!(firstOpen),
              goToLabel: firstOpen < 0 ? null : RunnerCopy.goToQuestion(firstOpen + 1),
            ),
          ],
        ),
      ),
    );
    return lit ? LitEdge(borderRadius: MmRadius.panelAll, child: card) : card;
  }
}

/// One count with the way back to its first question on the right, as a quiet 48 dp key.
class _CountRow extends StatelessWidget {
  const _CountRow({required this.glyph, required this.text, this.goTo, this.goToLabel});

  final Widget glyph;
  final String text;
  final VoidCallback? goTo;
  final String? goToLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final label = Row(
      children: [
        SizedBox.square(dimension: 20, child: Center(child: glyph)),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Text(text, style: context.mmType.labelLarge.copyWith(color: colors.ink)),
        ),
      ],
    );
    final key = goTo != null && goToLabel != null ? KeyButton.quiet(label: goToLabel!, onPressed: goTo, hapticOnCommit: false) : null;
    // With large text the way back no longer fits beside the count: it goes on a line of its own.
    final stacked = MediaQuery.textScalerOf(context).scale(1) > 1.3;
    if (stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ConstrainedBox(constraints: const BoxConstraints(minHeight: MmTarget.min), child: label),
          if (key != null) Padding(padding: const EdgeInsets.only(left: 28), child: key),
        ],
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: MmTarget.min),
      child: Row(children: [Expanded(child: label), ?key]),
    );
  }
}
