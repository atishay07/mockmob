import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/data/credit_figures.dart' show creditFiguresProvider;
import '../copy.dart';
import '../data/review_providers.dart' show conceptLinkProvider;
import '../model/review_chapters.dart';
import 'answer_sheet.dart';
import 'chapter_bits.dart';
import 'review_bits.dart' show FlushKey;

/// The open chapter's mistakes under its hero (REVIEW-RESULT-1018 4.3): "4 mistakes to repair", one row per never-repaired wrong
/// answer, newest first, each on the kept thread with its round badge, the first line of the question, its paper and the 12-hour
/// time it was attempted, the student's pick, and ONE action: Repair. Tapping the row does the same; the repair opens on the
/// question again with the key hidden, which is free (the paid step is inside it). Repaired mistakes are not repeated here: they
/// live in Saved repairs, so each list has one kind of row and one action.
///
/// The foot says in plain sentences what is not a row: what was left blank (Try it again, free), what is repaired (and where it
/// is), what is set aside while its key is checked, what a repair costs, and the lesson that explains the chapter.
class ChapterMistakes extends ConsumerStatefulWidget {
  const ChapterMistakes({super.key, required this.row, required this.onRepair});

  final ChapterRow row;

  /// Opens the repair at a mistake (a repaired one opens its saved repair, free).
  final ValueChanged<RowItem> onRepair;

  /// More rows than this fold behind "Show N more": one chapter never pushes the rest of the tab a screen away.
  static const shownRows = 5;

  @override
  ConsumerState<ChapterMistakes> createState() => _ChapterMistakesState();
}

class _ChapterMistakesState extends ConsumerState<ChapterMistakes> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = widget.row;
    final open = row.open;
    final hidden = open.length - ChapterMistakes.shownRows;
    final shown = _all || hidden <= 0 ? open : open.take(ChapterMistakes.shownRows).toList();
    final more = hidden > 0 && !_all ? hidden : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(open.isEmpty ? ReviewCopy.chapterNothingToRepair : ReviewCopy.chapterMistakes(open.length), style: type.labelLarge.copyWith(fontSize: 16)),
                ),
              ),
              if (open.length > 1) Text(ReviewCopy.newestFirst, style: type.caption.copyWith(color: colors.ink2)),
            ],
          ),
        ),
        Divider(height: 1, color: colors.line),
        if (open.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: Text(ReviewCopy.threadTryFirst, style: type.caption.copyWith(color: colors.ink2)),
          ),
          for (var i = 0; i < shown.length; i++)
            ChapterItemRow(
              key: ValueKey(shown[i].uid),
              badge: BadgeKind.wrong,
              number: shown[i].number,
              rail: true,
              first: i == 0,
              last: i == shown.length - 1 && more == 0,
              title: Text(stemShown(shown[i].stem, shown[i].number), style: type.cardTitle.copyWith(fontSize: 15, height: 20 / 15), maxLines: 4, overflow: TextOverflow.ellipsis),
              details: [stampText(context, shown[i].stamp), if (shown[i].pick != null) Padding(padding: const EdgeInsets.only(top: 2), child: PickFact(letter: shown[i].pick!))],
              action: ActionLabels.repair,
              semanticsLabel: ReviewCopy.rowSpoken(action: ActionLabels.repair, number: shown[i].number, stamp: shown[i].stamp, stem: shown[i].stem),
              onTap: () => widget.onRepair(shown[i]),
            ),
          if (more > 0) FlushKey(label: ReviewCopy.showMoreMistakes(more), onPressed: () => setState(() => _all = true)),
        ],
        _Foot(row: row, onRepair: widget.onRepair),
      ],
    );
  }
}

/// The plain sentences under the rows.
class _Foot extends ConsumerStatefulWidget {
  const _Foot({required this.row, required this.onRepair});

  final ChapterRow row;
  final ValueChanged<RowItem> onRepair;

  @override
  ConsumerState<_Foot> createState() => _FootState();
}

class _FootState extends ConsumerState<_Foot> {
  static const _namedBlanks = 6;
  static const _namedRepairs = 3;
  bool _allBlanks = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = widget.row;
    final credits = ref.watch(creditFiguresProvider);
    // A balance read from the saved copy may be from before the last repair: unknown here, never a wrong figure.
    final ai = credits.stale ? null : credits.ai;
    final renews = ai == 0 && credits.aiRenews != null ? _day(credits.aiRenews!) : null;
    final lesson = ref.watch(conceptLinkProvider(row.name));
    final sentence = type.small.copyWith(fontSize: 14, height: 21 / 14, color: colors.ink2);
    final bold = sentence.copyWith(fontWeight: FontWeight.w600, color: colors.ink);

    final blanks = row.blanks;
    final blanksShown = _allBlanks ? blanks : blanks.take(_namedBlanks).toList();
    final fixed = row.repaired;
    final named = [for (final r in fixed.take(_namedRepairs)) 'Q${r.number} from ${r.paperName}'];
    final lines = <Widget>[
      if (blanks.isNotEmpty) ...[
        Text.rich(TextSpan(style: sentence, children: [TextSpan(text: '${ReviewCopy.leftBlank(blanks.length)}. ', style: bold), TextSpan(text: ReviewCopy.tryBlankAgain(blanks.length))])),
        Wrap(
          spacing: MmSpace.s8,
          children: [
            for (final b in blanksShown) _BlankChip(item: b),
            if (blanks.length > blanksShown.length) _MoreChip(label: '${blanks.length - blanksShown.length} more', onTap: () => setState(() => _allBlanks = true)),
          ],
        ),
      ],
      if (fixed.isNotEmpty)
        Text.rich(
          TextSpan(
            style: sentence,
            children: [
              TextSpan(text: '${ReviewCopy.repairedFoot(fixed.length)}: ', style: bold),
              TextSpan(
                text:
                    '${ReviewCopy.repairedNames(named, fixed.length - named.length, slipped: row.slipped, total: fixed.length)} ${ReviewCopy.inSavedRepairs(fixed.length)}',
              ),
            ],
          ),
        ),
      if (row.keyHeld > 0) Text(ReviewCopy.setAsideFoot(row.keyHeld), style: sentence),
      Text(ReviewCopy.repairCostFoot(aiCredits: ai, renews: renews), style: type.caption.copyWith(color: colors.ink2)),
      if (lesson != null) _LessonLink(title: lesson.title, onTap: () => context.push(AppRoutes.learnUnit(lesson.unitId))),
    ];
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.only(top: MmSpace.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [for (var i = 0; i < lines.length; i++) ...[if (i > 0) const SizedBox(height: MmSpace.s8), lines[i]]],
          ),
        ),
      ),
    );
  }

  /// "1 Nov".
  static String _day(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${months[d.month - 1]}';
  }
}

/// A skipped question the student can try again: free, with the key hidden. "Q47, Mock 3", a 44 dp target.
class _BlankChip extends StatelessWidget {
  const _BlankChip({required this.item});

  final RowItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: () => showAnswerSheet(context, attemptId: item.paper, questionId: item.qid ?? '', number: item.number, tryFirst: true),
      pressedScale: 0.97,
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: ReviewCopy.blankChipSpoken(item.number, item.paperName),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Center(
          widthFactor: 1,
          child: DecoratedBox(
            decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Text(ReviewCopy.blankChip(item.number, item.paperName), style: type.label.copyWith(color: colors.ink)),
            ),
          ),
        ),
      ),
    );
  }
}

class _MoreChip extends StatelessWidget {
  const _MoreChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.97,
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: 'Show $label',
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
        child: Center(widthFactor: 1, child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: Text(label, style: context.mmType.label.copyWith(color: colors.ink2)))),
      ),
    );
  }
}

class _LessonLink extends StatelessWidget {
  const _LessonLink({required this.title, required this.onTap});

  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = ReviewCopy.learnFirst(title);
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: label,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            label,
            style: type.labelLarge.copyWith(fontSize: 14.5, decoration: TextDecoration.underline, decorationColor: colors.lineStrong, color: colors.ink),
          ),
        ),
      ),
    );
  }
}
