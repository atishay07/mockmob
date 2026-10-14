import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'engrave.dart' show Arrive;
import 'marks_bar.dart';
import 'marks_flow.dart';

/// The rows of "where the marks went", every number from [markBreakdown]. Observed loss only,
/// never a forecast.
List<(MarkPart, String, String, String?)> breakdownLabels(MarkBreakdown b) => [
  (MarkPart.scored, ResultCopy.rowScored, ResultCopy.marksValue(b.scored), null),
  (MarkPart.takenOff, ResultCopy.rowTakenOff, ResultCopy.marksValue(b.takenOff), b.wrong == 0 ? null : ResultCopy.eachOf(1, b.wrong)),
  (
    MarkPart.notEarnedWrong,
    ResultCopy.rowNotEarnedWrong,
    ResultCopy.marksValue(b.notEarnedOnWrong),
    b.wrong == 0 ? null : ResultCopy.eachOf(5, b.wrong),
  ),
  (
    MarkPart.notEarnedBlank,
    ResultCopy.rowNotEarnedBlank,
    ResultCopy.marksValue(b.notEarnedOnBlank),
    b.unattempted == 0 ? null : ResultCopy.eachOf(5, b.unattempted),
  ),
];

/// The bar, its scale, the rows, the caption that adds them up and the arithmetic toggle.
/// Shared by recap card 2 and the full result.
class BreakdownSection extends StatefulWidget {
  const BreakdownSection({
    super.key,
    required this.breakdown,
    this.grow,
    this.caption = true,
    this.flow = false,
    this.cells,
    this.onOpenQuestion,
    this.onPick,
  });

  /// The flow (column, ribbons and rows) instead of the stacked bar and its list.
  final bool flow;

  /// The full sentence of the arithmetic (the full result); the recap card leaves it to "Show the arithmetic".
  final bool caption;

  final MarkBreakdown breakdown;
  final Animation<double>? grow;

  /// The paper's answers in order. With [onOpenQuestion], each ribbon of the flow can be picked:
  /// it stays lit, the others dim, one line says what it is, and that kind's answers appear
  /// below, each opening its question.
  final List<BubbleState>? cells;

  /// A question was chosen (1-based number).
  final ValueChanged<int>? onOpenQuestion;

  /// A ribbon was picked or let go: the screen point of its middle, or null when let go. Mobi
  /// glances there.
  final ValueChanged<Offset?>? onPick;

  @override
  State<BreakdownSection> createState() => _BreakdownSectionState();
}

class _BreakdownSectionState extends State<BreakdownSection> with SingleTickerProviderStateMixin {
  bool _arithmetic = false;
  int? _picked;
  late final AnimationController _focus;
  late final Animation<double> _focusCurve;

  @override
  void initState() {
    super.initState();
    _focus = AnimationController(vsync: this, duration: Motion.ui);
    _focusCurve = CurvedAnimation(parent: _focus, curve: Motion.out);
  }

  bool get _pickable => widget.flow && widget.cells != null && widget.onOpenQuestion != null;

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  void _pick(int row, Offset at) {
    unawaited(HapticFeedback.selectionClick());
    final same = _picked == row;
    setState(() => _picked = same ? null : row);
    if (same) {
      if (Motion.reduced(context)) {
        _focus.value = 0;
      } else {
        unawaited(_focus.reverse());
      }
      widget.onPick?.call(null);
    } else {
      if (Motion.reduced(context)) {
        _focus.value = 1;
      } else {
        unawaited(_focus.forward());
      }
      widget.onPick?.call(at);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final b = widget.breakdown;
    final scale = type.caption.copyWith(color: colors.ink3);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.flow) ...[
          FlowSourceLine(max: b.max),
          const SizedBox(height: MmSpace.s12),
          MarksFlow(
            breakdown: b,
            rows: breakdownLabels(b),
            grow: widget.grow,
            selected: _picked,
            focus: _focusCurve,
            onSelect: _pickable ? _pick : null,
          ),
          if (_pickable) PickedKind(breakdown: b, row: _picked, cells: widget.cells!, onOpen: widget.onOpenQuestion!),
          const SizedBox(height: MmSpace.s12),
        ] else ...[
          MarksBar(breakdown: b, grow: widget.grow),
          const SizedBox(height: MmSpace.s6),
          ExcludeSemantics(
            child: Row(
              children: [
                Text(ResultCopy.barLabelStart, style: scale),
                const Spacer(),
                Text('${b.max}', style: scale),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          MarksRows(breakdown: b, labels: breakdownLabels(b)),
          Divider(height: 1, thickness: 1, color: colors.line),
        ],
        if (widget.caption) ...[
          const SizedBox(height: MmSpace.s12),
          Text(
            ResultCopy.breakdownCaption(b.max, b.scored, b.takenOff, b.notEarnedOnWrong, b.notEarnedOnBlank),
            style: type.small.copyWith(color: colors.ink2),
          ),
        ],
        const SizedBox(height: MmSpace.s4),
        // A plain text action, 48 dp tall, flush with the text above.
        Align(
          alignment: Alignment.centerLeft,
          child: _ArithmeticToggle(open: _arithmetic, onTap: () => setState(() => _arithmetic = !_arithmetic)),
        ),
        if (_arithmetic)
          Semantics(
            liveRegion: true,
            child: Text(ResultCopy.arithmetic(b.correct, b.wrong, b.scored), style: type.title.copyWith(color: colors.ink)),
          ),
      ],
    );
  }
}

class _ArithmeticToggle extends StatelessWidget {
  const _ArithmeticToggle({required this.open, required this.onTap});

  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final label = open ? ResultCopy.hideArithmetic : ResultCopy.showArithmetic;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                label,
                style: context.mmType.labelLarge.copyWith(color: pressed ? colors.ink2 : colors.ink, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Icon(open ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: colors.ink2),
          ],
        ),
      ),
    );
  }
}

/// What the picked ribbon is, in one line, and the answers of that kind as bubbles that each open
/// their question. Nothing until a ribbon is picked, and no space is held for it: it grows in
/// under the flow.
class PickedKind extends StatelessWidget {
  const PickedKind({super.key, required this.breakdown, required this.row, required this.cells, required this.onOpen});

  final MarkBreakdown breakdown;

  /// The picked row (index into the flow's rows, which follow [MarkPart.values]), or null.
  final int? row;
  final List<BubbleState> cells;
  final ValueChanged<int> onOpen;

  /// Which answers a row of the flow is about: the correct ones, the wrong ones (twice: what they
  /// took off and what they did not earn), the blank ones.
  static BubbleState stateOf(MarkPart part) => switch (part) {
    MarkPart.scored => BubbleState.filled,
    MarkPart.takenOff || MarkPart.notEarnedWrong => BubbleState.wrong,
    MarkPart.notEarnedBlank => BubbleState.blank,
  };

  /// The 1-based numbers of the answers of [part]'s kind, in paper order.
  static List<int> numbersFor(MarkPart part, List<BubbleState> cells) {
    final want = stateOf(part);
    return [
      for (var i = 0; i < cells.length; i++)
        if (cells[i] == want) i + 1,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final r = row;
    final colors = context.mmColors;
    final type = context.mmType;
    const parts = MarkPart.values;
    Widget content = const SizedBox(width: double.infinity, key: ValueKey('none'));
    if (r != null && r < parts.length) {
      final part = parts[r];
      final numbers = numbersFor(part, cells);
      content = Column(
        key: ValueKey('kind-$r'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(ResultCopy.flowSentence(part, breakdown), style: type.body)),
          if (numbers.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s8),
            Wrap(
              spacing: 2,
              runSpacing: 2,
              children: [
                for (var k = 0; k < numbers.length; k++)
                  Arrive(
                    delay: Duration(milliseconds: 40 + 16 * k.clamp(0, 14)),
                    duration: const Duration(milliseconds: 280),
                    rise: 6,
                    child: _NumberedBubble(number: numbers[k], state: stateOf(part), onTap: () => onOpen(numbers[k]), ink: colors.ink2),
                  ),
              ],
            ),
          ],
        ],
      );
    }
    return MmSizeEase(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(duration: Motion.of(context, Motion.ui), child: content),
    );
  }
}

/// One answer as a bubble with its number under it, a 48 dp target, opening its question.
class _NumberedBubble extends StatelessWidget {
  const _NumberedBubble({required this.number, required this.state, required this.onTap, required this.ink});

  final int number;
  final BubbleState state;
  final VoidCallback onTap;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.9,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: ResultCopy.questionTile(number, ResultCopy.stateWord(state)),
      builder: (context, pressed, _) => SizedBox(
        width: MmTarget.min,
        height: MmTarget.min,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Bubble(state: state, size: 22, animate: false),
            const SizedBox(height: 3),
            Text('$number', style: type.caption.copyWith(fontSize: 10.5, height: 1, color: ink, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
