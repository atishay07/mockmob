import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show categoryWordsTitle;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_catalog.dart';
import 'choice_tile.dart';
import 'entrance.dart';

/// The college ladder for one course: every college that seated [category] in Round 1, highest
/// minimum first, with DU's figure to one decimal, on one rail. Tapping inks a college's bubble
/// with its pick number (up to three), so the order of the picks shows.
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
          EntranceItem.answer(
            i,
            child: _LadderRow(
              offering: shown[i],
              score: shown[i].scoreFor(widget.category)!,
              pick: widget.picks.contains(shown[i].college) ? widget.picks.indexOf(shown[i].college) + 1 : null,
              first: i == 0,
              last: i == shown.length - 1,
              onTap: () {
                final ok = widget.onToggle(shown[i].college);
                setState(() => _full = !ok);
              },
            ),
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

/// One rung: the bubble on the rail (inked with the pick number once picked), the college, and
/// its closing score in condensed figures. Every rung sits flat on the ground, a hairline between;
/// a pick is only an inked, numbered bubble and the name in full ink, so three picks read as one
/// ladder with three marks, not three boxes.
class _LadderRow extends StatelessWidget {
  const _LadderRow({
    required this.offering,
    required this.score,
    required this.pick,
    required this.first,
    required this.last,
    required this.onTap,
  });

  final DuOffering offering;
  final double score;

  /// 1, 2 or 3 when picked (the order the student picked in), else null.
  final int? pick;
  final bool first;
  final bool last;
  final VoidCallback onTap;

  static const double _bubble = 26;
  static const double _inset = MmSpace.s12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = DuCatalog.format(score);
    final name = displayCollege(offering.college);
    final selected = pick != null;
    // The rail runs through every rung's bubble, over a picked rung's fill too, so the list
    // reads as one ladder.
    return ChoiceTile(
      selected: selected,
      exclusive: false,
      flat: true,
      bubble: BubbleSpot.none,
      semanticsLabel: selected ? '$name, $figure, pick $pick' : '$name, $figure',
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: CustomPaint(
        painter: _RailPainter(
          x: _inset + _bubble / 2,
          first: first,
          last: last,
          color: colors.lineStrong,
          rule: colors.line,
          ruleFrom: _inset + _bubble + MmSpace.s12,
        ),
        child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: _inset, vertical: MmSpace.s8 + 6),
        child: Row(
          children: [
            SizedBox.square(
              dimension: _bubble,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // The ground behind the bubble hides the rail inside the ring.
                  DecoratedBox(
                    decoration: BoxDecoration(shape: BoxShape.circle, color: selected ? Colors.transparent : colors.ground),
                    child: const SizedBox.square(dimension: _bubble - 2),
                  ),
                  Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: _bubble, inkOrigin: const Offset(-0.4, -0.4)),
                  if (selected)
                    Text(
                      '$pick',
                      style: type.label.copyWith(
                        color: colors.voltInk,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text(
                name,
                style: type.labelLarge.copyWith(
                  color: selected ? colors.ink : colors.ink2,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Text(figure, style: type.figureCompact.copyWith(fontSize: 26, height: 1, color: selected ? colors.ink : colors.ink2)),
          ],
        ),
        ),
      ),
    );
  }
}

/// One segment of the ladder's rail: from the rung above to the rung below, through the bubble.
class _RailPainter extends CustomPainter {
  const _RailPainter({
    required this.x,
    required this.first,
    required this.last,
    required this.color,
    required this.rule,
    required this.ruleFrom,
  });

  /// The hairline under each rung but the last, from the college name to the score.
  final Color rule;
  final double ruleFrom;
  final double x;
  final bool first;
  final bool last;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (first && last) return;
    final mid = size.height / 2;
    canvas.drawLine(
      Offset(x, first ? mid : 0),
      Offset(x, last ? mid : size.height),
      Paint()
        ..color = color
        ..strokeWidth = 1.5,
    );
    if (!last) {
      canvas.drawLine(
        Offset(ruleFrom, size.height - 0.5),
        Offset(size.width - _LadderRow._inset, size.height - 0.5),
        Paint()
          ..color = rule
          ..strokeWidth = 1,
      );
    }
  }

  @override
  bool shouldRepaint(_RailPainter old) =>
      old.x != x || old.first != first || old.last != last || old.color != color || old.rule != rule || old.ruleFrom != ruleFrom;
}

/// A college's name as shown: DU's "(W)" marks a women's college, so it is dropped where the
/// name already says so ("Lady Shri Ram College for Women").
String displayCollege(String college) =>
    college.contains('Women') ? college.replaceAll(' (W)', '').trim() : college;

/// The category chip above the ladder ("Showing unreserved"), which opens the category list.
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
      haptic: MmPressHaptic.selection,
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

/// The course chip above the ladder ("B.Com (Hons)" with a pencil), which goes back to the
/// course tiles. Same chip as [CategoryChip], a 48 dp target.
class CourseChip extends StatelessWidget {
  const CourseChip({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '$label. ${OnboardingCopy.changeCourse}',
      haptic: MmPressHaptic.selection,
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
                  Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(fontSize: 14))),
                  const SizedBox(width: MmSpace.s8),
                  Icon(LucideIcons.pencil, size: 14, color: colors.ink2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A category as a chip says it: the student's words, capitalised ("Unreserved", "OBC"). The
/// sheet still returns the code.
String categoryChipLabel(String category) => categoryWordsTitle(category);

/// The category list, in a glass sheet. Returns the chosen category (the code).
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
              MmChip(label: categoryChipLabel(c), selected: c == current, onTap: () => Navigator.of(context).pop(c)),
          ],
        ),
      ],
    ),
  );
}
