import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/stream_catalog.dart';
import '../data/stream_controller.dart';
import '../data/subject_names.dart';
import 'practice_card.dart';

/// Subject, chapter and difficulty as three filter keys. Each opens a sheet; choosing reloads
/// the stream from its first page.
class StreamFilterBar extends ConsumerWidget {
  const StreamFilterBar({super.key, required this.filters, required this.onChanged});

  final StreamFilters filters;
  final ValueChanged<StreamFilters> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final f = filters;
    // The three keys ride one rail: it snaps to a key, fades the edge with more behind it and
    // always peeks a clean start of the next key, never a label cut through a letter.
    return ChipRail(
      semanticLabel: InsightsCopy.streamFilters,
      children: [
        _FilterKey(
          label: subjectDisplayName(f.subject),
          hint: InsightsCopy.chooseSubject,
          onTap: () async {
            final picked = await _pickSubject(context, f.subject);
            if (picked != null && picked != f.subject) onChanged(StreamFilters(subject: picked));
          },
        ),
        _FilterKey(
          label: f.chapter ?? InsightsCopy.allChapters,
          hint: InsightsCopy.chooseChapter,
          active: f.chapter != null,
          onTap: () async {
            final picked = await _pickChapter(context, f.subject, f.chapter);
            if (picked == null) return;
            onChanged(picked.isEmpty ? f.copyWith(clearChapter: true) : f.copyWith(chapter: picked));
          },
        ),
        _FilterKey(
          label: f.difficulty == null ? InsightsCopy.anyDifficulty : difficultyWord(f.difficulty),
          hint: 'Difficulty',
          active: f.difficulty != null,
          onTap: () async {
            final picked = await _pickDifficulty(context, f.difficulty);
            if (picked == null) return;
            onChanged(picked.isEmpty ? f.copyWith(clearDifficulty: true) : f.copyWith(difficulty: picked));
          },
        ),
      ],
    );
  }

  Future<String?> _pickSubject(BuildContext context, String current) => showMmSheet<String>(
        context: context,
        title: InsightsCopy.chooseSubject,
        heightFactor: 0.8,
        builder: (sheet) => Consumer(
          builder: (context, ref, _) => ref.watch(streamSubjectsProvider).when(
                data: (subjects) => ListView(
                  shrinkWrap: true,
                  children: [
                    for (final s in subjects) ...[
                      MmSelectRow(title: subjectDisplayName(s.id), selected: s.id == current, onTap: () => Navigator.of(sheet).pop(s.id)),
                      const SizedBox(height: MmSpace.s8),
                    ],
                  ],
                ),
                loading: () => Padding(padding: const EdgeInsets.all(MmSpace.s32), child: Center(child: MmSpinner(color: context.mmColors.ink2))),
                error: (_, _) => Padding(
                  padding: const EdgeInsets.all(MmSpace.s16),
                  child: InlineBanner(
                    message: InsightsCopy.failedMessage,
                    tone: BannerTone.error,
                    actionLabel: InsightsCopy.retry,
                    onAction: () => ref.invalidate(streamSubjectsProvider),
                  ),
                ),
              ),
        ),
      );

  /// '' means all chapters.
  Future<String?> _pickChapter(BuildContext context, String subject, String? current) => showMmSheet<String>(
        context: context,
        title: InsightsCopy.chooseChapter,
        heightFactor: 0.85,
        builder: (sheet) => Consumer(
          builder: (context, ref, _) {
            final type = context.mmType;
            final colors = context.mmColors;
            final all = MmSelectRow(title: InsightsCopy.allChapters, selected: current == null, onTap: () => Navigator.of(sheet).pop(''));
            return ref.watch(streamChaptersProvider(subject)).when(
                  data: (catalog) => ListView(
                    shrinkWrap: true,
                    children: [
                      all,
                      for (final unit in catalog.units) ...[
                        if (unit.name.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s20, 0, MmSpace.s4),
                            child: Text(unit.name, style: type.label.copyWith(color: colors.ink2)),
                          )
                        else
                          const SizedBox(height: MmSpace.s8),
                        for (final c in unit.chapters) ...[
                          MmSelectRow(title: c.name, selected: c.name == current, onTap: () => Navigator.of(sheet).pop(c.name)),
                          const SizedBox(height: MmSpace.s8),
                        ],
                      ],
                    ],
                  ),
                  loading: () => Padding(padding: const EdgeInsets.all(MmSpace.s32), child: Center(child: MmSpinner(color: colors.ink2))),
                  error: (_, _) => Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [const InlineBanner(message: InsightsCopy.chaptersFailed, tone: BannerTone.warning), const SizedBox(height: MmSpace.s12), all],
                  ),
                );
          },
        ),
      );

  Future<String?> _pickDifficulty(BuildContext context, String? current) => showMmSheet<String>(
        context: context,
        title: 'Difficulty',
        builder: (sheet) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (value, label) in const [('', InsightsCopy.difficultyAll), ('easy', InsightsCopy.easy), ('medium', InsightsCopy.medium), ('hard', InsightsCopy.hard)]) ...[
              MmSelectRow(title: label, selected: (current ?? '') == value, onTap: () => Navigator.of(sheet).pop(value)),
              const SizedBox(height: MmSpace.s8),
            ],
          ],
        ),
      );
}

class _FilterKey extends StatelessWidget {
  const _FilterKey({required this.label, required this.hint, required this.onTap, this.active = false});

  final String label;
  final String hint;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: '$hint: $label',
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Center(
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: active ? colors.selectedSurface : colors.raised,
              shape: StadiumBorder(side: active ? BorderSide(color: colors.ink, width: 1.5) : BorderSide(color: colors.line)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s8, MmSpace.s12, MmSpace.s8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ConstrainedBox(
                    // Wide enough for a whole chapter name on one line at normal text.
                    constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 2 * MmSpace.gutter - 56),
                    child: Text(label, style: type.label.copyWith(color: colors.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: MmSpace.s4),
                  Icon(LucideIcons.chevronDown, size: 16, color: colors.ink2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
