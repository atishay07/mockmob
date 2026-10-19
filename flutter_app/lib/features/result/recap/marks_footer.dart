import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../widgets/result_space.dart';
import 'reveal_tally.dart';

/// Under the open sheet on card 1: the sheet's tally (each count led by its own bubble, so state
/// is never colour alone, counting up with the ink), one comparison line when the server sent
/// one, and the key naming what comes next.
class MarksFooter extends StatelessWidget {
  const MarksFooter({super.key, required this.model, required this.onNext, this.ink});

  final RecapModel model;
  final VoidCallback onNext;

  /// The ink's progress through the paper while the reader passes; null when complete.
  final Animation<double>? ink;

  /// One line under the counts, only when it carries something: the answer-key warning, or the
  /// earlier paper to compare with. A first mock and a lower result have nothing to add (the
  /// counts and the key say it), so they get no filler line.
  String? _line() {
    if (model.keysUnavailable) return ResultCopy.keysUnavailable;
    final prev = model.previous;
    switch (model.variant) {
      case RecapVariant.firstMock:
      case RecapVariant.lower:
      case RecapVariant.held:
        return null;
      case RecapVariant.higher:
        if (prev != null) return ResultCopy.higherCompare(prev.label, prev.marks, model.mockLabel, model.marks, prev.max);
        return null;
      case RecapVariant.standard:
        return prev == null ? null : ResultCopy.previous(prev.label, prev.marks, prev.max);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = _line();
    final m = model;
    return Padding(
      padding: const EdgeInsets.fromLTRB(ResultSpace.moment, MmSpace.s16, ResultSpace.moment, MmSpace.s12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RevealTally(cells: m.cells, ink: ink, marks: !m.isHeld),
              if (line != null) ...[const SizedBox(height: MmSpace.s12), Text(line, style: type.small.copyWith(color: colors.ink2))],
            ],
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: m.isHeld ? ResultCopy.nextFix : ResultCopy.nextMarks, onPressed: onNext),
        ],
      ),
    );
  }
}
