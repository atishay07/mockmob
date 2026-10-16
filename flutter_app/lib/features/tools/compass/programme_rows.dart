import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../widgets/tools_page.dart';
import 'cutoff_bar.dart';

/// The Round 1 verdict for an estimate ([score], up to [scoreHigh] for a range), from the
/// programme's effective cutoff range: above when even the low end clears every college, within
/// when the top of the estimate reaches the lowest, below otherwise.
(String, ToolTone)? roundOneVerdict(DuGroup group, String category, double? score, [double? scoreHigh]) {
  final r1 = group.roundOne(category);
  if (score == null || !group.hasCutoffs || r1 == null || r1.low == null || r1.high == null) return null;
  final top = scoreHigh ?? score;
  if (score >= r1.high!) return (ToolsCopy.verdictAbove, ToolTone.good);
  if (top >= r1.low!) return (ToolsCopy.verdictWithin, ToolTone.mid);
  return (ToolsCopy.verdictBelow, ToolTone.low);
}

/// One open programme: its name, how many colleges and the Round I range for the category, and,
/// with a score, where the score sits in that range. Opens the programme.
class ProgrammeRow extends StatelessWidget {
  const ProgrammeRow({super.key, required this.verdict, required this.category, required this.score, required this.onTap, this.couldClear = false, this.bar = false, this.scoreHigh});

  final DuVerdict verdict;
  final String category;

  /// The student's estimate: its low end (or one figure) and, for a range, its high end.
  final double? score;
  final double? scoreHigh;
  final VoidCallback onTap;

  /// The student's score meets the lowest cutoff of some round (the website's `couldClear`): a
  /// small volt dot springs in beside the name. False without a score.
  final bool couldClear;

  /// The Round I range as a bar with the student's score pinned on it (the best options), instead
  /// of a line of figures. The figures stay, under the bar's two ends.
  final bool bar;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final group = verdict.group;
    final r1 = group.roundOne(category);
    final range = group.hasCutoffs && r1 != null
        ? ToolsCopy.roundOneRange(category, duFormatScore(r1.low), duFormatScore(r1.high))
        : null;
    final collegesLine = group.hasCutoffs ? ToolsCopy.colleges(group.colleges) : ToolsCopy.noCutoffList;
    final v = roundOneVerdict(group, category, score, scoreHigh);
    final label = [group.name, collegesLine, ?range, if (verdict.secondary) ToolsCopy.secondaryNote, ?v?.$1, if (couldClear) ToolsCopy.couldClearDot].join('. ');
    return ToolsRowFrame(
      onTap: onTap,
      semanticsLabel: label,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(group.name, style: type.labelLarge.copyWith(fontSize: 16))),
                    if (couldClear) ...[const SizedBox(width: MmSpace.s8), const CouldClearDot()],
                  ],
                ),
                // The college count stands in its own column on the right; a programme without a
                // cutoff list says so here instead.
                if (!group.hasCutoffs) ...[
                  const SizedBox(height: MmSpace.s2),
                  Text(collegesLine, style: type.caption.copyWith(color: colors.ink2)),
                ],
                if (range != null && bar && r1?.low != null && r1?.high != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  CutoffBar(category: category, low: r1!.low!, high: r1.high!, score: score, scoreHigh: scoreHigh),
                ] else if (range != null) ...[
                  const SizedBox(height: MmSpace.s2),
                  Text(range, style: type.caption.copyWith(color: colors.ink2)),
                ],
                if (verdict.secondary || group.eligibility.performanceTest || v != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Wrap(
                    spacing: MmSpace.s6,
                    runSpacing: MmSpace.s6,
                    children: [
                      if (v != null) ToolTag(v.$1, tone: v.$2),
                      if (verdict.secondary) const ToolTag('Only if seats remain'),
                      if (group.eligibility.performanceTest) const ToolTag('Also a performance test'),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (group.hasCutoffs) ...[
            const SizedBox(width: MmSpace.s12),
            CollegeCount(count: group.colleges),
          ],
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
      ),
    );
  }
}

/// How many colleges a programme is at, as a right-aligned figure over "colleges": the number a
/// student compares down the list, so the rich programmes (55, 44) stand out from the rare ones.
class CollegeCount extends StatelessWidget {
  const CollegeCount({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ExcludeSemantics(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 48),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$count',
              textHeightBehavior: MmType.figureHeightBehavior,
              style: type.figureCompact.copyWith(fontSize: 24, height: 1.0, color: colors.ink),
            ),
            const SizedBox(height: 2),
            Text(ToolsCopy.collegesUnit(count), style: type.caption.copyWith(color: colors.ink3, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

/// A programme the subjects do not open yet, with what the nearest combination still needs.
class NearRow extends StatelessWidget {
  const NearRow({super.key, required this.verdict, required this.catalog, required this.onTap});

  final DuVerdict verdict;
  final DuCatalog catalog;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final gaps = [for (final g in verdict.nearest?.gaps ?? const <DuGap>[]) duDescribeGap(g, catalog)].join(', ');
    return ToolsRowFrame(
      onTap: onTap,
      semanticsLabel: '${verdict.group.name}. Not open yet. $gaps',
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, 12, MmSpace.s16, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(verdict.group.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(color: colors.ink)),
                if (gaps.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(gaps, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
      ),
    );
  }
}

/// The could-clear dot: 8 dp of volt that springs in (0 to 1 with a small overshoot, 360 ms)
/// when a score makes it true. Drawn at once under reduced motion.
class CouldClearDot extends StatelessWidget {
  const CouldClearDot({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final dot = ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(shape: BoxShape.circle, color: colors.isNight ? colors.volt : colors.accentText),
        child: const SizedBox.square(dimension: 8),
      ),
    );
    if (Motion.reduced(context)) return dot;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutBack,
      builder: (context, t, child) => Transform.scale(scale: t.clamp(0.0, 1.3), child: child),
      child: dot,
    );
  }
}
