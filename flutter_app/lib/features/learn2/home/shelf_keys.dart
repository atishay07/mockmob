import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'home_copy.dart';
import 'home_model.dart';

/// The three shelf tiles under the search field: "9 due today", "6 missed lately", "26 in Revise" (the web's ShelfKeys). The
/// student's own cards were a feature behind a focus; now they are one line of tiles. A tile opens that set in place and
/// the open set's tile shows pressed. Zero is a true value: it is drawn, quiet, and says so in its spoken name. Three
/// zeros (a new student) collapse to one line.
class HomeShelfKeys extends StatelessWidget {
  const HomeShelfKeys({super.key, required this.keys, required this.selected, required this.onSelect});

  final List<HomeShelfKey> keys;

  /// The id of the set that is open (due | missed | revise | must), or null.
  final String? selected;

  /// Called with the tile's id, or null when the open set's own tile is tapped again (the set closes).
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    if (keys.isEmpty) return const SizedBox.shrink();
    if (keys.every((k) => k.zero)) return const HomeShelfLine(text: HomeCopy.shelvesNothing);
    return Semantics(
      container: true,
      label: HomeCopy.shelvesGroup,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < keys.length; i++) ...[
              if (i > 0) const SizedBox(width: MmSpace.s8),
              Expanded(
                child: _ShelfTile(
                  key: ValueKey('lh-shelf-${keys[i].id}'),
                  shelfKey: keys[i],
                  pressed: selected == keys[i].id,
                  onTap: () => onSelect(selected == keys[i].id ? null : keys[i].id),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One quiet line in the tiles' own place and height, so nothing moves when it replaces them.
class HomeShelfLine extends StatelessWidget {
  const HomeShelfLine({super.key, required this.text, this.action, this.onAction});

  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.small.copyWith(color: colors.ink3, height: 1.45);
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Semantics(
          liveRegion: true,
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(text, style: style),
              if (action != null && onAction != null) ...[
                const SizedBox(width: MmSpace.s8),
                HomeTextKey(label: action!, onTap: onAction!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A text key with a hairline under it (the web's `lh-textkey`): 48 dp to touch, plain to look at.
class HomeTextKey extends StatelessWidget {
  const HomeTextKey({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: Center(
            widthFactor: 1,
            child: Text(
              label,
              style: type.labelLarge.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: colors.ink,
                decoration: TextDecoration.underline,
                decorationColor: colors.lineStrong,
                decorationThickness: 1.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ShelfTile extends StatelessWidget {
  const _ShelfTile({super.key, required this.shelfKey, required this.pressed, required this.onTap});

  final HomeShelfKey shelfKey;
  final bool pressed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final zero = shelfKey.zero;
    final dur = Motion.of(context, const Duration(milliseconds: 160));
    final fill = pressed ? colors.ink : colors.raised;
    final count = pressed ? colors.ground : (zero ? colors.ink3 : colors.ink);
    final label = pressed ? colors.ground : (zero ? colors.ink3 : colors.ink2);
    final border = pressed ? fill : (zero ? colors.line : colors.lineStrong);
    return MmPressable(
      semanticsLabel: shelfKey.name,
      selected: zero ? null : pressed,
      onTap: zero ? null : onTap,
      pressedScale: 0.97,
      focusRadius: BorderRadius.circular(14),
      haptic: MmPressHaptic.selection,
      builder: (context, down, _) => AnimatedContainer(
        duration: dur,
        curve: Motion.out,
        constraints: const BoxConstraints(minHeight: 56),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
        decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(14), border: Border.all(color: border)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${shelfKey.count}', style: type.title.copyWith(fontSize: 18, height: 1, color: count)),
            const SizedBox(height: MmSpace.s4),
            Text(shelfKey.label, style: type.caption.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600, height: 1.2, color: label)),
          ],
        ),
      ),
    );
  }
}

/// The tiles before their numbers land, at their final height: three, so nothing moves.
class HomeShelfKeysSkeleton extends StatelessWidget {
  const HomeShelfKeysSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          for (var i = 0; i < 3; i++) ...[
            if (i > 0) const SizedBox(width: MmSpace.s8),
            const Expanded(child: Skeleton(height: 56, radius: 14)),
          ],
        ],
      );
}
