import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The reason panel that rises after a choice (spec 5.1.3). Correct: a quiet raised panel with a
/// check. Wrong: the wrong trio, the right answer stated in words, and the explanation. Mobi
/// appears here, 40 dp, only after the choice: a hop for a right answer, an attentive nod for a
/// wrong one. It is a live region, so TalkBack reads it when it appears.
class ExplanationPanel extends StatelessWidget {
  const ExplanationPanel({super.key, required this.correct, required this.why, this.answerLine, this.animateMobi = true});

  final bool correct;
  final String why;

  /// "The answer is B, Frank." Shown after a wrong choice only.
  final String? answerLine;
  final bool animateMobi;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Color surface = correct ? colors.raised2 : colors.wrongSurface;
    final Color edge = correct ? colors.line : colors.wrongBorder;
    final Color titleColor = correct ? colors.ink : colors.wrongText;

    return Semantics(
      container: true,
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: surface,
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: edge),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Mobi(
                pose: correct ? MobiPose.celebrating : MobiPose.attentive,
                size: 40,
                motion: animateMobi ? (correct ? MobiMotion.hop : MobiMotion.settle) : MobiMotion.none,
              ),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        ExcludeSemantics(
                          child: Icon(correct ? LucideIcons.check : LucideIcons.circleX, size: 20, color: titleColor),
                        ),
                        const SizedBox(width: MmSpace.s8),
                        Expanded(
                          child: Text(
                            correct ? OnboardingCopy.answerCorrect : OnboardingCopy.answerWrong,
                            style: type.subhead.copyWith(color: titleColor),
                          ),
                        ),
                      ],
                    ),
                    if (answerLine != null) ...[
                      const SizedBox(height: MmSpace.s8),
                      Text(answerLine!, style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                    ],
                    const SizedBox(height: MmSpace.s8),
                    Text(why, style: type.body.copyWith(color: colors.ink)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
