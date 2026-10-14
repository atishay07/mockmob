import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../model/finish_reaction.dart';

/// Where the marks went, as the website's Score Recovery bar shows it: what was scored, what
/// the wrong answers cost and what was left on blanks, out of the paper's maximum. Each segment
/// is a share of real marks, and the line under it says the same thing in words.
class MarksBar extends StatelessWidget {
  const MarksBar({super.key, required this.marks});

  final FinishMarks marks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = marks;
    if (m.max <= 0) return const SizedBox.shrink();
    final scored = m.scored.clamp(0, m.max);
    // The wrong answers' cost can exceed what is left once a negative score is clamped to 0.
    final wrong = m.lostToWrong.clamp(0, m.max - scored);
    final blank = m.leftOnBlanks.clamp(0, m.max - scored - wrong);

    Widget segment(int value, Color color) =>
        value <= 0 ? const SizedBox.shrink() : Expanded(flex: value, child: ColoredBox(color: color));

    return Semantics(
      container: true,
      label: PracticeCopy.marksLine(m),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: MmRadius.pillAll,
            child: SizedBox(
              height: 10,
              child: ColoredBox(
                color: colors.ink.withValues(alpha: 0.08),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Volt in both themes, as the bubbles are; in Daylight a 1 dp ink edge keeps
                    // it apart from the paper.
                    if (scored > 0)
                      Expanded(
                        flex: scored,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: colors.volt,
                            border: colors.isNight ? null : Border.all(color: colors.ink.withValues(alpha: 0.24)),
                            borderRadius: MmRadius.pillAll,
                          ),
                        ),
                      ),
                    segment(wrong, colors.wrongMark),
                    segment(blank, colors.ink3),
                    segment(m.max - scored - wrong - blank, Colors.transparent),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(PracticeCopy.marksLine(m), style: type.small.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}
