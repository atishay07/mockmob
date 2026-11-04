import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import '../learn2_pill.dart';
import 'home_copy.dart';
import 'home_entrance.dart';
import 'home_model.dart';

/// Learn home's "Your roadmap" (the web's ChapterMap.jsx, R2 ruling 2, R3 R5, R4 ui-correctness#1 and ruling V): the book in order,
/// grouped by part and unit. Every row has one anatomy: the chapter's name, one coverage line ("31 of 46 cards seen · 4 of 10
/// questions tried", or "45 cards · 10 questions" before it is started; the chapter's real size on Free and Pro alike) and, once
/// started, a 3 dp bar of the cards seen. The only verdict word is "Needs work" ("Needs work, from your papers" when the evidence is
/// only papers); the chapter the student is in carries a volt "Start here" (a new student) or "Up next". No state ring, no
/// percentage, never "mastered", never a zero.
///
/// The sort menu (Book order, Needs work first) is the only control in its head. Free says "5 Key cards free in each chapter" once,
/// under it, never on a row. Chapters with no cards are not drawn. The part choice (LK2) is one block under the part's heading: the
/// line "Part 2 has two options. Pick the one your school teaches.", the two pills (the chosen one is filled, with a check), and the
/// line that says which option shows until one is picked. The tapped side stays chosen at once, only that unit cross-fades inside a
/// height ease, rows are keyed by chapter, and a failed save slides back with one line.
class ChapterMap extends StatefulWidget {
  const ChapterMap({
    super.key,
    required this.parts,
    required this.onOpen,
    required this.onSaveOption,
    this.isPro = true,
    this.position,
    this.isNew = false,
    this.firstIndex = 0,
  });

  final List<LearnPart> parts;

  /// A row was tapped: open the chapter page of this key.
  final ValueChanged<String> onOpen;

  /// Saves the part choice and reads the home again; true when the server's new body says the choice stuck.
  final Future<bool> Function(LearnPart part, String optionId) onSaveOption;

  /// Free says "5 Key cards free in each chapter" once in the header.
  final bool isPro;

  /// The chapter the student is in (the offer's position): its row carries "Start here" or "Up next".
  final String? position;

  /// A student with nothing started: the chapter they are in reads "Start here", else "Up next".
  final bool isNew;

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

  late List<LearnPart> _parts = HomeModel.playableParts(widget.parts);

  @override
  void didUpdateWidget(ChapterMap old) {
    super.didUpdateWidget(old);
    if (!identical(old.parts, widget.parts)) _parts = HomeModel.playableParts(widget.parts);
    // A held choice is dropped once the body that says so is on screen, so nothing flashes back.
    for (final part in _parts) {
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
    // Not agreed: the held choice is dropped now, the pill slides back and one line says why.
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

  /// "Start here" or "Up next" for the chapter the student is in, else null.
  String? _hereOf(String key) => widget.position == key ? (widget.isNew ? HomeCopy.hereNew : HomeCopy.hereNext) : null;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final parts = _parts;
    var slot = widget.firstIndex;

    final sorts = parts.isEmpty ? const <HomeSort>[] : HomeModel.mapSorts(parts);
    final active = sorts.any((s) => s.id == _sort) ? _sort : 'book';
    final head = HomeRise(
      index: slot++,
      child: _MapHead(sort: sorts, active: active, onSort: (items, current) => unawaited(_openSort(items, current))),
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

    final free = HomeModel.freeEach([for (final f in HomeModel.flatRows(parts)) f.row], widget.isPro);

    final body = <Widget>[];
    if (active != 'book') {
      final flat = HomeModel.sortRows(parts, active);
      body.add(
        _Rows(
          children: [
            for (final (i, f) in flat.indexed)
              (rail) => HomeRise(
                    index: slot + i,
                    child: _ChapterRow(key: ValueKey('lh-row-${f.row.key}'), row: f.row, here: _hereOf(f.row.key), rail: rail, onTap: () => widget.onOpen(f.row.key)),
                  ),
          ],
        ),
      );
    } else {
      for (var p = 0; p < parts.length; p++) {
        final part = parts[p];
        final firstOption = part.units.indexWhere((u) => u.optionId != null);
        final choice = HomeModel.effectiveChoice(part, _local);
        // The picked option has no chapter with cards at all: one line says so. Both showing (nothing picked) never does.
        final optionEmpty = part.option != null && choice != null && choice.isNotEmpty && HomeModel.shownOptionUnits([for (final u in part.units) if (u.optionId != null) u], choice).isEmpty;
        final units = <Widget>[];
        for (var i = 0; i < part.units.length; i++) {
          final unit = part.units[i];
          if (unit.optionId != null) {
            if (i != firstOption) continue;
            final optionUnits = [for (final u in part.units) if (u.optionId != null) u];
            units.add(
              _OptionGroup(
                key: ValueKey('lh-options-${part.id}'),
                units: optionUnits,
                choice: choice,
                here: _hereOf,
                onOpen: widget.onOpen,
                firstIndex: slot,
              ),
            );
            slot += optionUnits.fold(0, (n, u) => n + u.chapters.length);
            continue;
          }
          final unitSlot = slot;
          slot += unit.chapters.length;
          units.add(_UnitBlock(key: ValueKey('lh-unit-${part.id}-$i'), unit: unit, here: _hereOf, onOpen: widget.onOpen, firstIndex: unitSlot, first: units.isEmpty));
        }
        if (optionEmpty) {
          units.add(
            Padding(
              padding: const EdgeInsets.only(top: 14, bottom: 6),
              child: Text(
                HomeModel.optionComing,
                key: const ValueKey('lh-option-coming'),
                style: type.body.copyWith(fontSize: 14.5, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2),
              ),
            ),
          );
        }
        body.add(
          Semantics(
            container: true,
            label: part.title,
            child: Padding(
              padding: EdgeInsets.only(top: p == 0 ? MmSpace.s12 : MmSpace.group),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Semantics(header: true, child: Text(HomeModel.displayTitle(part.title), style: type.title.copyWith(fontSize: 20, height: 1.2, letterSpacing: -0.02 * 20, color: colors.ink))),
                  ),
                  if (part.option != null)
                    _PartSwitch(
                      key: ValueKey('lh-switch-${part.id}'),
                      part: part,
                      at: p,
                      option: part.option!,
                      choice: choice,
                      status: _status[part.id] ?? _Save.idle,
                      onChoose: (id) => unawaited(_choose(part, id)),
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
        if (free != null)
          Padding(
            padding: const EdgeInsets.only(top: 2, bottom: 4),
            child: Text(free, key: const ValueKey('lh-free-each'), style: type.caption.copyWith(fontSize: 13.5, height: 1.45, color: colors.ink3)),
          ),
        ...body,
      ],
    );
  }
}

// ------------------------------------------------------------------------------------------------------------------ head

class _MapHead extends StatelessWidget {
  const _MapHead({required this.sort, required this.active, required this.onSort});

  final List<HomeSort> sort;
  final String active;
  final void Function(List<HomeSort> items, String active) onSort;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = sort.any((s) => s.id == active) ? active : 'book';
    final current = sort.where((s) => s.id == shown).firstOrNull;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 40),
      child: Row(
        children: [
          Expanded(child: Semantics(header: true, child: Text(HomeCopy.roadmap, style: type.title.copyWith(fontSize: 20, height: 1.2, color: colors.ink)))),
          if (sort.length > 1 && current != null)
            MmPressable(
              key: const ValueKey('lh-sort'),
              semanticsLabel: '${HomeCopy.sortLabel}${current.label}',
              focusRadius: MmRadius.smallAll,
              haptic: MmPressHaptic.selection,
              onTap: () => onSort(sort, shown),
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

/// One unit: its heading (only when it says something the chapter's own name does not) and its rows on one path.
class _UnitBlock extends StatelessWidget {
  const _UnitBlock({super.key, required this.unit, required this.here, required this.onOpen, required this.firstIndex, this.first = false});

  final LearnPartUnit unit;
  final String? Function(String key) here;
  final ValueChanged<String> onOpen;
  final int firstIndex;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final heading = HomeModel.unitHeading(unit);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (heading != null)
          Padding(
            padding: EdgeInsets.only(top: first ? 6 : 18, bottom: 2),
            child: Semantics(
              header: true,
              child: Text(HomeModel.displayTitle(heading), style: type.body.copyWith(fontSize: 13, height: 1.35, fontWeight: FontWeight.w600, color: colors.ink3)),
            ),
          ),
        _Rows(
          children: [
            for (var i = 0; i < unit.chapters.length; i++)
              (rail) => HomeRise(
                    index: firstIndex + i,
                    child: _ChapterRow(
                      key: ValueKey('lh-row-${unit.chapters[i].key}'),
                      row: unit.chapters[i],
                      here: here(unit.chapters[i].key),
                      rail: rail,
                      onTap: () => onOpen(unit.chapters[i].key),
                    ),
                  ),
          ],
        ),
      ],
    );
  }
}

/// Where a row sits on its unit's path: the rail runs down from the first node to the last (C-LEARN-CALM 2.4).
enum _Rail { alone, first, middle, last }

/// Rows on one path: no hairlines; each row is told where it sits so the 2 dp rail joins its node to the next.
class _Rows extends StatelessWidget {
  const _Rows({required this.children});

  final List<Widget Function(_Rail rail)> children;

  @override
  Widget build(BuildContext context) {
    final n = children.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < n; i++)
          children[i](n == 1 ? _Rail.alone : (i == 0 ? _Rail.first : (i == n - 1 ? _Rail.last : _Rail.middle))),
      ],
    );
  }
}

/// A chapter of the roadmap (C-LEARN-CALM 2.4): a node with the chapter's place number and, once started, the arc of the cards seen
/// (the coverage the 3 dp bar showed, never mastery); beside it the name with its tag ("Up next" or "Start here" in volt, else the one
/// verdict "Needs work") and one coverage line. The chapter the student is in has a volt node. At least 64 dp; the whole row is the
/// target; pressed, the row takes the veil and the node gives a little.
class _ChapterRow extends StatelessWidget {
  const _ChapterRow({super.key, required this.row, required this.here, required this.onTap, this.rail = _Rail.alone});

  final LearnChapterRow row;
  final String? here;
  final VoidCallback onTap;
  final _Rail rail;

  /// The node's size and where its centre sits from the row's top.
  static const double node = 36;
  static const double nodeTop = 12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = HomeModel.roadmapRow(row);
    final line = view.line.isNotEmpty ? view.line : HomeModel.metaLine(row);
    final verdict = view.verdict;
    final parts = verdict?.split(', ');
    const centre = nodeTop + node / 2;
    return MmPressable(
      semanticsLabel: HomeModel.rowSpoken(row, here: here),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.985,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => Stack(
        children: [
          if (rail != _Rail.alone)
            Positioned(
              left: MmSpace.s4 + node / 2 - 1,
              width: 2,
              top: rail == _Rail.first ? centre : 0,
              bottom: rail == _Rail.last ? null : 0,
              height: rail == _Rail.last ? centre : null,
              child: ColoredBox(color: colors.line),
            ),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s4, 0, MmSpace.s4, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: nodeTop, bottom: nodeTop),
                    child: AnimatedScale(
                      scale: pressed ? 0.9 : 1,
                      duration: Motion.of(context, const Duration(milliseconds: 100)),
                      curve: Motion.out,
                      child: _Node(key: view.seen > 0 ? const ValueKey('lh-node-arc') : null, place: row.place?.n, share: view.seen > 0 ? view.share : 0, here: here != null),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(HomeModel.displayTitle(row.title), style: type.body.copyWith(fontSize: 16, height: 1.35, fontWeight: FontWeight.w700, color: colors.ink)),
                              if (here != null)
                                LearnPill(label: here!, tone: LearnPillTone.here)
                              else if (parts != null)
                                LearnPill(label: parts.first, trailing: parts.length > 1 ? parts.skip(1).join(', ') : null, tone: LearnPillTone.warn),
                            ],
                          ),
                          if (line.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              line,
                              style: type.body.copyWith(fontSize: 13.5, height: 1.4, fontWeight: FontWeight.w500, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Padding(
                    padding: const EdgeInsets.only(top: centre - 8),
                    child: Icon(LucideIcons.chevronRight, size: 16, color: colors.ink4),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The row's node: the place number in a circle on the ground (so the rail stops at its edge), a quiet ring, and the arc of the
/// cards seen drawn over it once in 600 ms (at rest under reduced motion). The chapter the student is in is a filled volt disc.
/// Without a place the node is a small dot. Decorative to a screen reader (the row speaks for itself).
class _Node extends StatelessWidget {
  const _Node({super.key, required this.place, required this.share, required this.here});

  final int? place;
  final double share;
  final bool here;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const size = _ChapterRow.node;
    final number = place == null
        ? Container(width: 8, height: 8, decoration: BoxDecoration(color: here ? colors.voltInk : colors.ink3, shape: BoxShape.circle))
        : Text(
            '$place',
            style: type.label.copyWith(
              fontSize: 14,
              height: 1,
              fontWeight: FontWeight.w800,
              color: here ? colors.voltInk : colors.ink,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          );
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(begin: 0, end: share),
          duration: Motion.of(context, const Duration(milliseconds: 600)),
          curve: Motion.out,
          builder: (context, v, child) => CustomPaint(
            painter: _NodePainter(
              fill: here ? colors.volt : colors.ground,
              ring: here ? colors.volt : colors.lineStrong,
              arc: here ? colors.voltInk : colors.accentText,
              share: v.clamp(0.0, 1.0),
            ),
            child: child,
          ),
          child: Center(child: number),
        ),
      ),
    );
  }
}

class _NodePainter extends CustomPainter {
  const _NodePainter({required this.fill, required this.ring, required this.arc, required this.share});

  final Color fill;
  final Color ring;
  final Color arc;
  final double share;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    canvas.drawCircle(c, r, Paint()..color = fill);
    canvas.drawCircle(c, r - 1, Paint()
      ..color = ring
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5);
    if (share > 0) {
      // At least a visible sliver once anything is seen ("3 of 165" must not draw as nothing).
      final sweep = 2 * math.pi * math.max(share, 0.04);
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: r - 1.5),
        -math.pi / 2,
        sweep,
        false,
        Paint()
          ..color = arc
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_NodePainter old) => old.fill != fill || old.ring != ring || old.arc != arc || old.share != share;
}

// ----------------------------------------------------------------------------------------------------- the part switch

/// "Part 2 has two options. Pick the one your school teaches.": one line, the pills under it, then the hint line (which option shows
/// until one is picked, "Saving your choice", or the failure). Once a choice is drawn the line says which ("Part 2 has two
/// options. Yours is Analysis of Financial Statements."), so a part chosen at the onboarding reads as settled, not pending. The hint keeps its place, so saving, failing and the plain hint
/// never move what is below it. The chosen pill is filled (ink) with a check, so the choice reads without colour alone.
class _PartSwitch extends StatelessWidget {
  const _PartSwitch({super.key, required this.part, required this.at, required this.option, required this.choice, required this.status, required this.onChoose});

  final LearnPart part;
  final int at;
  final LearnPartOption option;
  final String? choice;
  final _Save status;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final failed = status == _Save.failed;
    final hint = switch (status) {
      _Save.saving => HomeCopy.partSaving,
      _Save.failed => HomeCopy.partFailed,
      _Save.idle => HomeModel.impliedOptionLine(part, choice),
    };
    return Padding(
      padding: const EdgeInsets.only(top: 2, bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            // Asks while nothing is chosen; says which once one is (LK94).
            HomeModel.chosenOptionLine(part, choice, at),
            key: ValueKey('lh-option-line-${part.id}'),
            style: type.label.copyWith(fontSize: 13.5, height: 1.3, fontWeight: FontWeight.w600, color: colors.ink3),
          ),
          const SizedBox(height: 4),
          Semantics(
            container: true,
            label: option.label,
            child: Wrap(
              spacing: 8,
              runSpacing: 0,
              children: [
                for (final c in option.choices)
                  _PartPill(
                    key: ValueKey('lh-choice-${c.id}'),
                    label: c.label,
                    chapters: HomeModel.optionChapterCount(part.units, c.id),
                    chosen: choice == c.id,
                    onTap: () => onChoose(c.id),
                  ),
              ],
            ),
          ),
          if (hint != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
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

/// One option pill: 36 dp to look at (more when its name wraps), 48 dp to touch; chosen it is filled with the ink colour and a check.
class _PartPill extends StatelessWidget {
  const _PartPill({super.key, required this.label, required this.chapters, required this.chosen, required this.onTap});

  final String label;
  final int chapters;
  final bool chosen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      semanticsLabel: chapters > 0 ? '$label, ${HomeModel.plural(chapters, 'chapter')}' : label,
      selected: chosen,
      inMutuallyExclusiveGroup: true,
      focusRadius: BorderRadius.circular(18),
      pressedScale: 0.96,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Center(
          // As wide as its words: the pills flow in the row from the left, as the web's, never one to a line across the width.
          widthFactor: 1,
          child: LearnPill(label: label, tone: chosen ? LearnPillTone.chosen : LearnPillTone.choice),
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
  const _OptionGroup({super.key, required this.units, required this.choice, required this.here, required this.onOpen, required this.firstIndex});

  final List<LearnPartUnit> units;
  final String? choice;
  final String? Function(String key) here;
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
    // Every option's units are in the body already (the server sends them all), so nothing is waited for: an option with no chapters
    // with cards swaps to nothing, the box eases to no height, and the line "Cards for this option are coming." is what is left.
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
      blocks.add(_UnitBlock(key: ValueKey('${unit.optionId}:${unit.title}'), unit: unit, here: widget.here, onOpen: widget.onOpen, firstIndex: slot, first: i == 0));
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

/// The map before its data, at its final shape: the head and eight path rows of 64.
class ChapterMapSkeleton extends StatelessWidget {
  const ChapterMapSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(alignment: Alignment.centerLeft, child: Skeleton(width: 130, height: 26, radius: 8)),
        const SizedBox(height: 12),
        // Eight rows at the path's shape: a node and two lines, 64 dp each.
        for (var i = 0; i < 8; i++)
          const SizedBox(
            height: 64,
            child: Row(
              children: [
                SizedBox(width: MmSpace.s4),
                Skeleton(width: 36, height: 36, radius: 18),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FractionallySizedBox(widthFactor: 0.72, child: Skeleton(height: 16, radius: 6)),
                      SizedBox(height: 8),
                      FractionallySizedBox(widthFactor: 0.4, child: Skeleton(height: 12, radius: 6)),
                    ],
                  ),
                ),
              ],
            ),
          ),
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
