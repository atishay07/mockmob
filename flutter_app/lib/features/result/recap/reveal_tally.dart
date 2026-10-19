import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The counts under the open sheet, as the sheet's own tally: correct, wrong and not attempted
/// (and being checked, when any), each led by its own bubble so state is never colour alone. While
/// the reader passes, each count is the number of bubbles of that kind actually inked so far, so
/// the counts arrive with the ink and end on the paper's real counts.
///
/// With [marks] (20 Oct, I13: the marks are added up), each count carries what it is worth under its word: +5 for each
/// correct answer, -1 for each wrong one, 0 for each not attempted, adding up with the ink to the circled total on the
/// sheet.
class RevealTally extends StatelessWidget {
  const RevealTally({super.key, required this.cells, required this.ink, this.marks = false});

  /// Each count's marks under it.
  final bool marks;

  /// What one answer of [k] is worth; null for answers being checked.
  static int? worth(BubbleState k) => switch (k) {
    BubbleState.filled => 5,
    BubbleState.wrong => -1,
    BubbleState.blank => 0,
    _ => null,
  };

  /// "+225", "−3", "0".
  static String marksText(BubbleState k, int count) {
    final w = worth(k);
    if (w == null) return '';
    final v = w * count;
    return v > 0 ? '+$v' : (v < 0 ? '−${-v}' : '0');
  }

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
      ResultCopy.correct(total[BubbleState.filled]!) + (marks ? ', ${marksText(BubbleState.filled, total[BubbleState.filled]!)} marks' : ''),
      ResultCopy.wrong(total[BubbleState.wrong]!) + (marks ? ', ${marksText(BubbleState.wrong, total[BubbleState.wrong]!)} marks' : ''),
      ResultCopy.notAttempted(total[BubbleState.blank]!) + (marks ? ', 0 marks' : ''),
      if (held) ResultCopy.heldCell(total[BubbleState.marked]!),
    ].join(', ');
    Widget row(Map<BubbleState, int> c) => _TallyRow(counts: c, held: held, marks: marks);
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
  const _TallyRow({required this.counts, required this.held, required this.marks});

  final Map<BubbleState, int> counts;
  final bool held;
  final bool marks;

  /// The width between two columns of the single row: a hairline and the gap after it.
  static const double _divide = 1 + MmSpace.s12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final kinds = [
      (BubbleState.filled, 'correct'),
      (BubbleState.wrong, 'wrong'),
      (BubbleState.blank, 'not attempted'),
      if (held) (BubbleState.marked, 'being checked'),
    ];
    final scaler = MediaQuery.textScalerOf(context);
    final caption = context.mmType.caption;
    return LayoutBuilder(
      builder: (context, box) {
        // One row while every label fits under its count on a single line. Otherwise two columns,
        // each count with its label beside it: a label is never broken over three lines, and the
        // tally never grows a row of tall columns.
        final column = (box.maxWidth - (kinds.length - 1) * _divide) / kinds.length;
        var oneLine = true;
        for (final k in kinds) {
          final tp = TextPainter(text: TextSpan(text: k.$2, style: caption), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)
            ..layout();
          if (tp.width > column) oneLine = false;
          tp.dispose();
        }
        if (oneLine) {
          return IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < kinds.length; i++) ...[
                  if (i > 0) ...[VerticalDivider(width: 1, thickness: 1, color: colors.line), const SizedBox(width: MmSpace.s12)],
                  Expanded(
                    child: _Count(state: kinds[i].$1, count: counts[kinds[i].$1] ?? 0, label: kinds[i].$2, marks: marks),
                  ),
                ],
              ],
            ),
          );
        }
        final item = (box.maxWidth - MmSpace.s16) / 2;
        return Wrap(
          spacing: MmSpace.s16,
          runSpacing: MmSpace.s12,
          children: [
            for (final k in kinds)
              SizedBox(
                width: item,
                child: _InlineCount(state: k.$1, count: counts[k.$1] ?? 0, label: k.$2, marks: marks),
              ),
          ],
        );
      },
    );
  }
}

/// A count with its label beside it, for the two-column tally: bubble, number, words.
class _InlineCount extends StatelessWidget {
  const _InlineCount({required this.state, required this.count, required this.label, this.marks = false});

  final BubbleState state;
  final int count;
  final String label;
  final bool marks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Bubble(state: state, size: 12, animate: false),
        const SizedBox(width: MmSpace.s6),
        Text(
          '$count',
          maxLines: 1,
          style: type.figureCompact.copyWith(fontSize: 28, height: 1, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        const SizedBox(width: MmSpace.s8),
        Flexible(child: Text(label, style: type.caption.copyWith(color: colors.ink3))),
        if (marks && RevealTally.worth(state) != null) ...[
          const SizedBox(width: MmSpace.s8),
          _MarksValue(state: state, count: count),
        ],
      ],
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.state, required this.count, required this.label, this.marks = false});

  final BubbleState state;
  final int count;
  final String label;
  final bool marks;

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
        if (marks && RevealTally.worth(state) != null) ...[const SizedBox(height: 2), _MarksValue(state: state, count: count)],
      ],
    );
  }
}

/// What a count is worth, in tabular figures so the column never jitters while it adds up.
class _MarksValue extends StatelessWidget {
  const _MarksValue({required this.state, required this.count});

  final BubbleState state;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final color = switch (state) {
      BubbleState.wrong when count > 0 => colors.wrongText,
      BubbleState.blank => colors.ink3,
      _ => colors.ink,
    };
    return Text(
      RevealTally.marksText(state, count),
      maxLines: 1,
      style: context.mmType.body.copyWith(color: color, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]),
    );
  }
}
