// The lead card's split footer (TODAY-1018 6.1, 6.2): two other moves side by side under a
// hairline, then "More ways to practise". Plain buttons on the card's own surface (no card inside
// the card): a hover-free pressed wash and a 0.98 press. The recommended move, once the student
// picked another, carries the word "Suggested" above it, so the way back is always one tap.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_glance.dart';
import '../logic/today_model.dart';
import 'today_type.dart';

class MoveChoicesFooter extends StatelessWidget {
  const MoveChoicesFooter({super.key, required this.choices, this.onChoose, this.onMore});

  final List<MoveChoice> choices;
  final ValueChanged<MoveChoice>? onChoose;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rule = ColoredBox(color: colors.line, child: const SizedBox(height: 1, width: double.infinity));
    final shown = choices.take(2).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (shown.isNotEmpty) ...[
          rule,
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var k = 0; k < shown.length; k++) ...[
                  if (k > 0) ColoredBox(color: colors.line, child: const SizedBox(width: 1)),
                  Expanded(child: _Choice(choice: shown[k], onTap: onChoose == null ? null : () => onChoose!(shown[k]))),
                ],
                if (shown.length == 1) const Expanded(child: SizedBox.shrink()),
              ],
            ),
          ),
        ],
        if (onMore != null) ...[
          rule,
          _More(onTap: onMore!),
        ],
      ],
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.choice, this.onTap});

  final MoveChoice choice;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: GlanceCopy.choiceSemantics(choice.title, choice.line, choice.suggested),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        color: pressed ? colors.raised2.withValues(alpha: 0.7) : Colors.transparent,
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s12, MmSpace.s12, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (choice.suggested) ...[
              Text(GlanceCopy.suggested, style: type.micro.copyWith(color: accent, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
              const SizedBox(height: MmSpace.s2),
            ],
            Text(choice.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w600, color: colors.ink)),
            const SizedBox(height: MmSpace.s2),
            Text(choice.line, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(fontSize: 13, color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

class _More extends StatelessWidget {
  const _More({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: GlanceCopy.moreWays,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        color: pressed ? colors.raised2.withValues(alpha: 0.7) : Colors.transparent,
        height: 52,
        alignment: Alignment.center,
        child: Text(GlanceCopy.moreWays, style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink2)),
      ),
    );
  }
}
