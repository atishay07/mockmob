import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A compact 48 dp key that shows the current order and opens a sheet of the choices.
class ToolsSortKey<T> extends StatelessWidget {
  const ToolsSortKey({
    super.key,
    required this.options,
    required this.value,
    required this.labelOf,
    required this.onChanged,
    required this.sheetTitle,
  });

  final List<T> options;
  final T value;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;
  final String sheetTitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final label = labelOf(value);
    return MmPressable(
      semanticsLabel: '$sheetTitle: $label',
      onTap: () => _pick(context),
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.sunken,
          shape: StadiumBorder(side: BorderSide(color: colors.line)),
        ),
        child: SizedBox(
          height: MmTarget.min,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.arrowUpDown, size: 16, color: colors.ink2),
                const SizedBox(width: MmSpace.s6),
                Text(label, style: context.mmType.label.copyWith(color: colors.ink)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pick(BuildContext context) => showMmSheet<void>(
        context: context,
        title: sheetTitle,
        builder: (sheet) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final o in options)
              MmSelectRow(
                title: labelOf(o),
                selected: o == value,
                onTap: () {
                  onChanged(o);
                  Navigator.of(sheet).maybePop();
                },
              ),
          ],
        ),
      );
}
