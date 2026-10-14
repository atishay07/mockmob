import 'dart:math' as math;

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
/// handed in, and the two counts that matter before letting go. It sits on the page itself, no
/// box around it: one full-width volt rule above it is the page's one lit edge (grey once the
/// sheet could not be handed in), and the sheet, the counts and their hairlines carry the rest.
///
/// While the student can still change their mind ([onGoTo] given) each count is also a way back:
/// "5 not answered" takes them to question 9, the first without an answer. The counts are a
/// ledger of numerals, so the sheet reads first, then what is left to settle.
class SubmitSheetCard extends StatelessWidget {
  const SubmitSheetCard({
    super.key,
    required this.session,
    this.lit = true,
    this.phase = SheetPhase.review,
    this.onGoTo,
    this.animateInk = true,
    this.openRowKey,
    this.pulseOpen = false,
  });

  /// Put on the "not answered" row, so Mobi can point at it.
  final GlobalKey? openRowKey;

  /// The "not answered" row pulses once when this turns true (Mobi pointing at it).
  final bool pulseOpen;

  final RunnerSession session;

  /// The volt edge; off once the sheet could not be handed in.
  final bool lit;

  /// What the sheet is showing: pencil marks, the scan while sending, or the ink once received.
  final SheetPhase phase;

  /// Zero-based question to go back to; null while the page is no longer a review.
  final ValueChanged<int>? onGoTo;

  /// False when Celebrations is Off: the sheet shows its inked end state at once.
  final bool animateInk;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cells = sheetCellsOf(session);
    final counts = sheetCountsOf(cells);
    final firstOpen = cells.indexWhere((c) => !c.answered);
    final firstMarked = cells.indexWhere((c) => c.marked);
    final paper = RunnerCopy.paperName(
      isMock: session.isMock,
      mode: session.mode,
      subject: session.subject,
      mockNumber: session.mockNumber,
      chapter: session.chapter,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // A whole rule, edge to edge (never a gradient that fades out at its ends).
        SizedBox(height: 2, child: ColoredBox(color: lit ? colors.volt : colors.line)),
        const SizedBox(height: MmSpace.s16),
        Text(paper, style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s8),
        Align(
          alignment: Alignment.centerLeft,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: MonumentalNumber(
              // The roll lands after the page has arrived (its entrance).
              delay: Motion.staggerStep * 2,
              value: '${counts.answered}',
              unit: RunnerCopy.answeredOf(counts.total),
              style: type.figure,
              unitColor: colors.ink2,
              semanticsLabel: '${counts.answered} ${RunnerCopy.answeredOf(counts.total)}',
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        // A marked answer has a ring outside its disc: 3 dp each side keeps it inside the gutter.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: AnswerSheetView(
            cells: cells,
            phase: phase,
            animateInk: animateInk,
            bubbleSize: 17,
            semanticsLabel: RunnerCopy.sheetSummary(answered: counts.answered, notAnswered: counts.notAnswered, marked: counts.marked),
          ),
        ),
        _SheetLegend(cells: cells),
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
            key: openRowKey,
            pulse: pulseOpen,
            glyph: const Bubble(state: BubbleState.blank, size: 16, animate: false),
            count: counts.notAnswered,
            word: RunnerCopy.notAnsweredWord,
            goTo: onGoTo == null || firstOpen < 0 ? null : () => onGoTo!(firstOpen),
            goToLabel: firstOpen < 0 ? null : RunnerCopy.goToQuestion(firstOpen + 1),
          ),
      ],
    );
  }
}

/// What the two marked shapes on the sheet mean, in words, only for the shapes that are on it:
/// a ringed disc is an answer that is marked for review, a ringed dot a marked question without
/// an answer. Unanswered (dashed) needs no key: it is the "not answered" count's own glyph.
class _SheetLegend extends StatelessWidget {
  const _SheetLegend({required this.cells});

  final List<SheetCell> cells;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final markedAnswered = cells.any((c) => c.answered && c.marked);
    final markedBlank = cells.any((c) => !c.answered && c.marked);
    if (!markedAnswered && !markedBlank) return const SizedBox.shrink();
    Widget item(Widget glyph, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(dimension: 22, child: Center(child: glyph)),
        const SizedBox(width: MmSpace.s8),
        Text(label, style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: ExcludeSemantics(
        child: Wrap(
          spacing: MmSpace.s16,
          runSpacing: MmSpace.s8,
          children: [
            if (markedAnswered)
              item(CustomPaint(size: const Size.square(22), painter: _MarkedAnsweredGlyph(colors)), RunnerCopy.legendMarkedAnswered),
            if (markedBlank) item(const Bubble(state: BubbleState.marked, size: 16, animate: false), RunnerCopy.legendMarkedBlank),
          ],
        ),
      ),
    );
  }
}

/// The disc of an answered, marked question as the sheet draws it: solid ink with a ring round it.
class _MarkedAnsweredGlyph extends CustomPainter {
  const _MarkedAnsweredGlyph(this.colors);

  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    canvas.drawCircle(c, 6.5, Paint()..color = colors.ink);
    canvas.drawCircle(
      c,
      9,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = colors.ink2,
    );
  }

  @override
  bool shouldRepaint(_MarkedAnsweredGlyph old) => old.colors != colors;
}

/// One count of the ledger under the sheet: the number as a numeral, what it counts, and, while
/// the student can still act, a line saying where it takes them. The whole row is the key (a full
/// width target, at least 64 dp tall, with a chevron), so there is no second box to find; it
/// darkens while pressed. A count of zero is not shown.
class _CountRow extends StatefulWidget {
  const _CountRow({super.key, required this.glyph, required this.count, required this.word, this.goTo, this.goToLabel, this.pulse = false});

  /// The row pulses once when this turns true: its ground swells and settles over 600 ms.
  final bool pulse;

  final Widget glyph;
  final int count;
  final String word;
  final VoidCallback? goTo;
  final String? goToLabel;

  @override
  State<_CountRow> createState() => _CountRowState();
}

class _CountRowState extends State<_CountRow> with SingleTickerProviderStateMixin {
  bool _pressed = false;
  bool _focused = false;

  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));

  @override
  void initState() {
    super.initState();
    // Made here, not lazily: a row that never pulsed must still dispose it safely.
    _pulse.value = 0;
    if (widget.pulse) WidgetsBinding.instance.addPostFrameCallback((_) => _beat());
  }

  @override
  void didUpdateWidget(_CountRow old) {
    super.didUpdateWidget(old);
    if (widget.pulse && !old.pulse) _beat();
  }

  void _beat() {
    if (!mounted || Motion.reduced(context)) return;
    _pulse.forward(from: 0);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

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
    // The one pulse: the row's ground swells to the raised tone and settles, nothing moves.
    final pulsed = AnimatedBuilder(
      animation: _pulse,
      child: body,
      builder: (context, child) {
        final t = _pulse.isAnimating ? math.sin(math.pi * _pulse.value) : 0.0;
        if (t <= 0) return child!;
        return DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.raised2.withValues(alpha: t),
            shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll),
          ),
          child: child,
        );
      },
    );
    if (!_canGo) return pulsed;
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
            child: ColoredBox(color: _pressed ? colors.raised2 : Colors.transparent, child: pulsed),
          ),
        ),
      ),
    );
  }
}
