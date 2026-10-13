import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';

/// The subjects as lit tiles that lead the tab: each subject's object in its own light, the name
/// below. Chosen and not chosen follow the shared answer-sheet selection ([MmSelection]). A last
/// tile opens the remaining supported subjects. Scrolls sideways, bleeding to the screen edge.
class SubjectTiles extends ConsumerWidget {
  const SubjectTiles({
    super.key,
    required this.choices,
    required this.selectedId,
    required this.onSelected,
    this.onMore,
    this.countFor,
    this.gutter = MmSpace.gutter,
  });

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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = choices.length + (onMore == null ? 0 : 1);
    return Semantics(
      container: true,
      label: PracticeCopy.subjectLabel,
      child: SizedBox(
        height: height,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.symmetric(horizontal: gutter),
          clipBehavior: Clip.none,
          itemCount: count,
          separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s8),
          itemBuilder: (context, i) {
            if (i == choices.length) return _MoreTile(onTap: onMore!);
            final c = choices[i];
            return SubjectTile(
              id: c.id,
              name: c.name,
              questions: countFor?.call(c.id),
              selected: c.id == selectedId,
              onTap: () {
                if (c.id == selectedId) return;
                ref.read(hapticsProvider).selection();
                onSelected(c.id);
              },
            );
          },
        ),
      ),
    );
  }
}

class SubjectTile extends StatelessWidget {
  const SubjectTile({super.key, required this.id, required this.name, required this.selected, required this.onTap, this.questions});

  final String id;
  final String name;
  final int? questions;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(id);
    final art = MmArt.subjectObject(id);
    return MmPressable(
      semanticsLabel: questions == null ? name : '$name, ${PracticeCopy.questionsAvailable(questions!)}',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: MmRadius.keyAll,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        width: SubjectTiles.width,
        height: SubjectTiles.height,
        child: DecoratedBox(
          position: DecorationPosition.foreground,
          decoration: ShapeDecoration(
            shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: MmSelection.side(colors, selected: selected)),
          ),
          child: MmClip(
            borderRadius: MmRadius.keyAll,
            child: ColoredBox(
              color: MmSelection.fill(colors, selected: selected, pressed: pressed),
              child: Stack(
                children: [
                  if (light != null)
                    Positioned.fill(
                      child: LightField.subject(context, light, center: const Alignment(0.1, -0.3), strength: selected ? 1 : 0.7),
                    ),
                  if (art != null)
                    Positioned(
                      left: 16,
                      right: 12,
                      top: 18,
                      bottom: questions == null ? 40 : 52,
                      child: ArtImage(art, width: SubjectTiles.width - 28, opacity: selected ? 1 : 0.86),
                    ),
                  Positioned(
                    left: 10,
                    right: 8,
                    bottom: 10,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // A long name ("Political Science") shrinks a little rather than losing letters.
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(name, maxLines: 1, style: type.labelLarge.copyWith(fontSize: 14, color: selected ? colors.ink : colors.ink2)),
                        ),
                        if (questions != null)
                          Text(
                            PracticeCopy.questionsAvailable(questions!),
                            maxLines: 1,
                            style: type.caption.copyWith(fontSize: 11, color: colors.ink3),
                          ),
                      ],
                    ),
                  ),
                  Positioned(top: 10, left: 10, child: SelectBubble(selected: selected)),
                ],
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
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        width: 92,
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
