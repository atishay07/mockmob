import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart' show EmblemSizes, SubjectEmblem;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/review_chapters.dart';
import 'chapter_hero.dart' show LostBar;
import 'collapsible.dart';

/// "More chapters" (REVIEW-RESULT-1018 4.5): every chapter that is not the open one, most marks lost first, each priced the
/// way the hero is ("Lost 29 of the 45 marks on offer, ..."). A row opens on tap and becomes the hero; the one that was the hero
/// joins the list at its place. The first four show; "See all N chapters" opens the rest in place.
class MoreChapters extends StatefulWidget {
  const MoreChapters({super.key, required this.rows, required this.total, required this.across, required this.onOpen});

  /// The chapters other than the open one, in rank order.
  final List<ChapterRow> rows;

  /// How many chapters the student has in all, the open one included.
  final int total;

  /// "Each chapter across Mock 3, Quick practice and Mock 2."
  final String across;
  final ValueChanged<ChapterRow> onOpen;

  static const shown = 4;

  @override
  State<MoreChapters> createState() => _MoreChaptersState();
}

class _MoreChaptersState extends State<MoreChapters> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rows = widget.rows;
    if (rows.isEmpty) return const SizedBox.shrink();
    final first = rows.take(MoreChapters.shown).toList();
    final rest = rows.skip(MoreChapters.shown).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Semantics(header: true, child: Text(ReviewCopy.moreChapters, style: type.title))),
            Text(ReviewCopy.mostMarksFirst, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
        const SizedBox(height: MmSpace.s2),
        Text(widget.across, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        for (final r in first) _ChapterTile(row: r, onTap: () => widget.onOpen(r)),
        if (rest.isNotEmpty)
          MmCollapsible(
            expanded: _all,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final r in rest) _ChapterTile(row: r, onTap: () => widget.onOpen(r))]),
          ),
        if (rest.isNotEmpty && !_all)
          MmPressable(
            onTap: () => setState(() => _all = true),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: ReviewCopy.seeAllChapters(widget.total),
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Row(
                children: [
                  Expanded(child: Text(ReviewCopy.seeAllChapters(widget.total), style: type.labelLarge.copyWith(color: colors.ink2))),
                  Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// One chapter in the list: its object, name and the marks it lost as a display number, the same line as the hero, and the
/// bar with a chevron that says it opens. A 88 dp target or taller.
class _ChapterTile extends StatelessWidget {
  const _ChapterTile({required this.row, required this.onTap});

  final ChapterRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = ReviewCopy.chapterRowSpoken(name: row.name, lost: row.lost, line: row.line.text);
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: '$label ${ReviewCopy.opensChapter}',
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 88),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(child: SubjectEmblem(subject: row.subject ?? '', size: EmblemSizes.chip, framed: false)),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(row.name, style: type.cardTitle.copyWith(fontSize: 16, height: 21 / 16), maxLines: 3, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(row.line.text, style: type.caption.copyWith(fontSize: 13.5, height: 19 / 13.5, color: colors.ink2)),
                      const SizedBox(height: MmSpace.s8),
                      Row(
                        children: [
                          if (row.offer != null) Expanded(child: LostBar(share: row.share)) else const Spacer(),
                          const SizedBox(width: MmSpace.s12),
                          Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                ExcludeSemantics(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('−${row.lost}', style: type.figureCompact.copyWith(fontSize: 28, height: 1.05, color: colors.badText)),
                      Text(ReviewCopy.marksWord, style: type.caption.copyWith(fontSize: 11, height: 1.2, color: colors.ink2)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
