import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/subjects.dart';
import 'choice_tile.dart';

/// Shaky, Okay, Strong as one question on an answer sheet: three labelled bubbles, the chosen
/// one inked from the touch point. Each is a 48 dp target in a radio group; TalkBack reads
/// "How solid is Accountancy, Shaky, selected".
class ConfidenceBubbles extends ConsumerWidget {
  const ConfidenceBubbles({super.key, required this.subject, required this.value, required this.onChanged});

  final String subject;
  final Confidence value;
  final ValueChanged<Confidence> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: 'How solid is $subject',
      child: Row(
        children: [
          for (final c in Confidence.values)
            Expanded(
              child: Builder(
                builder: (context) => MmPressable(
                  semanticsLabel: c.label,
                  selected: c == value,
                  inMutuallyExclusiveGroup: true,
                  pressedScale: 0.94,
                  focusRadius: MmRadius.keyAll,
                  onTap: () {
                    if (c == value) return;
                    ref.read(hapticsProvider).selection();
                    GuideGlance.at(context);
                    onChanged(c);
                  },
                  builder: (context, pressed, _) => SizedBox(
                    height: 48,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Bubble(
                          state: c == value ? BubbleState.filled : BubbleState.hollow,
                          size: 22,
                          inkOrigin: const Offset(-0.5, 0.2),
                        ),
                        const SizedBox(width: MmSpace.s8),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              c.label,
                              maxLines: 1,
                              style: type.labelLarge.copyWith(
                                fontSize: 14,
                                color: c == value ? colors.ink : colors.ink2,
                                fontWeight: c == value ? FontWeight.w700 : FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
