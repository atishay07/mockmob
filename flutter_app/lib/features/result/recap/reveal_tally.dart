import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The counts under the open sheet, as the sheet's own tally: correct, wrong and not attempted
/// (and being checked, when any), each led by its own bubble so state is never colour alone. While
/// the reader passes, each count is the number of bubbles of that kind actually inked so far, so
/// the counts arrive with the ink and end on the paper's real counts.
class RevealTally extends StatelessWidget {
  const RevealTally({super.key, required this.cells, required this.ink});

  /// One state per question, in paper order.
  final List<BubbleState> cells;

  /// How far the ink has got through the paper (0 to 1); null when the sheet is complete.
  final Animation<double>? ink;

  static const List<BubbleState> _kinds = [BubbleState.filled, BubbleState.wrong, BubbleState.blank, BubbleState.marked];

  /// Counts of each kind among the first [inked] questions.
  static Map<BubbleState, int> countsUpTo(List<BubbleState> cells, int inked) {
    final out = {for (final k in _kinds) k: 0};
    for (var i = 0; i < cells.length && i < inked; i++) {
      final k = cells[i] == BubbleState.hollow ? BubbleState.blank : cells[i];
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final total = countsUpTo(cells, cells.length);
    final held = total[BubbleState.marked]! > 0;
    final label = [
      ResultCopy.correct(total[BubbleState.filled]!),
      ResultCopy.wrong(total[BubbleState.wrong]!),
      ResultCopy.notAttempted(total[BubbleState.blank]!),
      if (held) ResultCopy.heldCell(total[BubbleState.marked]!),
    ].join(', ');
    Widget row(Map<BubbleState, int> c) => _TallyRow(counts: c, held: held);
    final a = ink;
    return Semantics(
      container: true,
      label: label,
      excludeSemantics: true,
      child: RepaintBoundary(
        child: a == null
            ? row(total)
            : AnimatedBuilder(
                animation: a,
                builder: (context, _) {
                  final v = a.value;
                  // A bubble counts once it is half inked, as the grid draws it.
                  final inked = v >= 1 ? cells.length : (v * cells.length + 0.5).floor().clamp(0, cells.length);
                  return row(countsUpTo(cells, inked));
                },
              ),
      ),
    );
  }
}

class _TallyRow extends StatelessWidget {
  const _TallyRow({required this.counts, required this.held});

  final Map<BubbleState, int> counts;
  final bool held;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final kinds = [
      (BubbleState.filled, 'correct'),
      (BubbleState.wrong, 'wrong'),
      (BubbleState.blank, 'not attempted'),
      if (held) (BubbleState.marked, 'being checked'),
    ];
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < kinds.length; i++) ...[
            if (i > 0) ...[VerticalDivider(width: 1, thickness: 1, color: colors.line), const SizedBox(width: MmSpace.s12)],
            Expanded(
              child: _Count(state: kinds[i].$1, count: counts[kinds[i].$1] ?? 0, label: kinds[i].$2),
            ),
          ],
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.state, required this.count, required this.label});

  final BubbleState state;
  final int count;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Bubble(state: state, size: 12, animate: false),
            const SizedBox(width: MmSpace.s6),
            Flexible(
              child: Text(
                '$count',
                maxLines: 1,
                style: type.figureCompact.copyWith(fontSize: 32, height: 1, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(label, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}
