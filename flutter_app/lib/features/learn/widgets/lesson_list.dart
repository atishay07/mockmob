import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/study.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../models/learn_catalog.dart';

/// One subject's lessons in a single panel: a heading, then a row per lesson with its status
/// word (New, In progress, Due, Done for now). Never "mastered".
class SubjectLessons extends StatelessWidget {
  const SubjectLessons({super.key, required this.title, required this.units, required this.onOpen});

  final String title;
  final List<LearnUnit> units;
  final ValueChanged<LearnUnit> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8, left: MmSpace.s4),
          child: Semantics(header: true, child: Text(title, style: context.mmType.subhead)),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.raised,
            borderRadius: MmRadius.panelAll,
            border: Border.all(color: colors.line),
          ),
          child: ClipRRect(
            borderRadius: MmRadius.panelAll,
            child: Column(
              children: [
                for (var i = 0; i < units.length; i++) ...[
                  if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
                  LessonRow(unit: units[i], onTap: () => onOpen(units[i])),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class LessonRow extends StatelessWidget {
  const LessonRow({super.key, required this.unit, required this.onTap});

  final LearnUnit unit;
  final VoidCallback onTap;

  static IconData glyph(StudyUnitStatus s) => switch (s) {
        StudyUnitStatus.newUnit || StudyUnitStatus.unknown => LucideIcons.circle,
        StudyUnitStatus.inProgress || StudyUnitStatus.lockIn => LucideIcons.circleDot,
        StudyUnitStatus.due => LucideIcons.rotateCcw,
        StudyUnitStatus.learned => LucideIcons.circleCheck,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final word = LearnCopy.statusWord(unit.status);
    final minutes = unit.estimatedMinutes == null ? null : LearnCopy.minutes(unit.estimatedMinutes!);
    return Semantics(
      button: true,
      container: true,
      label: [unit.title, word, ?minutes].join('. '),
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(glyph(unit.status), size: 20, color: unit.status == StudyUnitStatus.learned ? colors.ink : colors.ink2),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(unit.title, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                      Text(minutes == null ? word : '$word, $minutes', style: type.small.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
