// "Show me" (brief 12.1, evidence first): a small quiet tag under a claim that opens the exact
// paper behind it. Three tiny bubbles say "this comes from your sheet".
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

class ShowMeTag extends StatelessWidget {
  const ShowMeTag({super.key, required this.onTap, this.semanticsLabel});

  final VoidCallback onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: semanticsLabel ?? '${TodayCopy.showMe}, the questions behind this',
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: 48,
        child: Align(
          alignment: Alignment.centerLeft,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.55 : 0.6),
              shape: StadiumBorder(side: BorderSide(color: colors.line)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 7, 12, 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BubbleRow(states: [BubbleState.filled, BubbleState.wrong, BubbleState.hollow], bubbleSize: 8, gap: 3),
                  const SizedBox(width: MmSpace.s8),
                  Text(TodayCopy.showMe, style: type.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
