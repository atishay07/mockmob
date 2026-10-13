import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../edit_copy.dart';
import '../widgets/subject_art.dart';
import '../widgets/you_row.dart';

/// One subject in the editor: its object, its name and an answer bubble that inks when chosen.
/// The whole row toggles; TalkBack hears a checkbox.
class SubjectChoiceRow extends StatelessWidget {
  const SubjectChoiceRow({super.key, required this.id, required this.name, required this.chosen, required this.onTap});

  final String id;
  final String name;
  final bool chosen;

  /// Null while a save is out.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Semantics(
      checked: chosen,
      child: RowFrame(
        onTap: onTap,
        semanticsLabel: EditCopy.chosenLabel(name, chosen),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
        child: Row(
          children: [
            SubjectArt(id, size: 40),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text(name, style: type.labelLarge.copyWith(fontSize: 16, color: onTap == null ? colors.ink3 : colors.ink)),
            ),
            const SizedBox(width: MmSpace.s12),
            Bubble(state: chosen ? BubbleState.filled : BubbleState.hollow, size: 24),
          ],
        ),
      ),
    );
  }
}

/// A saved subject practice cannot open: the server's reason and a Remove key.
class StaleSubjectRow extends StatelessWidget {
  const StaleSubjectRow({super.key, required this.id, required this.name, required this.reason, required this.onRemove});

  final String id;
  final String name;
  final String? reason;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.s8, MmSpace.s12),
      child: Row(
        children: [
          SubjectArt(id, size: 40),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: type.labelLarge.copyWith(fontSize: 16)),
                const SizedBox(height: 2),
                Text(reason ?? EditCopy.staleNoReason, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          KeyButton.quiet(label: EditCopy.remove, onPressed: onRemove, semanticsLabel: '${EditCopy.remove} $name'),
        ],
      ),
    );
  }
}

/// "3 of 5 chosen", announced as it changes.
class SlotCount extends StatelessWidget {
  const SlotCount({super.key, required this.count, required this.max});

  final int count;
  final int max;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      liveRegion: true,
      child: Text(EditCopy.subjectsCount(count), style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink2)),
    );
  }
}
