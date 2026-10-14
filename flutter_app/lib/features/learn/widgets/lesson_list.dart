import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../models/learn_catalog.dart';
import 'lesson_ring.dart';
import 'subject_mark.dart';

/// One subject's lessons: the subject's own drawn emblem and name with its lesson count, one
/// grouped list with a row per lesson and its status word (New, In progress, Due, Done for now;
/// never "mastered"), then a way into each taught chapter's summary.
class SubjectLessons extends StatelessWidget {
  const SubjectLessons({
    super.key,
    required this.subject,
    required this.units,
    required this.onOpen,
    this.onReadChapter,
    this.upNext,
    this.onPhone = const {},
    this.offline = false,
  });

  /// Ids of the lessons kept on this phone: their rows say so.
  final Set<String> onPhone;

  /// The phone has no connection: a lesson that is not kept says it needs one.
  final bool offline;

  final LearnSubject subject;
  final List<LearnUnit> units;
  final ValueChanged<LearnUnit> onOpen;

  /// Opens the chapter reader; null hides the chapter rows.
  final ValueChanged<String>? onReadChapter;

  /// The lesson the server suggests next, when it sits in this list: its row says so (with the
  /// server's reason) instead of a second card above repeating it.
  final NextLesson? upNext;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapters = <String>{
      for (final u in units)
        if (u.chapter != null && u.chapter!.trim().isNotEmpty) u.chapter!.trim(),
    }.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SubjectHeader(subject: subject, lessons: units.length),
        const SizedBox(height: MmRhythm.item),
        MmRowGroup(
          dividerIndent: MmSpace.s16,
          children: [for (final unit in units) _lessonRow(colors, unit)],
        ),
        if (onReadChapter != null && chapters.isNotEmpty) ...[
          const SizedBox(height: MmRhythm.group),
          // On the gutter, exactly under the card edge (E0), 12 above its content.
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Semantics(header: true, child: Text(LearnCopy.chapterSummariesHeading, style: type.label.copyWith(color: colors.ink2))),
          ),
          // Leading plates are 40 dp, so the hairlines start at E1 + 52 (the default indent).
          MmRowGroup(
            children: [
              for (final c in chapters)
                MmRow(
                  leading: _Plate(child: Icon(LucideIcons.bookOpenText, size: 20, color: colors.ink2)),
                  title: c,
                  subtitle: LearnCopy.readSummary,
                  semanticsLabel: '${LearnCopy.readSummary}. $c',
                  trailing: Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
                  onTap: () => onReadChapter!(c),
                ),
            ],
          ),
        ],
      ],
    );
  }

  /// One lesson: its title, then its status word and length. The word carries the state, so no
  /// glyph repeats it.
  Widget _lessonRow(MmColors colors, LearnUnit unit) {
    final word = LearnCopy.statusWord(unit.status);
    final minutes = unit.estimatedMinutes == null ? null : LearnCopy.minutes(unit.estimatedMinutes!);
    final status = minutes == null ? word : '$word, $minutes';
    final next = upNext != null && upNext!.id == unit.id;
    final reason = next ? upNext!.reason : null;
    // Whether the lesson can be opened without a connection, said only when it is true: kept on
    // this phone, or (when there is no connection) not kept.
    final where = onPhone.contains(unit.id) ? LearnCopy.onThisPhone : (offline ? LearnCopy.needsConnection : null);
    return MmRow(
      title: unit.title,
      subtitle: ['${next ? '${LearnCopy.upNext}. ' : ''}$status', ?reason, ?where].join('\n'),
      subtitleLines: next ? 5 : 3,
      semanticsLabel: [if (next) LearnCopy.upNext, unit.title, word, ?minutes, ?reason, ?where].join('. '),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          LessonStateRing(key: ValueKey('ring-${unit.id}'), state: LessonRingState.of(unit)),
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
      ),
      onTap: () => onOpen(unit),
    );
  }
}

/// A 40 dp leading plate (12 dp radius) for a row's glyph: a well, so it reads in both themes.
class _Plate extends StatelessWidget {
  const _Plate({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(color: context.mmColors.sunken, borderRadius: MmRadius.smallAll),
      child: SizedBox.square(dimension: 40, child: Center(child: child)),
    );
  }
}

/// A subject's name beside its drawn emblem (56 dp), with how many lessons are published.
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
        SubjectMark(subjectId: subject.id, name: subject.title, size: EmblemSizes.tile),
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
      haptic: MmPressHaptic.selection,
      highlight: true,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              Icon(LucideIcons.bookOpenText, size: 20, color: colors.ink2),
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
              Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
