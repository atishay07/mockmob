import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
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
      semanticsLabel: subject.hasStartingPoint ? '${subject.label}. ${OnboardingCopy.practiceReady}' : subject.label,
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
            Bubble(state: included ? BubbleState.filled : BubbleState.hollow, size: 22, inkOrigin: const Offset(-0.7, 0)),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(subject.label, style: type.labelLarge.copyWith(color: included ? colors.ink : colors.ink2)),
                  if (subject.hasStartingPoint)
                    Text(OnboardingCopy.practiceReady, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: included ? colors.raised : colors.ground.withValues(alpha: 0),
        shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: included ? colors.line : colors.line.withValues(alpha: 0.6))),
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
