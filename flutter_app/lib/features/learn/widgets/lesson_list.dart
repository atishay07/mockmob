import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../models/learn_catalog.dart';
import 'subject_mark.dart';

/// One subject's lessons: the subject's own object art and name with its lesson count, a panel
/// with a row per lesson and its status word (New, In progress, Due, Done for now; never
/// "mastered"), then a way into each taught chapter's summary.
class SubjectLessons extends StatelessWidget {
  const SubjectLessons({
    super.key,
    required this.subject,
    required this.units,
    required this.onOpen,
    this.onReadChapter,
  });

  final LearnSubject subject;
  final List<LearnUnit> units;
  final ValueChanged<LearnUnit> onOpen;

  /// Opens the chapter reader; null hides the chapter rows.
  final ValueChanged<String>? onReadChapter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final chapters = <String>{
      for (final u in units)
        if (u.chapter != null && u.chapter!.trim().isNotEmpty) u.chapter!.trim(),
    }.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SubjectHeader(subject: subject, lessons: units.length),
        const SizedBox(height: MmSpace.s12),
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
        if (onReadChapter != null)
          for (final c in chapters) ChapterSummaryRow(chapter: c, onTap: () => onReadChapter!(c)),
      ],
    );
  }
}

/// A subject's name beside its object art (56 dp), with how many lessons are published.
class SubjectHeader extends StatelessWidget {
  const SubjectHeader({super.key, required this.subject, this.lessons});

  final LearnSubject subject;

  /// Published lessons in this subject, or null to say nothing.
  final int? lessons;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        SubjectMark(subjectId: subject.id, name: subject.title, size: 56),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(header: true, child: Text(subject.title, style: type.subhead)),
              if (lessons != null && lessons! > 0) Text(LearnCopy.lessonCount(lessons!), style: type.small.copyWith(color: colors.ink2)),
            ],
          ),
        ),
      ],
    );
  }
}

/// One lesson: its title, then its status word and length. The word carries the state, so no
/// glyph repeats it.
class LessonRow extends StatelessWidget {
  const LessonRow({super.key, required this.unit, required this.onTap});

  final LearnUnit unit;
  final VoidCallback onTap;

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

/// "Read the chapter summary" for one taught chapter, opening the chapter reader.
class ChapterSummaryRow extends StatelessWidget {
  const ChapterSummaryRow({super.key, required this.chapter, required this.onTap});

  final String chapter;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '${LearnCopy.readSummary}. $chapter',
      focusRadius: MmRadius.panelAll,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s8),
          child: Row(
            children: [
              Icon(LucideIcons.bookOpenText, size: 18, color: colors.ink2),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(LearnCopy.readSummary, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                    Text(chapter, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
