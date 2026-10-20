import 'package:flutter/material.dart';

import '../theme/theme.dart';
import 'bubbles/bubble_painter.dart';
import 'bubbles/bubble_row.dart';
import 'hit_slop.dart';
import 'pressable.dart';

/// "Show me" (brief 12.1, evidence first): the one quiet pill under any claim the app makes
/// about the student, opening the exact questions or attempts behind it. A 32 dp pill with a 48 dp
/// target (the touch band is [MmHitSlop], not layout, so the pill takes 32 dp of height): three 6 dp evidence bubbles, then "Show me". The same on every tab.
class ShowMePill extends StatelessWidget {
  const ShowMePill({
    super.key,
    required this.onTap,
    this.semanticsLabel = 'Show me, the questions this comes from',
    this.marks = const [],
  });

  final VoidCallback onTap;

  /// Say what opens ("Show me, the attempt behind this"), never just "Show me".
  final String semanticsLabel;

  /// Up to three evidence bubbles, only when they stand for real answers (Review shows the wrong
  /// answers it means). Empty draws no bubbles: a dot must say something.
  final List<BubbleState> marks;

  static const String label = 'Show me';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 32,
      child: Align(
        alignment: Alignment.centerLeft,
        widthFactor: 1,
        heightFactor: 1,
        child: MmPressable(
          semanticsLabel: semanticsLabel,
          focusRadius: MmRadius.pillAll,
          onTap: onTap,
          builder: (context, pressed, _) => DecoratedBox(
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.55 : 0.6),
              shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
            ),
            child: SizedBox(
              height: 32,
              child: Padding(
                padding: EdgeInsets.only(left: marks.isEmpty ? MmSpace.s12 : MmSpace.s8, right: MmSpace.s12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (marks.isNotEmpty) ...[
                      BubbleRow(states: marks.take(3).toList(), bubbleSize: 6, gap: 4),
                      const SizedBox(width: MmSpace.s8),
                    ],
                    Text(
                      label,
                      style: type.caption.copyWith(
                        fontSize: 13,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                        color: colors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
