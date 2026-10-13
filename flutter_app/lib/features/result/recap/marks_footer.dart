import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';

/// Under the open sheet on card 1: the three counts as the sheet's legend (each led by its own
/// bubble, so state is never colour alone), the sum, one comparison line when the server sent
/// one, and the key naming what comes next.
class MarksFooter extends StatelessWidget {
  const MarksFooter({super.key, required this.model, required this.onNext, required this.onFirstFix, this.mobi});

  final RecapModel model;
  final VoidCallback onNext;

  /// The lower variant's extra quiet key, which jumps to card 3.
  final VoidCallback onFirstFix;

  /// Mobi on card 1: greeting for a first mock, one hop for a higher result. Null otherwise.
  final Widget? mobi;

  String? _line() {
    if (model.keysUnavailable) return ResultCopy.keysUnavailable;
    final prev = model.previous;
    switch (model.variant) {
      case RecapVariant.firstMock:
        return ResultCopy.noEarlier;
      case RecapVariant.lower:
        return ResultCopy.lowerLine;
      case RecapVariant.higher:
        if (prev != null) return ResultCopy.higherCompare(prev.label, prev.marks, model.mockLabel, model.marks, prev.max);
        return null;
      case RecapVariant.held:
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
      padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s16, MmSpace.cardGutter, MmSpace.s12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: MmSpace.s16,
                      runSpacing: MmSpace.s6,
                      children: [
                        _Count(state: BubbleState.filled, text: ResultCopy.correct(m.correct)),
                        _Count(state: BubbleState.wrong, text: ResultCopy.wrong(m.wrong)),
                        _Count(state: BubbleState.blank, text: ResultCopy.notAttempted(m.unattempted)),
                        if (m.heldCount > 0) _Count(state: BubbleState.marked, text: ResultCopy.heldCell(m.heldCount)),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s6),
                    Text(ResultCopy.sum(m.correct, m.wrong, m.unattempted), style: type.caption.copyWith(color: colors.ink3)),
                    if (line != null) ...[const SizedBox(height: MmSpace.s8), Text(line, style: type.small.copyWith(color: colors.ink2))],
                  ],
                ),
              ),
              if (mobi != null) ...[const SizedBox(width: MmSpace.s8), mobi!],
            ],
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: m.isHeld ? ResultCopy.nextFix : ResultCopy.nextMarks, onPressed: onNext),
          if (m.variant == RecapVariant.lower)
            Align(
              child: KeyButton.quiet(label: ResultCopy.showFirstFix, onPressed: onFirstFix),
            ),
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.state, required this.text});

  final BubbleState state;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Bubble(state: state, size: 14, animate: false),
        const SizedBox(width: MmSpace.s6),
        Text(text, style: context.mmType.labelLarge),
      ],
    );
  }
}
