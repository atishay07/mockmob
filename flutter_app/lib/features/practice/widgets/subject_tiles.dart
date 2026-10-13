import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';

/// The subjects as small lit tiles: each subject's object in its own light, the name below.
/// The chosen tile carries a paper-white rim and an inked bubble; the rest a hairline. A last
/// tile opens the remaining supported subjects. Scrolls sideways, bleeding to the screen edge.
class SubjectTiles extends ConsumerWidget {
  const SubjectTiles({
    super.key,
    required this.choices,
    required this.selectedId,
    required this.onSelected,
    this.onMore,
    this.gutter = MmSpace.gutter,
  });

  final List<SubjectChoice> choices;
  final String selectedId;
  final ValueChanged<String> onSelected;

  /// Null hides the "More subjects" tile.
  final VoidCallback? onMore;

  /// Horizontal padding of the scroller, so the first tile lines up with the page.
  final double gutter;

  static const double width = 112;
  static const double height = 128;

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
  const SubjectTile({super.key, required this.id, required this.name, required this.selected, required this.onTap});

  final String id;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(id);
    final art = MmArt.subjectObject(id);
    return MmPressable(
      semanticsLabel: name,
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
            shape: RoundedSuperellipseBorder(
              borderRadius: MmRadius.keyAll,
              side: BorderSide(color: selected ? colors.ink : colors.line, width: selected ? 1.5 : 1),
            ),
          ),
          child: MmClip(
            borderRadius: MmRadius.keyAll,
            child: ColoredBox(
              color: colors.raised,
              child: Stack(
                children: [
                  if (light != null)
                    Positioned.fill(
                      child: LightField.subject(context, light, center: const Alignment(0.1, -0.3), strength: selected ? 1 : 0.7),
                    ),
                  if (art != null)
                    Positioned(
                      left: 14,
                      right: 10,
                      top: 12,
                      bottom: 38,
                      child: Opacity(opacity: selected ? 1 : 0.86, child: ArtImage(art)),
                    ),
                  Positioned(
                    left: 10,
                    right: 8,
                    bottom: 10,
                    // A long name ("Business Studies") shrinks a little rather than losing letters.
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(name, maxLines: 1, style: type.label.copyWith(color: selected ? colors.ink : colors.ink2)),
                    ),
                  ),
                  Positioned(top: 8, left: 8, child: Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 14)),
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
