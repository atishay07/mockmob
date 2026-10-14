import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The bottom bar, 72 dp above the gesture inset (spec 5.5): Previous as a glass pill and the
/// one volt key, Next, which becomes Review and submit on the last question. No haptic
/// on these: inside a timed paper only the option tick speaks.
///
/// When every question has an answer the volt key carries the soft lit glow beneath it (14% volt,
/// never behind text): the one resting emphasis on the screen, saying the paper is ready to hand in.
/// Daylight has no glows (MOTION.md 1.4): there the same emphasis is a 1 dp olive edge round the key.
class RunnerBottomBar extends StatelessWidget {
  const RunnerBottomBar({
    super.key,
    required this.isFirst,
    required this.isLast,
    required this.onPrevious,
    required this.onNext,
    this.allAnswered = false,
  });

  final bool isFirst;
  final bool isLast;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  /// Every question has an answer: the key glows.
  final bool allAnswered;

  /// The room the primary key needs to say "Review and submit" on one line.
  static const double reviewLabelMinWidth = 170;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    final ready = allAnswered && !Motion.reduced(context);
    final glow = ready && colors.isNight;
    final edge = ready && !colors.isNight;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.5,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.ground,
          border: Border(top: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s8 + inset),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Row(
              children: [
                KeyButton.secondary(label: RunnerCopy.previous, onPressed: isFirst ? null : onPrevious, expanded: false, hapticOnCommit: false),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: AnimatedContainer(
                    duration: Motion.glideDuration,
                    curve: Motion.glide,
                    // Painted over the key, so the edge takes no room and the key never changes size.
                    foregroundDecoration: edge
                        ? BoxDecoration(
                            borderRadius: MmRadius.pillAll,
                            border: Border.all(color: colors.accentText),
                          )
                        : null,
                    decoration: BoxDecoration(
                      borderRadius: MmRadius.pillAll,
                      boxShadow: glow ? [BoxShadow(color: colors.voltGlow, blurRadius: 22, offset: const Offset(0, 6), spreadRadius: -2)] : const [],
                    ),
                    // "Review and submit" would wrap in the room a narrow phone leaves, so the last
                    // key says "Review" there (it opens the same page).
                    child: LayoutBuilder(
                      builder: (context, box) => KeyButton(
                        label: !isLast
                            ? RunnerCopy.next
                            : box.maxWidth < reviewLabelMinWidth
                            ? RunnerCopy.review
                            : RunnerCopy.reviewAndSubmit,
                        semanticsLabel: isLast ? RunnerCopy.reviewAndSubmit : null,
                        onPressed: onNext,
                        hapticOnCommit: false,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
