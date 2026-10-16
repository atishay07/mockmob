// The two record rows that close Today (TODAY-1017 4.5): "Last paper" (the newest opened paper,
// which opens its result) and "Your colleges" (the first of My colleges with its 2026 Round 1
// cutoff, which opens Colleges). Rows on the ground with hairlines, never cards; each row is one
// target the full width and at least 76 dp tall. The colleges row never shows an estimate or a
// chance: the practice score and the DU score are different scales, and Colleges owns that.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'colleges_card.dart' show CollegesCardStatus;
import 'today_pill.dart';
import 'today_type.dart';

class TodayRows extends StatelessWidget {
  const TodayRows({
    super.key,
    this.lastPaper,
    this.firstCollege,
    this.collegesSaved = 0,
    this.collegesStatus = CollegesCardStatus.ready,
    this.onPaper,
    this.onColleges,
    this.onChoose,
    this.onRetry,
  });

  final LastPaper? lastPaper;

  /// The first of My colleges, or null when the list is empty.
  final LadderRung? firstCollege;

  /// How many colleges are saved in all ("2 more saved").
  final int collegesSaved;
  final CollegesCardStatus collegesStatus;
  final void Function(TodayTarget target)? onPaper;
  final VoidCallback? onColleges;
  final VoidCallback? onChoose;
  final VoidCallback? onRetry;

  static const double minRow = 76;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final paper = lastPaper;
    final rule = Divider(height: 1, thickness: 1, color: colors.line);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (paper != null) ...[
          rule,
          _Row(
            label: TodayCopy.lastPaperTitle,
            title: paper.title,
            sub: paper.sub,
            subAccent: paper.up == true ? paper.change : null,
            figure: '${paper.marks}',
            denominator: TodayCopy.ofDenominator(paper.outOf),
            onTap: onPaper == null ? null : () => onPaper!(paper.target),
          ),
        ],
        rule,
        _colleges(context),
        rule,
      ],
    );
  }

  Widget _colleges(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final first = firstCollege;
    if (first != null) {
      final more = collegesSaved - 1;
      return _Row(
        label: TodayCopy.collegesRowTitle,
        title: first.college,
        sub: TodayCopy.collegesSub(first.course, more < 0 ? 0 : more),
        figure: first.score,
        denominator: first.outOf == null ? null : TodayCopy.ofDenominator(first.outOf!),
        onTap: onColleges,
      );
    }
    final Widget body;
    switch (collegesStatus) {
      case CollegesCardStatus.loading:
        body = const SkeletonGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [Skeleton.line(width: 90, height: 12), SizedBox(height: MmSpace.s8), Skeleton.line(width: 220), SizedBox(height: MmSpace.s6), Skeleton.line(width: 160, height: 12)],
          ),
        );
      case CollegesCardStatus.failed:
        body = Row(
          children: [
            Expanded(child: Text(TodayCopy.collegesFailed, style: type.body.copyWith(color: colors.ink))),
            if (onRetry != null) KeyButton.quiet(label: TodayCopy.tryAgain, onPressed: onRetry),
          ],
        );
      case CollegesCardStatus.ready:
        // An empty state that teaches: what appears here, and the one way to fill it.
        body = Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(TodayCopy.collegesRowTitle, style: type.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s2),
                  Text(TodayCopy.collegesEmpty, style: type.body.copyWith(color: colors.ink)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            SizedBox(width: 120, child: TodayPill(label: TodayCopy.choose, icon: LucideIcons.plus, onTap: onChoose)),
          ],
        );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: minRow),
      child: Padding(padding: const EdgeInsets.symmetric(vertical: MmSpace.s12), child: Align(alignment: Alignment.centerLeft, child: body)),
    );
  }
}

/// One row: the label, the title and the line under it on the left; the figure with its
/// denominator under it on the right; a chevron at the end. The whole row is the target.
class _Row extends StatelessWidget {
  const _Row({required this.label, required this.title, required this.sub, required this.figure, this.denominator, this.subAccent, this.onTap});

  final String label;
  final String title;
  final String sub;

  /// The part of [sub] set in the accent (a rise: "+33 on Mock 6").
  final String? subAccent;
  final String figure;
  final String? denominator;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final subStyle = type.caption.copyWith(fontSize: 13.5, color: colors.ink2);
    final at = subAccent == null ? -1 : sub.indexOf(subAccent!);
    return MmPressable(
      onTap: onTap,
      semanticsLabel: TodayCopy.rowSemantics(label, title, sub, denominator == null ? figure : '$figure ${denominator!}'),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        color: pressed ? colors.raised2.withValues(alpha: 0.6) : Colors.transparent,
        constraints: const BoxConstraints(minHeight: TodayRows.minRow),
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label, style: type.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s2),
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: colors.ink)),
                  const SizedBox(height: MmSpace.s2),
                  Text.rich(
                    at < 0
                        ? TextSpan(text: sub)
                        : TextSpan(children: [
                            TextSpan(text: sub.substring(0, at)),
                            TextSpan(text: subAccent, style: TextStyle(color: accent, fontWeight: FontWeight.w600)),
                            TextSpan(text: sub.substring(at + subAccent!.length)),
                          ]),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: subStyle,
                  ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(figure, style: type.scoreFigure.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                if (denominator != null) ...[
                  const SizedBox(height: MmSpace.s2),
                  Text(denominator!, style: type.micro.copyWith(color: colors.ink3)),
                ],
              ],
            ),
            const SizedBox(width: MmSpace.s8),
            Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}
