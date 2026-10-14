import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../bubbles/bubble.dart';

/// One answer-sheet language for every chosen thing (rows, chips, tiles, segments): chosen is a
/// raised fill with a 1.5 dp paper-ink rim and an inked bubble; not chosen is a hairline with a
/// hollow bubble. Volt appears only as the ink in the bubble, so it stays the light of actions.
abstract final class MmSelection {
  static Color fill(MmColors c, {required bool selected, bool pressed = false}) {
    if (selected) return c.isNight ? c.raised2 : c.raised;
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
    final fill = colors.isNight ? colors.volt : colors.accentText;
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
                  decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
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
                color: selected ? (colors.isNight ? colors.voltInk : colors.raised) : colors.ink2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
