import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../theme/theme.dart';
import '../hit_slop.dart';
import '../pressable.dart';
import 'selection_style.dart';

/// A chip (10, 20, 30 minutes; a subject; a category) in the answer-sheet selection language
/// ([MmSelection]): a hollow bubble and a hairline at rest; chosen, a raised fill, a paper-ink
/// rim and an inked bubble. 40 dp visual with a 48 dp target (the extra band is [MmHitSlop], not layout, so chips in a wrap
/// keep their coded gaps). `selectionClick` on tap.
class MmChip extends ConsumerWidget {
  const MmChip({super.key, required this.label, required this.selected, required this.onTap, this.leading});

  final String label;
  final bool selected;

  /// Null disables the chip.
  final VoidCallback? onTap;
  final IconData? leading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final disabled = onTap == null;
    final textColor = disabled ? colors.ink4 : colors.ink;

    return MmHitSlop.toTarget(
      visual: 40,
      child: MmPressable(
        semanticsLabel: label,
        selected: selected,
        onTap: disabled
            ? null
            : () {
                ref.read(hapticsProvider).selection();
                onTap!();
              },
        builder: (context, pressed, _) => DecoratedBox(
          decoration: ShapeDecoration(
            color: MmSelection.fill(colors, selected: selected, pressed: pressed),
            shape: StadiumBorder(side: MmSelection.side(colors, selected: selected)),
          ),
          child: SizedBox(
            height: 40,
            child: Padding(
              padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SelectBubble(selected: selected),
                  const SizedBox(width: MmSpace.s8),
                  if (leading != null) ...[
                    Icon(leading, size: 16, color: textColor),
                    const SizedBox(width: MmSpace.s6),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      softWrap: false,
                      style: type.labelLarge.copyWith(fontSize: 14, color: textColor),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
