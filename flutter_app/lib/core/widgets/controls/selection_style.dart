import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../bubbles/bubble.dart';

/// One answer-sheet language for every chosen thing (rows, chips, tiles, segments): chosen is a
/// raised fill with a 1.5 dp paper-ink rim and an inked bubble; not chosen is a hairline with a
/// hollow bubble. Volt appears only as the ink in the bubble, so it stays the light of actions.
abstract final class MmSelection {
  static Color fill(MmColors c, {required bool selected, bool pressed = false}) {
    // `selectedSurface`: Night's `raised2`, Day's `raised` (Day's `raised2` is darker than the ground
    // and reads as disabled); the paper-ink rim carries the state on both.
    if (selected) return c.selectedSurface;
    return Color.lerp(c.raised, c.raised2, pressed ? 0.7 : 0)!;
  }

  static BorderSide side(MmColors c, {required bool selected}) =>
      selected ? BorderSide(color: c.ink.withValues(alpha: 0.7), width: 1.5) : BorderSide(color: c.line);
}

/// Answer-sheet letters for choice rows.
const List<String> kAnswerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/// The 10 dp bubble that leads a choice: inked when chosen, hollow when not.
class SelectBubble extends StatelessWidget {
  const SelectBubble({super.key, required this.selected, this.size = 10});

  final bool selected;
  final double size;

  @override
  Widget build(BuildContext context) => Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: size);
}

/// An answer-sheet letter bubble (A, B, C, D) for a choice row: a ring with the letter that
/// fills with volt ink over 280 ms when chosen.
class LetterBubble extends StatelessWidget {
  const LetterBubble({super.key, required this.letter, required this.selected, this.size = 28});

  final String letter;
  final bool selected;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    // A filled mark is volt on both themes with voltInk on it (SPACING.md 8.3); on Day the 1 dp olive
    // rim keeps it readable on paper, like the bubble painter's inked bubble.
    final fill = colors.markFill;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.lineStrong, width: 1.5)),
              child: const SizedBox.expand(),
            ),
            AnimatedScale(
              scale: selected ? 1 : 0.2,
              duration: reduced ? Duration.zero : Motion.ink,
              curve: Motion.glide,
              child: AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: reduced ? Duration.zero : Motion.ink,
                curve: Motion.glide,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: fill,
                    shape: BoxShape.circle,
                    border: colors.isNight ? null : Border.all(color: colors.accentText.withValues(alpha: 0.55)),
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
            Text(
              letter,
              textScaler: TextScaler.noScaling,
              style: type.label.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                height: 1,
                color: selected ? colors.voltInk : colors.ink2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
