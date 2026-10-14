import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

enum WarmupOptionState { open, right, wrong, dimmed }

/// One answer option of the warm-up question: solid, 56 dp, a lettered bubble on the left. After
/// the answer, the right option takes the lit edge and an inked bubble, a wrong pick takes the
/// wrong colours and a crossed bubble, and the rest go quiet. State is never colour alone.
class WarmupOption extends StatelessWidget {
  const WarmupOption({super.key, required this.letter, required this.text, required this.state, this.onTap});

  final String letter;
  final String text;
  final WarmupOptionState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final wrong = state == WarmupOptionState.wrong;
    final right = state == WarmupOptionState.right;
    final fill = wrong ? colors.wrongSurface : (right ? colors.raised2 : colors.raised);
    final border = wrong ? colors.wrongBorder : (right ? colors.lineStrong : colors.line);
    final ink = wrong ? colors.wrongText : (state == WarmupOptionState.dimmed ? colors.ink3 : colors.ink);
    final suffix = switch (state) {
      WarmupOptionState.right => ', the right answer',
      WarmupOptionState.wrong => ', your answer, wrong',
      _ => '',
    };

    Widget option = MmPressable(
      semanticsLabel: '${OnboardingCopy.optionSemantics(letter, text)}$suffix',
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: onTap,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : fill,
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: border)),
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: state == WarmupOptionState.dimmed ? 40 : 56),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: state == WarmupOptionState.dimmed ? MmSpace.s8 : MmSpace.s12),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 26,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Bubble(
                        state: right ? BubbleState.filled : (wrong ? BubbleState.wrong : BubbleState.hollow),
                        size: 26,
                      ),
                      if (!right && !wrong)
                        Text(letter, style: type.caption.copyWith(fontSize: 11, color: colors.ink2, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(text, style: type.body.copyWith(color: ink, fontWeight: right ? FontWeight.w600 : FontWeight.w400)),
                      if (right) Text(OnboardingCopy.correctAnswer, style: type.caption.copyWith(color: colors.ink2)),
                      if (wrong) Text(OnboardingCopy.yourAnswer, style: type.caption.copyWith(color: colors.wrongText)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (right) option = LitEdge(borderRadius: MmRadius.keyAll, child: option);
    return option;
  }
}
