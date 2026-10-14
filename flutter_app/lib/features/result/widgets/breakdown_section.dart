import 'package:flutter/material.dart';

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
        // A 32 dp pill inside a 48 dp target, on the gutter like the Show me pill.
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
      focusRadius: MmRadius.pillAll,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.55 : 0.6),
              shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
            ),
            child: SizedBox(
              height: 32,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    label,
                    style: context.mmType.caption.copyWith(fontSize: 13, height: 1.2, fontWeight: FontWeight.w600, color: colors.ink),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
