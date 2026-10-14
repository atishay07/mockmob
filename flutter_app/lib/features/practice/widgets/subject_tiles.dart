import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/widgets/edge_fade.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'practice_motion.dart';
import 'subject_accent.dart';

/// The subjects as lit tiles that lead the tab: each subject's object in its own light, the name
/// below. Chosen and not chosen follow the shared answer-sheet selection ([MmSelection]). A last
/// tile opens the remaining supported subjects. Scrolls sideways, bleeding to the screen edge.
///
/// The chosen tile is always in view: a subject picked elsewhere (Compass, a link, the quick
/// start) opens the strip already scrolled to it, and a later choice glides it into view.
class SubjectTiles extends ConsumerStatefulWidget {
  const SubjectTiles({
    super.key,
    required this.choices,
    required this.selectedId,
    required this.onSelected,
    this.onMore,
    this.countFor,
    this.onPickedAt,
    this.gutter = MmSpace.gutter,
  });

  /// Called with the centre of the tile just tapped (screen coordinates), so Mobi can look at it.
  final ValueChanged<Offset>? onPickedAt;

  final List<SubjectChoice> choices;

  /// Usable questions in a subject (`/api/stats`), or null when unknown: then nothing is shown.
  final int? Function(String id)? countFor;
  final String selectedId;
  final ValueChanged<String> onSelected;

  /// Null hides the "More subjects" tile.
  final VoidCallback? onMore;

  /// Horizontal padding of the scroller, so the first tile lines up with the page.
  final double gutter;

  static const double width = 132;
  static const double height = 148;

  /// Room above the tiles for the chosen one's lift, inside the strip's edge fade (which clips).
  static const double liftRoom = MmSpace.s4;

  /// The subject emblem's side in a tile: what the name block leaves above it.
  static double emblemSize(bool withCount) => withCount ? 84 : 96;
  static const double gap = MmSpace.s8;

  /// The "More subjects" tile's width.
  static const double moreWidth = 92;

  /// The scroll offset that shows tile [index] whole, with [gutter] of air beside it, given the
  /// strip's current [offset], its [viewport] width and how far it can scroll. Unchanged when
  /// the tile already shows.
  @visibleForTesting
  static double offsetToShow({
    required int index,
    required double offset,
    required double viewport,
    required double maxExtent,
    required double gutter,
  }) {
    final start = gutter + index * (width + gap);
    final end = start + width;
    var target = offset;
    if (end + gutter > offset + viewport) target = end + gutter - viewport;
    if (start - gutter < target) target = math.max(start - gutter, 0);
    return target.clamp(0.0, math.max(maxExtent, 0.0));
  }

  @override
  ConsumerState<SubjectTiles> createState() => _SubjectTilesState();
}

class _SubjectTilesState extends ConsumerState<SubjectTiles> {
  ScrollController? _controller;
  double _viewport = 0;

  int get _selectedIndex => widget.choices.indexWhere((c) => c.id == widget.selectedId);

  /// The width of everything the strip scrolls over, to know how far it can go.
  double get _contentWidth {
    final tiles = widget.choices.length;
    final more = widget.onMore == null ? 0.0 : SubjectTiles.moreWidth + SubjectTiles.gap;
    return widget.gutter * 2 + tiles * SubjectTiles.width + math.max(tiles - 1, 0) * SubjectTiles.gap + more;
  }

  double _target(double offset) {
    final index = _selectedIndex;
    if (index < 0 || _viewport <= 0) return offset;
    return SubjectTiles.offsetToShow(
      index: index,
      offset: offset,
      viewport: _viewport,
      maxExtent: _contentWidth - _viewport,
      gutter: widget.gutter,
    );
  }

  @override
  void didUpdateWidget(SubjectTiles old) {
    super.didUpdateWidget(old);
    if (old.selectedId == widget.selectedId && old.choices.length == widget.choices.length) return;
    // The new choice glides into view once the strip has laid out with it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _controller;
      if (!mounted || c == null || !c.hasClients) return;
      final to = _target(c.offset);
      if ((to - c.offset).abs() < 0.5) return;
      final d = Motion.of(context, Motion.glideDuration);
      if (d == Duration.zero) {
        c.jumpTo(to);
      } else {
        unawaited(c.animateTo(to, duration: d, curve: Motion.glide));
      }
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final choices = widget.choices;
    final count = choices.length + (widget.onMore == null ? 0 : 1);
    return Semantics(
      container: true,
      label: PracticeCopy.subjectLabel,
      child: SizedBox(
        height: SubjectTiles.height + SubjectTiles.liftRoom,
        child: LayoutBuilder(
          builder: (context, constraints) {
            _viewport = constraints.maxWidth;
            // Opens already scrolled to the chosen tile, so it never starts off-screen.
            _controller ??= ScrollController(initialScrollOffset: _target(0));
            // The strip fades out over 24 dp at an edge with more behind it, so the last tile is
            // never cut hard at the screen edge (SPACING-AUDIT P8).
            return EdgeFade(
              extent: MmSpace.s24,
              child: ListView.separated(
              controller: _controller,
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.fromLTRB(widget.gutter, SubjectTiles.liftRoom, widget.gutter, 0),
              itemCount: count,
              separatorBuilder: (_, _) => const SizedBox(width: SubjectTiles.gap),
              itemBuilder: (context, i) {
                if (i == choices.length) return _MoreTile(onTap: widget.onMore!);
                final c = choices[i];
                return SubjectTile(
                  id: c.id,
                  name: c.name,
                  questions: widget.countFor?.call(c.id),
                  selected: c.id == widget.selectedId,
                  onTap: () {
                    if (c.id == widget.selectedId) return;
                    ref.read(hapticsProvider).selection();
                    widget.onSelected(c.id);
                  },
                  onPickedAt: widget.onPickedAt,
                );
              },
              ),
            );
          },
        ),
      ),
    );
  }
}

class SubjectTile extends StatefulWidget {
  const SubjectTile({super.key, required this.id, required this.name, required this.selected, required this.onTap, this.questions, this.onPickedAt});

  final String id;
  final String name;
  final int? questions;
  final bool selected;
  final VoidCallback onTap;

  /// Called with this tile's centre (screen coordinates) when it is tapped to be picked.
  final ValueChanged<Offset>? onPickedAt;

  @override
  State<SubjectTile> createState() => _SubjectTileState();
}

class _SubjectTileState extends State<SubjectTile> {
  /// Counts the times this tile became the chosen one: the object's squash and sparkle play on it.
  int _picks = 0;

  @override
  void didUpdateWidget(SubjectTile old) {
    super.didUpdateWidget(old);
    if (!old.selected && widget.selected) _picks++;
  }

  void _tapped() {
    if (!widget.selected) {
      final box = context.findRenderObject();
      if (box is RenderBox && box.hasSize && box.attached) widget.onPickedAt?.call(box.localToGlobal(box.size.center(Offset.zero)));
    }
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final name = widget.name;
    final questions = widget.questions;
    final selected = widget.selected;
    final onTap = _tapped;
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(id);
    final accent = context.subjectAccentOf(id);
    final reduced = Motion.reduced(context);
    return MmPressable(
      semanticsLabel: questions == null ? name : '$name, ${PracticeCopy.questionsAvailable(questions)}',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: MmRadius.keyAll,
      onTap: onTap,
      builder: (context, pressed, _) => TweenAnimationBuilder<double>(
        // 0 at rest, 1 chosen: the tile lifts, its object grows into its light and the identity
        // bar under the name lengthens. One emphasized landing, no loop.
        tween: Tween(end: selected ? 1 : 0),
        duration: reduced ? Duration.zero : Motion.emphasizedDuration,
        curve: Motion.emphasized,
        builder: (context, t, _) => Transform.translate(
          offset: Offset(0, -SubjectTiles.liftRoom * t),
          child: SizedBox(
            width: SubjectTiles.width,
            height: SubjectTiles.height,
            child: DecoratedBox(
              position: DecorationPosition.foreground,
              decoration: ShapeDecoration(
                shape: RoundedSuperellipseBorder(
                  borderRadius: MmRadius.keyAll,
                  side: MmSelection.side(colors, selected: selected),
                ),
              ),
              child: MmClip(
                borderRadius: MmRadius.keyAll,
                child: ColoredBox(
                  color: MmSelection.fill(colors, selected: selected, pressed: pressed),
                  child: Stack(
                    children: [
                      if (light != null)
                        Positioned.fill(
                          child: LightField.subject(context, light, center: const Alignment(0.1, -0.3), strength: 0.7 + 0.3 * t),
                        ),
                      Positioned(
                        left: 12,
                        right: 12,
                        top: 12,
                        bottom: questions == null ? 40 : 52,
                        child: Align(
                          alignment: Alignment.topLeft,
                          child: AnimatedScale(
                            // The object dips under the finger and settles larger once chosen; its
                            // volt mark inks when the subject is picked (the ring is on the tile).
                            scale: (pressed ? 0.94 : 1) * (1 + 0.07 * t),
                            duration: reduced ? Duration.zero : Motion.ui,
                            curve: Motion.out,
                            alignment: Alignment.topLeft,
                            // The pick lands on the object itself: a squash into its light and a few
                            // glints, once per pick (nothing under reduced motion; the ring says it).
                            child: PracticeSquash(
                              trigger: _picks,
                              glint: light?.of(Theme.of(context).brightness) ?? colors.volt,
                              alignment: Alignment.bottomLeft,
                              child: SubjectEmblem(
                                subject: id,
                                size: SubjectTiles.emblemSize(questions != null),
                                framed: false,
                                marked: selected,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: MmSpace.s12,
                        right: MmSpace.s8,
                        bottom: MmSpace.s12,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // The subject's identity mark: its own hue, longer when chosen.
                            DecoratedBox(
                              decoration: ShapeDecoration(
                                color: accent.withValues(alpha: 0.55 + 0.45 * t),
                                shape: const StadiumBorder(),
                              ),
                              child: SizedBox(width: 14 + 14 * t, height: 3),
                            ),
                            const SizedBox(height: MmSpace.s6),
                            // A long name ("Political Science") shrinks a little rather than losing
                            // letters. The line keeps its full height and the name sits on its foot,
                            // so every tile's name shares one baseline, shrunk or not.
                            SizedBox(
                              height: MediaQuery.textScalerOf(context).scale(20),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.bottomLeft,
                                child: Text(
                                  name,
                                  maxLines: 1,
                                  style: type.labelLarge.copyWith(fontSize: 14, color: Color.lerp(colors.ink2, colors.ink, t)),
                                ),
                              ),
                            ),
                            if (questions != null)
                              // Rolls from what it showed when a pull brings a new count.
                              MmCountUp(
                                value: questions,
                                from: questions,
                                format: (v) => PracticeCopy.questionsAvailable(v.round()),
                                style: type.caption.copyWith(fontSize: 11, color: colors.ink3),
                              ),
                          ],
                        ),
                      ),
                      Positioned(top: MmSpace.s12, left: MmSpace.s12, child: SelectBubble(selected: selected)),
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

class _MoreTile extends StatelessWidget {
  const _MoreTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: PracticeCopy.moreSubjects,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        width: SubjectTiles.moreWidth,
        height: SubjectTiles.height,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.raised2 : colors.ground,
            shape: RoundedSuperellipseBorder(
              borderRadius: MmRadius.keyAll,
              side: BorderSide(color: colors.line),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(LucideIcons.plus, size: 20, color: colors.ink2),
                const Spacer(),
                Text(PracticeCopy.moreSubjects, style: type.label.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
