import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import 'home_copy.dart';
import 'home_entrance.dart';
import 'home_model.dart';
import 'state_ring.dart';

/// Learn home's chapter map (the web's ChapterMap.jsx): the book in order, grouped by part and unit. Every row has one
/// anatomy: the chapter's name and its card count on the first line, then the state ring and word and one true meta line.
/// The sort menu (Book order, Due first, Needs work first, and Marks open only when a chapter has a figure) is the only
/// control in its head. The part choice (LK2) is drawn at the option unit: the tapped side stays chosen at once, only
/// that unit cross-fades inside a height ease, nothing above it moves or re-sorts, rows are keyed by chapter, and a failed
/// save slides the indicator back with one line.
class ChapterMap extends StatefulWidget {
  const ChapterMap({super.key, required this.parts, required this.onOpen, required this.onSaveOption, this.firstIndex = 0});

  final List<LearnPart> parts;

  /// A row was tapped: open the chapter page of this key.
  final ValueChanged<String> onOpen;

  /// Saves the part choice and reads the home again; true when the server's new body says the choice stuck.
  final Future<bool> Function(LearnPart part, String optionId) onSaveOption;

  /// The entrance slot of the map's head (the rows follow it; see [HomeRise]).
  final int firstIndex;

  @override
  State<ChapterMap> createState() => _ChapterMapState();
}

enum _Save { idle, saving, failed }

class _ChapterMapState extends State<ChapterMap> {
  String _sort = 'book';
  final Map<String, String> _local = {};
  final Map<String, _Save> _status = {};
  final Set<String> _saving = {};

  @override
  void didUpdateWidget(ChapterMap old) {
    super.didUpdateWidget(old);
    // A held choice is dropped once the body that says so is on screen, so nothing flashes back.
    for (final part in widget.parts) {
      if (_local[part.id] != null && part.option?.chosen == _local[part.id]) _local.remove(part.id);
    }
  }

  Future<void> _choose(LearnPart part, String id) async {
    final now = HomeModel.effectiveChoice(part, _local);
    if (id == now || _saving.contains(part.id)) return;
    _saving.add(part.id);
    setState(() {
      _local[part.id] = id;
      _status[part.id] = _Save.saving;
    });
    var agreed = false;
    try {
      agreed = await widget.onSaveOption(part, id);
    } on Object {
      agreed = false;
    }
    _saving.remove(part.id);
    if (!mounted) return;
    if (agreed) {
      setState(() => _status[part.id] = _Save.idle);
      return;
    }
    // Not agreed: the held choice is dropped now, the indicator slides back and one line says why.
    setState(() {
      _local.remove(part.id);
      _status[part.id] = _Save.failed;
    });
  }

  Future<void> _openSort(List<HomeSort> items, String active) async {
    final picked = await showMmSheet<String>(
      context: context,
      title: HomeCopy.sortTitle,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final item in items) ...[
              KeyButton.option(
                key: ValueKey('lh-sort-${item.id}'),
                label: item.label,
                selected: item.id == active,
                onPressed: () => Navigator.of(sheet).pop(item.id),
              ),
              const SizedBox(height: MmSpace.s8),
            ],
          ],
        ),
      ),
    );
    if (picked != null && mounted) setState(() => _sort = picked);
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final parts = widget.parts;
    var slot = widget.firstIndex;

    final head = HomeRise(
      index: slot++,
      child: _MapHead(
        sort: parts.isEmpty ? null : HomeModel.sortsFor(parts),
        active: _sort,
        onSort: (items, active) => unawaited(_openSort(items, active)),
      ),
    );

    if (parts.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          head,
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: Text(HomeCopy.noChapters, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
          ),
        ],
      );
    }

    final sorts = HomeModel.sortsFor(parts);
    final active = sorts.any((s) => s.id == _sort) ? _sort : 'book';
    final fresh = HomeModel.allNotStarted(parts);
    final total = HomeModel.chapterTotal(parts);

    final body = <Widget>[];
    if (active != 'book') {
      final flat = HomeModel.sortRows(parts, active);
      body.add(
        _Rows(
          children: [
            for (final f in flat)
              HomeRise(
                index: slot++,
                child: _ChapterRow(
                  key: ValueKey('lh-row-${f.row.key}'),
                  row: f.row,
                  refLabel: f.row.ref ?? '',
                  marks: active == 'marks',
                  bare: fresh,
                  onTap: () => widget.onOpen(f.row.key),
                ),
              ),
          ],
        ),
      );
    } else {
      for (var p = 0; p < parts.length; p++) {
        final part = parts[p];
        final firstOption = part.units.indexWhere((u) => u.optionId != null);
        final choice = HomeModel.effectiveChoice(part, _local);
        final units = <Widget>[];
        for (var i = 0; i < part.units.length; i++) {
          final unit = part.units[i];
          if (unit.optionId != null) {
            if (i != firstOption) continue;
            final option = part.option;
            if (option != null) {
              units.add(
                _PartSwitch(
                  key: ValueKey('lh-switch-${part.id}'),
                  part: part,
                  option: option,
                  choice: choice,
                  status: _status[part.id] ?? _Save.idle,
                  onChoose: (id) => unawaited(_choose(part, id)),
                ),
              );
            }
            final optionUnits = [for (final u in part.units) if (u.optionId != null) u];
            units.add(
              _OptionGroup(
                key: ValueKey('lh-options-${part.id}'),
                units: optionUnits,
                choice: choice,
                bare: fresh,
                onOpen: widget.onOpen,
                firstIndex: slot,
              ),
            );
            slot += optionUnits.fold(0, (n, u) => n + u.chapters.length);
            continue;
          }
          final unitSlot = slot;
          slot += unit.chapters.length;
          units.add(_UnitBlock(key: ValueKey('lh-unit-${part.id}-$i'), unit: unit, bare: fresh, onOpen: widget.onOpen, firstIndex: unitSlot, first: units.isEmpty));
        }
        body.add(
          Semantics(
            container: true,
            label: part.title,
            child: Padding(
              padding: EdgeInsets.only(top: p == 0 ? MmSpace.s8 : 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Semantics(header: true, child: Text(HomeModel.displayTitle(part.title), style: type.title.copyWith(fontSize: 17, height: 1.25, color: colors.ink))),
                  ),
                  ...units,
                ],
              ),
            ),
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        head,
        if (fresh)
          Padding(
            padding: const EdgeInsets.only(top: 2, bottom: 4),
            child: Text(HomeCopy.allNew(total), style: type.caption.copyWith(fontSize: 13.5, height: 1.45, color: colors.ink3)),
          ),
        ...body,
      ],
    );
  }
}

// ------------------------------------------------------------------------------------------------------------------ head

class _MapHead extends StatelessWidget {
  const _MapHead({required this.sort, required this.active, required this.onSort});

  final List<HomeSort>? sort;
  final String active;
  final void Function(List<HomeSort> items, String active) onSort;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final items = sort ?? const <HomeSort>[];
    final shown = items.any((s) => s.id == active) ? active : 'book';
    final current = items.where((s) => s.id == shown).firstOrNull;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 40),
      child: Row(
        children: [
          Expanded(child: Semantics(header: true, child: Text(HomeCopy.chapters, style: type.title.copyWith(fontSize: 20, height: 1.2, color: colors.ink)))),
          if (items.length > 1 && current != null)
            MmPressable(
              key: const ValueKey('lh-sort'),
              semanticsLabel: '${HomeCopy.sortLabel}${current.label}',
              focusRadius: MmRadius.smallAll,
              haptic: MmPressHaptic.selection,
              onTap: () => onSort(items, shown),
              builder: (context, pressed, _) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: MmTarget.min),
                child: Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s12),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(current.label, style: type.labelLarge.copyWith(fontSize: 14, color: colors.ink2)),
                      const SizedBox(width: 6),
                      Icon(LucideIcons.chevronDown, size: 16, color: colors.ink2),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------------------ units, rows

/// One unit: its heading (only when it says something the chapter's own name does not) and its rows.
class _UnitBlock extends StatelessWidget {
  const _UnitBlock({super.key, required this.unit, required this.bare, required this.onOpen, required this.firstIndex, this.first = false});

  final LearnPartUnit unit;
  final bool bare;
  final ValueChanged<String> onOpen;
  final int firstIndex;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final heading = HomeModel.unitHeading(unit);
    final refs = HomeModel.visibleRefs(unit.chapters);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (heading != null)
          Padding(
            padding: EdgeInsets.only(top: first ? 4 : 12, bottom: 4),
            child: Semantics(header: true, child: Text(HomeModel.displayTitle(heading), style: type.body.copyWith(fontSize: 13.5, height: 1.3, fontWeight: FontWeight.w600, color: colors.ink3))),
          ),
        _Rows(
          children: [
            for (var i = 0; i < unit.chapters.length; i++)
              HomeRise(
                index: firstIndex + i,
                child: _ChapterRow(
                  key: ValueKey('lh-row-${unit.chapters[i].key}'),
                  row: unit.chapters[i],
                  refLabel: refs[i],
                  bare: bare,
                  onTap: () => onOpen(unit.chapters[i].key),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Rows divided by hairlines: one at the top, one under every row.
class _Rows extends StatelessWidget {
  const _Rows({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final line = BorderSide(color: context.mmColors.line);
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final child in children) DecoratedBox(decoration: BoxDecoration(border: Border(bottom: line)), child: child),
        ],
      ),
    );
  }
}

/// A chapter of the map: name and card count, then the state ring and word and one true line. At least 64 dp, the whole
/// row is the target. A chapter with nothing to play says so, in ink-2.
class _ChapterRow extends StatelessWidget {
  const _ChapterRow({super.key, required this.row, required this.refLabel, required this.onTap, this.marks = false, this.bare = false});

  final LearnChapterRow row;
  final String refLabel;
  final VoidCallback onTap;
  final bool marks;

  /// Every chapter is "Not started": the rows draw no state.
  final bool bare;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shape = HomeModel.stateShape(row.state.key);
    final empty = HomeModel.nothingToPlay(row);
    final meta = HomeModel.metaLine(row);
    final cards = HomeModel.cardsText(row);
    final m = marks ? HomeModel.marksText(row) : '';
    final detail = [refLabel, meta].where((s) => s.isNotEmpty).join(', ');
    final showState = !bare && !empty;
    final stateColor = switch (shape) {
      'weak' => colors.warnText,
      'strong' => colors.goodText,
      'none' || 'thin' || 'unknown' => colors.ink3,
      _ => colors.ink2,
    };
    final subStyle = type.caption.copyWith(fontSize: 13, height: 1.4, fontWeight: FontWeight.w500, color: colors.ink2);
    return MmPressable(
      semanticsLabel: HomeModel.rowSpoken(row, marks: marks),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(
                          child: Text(
                            HomeModel.displayTitle(row.title),
                            style: type.body.copyWith(fontSize: 16, height: 1.35, fontWeight: FontWeight.w600, color: empty ? colors.ink2 : colors.ink),
                          ),
                        ),
                        if (m.isNotEmpty || cards.isNotEmpty) ...[
                          const SizedBox(width: MmSpace.s12),
                          if (m.isNotEmpty) ...[
                            Text(m, style: type.label.copyWith(fontSize: 13.5, height: 1.35, fontWeight: FontWeight.w700, color: colors.badText)),
                            const SizedBox(width: 10),
                          ],
                          if (cards.isNotEmpty) Text(cards, style: type.label.copyWith(fontSize: 13.5, height: 1.35, color: colors.ink2)),
                        ],
                      ],
                    ),
                    if (showState || detail.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 12,
                        runSpacing: 2,
                        children: [
                          if (showState)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                LearnStateRing(shape: shape, color: stateColor),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    row.state.label.isEmpty ? HomeCopy.notStarted : row.state.label,
                                    style: subStyle.copyWith(fontWeight: shape == 'unknown' ? FontWeight.w500 : FontWeight.w600, color: stateColor),
                                  ),
                                ),
                              ],
                            ),
                          if (detail.isNotEmpty) Text(detail, style: subStyle.copyWith(color: empty ? colors.ink3 : colors.ink2)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

// ----------------------------------------------------------------------------------------------------- the part switch

/// "Your part" with its choices: one sliding thumb; each choice says how many chapters it holds; the hint line keeps its
/// height, so saving, failing and the plain hint never move what is below it.
class _PartSwitch extends StatelessWidget {
  const _PartSwitch({super.key, required this.part, required this.option, required this.choice, required this.status, required this.onChoose});

  final LearnPart part;
  final LearnPartOption option;
  final String? choice;
  final _Save status;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final choices = option.choices;
    final index = choices.indexWhere((c) => c.id == choice);
    final failed = status == _Save.failed;
    final hint = switch (status) {
      _Save.saving => HomeCopy.partSaving,
      _Save.failed => HomeCopy.partFailed,
      _Save.idle => option.hint ?? (choice != null ? HomeCopy.partChosen : HomeCopy.partNone),
    };
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(option.label, style: type.label.copyWith(fontSize: 13.5, height: 1.3, fontWeight: FontWeight.w600, color: colors.ink3)),
          const SizedBox(height: 8),
          Semantics(
            container: true,
            label: option.label,
            child: DecoratedBox(
              decoration: ShapeDecoration(
                color: colors.sunken,
                shape: RoundedSuperellipseBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: colors.line)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: AnimatedOpacity(
                        duration: Motion.of(context, const Duration(milliseconds: 160)),
                        curve: Motion.out,
                        opacity: index >= 0 ? 1 : 0,
                        child: MmSlidingIndicator(
                          index: math.max(index, 0),
                          count: choices.length,
                          fillHeight: true,
                          child: DecoratedBox(
                            decoration: ShapeDecoration(
                              color: colors.selectedSurface,
                              shape: RoundedSuperellipseBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: colors.lineStrong)),
                              shadows: colors.cardShadow,
                            ),
                          ),
                        ),
                      ),
                    ),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final c in choices)
                            Expanded(
                              child: _PartChoice(
                                key: ValueKey('lh-choice-${c.id}'),
                                label: c.label,
                                chapters: HomeModel.optionChapterCount(part.units, c.id),
                                chosen: choice == c.id,
                                onTap: () => onChoose(c.id),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // The hint keeps two lines of room: "Saving your choice" and the failure take its place without a jump.
          ConstrainedBox(
            constraints: BoxConstraints(minHeight: scaler.scale(39)),
            child: Semantics(
              liveRegion: true,
              child: Text(
                hint,
                key: const ValueKey('lh-part-hint'),
                style: type.caption.copyWith(fontSize: 13, height: 1.5, fontWeight: failed ? FontWeight.w600 : FontWeight.w500, color: failed ? colors.badText : colors.ink3),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PartChoice extends StatelessWidget {
  const _PartChoice({super.key, required this.label, required this.chapters, required this.chosen, required this.onTap});

  final String label;
  final int chapters;
  final bool chosen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: chapters > 0 ? '$label, ${HomeModel.plural(chapters, 'chapter')}' : label,
      selected: chosen,
      inMutuallyExclusiveGroup: true,
      focusRadius: BorderRadius.circular(10),
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                textAlign: TextAlign.center,
                style: type.body.copyWith(fontSize: 14.5, height: 1.25, fontWeight: chosen ? FontWeight.w700 : FontWeight.w600, color: chosen ? colors.ink : colors.ink2),
              ),
              if (chapters > 0) ...[
                const SizedBox(height: 2),
                Text(HomeModel.plural(chapters, 'chapter'), style: type.caption.copyWith(fontSize: 12.5, height: 1.3, color: colors.ink3)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------- the option units

/// The option units of a part, swapped as the part choice changes: the units on show fade out (160 ms), the other part's
/// fade in (220 ms), and the box eases its height (240 ms). The units are all known already, so nothing waits for the
/// server: the swap is a timed cross-fade between two drawn states. While it runs the old rows keep their place, faded and
/// untouchable, so nothing below moves early.
class _OptionGroup extends StatefulWidget {
  const _OptionGroup({super.key, required this.units, required this.choice, required this.bare, required this.onOpen, required this.firstIndex});

  final List<LearnPartUnit> units;
  final String? choice;
  final bool bare;
  final ValueChanged<String> onOpen;
  final int firstIndex;

  @override
  State<_OptionGroup> createState() => _OptionGroupState();
}

class _OptionGroupState extends State<_OptionGroup> with SingleTickerProviderStateMixin {
  static const Duration _outTime = Duration(milliseconds: 160);
  static const Duration _inTime = Duration(milliseconds: 220);
  static const Duration _heightTime = Duration(milliseconds: 240);

  late List<LearnPartUnit> _shown = _target;
  late final AnimationController _fade = AnimationController(vsync: this, value: 1);
  bool _out = false;
  Timer? _timer;
  DateTime _outAt = DateTime.now();

  List<LearnPartUnit> get _target => HomeModel.shownOptionUnits(widget.units, widget.choice);

  @override
  void didUpdateWidget(_OptionGroup old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final target = _target;
    if (HomeModel.unitsSignature(target) == HomeModel.unitsSignature(_shown)) {
      // Back to what is drawn (a failed save, or a read that changed nothing): fade it back in.
      _timer?.cancel();
      _shown = target;
      if (_out) {
        _out = false;
        _fade.animateTo(1, duration: Motion.of(context, _inTime), curve: Motion.out);
      }
      return;
    }
    if (Motion.reduced(context)) {
      _timer?.cancel();
      _out = false;
      _fade.value = 1;
      _shown = target;
      return;
    }
    if (!_out) {
      _out = true;
      _outAt = DateTime.now();
      _fade.animateTo(0, duration: _outTime, curve: Motion.leave);
    }
    _timer?.cancel();
    // The other part's rows have not arrived: hold, faded.
    if (target.isEmpty) return;
    final wait = _outTime - DateTime.now().difference(_outAt);
    _timer = Timer(wait.isNegative ? Duration.zero : wait, _swap);
  }

  void _swap() {
    if (!mounted) return;
    setState(() {
      _shown = _target;
      _out = false;
    });
    _fade.animateTo(1, duration: _inTime, curve: Motion.out);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    var slot = widget.firstIndex;
    final blocks = <Widget>[];
    for (var i = 0; i < _shown.length; i++) {
      final unit = _shown[i];
      blocks.add(_UnitBlock(key: ValueKey('${unit.optionId}:${unit.title}'), unit: unit, bare: widget.bare, onOpen: widget.onOpen, firstIndex: slot, first: i == 0));
      slot += unit.chapters.length;
    }
    return MmSizeEase(
      duration: _heightTime,
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: FadeTransition(
        opacity: _fade,
        child: IgnorePointer(
          ignoring: _out,
          child: ExcludeSemantics(
            excluding: _out,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: blocks),
          ),
        ),
      ),
    );
  }
}

// ----------------------------------------------------------------------------------------------------- loading, failing

/// The map before its data, at its final shape: the head and eight rows of 64.
class ChapterMapSkeleton extends StatelessWidget {
  const ChapterMapSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(alignment: Alignment.centerLeft, child: Skeleton(width: 130, height: 26, radius: 8)),
        const SizedBox(height: 12),
        for (var i = 0; i < 8; i++) ...[
          if (i > 0) const SizedBox(height: 1),
          const Skeleton(height: 64, radius: 0),
        ],
      ],
    );
  }
}

/// "Learn did not load": its own words and one key, in the place the blocks would stand. The subject row and the field
/// above stay usable.
class HomeLoadError extends StatelessWidget {
  const HomeLoadError({super.key, required this.onRetry, this.busy = false});

  final VoidCallback onRetry;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(HomeCopy.errorTitle, style: type.title.copyWith(fontSize: 18, height: 1.25, color: colors.ink)),
              const SizedBox(height: 8),
              Text(HomeCopy.errorLine, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
              const SizedBox(height: 16),
              KeyButton.secondary(label: HomeCopy.tryAgain, expanded: false, minHeight: MmTarget.min, loading: busy, onPressed: busy ? null : onRetry),
            ],
          ),
        ),
      ),
    );
  }
}
