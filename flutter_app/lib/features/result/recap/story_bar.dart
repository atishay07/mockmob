import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The top of every recap card: one segment per card showing where you are (position, not a
/// timer and not progress toward a reward), and "Skip to full result" on the right.
class StoryBar extends StatelessWidget {
  const StoryBar({super.key, required this.card, required this.count, required this.onSkip, this.onBack});

  /// 1-based.
  final int card;
  final int count;
  final VoidCallback onSkip;

  /// The previous card; given on cards 2 to 4 (the chevron is the visible way back, besides the
  /// swipe). System back still goes to the full result.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox(
      height: 56,
      child: Padding(
        padding: const EdgeInsets.only(left: MmSpace.s4, right: MmSpace.s8),
        child: Row(
          children: [
            // The slot is always there, so the segments do not move from card to card.
            SizedBox.square(
              dimension: MmTarget.min,
              child: onBack == null
                  ? null
                  : MmPressable(
                      onTap: onBack!,
                      semanticsLabel: ResultCopy.previousCard,
                      focusRadius: MmRadius.pillAll,
                      builder: (context, pressed, _) => Center(child: Icon(LucideIcons.arrowLeft, size: 22, color: colors.ink)),
                    ),
            ),
            Expanded(
              child: Semantics(
                label: ResultCopy.cardOf(card, count),
                excludeSemantics: true,
                child: Row(
                  children: [
                    for (var i = 1; i <= count; i++) ...[
                      if (i > 1) const SizedBox(width: 4),
                      Expanded(
                        child: AnimatedContainer(
                          duration: Motion.of(context, Motion.ui),
                          curve: Motion.glide,
                          height: 3,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(2),
                            color: i == card ? colors.ink : (i < card ? colors.ink3 : colors.lineStrong),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            KeyButton.quiet(label: ResultCopy.skip, onPressed: onSkip),
          ],
        ),
      ),
    );
  }
}
