import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'pressable.dart';

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
          Pressable(
            onTap: () => onPick(s.id),
            minHeight: 52,
            builder: (_, _) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s12),
              child: Row(
                children: [
                  Expanded(child: Text(s.name, style: type.subhead)),
                  ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
