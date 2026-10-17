import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../theme/theme.dart';
import '../hit_slop.dart';
import '../pressable.dart';
import 'selection_style.dart';

export 'chip_rail.dart';

/// A chip (10, 20, 30 minutes; a subject; a category) in the answer-sheet selection language
/// ([MmSelection]): a hollow bubble and a hairline at rest; chosen, a raised fill, a paper-ink
/// rim and an inked bubble. 40 dp visual with a 48 dp target (the extra band is [MmHitSlop], not layout, so chips in a wrap
/// keep their coded gaps). `selectionClick` on tap.
///
/// Chips that scroll sideways belong in a [ChipRail]: it gives each chip all the width its words
/// need (the label is never ellipsised there), snaps the rail to chip edges, fades the edges and
/// shows a clean peek of the next chip, so none is ever cut through a letter.
class MmChip extends ConsumerWidget {
  const MmChip({super.key, required this.label, required this.selected, required this.onTap, this.leading, this.showBubble = true});

  /// The visual height; the touch target is [targetHeight].
  static const double height = 40;
  static const double targetHeight = 48;

  /// Where the label starts from the chip's left edge: 12 dp of cap, the 10 dp bubble, an 8 dp
  /// gap. A cut that lands before this point shows a clean rounded start and no letters
  /// ([ChipRail] aims its peek here). With a [leading] icon the label starts [leadingExtra] later.
  static const double labelInset = 30;
  static const double leadingExtra = 22;

  final String label;
  final bool selected;

  /// Null disables the chip.
  final VoidCallback? onTap;
  final IconData? leading;

  /// False for a plain chip: no bubble; the chosen state is carried by the raised fill, the
  /// paper-ink rim and a heavier word (the You hub's section row, where a dot in every pill
  /// read as the dot-pill look).
  final bool showBubble;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final disabled = onTap == null;
    final textColor = disabled ? colors.ink4 : colors.ink;

    return MmHitSlop.toTarget(
      visual: height,
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
            height: height,
            child: Padding(
              padding: EdgeInsets.only(left: showBubble ? MmSpace.s12 : MmSpace.s16, right: MmSpace.s16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (showBubble) ...[SelectBubble(selected: selected), const SizedBox(width: MmSpace.s8)],
                  if (leading != null) ...[Icon(leading, size: 16, color: textColor), const SizedBox(width: MmSpace.s6)],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      softWrap: false,
                      style: type.labelLarge.copyWith(
                        fontSize: 14,
                        color: textColor,
                        fontWeight: showBubble ? null : (selected ? FontWeight.w700 : FontWeight.w500),
                      ),
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
