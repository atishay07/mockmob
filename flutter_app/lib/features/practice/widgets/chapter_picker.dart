import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/models/subject.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import '../model/practice_selection.dart';

/// The chapters field of chapter practice: a labelled row that opens the chapter list and says
/// what is chosen ("Goodwill and Issue of shares"). The names are never truncated.
class ChapterField extends StatelessWidget {
  const ChapterField({super.key, required this.chapters, required this.onTap});

  final List<String> chapters;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chosen = chapters.isNotEmpty;
    final text = chosen ? PracticeCopy.chaptersSummary(chapters) : PracticeCopy.chooseChapter;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(PracticeCopy.chapterLabel, style: type.label.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        MmPressable(
          onTap: onTap,
          focusRadius: MmRadius.keyAll,
          pressedScale: 0.985,
          haptic: MmPressHaptic.selection,
          semanticsLabel: '${PracticeCopy.chapterLabel}, $text',
          builder: (context, pressed, _) => DecoratedBox(
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.raised,
              shape: RoundedSuperellipseBorder(
                borderRadius: MmRadius.keyAll,
                side: BorderSide(color: chosen ? colors.ink : colors.lineStrong, width: chosen ? 1.5 : 1),
              ),
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.option),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                child: Row(
                  children: [
                    Icon(LucideIcons.bookOpen, size: 18, color: chosen ? colors.ink : colors.ink2),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Text(text, style: type.labelLarge.copyWith(color: chosen ? colors.ink : colors.ink2)),
                    ),
                    if (chapters.length > 1) ...[
                      const SizedBox(width: MmSpace.s8),
                      Text('${chapters.length}', style: type.label.copyWith(color: colors.ink2)),
                    ],
                    const SizedBox(width: MmSpace.s8),
                    Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Opens the chapter list for [subjectId] and returns the chosen chapter names, or null when
/// the sheet is dismissed. Up to 12 chapters, grouped by unit, with search. A subject with a
/// comma in a chapter name takes one chapter: a tap picks it and closes the sheet.
Future<List<String>?> showChapterPicker(BuildContext context, {required String subjectId, List<String> selected = const []}) {
  final chosen = ValueNotifier<List<String>>([...selected]);
  final multi = ValueNotifier<bool>(true);
  return showMmSheet<List<String>>(
    context: context,
    title: PracticeCopy.chooseChapterTitle,
    heightFactor: 0.86,
    builder: (sheetContext) =>
        ChapterList(subjectId: subjectId, chosen: chosen, multi: multi, onSingle: (name) => Navigator.of(sheetContext).pop([name])),
    footer: (sheetContext) => _UseKey(chosen: chosen, multi: multi, onUse: () => Navigator.of(sheetContext).pop(chosen.value)),
  ).whenComplete(() {
    chosen.dispose();
    multi.dispose();
  });
}

class _UseKey extends StatelessWidget {
  const _UseKey({required this.chosen, required this.multi, required this.onUse});

  final ValueNotifier<List<String>> chosen;
  final ValueNotifier<bool> multi;
  final VoidCallback onUse;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([chosen, multi]),
    builder: (context, _) {
      final n = chosen.value.length;
      return KeyButton(
        label: multi.value ? PracticeCopy.useChapters(n) : PracticeCopy.useChapters(n.clamp(0, 1)),
        onPressed: n == 0 ? null : onUse,
      );
    },
  );
}

/// The searchable, unit-grouped chapter list. [chosen] holds the picked names in the order they
/// were picked; [multi] turns false for a subject that takes one chapter.
class ChapterList extends ConsumerStatefulWidget {
  const ChapterList({super.key, required this.subjectId, required this.chosen, required this.multi, required this.onSingle});

  final String subjectId;
  final ValueNotifier<List<String>> chosen;
  final ValueNotifier<bool> multi;
  final ValueChanged<String> onSingle;

  @override
  ConsumerState<ChapterList> createState() => _ChapterListState();
}

class _ChapterListState extends ConsumerState<ChapterList> {
  String _query = '';

  void _toggle(String name, bool multi) {
    if (!multi) {
      widget.onSingle(name);
      return;
    }
    final list = [...widget.chosen.value];
    if (list.contains(name)) {
      list.remove(name);
    } else if (list.length < maxChapters) {
      list.add(name);
    }
    widget.chosen.value = list;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapters = ref.watch(practiceChaptersProvider(widget.subjectId));
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
            KeyButton.secondary(label: PracticeCopy.retry, onPressed: () => ref.invalidate(practiceChaptersProvider(widget.subjectId))),
          ],
        );
      },
      data: (catalog) {
        final multi = canMultiSelect(catalog.allChapters.map((c) => c.name));
        if (widget.multi.value != multi) {
          WidgetsBinding.instance.addPostFrameCallback((_) => widget.multi.value = multi);
        }
        return ListenableBuilder(
          listenable: widget.chosen,
          builder: (context, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SearchField(onChanged: (q) => setState(() => _query = q.trim().toLowerCase())),
              const SizedBox(height: MmSpace.s8),
              Text(multi ? PracticeCopy.chapterLimit : PracticeCopy.oneChapterOnly, style: type.small.copyWith(color: colors.ink3)),
              _Units(
                units: catalog.units,
                query: _query,
                chosen: widget.chosen.value,
                full: multi && widget.chosen.value.length >= maxChapters,
                onToggle: (name) => _toggle(name, multi),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(
      borderRadius: MmRadius.keyAll,
      borderSide: BorderSide(color: c, width: w),
    );
    return TextField(
      onChanged: onChanged,
      style: type.body,
      cursorColor: colors.ink,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: PracticeCopy.searchChapters,
        hintStyle: type.body.copyWith(color: colors.ink3),
        prefixIcon: Icon(LucideIcons.search, size: 18, color: colors.ink2),
        filled: true,
        fillColor: colors.raised,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
        enabledBorder: border(colors.lineStrong, 1),
        focusedBorder: border(colors.ink, 1.5),
      ),
    );
  }
}

class _Units extends StatelessWidget {
  const _Units({required this.units, required this.query, required this.chosen, required this.full, required this.onToggle});

  final List<ChapterUnit> units;
  final String query;
  final List<String> chosen;

  /// Twelve are chosen: the others cannot be added.
  final bool full;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final children = <Widget>[];
    for (final unit in units) {
      final rows = [
        for (final c in unit.chapters)
          if (query.isEmpty || c.name.toLowerCase().contains(query)) c,
      ];
      if (rows.isEmpty) continue;
      if (unit.name.isNotEmpty) {
        children.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s20, MmSpace.s4, MmSpace.s4),
            child: Semantics(
              header: true,
              child: Text(unit.name, style: type.label.copyWith(color: colors.ink3)),
            ),
          ),
        );
      }
      for (final c in rows) {
        final picked = chosen.contains(c.name);
        children.add(_ChapterRow(name: c.name, selected: picked, enabled: picked || !full, onTap: () => onToggle(c.name)));
      }
    }
    if (children.isEmpty) {
      children.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s24),
          child: Text(PracticeCopy.noChapterMatch, style: type.body.copyWith(color: colors.ink2)),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({required this.name, required this.selected, required this.enabled, required this.onTap});

  final String name;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: enabled ? onTap : null,
      semanticsLabel: name,
      selected: selected,
      focusRadius: MmRadius.keyAll,
      pressedScale: 0.985,
      haptic: MmPressHaptic.selection,
      highlight: true,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 52),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: type.body.copyWith(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    color: enabled ? colors.ink : colors.ink3,
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              // The bubble is the selection state: filled when this chapter is in the session.
              Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
