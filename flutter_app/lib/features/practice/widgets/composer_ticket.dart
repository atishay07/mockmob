import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'subject_accent.dart';

/// The head of the confirm step, read like a ticket: the subject's object in its own light, the
/// mode and the subject, and the length as a big number on the right. A new subject slides its
/// object in; a new length rolls the number. So the paper about to start is seen, not only read
/// (owner feedback 1110: "starting from Business Studies ... redirecting me to Accountancy").
class ComposerTicket extends StatelessWidget {
  const ComposerTicket({
    super.key,
    required this.subjectId,
    required this.eyebrow,
    required this.subject,
    required this.count,
    required this.semanticsLabel,
  });

  final String subjectId;
  final String eyebrow;
  final String subject;
  final int count;
  final String semanticsLabel;

  static const double object = 68;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final glide = reduced ? Duration.zero : Motion.glideDuration;

    Widget slideIn(Widget child, Animation<double> a, {Offset from = const Offset(0.18, 0)}) => FadeTransition(
      opacity: a,
      child: SlideTransition(
        position: Tween(begin: from, end: Offset.zero).chain(CurveTween(curve: Motion.glide)).animate(a),
        child: child,
      ),
    );

    return Semantics(
      header: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox.square(
            dimension: object,
            child: AnimatedSwitcher(
              duration: glide,
              switchInCurve: Curves.linear,
              switchOutCurve: Motion.exit,
              transitionBuilder: (child, a) => slideIn(child, a),
              child: _SubjectObject(key: ValueKey(subjectId), subjectId: subjectId),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  eyebrow,
                  style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2),
                ),
                const SizedBox(height: 2),
                AnimatedSwitcher(
                  duration: glide,
                  layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
                  transitionBuilder: (child, a) => slideIn(child, a, from: const Offset(0, 0.35)),
                  child: Text(subject, key: ValueKey(subject), style: type.screenTitle.copyWith(fontSize: 24)),
                ),
                const SizedBox(height: MmSpace.s6),
                DecoratedBox(
                  decoration: ShapeDecoration(color: context.subjectAccentOf(subjectId), shape: const StadiumBorder()),
                  child: const SizedBox(width: 28, height: 3),
                ),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          _CountFigure(count: count),
        ],
      ),
    );
  }
}

/// The subject's object on a round pool of its light.
class _SubjectObject extends StatelessWidget {
  const _SubjectObject({super.key, required this.subjectId});

  final String subjectId;

  @override
  Widget build(BuildContext context) {
    final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.language;
    final art = MmArt.subjectObject(subjectId);
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipOval(child: LightField.subject(context, light, center: Alignment.center, strength: 1)),
        if (art != null)
          Padding(
            padding: const EdgeInsets.all(4),
            child: ArtImage(art, width: ComposerTicket.object - 8),
          ),
      ],
    );
  }
}

/// The length as a condensed figure with "questions" under it. A new length rolls in from
/// below while the old one leaves upward.
class _CountFigure extends StatelessWidget {
  const _CountFigure({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRect(
          child: AnimatedSwitcher(
            duration: reduced ? Duration.zero : Motion.glideDuration,
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerRight, children: [...previous, ?current]),
            transitionBuilder: (child, a) {
              final entering = child.key == ValueKey(count);
              final slide = Tween(begin: Offset(0, entering ? 0.6 : -0.6), end: Offset.zero).chain(CurveTween(curve: Motion.emphasized));
              return FadeTransition(
                opacity: a,
                child: SlideTransition(position: slide.animate(a), child: child),
              );
            },
            child: Text(
              '$count',
              key: ValueKey(count),
              style: type.figureCompact.copyWith(fontSize: 44, height: 44 / 44),
            ),
          ),
        ),
        Text(PracticeCopy.questionsUnit, style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The subjects as tactile chips for the setup page (which can change subject): each the
/// subject's line glyph on its own light, the name, and on the chosen chip the volt bubble and
/// its identity underline. Scrolls sideways; the chosen chip glides into view.
class SubjectChips extends ConsumerStatefulWidget {
  const SubjectChips({super.key, required this.choices, required this.selectedId, required this.onSelected, this.onMore});

  final List<SubjectChoice> choices;
  final String selectedId;
  final ValueChanged<String> onSelected;

  /// Null hides the "More subjects" chip.
  final VoidCallback? onMore;

  static const double height = 52;

  @override
  ConsumerState<SubjectChips> createState() => _SubjectChipsState();
}

class _SubjectChipsState extends ConsumerState<SubjectChips> {
  final ScrollController _scroll = ScrollController();
  final GlobalKey _selectedKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(animate: false));
  }

  @override
  void didUpdateWidget(SubjectChips old) {
    super.didUpdateWidget(old);
    if (old.selectedId != widget.selectedId) WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(animate: true));
  }

  /// Brings the chosen chip into view inside the strip only (the page never scrolls for it).
  void _reveal({required bool animate}) {
    final box = _selectedKey.currentContext?.findRenderObject();
    if (!mounted || box == null || !_scroll.hasClients) return;
    final d = animate ? Motion.of(context, Motion.glideDuration) : Duration.zero;
    unawaited(_scroll.position.ensureVisible(box, alignment: 0.5, duration: d, curve: Motion.glide));
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final choices = widget.choices;
    return Semantics(
      container: true,
      label: PracticeCopy.subjectLabel,
      child: SizedBox(
        height: SubjectChips.height,
        child: ListView.separated(
          controller: _scroll,
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          itemCount: choices.length + (widget.onMore == null ? 0 : 1),
          separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s8),
          itemBuilder: (context, i) {
            if (i == choices.length) return _MoreChip(onTap: widget.onMore!);
            final c = choices[i];
            final selected = c.id == widget.selectedId;
            return _SubjectChip(
              key: selected ? _selectedKey : ValueKey(c.id),
              id: c.id,
              name: c.name,
              selected: selected,
              onTap: () {
                if (selected) return;
                unawaited(ref.read(hapticsProvider).selection());
                widget.onSelected(c.id);
              },
            );
          },
        ),
      ),
    );
  }
}

class _SubjectChip extends StatelessWidget {
  const _SubjectChip({super.key, required this.id, required this.name, required this.selected, required this.onTap});

  final String id;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = context.subjectAccentOf(id);
    final reduced = Motion.reduced(context);
    const radius = BorderRadius.all(Radius.circular(16));
    return MmPressable(
      semanticsLabel: name,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: radius,
      onTap: onTap,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: reduced ? Duration.zero : Motion.ui,
        curve: Motion.out,
        height: SubjectChips.height,
        padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s8, MmSpace.s12, MmSpace.s8),
        decoration: ShapeDecoration(
          color: MmSelection.fill(colors, selected: selected, pressed: pressed),
          shape: RoundedSuperellipseBorder(
            borderRadius: radius,
            side: MmSelection.side(colors, selected: selected),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SubjectGlyphTile(id, size: 32),
            const SizedBox(width: MmSpace.s8),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(name, maxLines: 1, style: type.labelLarge.copyWith(fontSize: 14, color: selected ? colors.ink : colors.ink2)),
                const SizedBox(height: 3),
                AnimatedContainer(
                  duration: reduced ? Duration.zero : Motion.emphasizedDuration,
                  curve: Motion.emphasized,
                  width: selected ? 24 : 10,
                  height: 3,
                  decoration: ShapeDecoration(
                    color: accent.withValues(alpha: selected ? 1 : 0.5),
                    shape: const StadiumBorder(),
                  ),
                ),
              ],
            ),
            if (selected) ...[const SizedBox(width: MmSpace.s8), const SelectBubble(selected: true)],
          ],
        ),
      ),
    );
  }
}

class _MoreChip extends StatelessWidget {
  const _MoreChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = BorderRadius.all(Radius.circular(16));
    return MmPressable(
      semanticsLabel: PracticeCopy.moreSubjects,
      focusRadius: radius,
      onTap: onTap,
      builder: (context, pressed, _) => Container(
        height: SubjectChips.height,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : null,
          shape: RoundedSuperellipseBorder(
            borderRadius: radius,
            side: BorderSide(color: colors.line),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.plus, size: 18, color: colors.ink2),
            const SizedBox(width: MmSpace.s6),
            Text(PracticeCopy.moreSubjects, style: type.label.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}
