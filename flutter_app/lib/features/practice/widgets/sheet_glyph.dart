import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';

/// Columns that keep a sheet of [count] cells compact and even: one row up to 10, then rows
/// of 10 (or 8 for 15, so the last row is not a stub).
int sheetColumns(int count) {
  if (count <= 10) return count < 1 ? 1 : count;
  if (count == 15) return 8;
  return 10;
}

/// A blank answer sheet drawn as [count] hollow cells: the one recurring object of the app,
/// used here to show how big a session is before it starts. The cells appear and disappear one
/// by one when the count changes (200 ms), so the stepper visibly adds or removes questions.
/// Reduced motion changes it at once. Decoration only: it carries no information the text
/// beside it does not already say.
class SheetGlyph extends StatelessWidget {
  const SheetGlyph({super.key, required this.count, this.cellSize = 14, this.gap = 3});

  final int count;
  final double cellSize;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(end: count.toDouble()),
        duration: Motion.of(context, Motion.ui),
        curve: Motion.out,
        builder: (context, value, _) {
          final shown = value.round().clamp(1, 60);
          return QuestionStrip(
            cells: List<QuestionCell>.filled(shown, QuestionCell.blank),
            columns: sheetColumns(count),
            cellSize: cellSize,
            gap: gap,
          );
        },
      ),
    );
  }
}
