import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../theme/theme.dart';
import '../materials/shape.dart';
import '../pressable.dart';
import 'selection_style.dart';

/// A choice row written like a line of an answer sheet (onboarding answers, settings choices): a
/// leading bubble, then the title and an optional note. With a [letter] the bubble is a 28 dp
/// letter bubble (A, B, C, D) that inks volt when chosen; without one it is the 10 dp select
/// bubble. Chosen rows take the shared selection look ([MmSelection]). 56 dp minimum,
/// `selectionClick` on choose.
class MmSelectRow extends ConsumerWidget {
  const MmSelectRow({
    super.key,
    required this.title,
    required this.selected,
    required this.onTap,
    this.note,
    this.letter,
    this.leading,
    this.trailing,
    this.multi = false,
  });

  final String title;
  final String? note;
  final bool selected;

  /// Null disables the row.
  final VoidCallback? onTap;

  /// "A" to "F": draws a letter bubble instead of the small select bubble.
  final String? letter;

  /// Art or an icon between the bubble and the title.
  final Widget? leading;

  /// A count or a chevron at the end.
  final Widget? trailing;

  /// Part of a multi-choice list (checkbox semantics instead of radio).
  final bool multi;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final disabled = onTap == null;
    final hasLetter = letter != null;

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
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: MmSelection.fill(colors, selected: selected, pressed: pressed),
          shape: mmShapeBorder(MmRadius.keyAll, side: MmSelection.side(colors, selected: selected)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: EdgeInsets.fromLTRB(hasLetter ? MmSpace.s12 : MmSpace.s16, MmSpace.s8, MmSpace.s16, MmSpace.s8),
            child: Row(
              children: [
                if (hasLetter) LetterBubble(letter: letter!, selected: selected) else SelectBubble(selected: selected),
                SizedBox(width: hasLetter ? MmSpace.s12 : MmSpace.s12),
                if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s12)],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: type.body.copyWith(fontWeight: FontWeight.w500, color: disabled ? colors.ink3 : colors.ink),
                      ),
                      if (note != null) ...[
                        const SizedBox(height: 2),
                        Text(note!, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
