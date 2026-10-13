import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/subjects.dart';

/// One subject on the subjects step: a bubble to include it, its name, and, once included,
/// Shaky, Okay or Strong.
class SubjectRow extends ConsumerWidget {
  const SubjectRow({
    super.key,
    required this.subject,
    required this.included,
    required this.confidence,
    required this.onToggle,
    required this.onConfidence,
  });

  final SheetSubject subject;
  final bool included;
  final Confidence? confidence;
  final VoidCallback onToggle;
  final ValueChanged<Confidence> onConfidence;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final header = MmPressable(
      semanticsLabel: subject.label,
      checked: included,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onToggle();
      },
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Row(
          children: [
            SelectBubble(selected: included),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text(subject.label, style: type.body.copyWith(fontWeight: FontWeight.w500, color: included ? colors.ink : colors.ink2)),
            ),
          ],
        ),
      ),
    );

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: MmSelection.fill(colors, selected: included),
        shape: mmShapeBorder(MmRadius.keyAll, side: MmSelection.side(colors, selected: included)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s4, MmSpace.s16, MmSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            header,
            if (included)
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s12),
                // Unrated reads as Okay, the default the plan uses, so nothing is hidden.
                child: MmSegmented<Confidence>(
                  semanticsLabel: 'How solid is ${subject.label}',
                  segments: [for (final c in Confidence.values) MmSegment(c, c.label)],
                  value: confidence ?? Confidence.okay,
                  onChanged: onConfidence,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
