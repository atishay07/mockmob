import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../theme/theme.dart';
import '../bubbles/bubble.dart';
import '../materials/edge_light.dart';
import '../materials/shape.dart';
import '../pressable.dart';

/// A selectable row on smoked glass (onboarding answers, settings choices): title, optional
/// note and leading art, and an answer bubble on the right that inks when chosen. A chosen row
/// gets a volt rim. 64 dp minimum, `selectionClick` on choose.
class MmSelectRow extends ConsumerWidget {
  const MmSelectRow({
    super.key,
    required this.title,
    required this.selected,
    required this.onTap,
    this.note,
    this.leading,
    this.trailing,
    this.multi = false,
  });

  final String title;
  final String? note;
  final bool selected;

  /// Null disables the row.
  final VoidCallback? onTap;
  final Widget? leading;

  /// Replaces the bubble (a count, a chevron).
  final Widget? trailing;

  /// Part of a multi-choice list (checkbox semantics instead of radio).
  final bool multi;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final disabled = onTap == null;

    return MmPressable(
        semanticsLabel: note == null ? title : '$title. $note',
        selected: multi ? null : selected,
        checked: multi ? selected : null,
        inMutuallyExclusiveGroup: multi ? null : true,
        button: true,
        focusRadius: MmRadius.keyAll,
        onTap: disabled
            ? null
            : () {
                ref.read(hapticsProvider).selection();
                onTap!();
              },
        builder: (context, pressed, _) {
          final fill = selected
              ? colors.raised2
              : Color.lerp(colors.isNight ? colors.raised : colors.raised, colors.raised2, pressed ? 0.7 : 0)!;
          final rim = selected ? (colors.isNight ? colors.volt : colors.accentText) : colors.line;
          return DecoratedBox(
            decoration: ShapeDecoration(
              color: fill,
              shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: rim, width: selected ? 1.5 : 1)),
            ),
            child: CustomPaint(
              foregroundPainter: selected
                  ? null
                  : EdgeLightPainter(
                      borderRadius: MmRadius.keyAll,
                      top: colors.edgeTop,
                      bottom: colors.edgeBottom.withValues(alpha: 0),
                      boost: pressed ? 1.6 : 1,
                      sheen: false,
                    ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 64),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                  child: Row(
                    children: [
                      if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s12)],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(title, style: type.labelLarge.copyWith(color: disabled ? colors.ink3 : colors.ink)),
                            if (note != null) ...[
                              const SizedBox(height: 2),
                              Text(note!, style: type.caption.copyWith(color: colors.ink3)),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      trailing ?? Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 22),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
    );
  }
}
