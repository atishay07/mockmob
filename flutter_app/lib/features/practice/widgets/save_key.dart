import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Save a question to the student's saved questions (the website's Saved page). A quiet key
/// with a bookmark glyph; it reads "Saved" only once the server has said so.
class SaveKey extends StatelessWidget {
  const SaveKey({super.key, required this.saved, required this.busy, required this.onTap});

  final bool saved;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: busy ? null : onTap,
      semanticsLabel: saved ? PracticeCopy.unsaveSemantics : PracticeCopy.saveSemantics,
      selected: saved,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.96,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                SizedBox.square(dimension: 18, child: MmSpinner(color: colors.ink2, size: 16))
              else
                Icon(saved ? LucideIcons.bookmarkCheck : LucideIcons.bookmark, size: 18, color: saved ? colors.ink : colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Text(
                saved ? PracticeCopy.saved : PracticeCopy.save,
                style: type.label.copyWith(color: pressed ? colors.ink2 : (saved ? colors.ink : colors.ink2)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
