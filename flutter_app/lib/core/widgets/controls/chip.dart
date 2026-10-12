import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../theme/theme.dart';
import '../pressable.dart';

/// A chip (10, 20, 30 minutes; a subject; a category). Rest: a hairline pill. Selected: inverted
/// to paper-white ink with dark text, which reads as chosen without spending the volt.
/// 40 dp visual inside a 48 dp target. `selectionClick` on tap.
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
    final textColor = selected ? colors.ground : (disabled ? colors.ink4 : colors.ink);

    return MmPressable(
      semanticsLabel: label,
      selected: selected,
      onTap: disabled
          ? null
          : () {
              ref.read(hapticsProvider).selection();
              onTap!();
            },
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: selected ? colors.ink : (pressed ? colors.raised2 : colors.raised),
            shape: StadiumBorder(side: BorderSide(color: selected ? colors.ink : colors.line)),
          ),
          child: SizedBox(
            height: 40,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (leading != null) ...[Icon(leading, size: 16, color: textColor), const SizedBox(width: MmSpace.s6)],
                  Text(label, style: type.labelLarge.copyWith(fontSize: 14, color: textColor)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
