import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/models/subject.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'pressable.dart';

/// The single chapter field of chapter practice: a labelled row that opens the chapter list.
/// The chosen name is never truncated.
class ChapterField extends StatelessWidget {
  const ChapterField({super.key, required this.chapter, required this.onTap});

  final String? chapter;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chosen = chapter != null && chapter!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(PracticeCopy.chapterLabel, style: type.label.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        Pressable(
          onTap: onTap,
          minHeight: MmTarget.option,
          semanticsLabel: '${PracticeCopy.chapterLabel}, ${chosen ? chapter! : PracticeCopy.chooseChapter}',
          builder: (context, pressed) => DecoratedBox(
            decoration: BoxDecoration(
              color: pressed ? colors.sunken : colors.raised,
              borderRadius: MmRadius.keyAll,
              border: Border.all(color: chosen ? colors.ink : colors.lineStrong, width: chosen ? 1.5 : 1),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      chosen ? chapter! : PracticeCopy.chooseChapter,
                      style: type.body.copyWith(
                        color: chosen ? colors.ink : colors.ink3,
                        fontWeight: chosen ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Opens the chapter list for [subjectId]. Returns the chosen chapter name.
Future<String?> showChapterPicker(BuildContext context, {required String subjectId, String? selected}) {
  return showMmSheet<String>(
    context: context,
    title: PracticeCopy.chooseChapterTitle,
    builder: (context) => ChapterList(subjectId: subjectId, selected: selected, onPick: (name) => Navigator.of(context).pop(name)),
  );
}

class ChapterList extends ConsumerWidget {
  const ChapterList({super.key, required this.subjectId, required this.onPick, this.selected});

  final String subjectId;
  final String? selected;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapters = ref.watch(practiceChaptersProvider(subjectId));
    return chapters.when(
      loading: () => SkeletonGroup(
        label: 'Loading chapters',
        child: Column(
          children: [
            for (var i = 0; i < 6; i++)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: MmSpace.s12),
                child: Skeleton.line(height: 16),
              ),
          ],
        ),
      ),
      error: (error, _) {
        final offline = error is ApiError && error.isOffline;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(offline ? PracticeCopy.chaptersOffline : PracticeCopy.chaptersLoadFailed, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: PracticeCopy.retry, onPressed: () => ref.invalidate(practiceChaptersProvider(subjectId))),
          ],
        );
      },
      data: (catalog) => _Units(units: catalog.units, selected: selected, onPick: onPick),
    );
  }
}

class _Units extends StatelessWidget {
  const _Units({required this.units, required this.selected, required this.onPick});

  final List<ChapterUnit> units;
  final String? selected;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final unit in units) ...[
          if (unit.name.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s16, MmSpace.s4, MmSpace.s4),
              child: Semantics(
                header: true,
                child: Text(unit.name, style: type.label.copyWith(color: colors.ink2)),
              ),
            ),
          for (final chapter in unit.chapters) _ChapterRow(name: chapter.name, selected: chapter.name == selected, onPick: onPick),
        ],
      ],
    );
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({required this.name, required this.selected, required this.onPick});

  final String name;
  final bool selected;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Pressable(
      onTap: () => onPick(name),
      selected: selected,
      minHeight: 52,
      builder: (_, _) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s12),
        child: Row(
          children: [
            Expanded(
              child: Text(name, style: type.body.copyWith(fontWeight: selected ? FontWeight.w700 : FontWeight.w400)),
            ),
            if (selected) ExcludeSemantics(child: Icon(LucideIcons.check, size: 20, color: colors.ink)),
          ],
        ),
      ),
    );
  }
}
