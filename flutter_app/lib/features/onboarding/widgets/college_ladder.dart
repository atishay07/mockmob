import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_catalog.dart';

/// The college ladder for one course: every college that seated [category] in Round 1, highest
/// minimum first, with DU's figure to one decimal. Tapping inks a college's bubble (up to three).
class CollegeLadder extends StatefulWidget {
  const CollegeLadder({
    super.key,
    required this.course,
    required this.category,
    required this.picks,
    required this.onToggle,
    this.initialCount = 7,
  });

  final DuCourse course;
  final String category;
  final List<String> picks;

  /// Returns false when the pick was refused (already three).
  final bool Function(String college) onToggle;
  final int initialCount;

  @override
  State<CollegeLadder> createState() => _CollegeLadderState();
}

class _CollegeLadderState extends State<CollegeLadder> {
  bool _all = false;
  bool _full = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rows = widget.course.ladder(widget.category);
    // Picks always show, even when they sit below the fold.
    final shown = _all
        ? rows
        : [
            ...rows.take(widget.initialCount),
            ...rows.skip(widget.initialCount).where((o) => widget.picks.contains(o.college)),
          ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < shown.length; i++)
          _LadderRow(
            offering: shown[i],
            score: shown[i].scoreFor(widget.category)!,
            selected: widget.picks.contains(shown[i].college),
            last: i == shown.length - 1,
            onTap: () {
              final ok = widget.onToggle(shown[i].college);
              setState(() => _full = !ok);
            },
          ),
        if (_full)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: Semantics(liveRegion: true, child: Text(OnboardingCopy.threeIsPlenty, style: type.small.copyWith(color: colors.ink2))),
          ),
        if (rows.length > widget.initialCount)
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(
              label: _all ? OnboardingCopy.showFewer : OnboardingCopy.showAll(rows.length),
              onPressed: () => setState(() => _all = !_all),
            ),
          ),
      ],
    );
  }
}

class _LadderRow extends ConsumerWidget {
  const _LadderRow({required this.offering, required this.score, required this.selected, required this.last, required this.onTap});

  final DuOffering offering;
  final double score;
  final bool selected;
  final bool last;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = DuCatalog.format(score);
    return MmPressable(
      semanticsLabel: '${offering.college}, $figure',
      checked: selected,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: selected ? colors.raised2 : (pressed ? colors.raised : Colors.transparent),
          borderRadius: MmRadius.keyAll,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
            child: Row(
              children: [
                Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 20, inkOrigin: const Offset(-0.7, 0)),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Text(
                    offering.college,
                    style: type.labelLarge.copyWith(color: selected ? colors.ink : colors.ink2, fontWeight: selected ? FontWeight.w600 : FontWeight.w500),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Text(figure, style: type.title.copyWith(fontSize: 20, color: selected ? colors.ink : colors.ink2)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The category chip above the ladder ("Showing UR"), which opens the category list.
class CategoryChip extends StatelessWidget {
  const CategoryChip({super.key, required this.category, required this.onTap});

  final String category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '${OnboardingCopy.showing(category)}. Change category',
      onTap: onTap,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.raised2 : colors.raised,
            shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
          ),
          child: SizedBox(
            height: 40,
            child: Padding(
              padding: const EdgeInsets.only(left: MmSpace.s16, right: MmSpace.s12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(OnboardingCopy.showing(category), style: type.labelLarge.copyWith(fontSize: 14)),
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

/// The category list, in a glass sheet. Returns the chosen category.
Future<String?> showCategorySheet(BuildContext context, String current) {
  return showMmSheet<String>(
    context: context,
    title: OnboardingCopy.categoryTitle,
    builder: (context) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(OnboardingCopy.categoryNote, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
        const SizedBox(height: MmSpace.s16),
        Wrap(
          spacing: MmSpace.s8,
          children: [
            for (final c in DuCatalog.categories)
              MmChip(label: c, selected: c == current, onTap: () => Navigator.of(context).pop(c)),
          ],
        ),
      ],
    ),
  );
}
