import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';

/// A one-tap action shaped like a chip (a quick-start preset, "Clear all", "+ Mathematics"). It
/// has no answer bubble: it is not a choice that stays chosen, so it must not look like one.
/// 40 dp visual inside a 48 dp target; `selectionClick` on tap.
class ToolsActionChip extends ConsumerWidget {
  const ToolsActionChip({super.key, required this.label, required this.icon, required this.onTap, this.trailing, this.semanticsLabel});

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  /// A short figure after the label, such as "+6".
  final String? trailing;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final disabled = onTap == null;
    final ink = disabled ? colors.ink4 : colors.ink;
    return MmPressable(
      semanticsLabel: semanticsLabel ?? label,
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
            color: pressed ? colors.raised2 : colors.raised,
            shape: StadiumBorder(side: BorderSide(color: colors.line)),
          ),
          child: SizedBox(
            height: 40,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 16, color: disabled ? ink : colors.accentText),
                  const SizedBox(width: MmSpace.s6),
                  Text(label, style: type.labelLarge.copyWith(fontSize: 14, color: ink)),
                  if (trailing != null) ...[
                    const SizedBox(width: MmSpace.s8),
                    Text(
                      trailing!,
                      style: type.labelLarge.copyWith(
                        fontSize: 14,
                        color: colors.accentText,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                  const SizedBox(width: 2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
