import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
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
/// "5 not answered" takes them to question 9, the first without an answer. The counts are a
/// ledger of numerals, so the sheet reads first, then what is left to settle.
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

    // The one focal surface of the page (MmSurface hero tier): lamp light, grain, edge light, and
    // the volt lit edge while the sheet can still be handed in.
    return MmSurface.hero(
      lit: lit,
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
                // The roll lands after the card has arrived (the page's entrance).
                delay: Motion.staggerStep * 2,
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
          if (counts.marked > 0)
            _CountRow(
              glyph: Icon(LucideIcons.flag, size: 16, color: colors.ink),
              count: counts.marked,
              word: RunnerCopy.markedWord,
              goTo: onGoTo == null || firstMarked < 0 ? null : () => onGoTo!(firstMarked),
              goToLabel: firstMarked < 0 ? null : RunnerCopy.goToQuestion(firstMarked + 1),
            ),
          if (counts.marked > 0 && counts.notAnswered > 0) Divider(height: 1, thickness: 1, color: colors.line),
          if (counts.notAnswered > 0)
            _CountRow(
              glyph: const Bubble(state: BubbleState.blank, size: 16, animate: false),
              count: counts.notAnswered,
              word: RunnerCopy.notAnsweredWord,
              goTo: onGoTo == null || firstOpen < 0 ? null : () => onGoTo!(firstOpen),
              goToLabel: firstOpen < 0 ? null : RunnerCopy.goToQuestion(firstOpen + 1),
            ),
        ],
      ),
    );
  }
}

/// One count of the ledger under the sheet: the number as a numeral, what it counts, and, while
/// the student can still act, a line saying where it takes them. The whole row is the key (a full
/// width target, at least 64 dp tall, with a chevron), so there is no second box to find; it
/// darkens while pressed. A count of zero is not shown.
class _CountRow extends StatefulWidget {
  const _CountRow({required this.glyph, required this.count, required this.word, this.goTo, this.goToLabel});

  final Widget glyph;
  final int count;
  final String word;
  final VoidCallback? goTo;
  final String? goToLabel;

  @override
  State<_CountRow> createState() => _CountRowState();
}

class _CountRowState extends State<_CountRow> {
  bool _pressed = false;
  bool _focused = false;

  bool get _canGo => widget.goTo != null && widget.goToLabel != null;

  void _set(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final body = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          children: [
            SizedBox.square(dimension: 22, child: Center(child: widget.glyph)),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // One text, so the count and its words are read as one phrase: "5 not answered".
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${widget.count}',
                          style: type.figureCompact.copyWith(fontSize: 32, height: 1, color: colors.ink),
                        ),
                        TextSpan(
                          text: ' ${widget.word}',
                          style: type.labelLarge.copyWith(color: colors.ink2),
                        ),
                      ],
                    ),
                  ),
                  if (_canGo) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(
                      widget.goToLabel!,
                      style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
            ),
            if (_canGo) Icon(LucideIcons.chevronRight, size: 20, color: colors.ink2),
          ],
        ),
      ),
    );
    if (!_canGo) return body;
    return Semantics(
      container: true,
      button: true,
      label: '${widget.count} ${widget.word}. ${widget.goToLabel}',
      excludeSemantics: true,
      onTap: widget.goTo,
      child: FocusableActionDetector(
        onShowFocusHighlight: (v) => setState(() => _focused = v),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              widget.goTo?.call();
              return null;
            },
          ),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => _set(true),
          onTapUp: (_) => _set(false),
          onTapCancel: () => _set(false),
          onTap: widget.goTo,
          child: DecoratedBox(
            position: DecorationPosition.foreground,
            decoration: _focused
                ? ShapeDecoration(
                    shape: RoundedSuperellipseBorder(
                      borderRadius: MmRadius.keyAll,
                      side: BorderSide(color: colors.focusRing, width: 2),
                    ),
                  )
                : const BoxDecoration(),
            child: ColoredBox(color: _pressed ? colors.raised2 : const Color(0x00000000), child: body),
          ),
        ),
      ),
    );
  }
}
