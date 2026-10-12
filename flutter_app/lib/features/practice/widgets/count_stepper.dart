import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/copy.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/practice_selection.dart';
import 'sheet_glyph.dart';

/// The question count: a stepper over 5, 10, 15 and 20 only, with the blank sheet beside it
/// growing or shrinking to match. [time] is the quote's own duration, shown once it arrives.
class CountStepper extends ConsumerWidget {
  const CountStepper({super.key, required this.count, required this.onChanged, this.time});

  final int count;
  final ValueChanged<int> onChanged;
  final Duration? time;

  void _step(WidgetRef ref, int delta) {
    final index = practiceCounts.indexOf(count);
    final next = (index + delta).clamp(0, practiceCounts.length - 1);
    if (next == index) return;
    ref.read(hapticsProvider).tick();
    onChanged(practiceCounts[next]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final index = practiceCounts.indexOf(count);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(PracticeCopy.questionsLabel, style: type.label.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s8),
        Row(
          children: [
            KeyButton.secondary(
              label: minusSign,
              semanticsLabel: PracticeCopy.fewerQuestions,
              expanded: false,
              minHeight: 48,
              hapticOnCommit: false,
              onPressed: index > 0 ? () => _step(ref, -1) : null,
            ),
            const SizedBox(width: MmSpace.s12),
            Semantics(
              liveRegion: true,
              label: '$count questions',
              excludeSemantics: true,
              child: SizedBox(
                width: 64,
                child: Text('$count', style: type.figureCompact, textAlign: TextAlign.center),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            KeyButton.secondary(
              label: '+',
              semanticsLabel: PracticeCopy.moreQuestions,
              expanded: false,
              minHeight: 48,
              hapticOnCommit: false,
              onPressed: index < practiceCounts.length - 1 ? () => _step(ref, 1) : null,
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s16),
        // Two rows are always reserved, so adding questions never moves what is below.
        SizedBox(
          height: 2 * 14.0 + 3,
          child: Align(
            alignment: Alignment.topLeft,
            child: SheetGlyph(count: count),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          time == null ? plural(count, 'question') : PracticeCopy.countSummary(count, time),
          style: type.small.copyWith(color: colors.ink2),
        ),
      ],
    );
  }
}
