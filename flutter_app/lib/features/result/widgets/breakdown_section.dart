import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/domain.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
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
  const BreakdownSection({super.key, required this.breakdown, this.grow, this.caption = true, this.flow = false});

  /// The flow (column, ribbons and rows) instead of the stacked bar and its list.
  final bool flow;

  /// The full sentence of the arithmetic (the full result); the recap card leaves it to "Show the arithmetic".
  final bool caption;

  final MarkBreakdown breakdown;
  final Animation<double>? grow;

  @override
  State<BreakdownSection> createState() => _BreakdownSectionState();
}

class _BreakdownSectionState extends State<BreakdownSection> {
  bool _arithmetic = false;

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
          MarksFlow(breakdown: b, rows: breakdownLabels(b), grow: widget.grow),
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
