import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';

/// Opens the remaining supported subjects. Returns the chosen public subject id.
Future<String?> showOtherSubjects(BuildContext context, List<SubjectChoice> subjects) {
  return showMmSheet<String>(
    context: context,
    title: PracticeCopy.otherSubjectsTitle,
    builder: (context) => OtherSubjectsList(subjects: subjects, onPick: (id) => Navigator.of(context).pop(id)),
  );
}

class OtherSubjectsList extends StatelessWidget {
  const OtherSubjectsList({super.key, required this.subjects, required this.onPick});

  final List<SubjectChoice> subjects;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (subjects.isEmpty) {
      return Text(PracticeCopy.otherSubjectsEmpty, style: type.body.copyWith(color: colors.ink2));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final s in subjects)
          MmPressable(
            onTap: () => onPick(s.id),
            semanticsLabel: s.name,
            focusRadius: MmRadius.keyAll,
            pressedScale: 0.985,
            haptic: MmPressHaptic.selection,
            highlight: true,
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s8),
                child: Row(
                  children: [
                    SubjectEmblem(subject: s.id, size: EmblemSizes.chip, framed: false),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(child: Text(s.name, style: type.labelLarge)),
                    Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
