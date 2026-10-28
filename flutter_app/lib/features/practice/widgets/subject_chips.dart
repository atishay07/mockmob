import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'pressable.dart';

/// Subject chips: 44 dp, wrapping, one selected. Selected is ink fill plus a check glyph, never
/// volt. A last "Other subjects" chip opens the rest of the supported subjects.
class SubjectChips extends StatelessWidget {
  const SubjectChips({super.key, required this.choices, required this.selectedId, required this.onSelected, this.onOther});

  final List<SubjectChoice> choices;
  final String selectedId;
  final ValueChanged<String> onSelected;

  /// Null hides the "Other subjects" chip (nothing else to offer).
  final VoidCallback? onOther;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s8,
      children: [
        for (final c in choices) SubjectChip(label: c.name, selected: c.id == selectedId, onTap: () => onSelected(c.id)),
        if (onOther != null) SubjectChip(label: PracticeCopy.otherSubjects, selected: false, onTap: onOther!, more: true),
      ],
    );
  }
}

class SubjectChip extends StatelessWidget {
  const SubjectChip({super.key, required this.label, required this.selected, required this.onTap, this.more = false});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// The "Other subjects" chip: outlined, with a trailing glyph instead of selection.
  final bool more;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Pressable(
      onTap: onTap,
      selected: more ? null : selected,
      radius: MmRadius.pill,
      tickOnTap: !selected,
      pressedColor: selected ? colors.ink2 : colors.sunken,
      builder: (context, pressed) => DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: MmRadius.pillAll,
          color: selected ? (pressed ? colors.ink2 : colors.ink) : colors.raised,
          border: Border.all(color: selected ? colors.ink : colors.lineStrong),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                ExcludeSemantics(child: Icon(LucideIcons.check, size: 16, color: colors.ground)),
                const SizedBox(width: MmSpace.s8),
              ],
              Flexible(
                child: Text(label, style: type.label.copyWith(fontSize: 14, color: selected ? colors.ground : colors.ink)),
              ),
              if (more) ...[
                const SizedBox(width: MmSpace.s8),
                ExcludeSemantics(child: Icon(LucideIcons.chevronDown, size: 16, color: colors.ink2)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
