import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/models/subject.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../../../core/motion/motion.dart';
import '../data/practice_catalog.dart';
import '../data/suggestion.dart' show RecordChapter, practiceRecordChaptersProvider;
import '../model/practice_selection.dart';

/// The chapters field of chapter practice. With nothing chosen it is one labelled row that opens
/// the chapter list. Once chapters are chosen they show once, as removable chips, and the row
/// under them becomes "Add chapters" (a summary row above the same chips said each chapter twice,
/// Design critic 19). The names are never truncated.
class ChapterField extends StatelessWidget {
  const ChapterField({super.key, required this.chapters, required this.onTap, this.onRemove});

  final List<String> chapters;
  final VoidCallback onTap;

  /// Removes one chosen chapter (the chip's own key). Null shows the names in the row, without chips.
  final ValueChanged<String>? onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chosen = chapters.isNotEmpty;
    final chips = chosen && onRemove != null;
    final text = chips
        ? (chapters.length >= maxChapters ? PracticeCopy.editChapters : PracticeCopy.addChapters)
        : (chosen ? PracticeCopy.chaptersSummary(chapters) : PracticeCopy.chooseChapter);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(PracticeCopy.chapterLabel, style: type.label.copyWith(color: colors.ink2))),
            // The count with its denominator, once there is more than one to count.
            if (chapters.length > 1) _CountBadge(count: chapters.length, style: type.label.copyWith(color: colors.ink2)),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        if (chips) ...[
          ChosenChapterChips(chapters: chapters, onRemove: onRemove!),
          const SizedBox(height: MmSpace.s8),
        ],
        MmPressable(
          onTap: onTap,
          focusRadius: MmRadius.keyAll,
          pressedScale: 0.985,
          haptic: MmPressHaptic.selection,
          semanticsLabel: chips ? text : '${PracticeCopy.chapterLabel}, $text',
          builder: (context, pressed, _) => DecoratedBox(
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.raised,
              shape: RoundedSuperellipseBorder(
                borderRadius: MmRadius.keyAll,
                // A quiet edge in both states: the volt Start key is the loudest thing on the page.
                side: BorderSide(color: colors.lineStrong),
              ),
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.option),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                child: Row(
                  children: [
                    Icon(chips ? LucideIcons.plus : LucideIcons.bookOpen, size: 18, color: chosen && !chips ? colors.ink : colors.ink2),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Text(text, style: type.labelLarge.copyWith(color: chosen && !chips ? colors.ink : colors.ink2)),
                    ),
                    if (!chips && chapters.length > 1) ...[
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

/// The chosen count against the most one session takes ("3 of 12"): it rolls (the new figure rises
/// into place as it fades in, no scale) each time it changes, never on first show. Nothing under reduced motion.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count, required this.style});

  final int count;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final duration = Motion.of(context, Motion.card);
    return Semantics(
      label: PracticeCopy.chaptersChosenSemantics(count, maxChapters),
      excludeSemantics: true,
      child: AnimatedSwitcher(
        duration: duration,
        layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerRight, children: [...previous, ?current]),
        // The count rolls (the new figure rises a little into place as it fades in), no scale and
        // no overshoot: numbers never wobble (APP-PASS AP2-07, M14; standards s10 item 6, T-105).
        transitionBuilder: (child, a) => ClipRect(
          child: SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 0.45), end: Offset.zero).chain(CurveTween(curve: Motion.out)).animate(a),
            child: FadeTransition(opacity: a, child: child),
          ),
        ),
        child: Text(PracticeCopy.chaptersChosen(count, maxChapters), key: ValueKey(count), style: style),
      ),
    );
  }
}

/// The chosen chapters as chips under the field, each with its own remove key. A chip scales in
/// (0.85 to 1, fading up) when a chapter is chosen and fades out when it is removed or the
/// session leaves it: removal waits for the fade before the chip leaves the row.
class ChosenChapterChips extends StatefulWidget {
  const ChosenChapterChips({super.key, required this.chapters, required this.onRemove});

  final List<String> chapters;
  final ValueChanged<String> onRemove;

  @override
  State<ChosenChapterChips> createState() => _ChosenChapterChipsState();
}

class _ChosenChapterChipsState extends State<ChosenChapterChips> {
  /// Names shown, in the order chosen, including those fading out.
  late List<String> _shown = [...widget.chapters];

  @override
  void didUpdateWidget(ChosenChapterChips old) {
    super.didUpdateWidget(old);
    // A chosen chapter not shown yet is appended in the order the selection gives; the ones that
    // left stay as they are until their fade ends.
    for (final c in widget.chapters) {
      if (!_shown.contains(c)) _shown.add(c);
    }
  }

  void _gone(String name) {
    if (!mounted || widget.chapters.contains(name)) return;
    setState(() => _shown = [..._shown]..remove(name));
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s8,
      children: [
        for (final name in _shown)
          _ChapterChip(
            key: ValueKey(name),
            name: name,
            leaving: !widget.chapters.contains(name),
            onRemove: () => widget.onRemove(name),
            onGone: () => _gone(name),
          ),
      ],
    );
  }
}

class _ChapterChip extends StatefulWidget {
  const _ChapterChip({super.key, required this.name, required this.leaving, required this.onRemove, required this.onGone});

  final String name;
  final bool leaving;
  final VoidCallback onRemove;
  final VoidCallback onGone;

  @override
  State<_ChapterChip> createState() => _ChapterChipState();
}

class _ChapterChipState extends State<_ChapterChip> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void didUpdateWidget(_ChapterChip old) {
    super.didUpdateWidget(old);
    if (!old.leaving && widget.leaving) {
      if (Motion.reduced(context)) {
        // Gone at once, but after this build: the row is rebuilding right now.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) widget.onGone();
        });
        WidgetsBinding.instance.ensureVisualUpdate();
      } else {
        _c.reverse().whenComplete(() {
          if (mounted) widget.onGone();
        });
      }
    } else if (old.leaving && !widget.leaving) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return FadeTransition(
      opacity: _c,
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.85, end: 1).chain(CurveTween(curve: Motion.out)).animate(_c),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 300),
          child: MmPressable(
            onTap: widget.leaving ? null : widget.onRemove,
            semanticsLabel: 'Remove ${widget.name}',
            focusRadius: MmRadius.smallAll,
            pressedScale: 0.97,
            haptic: MmPressHaptic.selection,
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: pressed ? colors.raised2 : colors.sunken,
                  shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.line)),
                ),
                child: Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(child: Text(widget.name, style: type.label.copyWith(color: colors.ink), maxLines: 2, overflow: TextOverflow.ellipsis)),
                      const SizedBox(width: MmSpace.s8),
                      Icon(LucideIcons.x, size: 16, color: colors.ink2),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
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

  /// Bumped by each tap on a chapter past the cap: the limit line shakes once for each, with the
  /// kit's refusal haptic ([MmShake]).
  final ValueNotifier<int> _capTaps = ValueNotifier(0);

  @override
  void dispose() {
    _capTaps.dispose();
    super.dispose();
  }

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
    } else {
      // At the cap: nothing is added. The line that says why shakes (and says it, as always).
      setState(() => _capTaps.value++);
      return;
    }
    widget.chosen.value = list;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapters = ref.watch(practiceChaptersProvider(widget.subjectId));
    return _SolidGround(
      child: chapters.when(
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
                MmShake(
                  pulse: _capTaps,
                  child: Text(
                    multi ? PracticeCopy.chapterLimit : PracticeCopy.oneChapterOnly,
                    style: type.small.copyWith(color: _capTaps.value > 0 && widget.chosen.value.length >= maxChapters ? colors.ink : colors.ink3),
                  ),
                ),
                // While searching, the results come first: the shortcut chips repeat rows the list
                // has (and rarely match what was typed), and they pushed the matches under the keys.
                if (multi && _query.isEmpty) _RecordRow(subjectId: widget.subjectId, chosen: widget.chosen.value, onToggle: (name) => _toggle(name, multi)),
                ChapterUnitsList(
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
      ),
    );
  }
}

/// "From your record": up to three chapters that cost marks in the latest paper in this subject,
/// as chips that choose the chapter. Real chapters from the student's own paper, never a guess;
/// with no paper or no loss the row is not there at all.
class _RecordRow extends ConsumerWidget {
  const _RecordRow({required this.subjectId, required this.chosen, required this.onToggle});

  final String subjectId;
  final List<String> chosen;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chapters = ref.watch(practiceRecordChaptersProvider(subjectId));
    if (chapters.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(PracticeCopy.fromYourRecord, style: type.label.copyWith(color: colors.ink3))),
          const SizedBox(height: MmSpace.s8),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [for (final c in chapters) _RecordChip(chapter: c, picked: chosen.contains(c.chapter), onTap: () => onToggle(c.chapter))],
          ),
        ],
      ),
    );
  }
}

class _RecordChip extends StatelessWidget {
  const _RecordChip({required this.chapter, required this.picked, required this.onTap});

  final RecordChapter chapter;
  final bool picked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: MmPressable(
        onTap: onTap,
        selected: picked,
        semanticsLabel: PracticeCopy.recordChipSemantics(chapter.chapter, chapter.marksLost),
        focusRadius: MmRadius.smallAll,
        pressedScale: 0.97,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: MmSelection.fill(colors, selected: picked, pressed: pressed),
              shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: MmSelection.side(colors, selected: picked)),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(chapter.chapter, style: type.label.copyWith(color: colors.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
                  Text(PracticeCopy.recordChipMarks(chapter.marksLost), style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The chapter list on an opaque ground, edge to edge and down to the footer. The sheet's glass
/// lets the page behind it show through on Daylight, and a long list of rows over ghost shapes
/// reads as rendering noise; Night's glass is dark enough to hide them, so only Daylight needs it.
class _SolidGround extends StatelessWidget {
  const _SolidGround({required this.child});

  final Widget child;

  /// The sheet's side padding, which the ground runs past to the sheet's edge.
  static const double _bleed = MmSpace.s20;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (colors.isNight) return child;
    // About the sheet's body (86% of the screen less its handle, title and footer).
    final minHeight = MediaQuery.sizeOf(context).height * 0.86 - 230;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: -_bleed,
          right: -_bleed,
          top: 0,
          bottom: -_bleed,
          child: ColoredBox(color: colors.raised),
        ),
        ConstrainedBox(
          constraints: BoxConstraints(minHeight: minHeight),
          child: child,
        ),
      ],
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

/// A search string or a name as the picker compares them: lower case, "&" read as "and", and
/// anything that is not a letter or digit folded to one space ("Nature & Significance" and
/// "nature and significance" meet).
@visibleForTesting
String normalizeChapterQuery(String text) =>
    text.toLowerCase().replaceAll('&', ' and ').replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();

@visibleForTesting
class ChapterUnitsList extends StatelessWidget {
  const ChapterUnitsList({super.key, required this.units, required this.query, required this.chosen, required this.full, required this.onToggle});

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
    // A unit that only repeats its one chapter's name (Business Studies) has nothing to group, so
    // it gets no header. The test is per unit: one three-chapter unit must not bring the repeated
    // headers back for all the others.
    var afterHeaded = false;
    final q = normalizeChapterQuery(query);
    for (final unit in units) {
      // A unit that matches shows all its chapters; otherwise only the chapters that match.
      final unitHit = q.isNotEmpty && normalizeChapterQuery(unit.name).contains(q);
      final rows = [
        for (final c in unit.chapters)
          if (q.isEmpty || unitHit || normalizeChapterQuery(c.name).contains(q)) c,
      ];
      if (rows.isEmpty) continue;
      final repeatsChapter = unit.chapters.length <= 1 &&
          (unit.chapters.isEmpty || normalizeChapterQuery(unit.name) == normalizeChapterQuery(unit.chapters.first.name));
      final headed = unit.name.isNotEmpty && !repeatsChapter;
      if (!headed && afterHeaded) {
        // A bare row after a headed group keeps a gap, so it does not read as part of that group.
        children.add(const SizedBox(height: MmSpace.s12));
      }
      afterHeaded = headed;
      if (headed) {
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
      // Past the cap a row still answers (the limit line shakes); it only does not add.
      onTap: onTap,
      semanticsLabel: name,
      selected: selected,
      focusRadius: MmRadius.keyAll,
      pressedScale: 0.985,
      // A refused tap (past the cap) gets the refusal haptic from the shaking line, not a tick too.
      haptic: enabled ? MmPressHaptic.selection : MmPressHaptic.none,
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
