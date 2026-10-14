import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../widgets/tools_page.dart';

/// The Round I verdict for a score, from the programme's effective cutoff range.
(String, ToolTone)? roundOneVerdict(DuGroup group, String category, double? score) {
  final r1 = group.roundOne(category);
  if (score == null || !group.hasCutoffs || r1 == null || r1.low == null || r1.high == null) return null;
  if (score >= r1.high!) return (ToolsCopy.verdictAbove, ToolTone.good);
  if (score >= r1.low!) return (ToolsCopy.verdictWithin, ToolTone.mid);
  return (ToolsCopy.verdictBelow, ToolTone.low);
}

/// One open programme: its name, how many colleges and the Round I range for the category, and,
/// with a score, where the score sits in that range. Opens the programme.
class ProgrammeRow extends StatelessWidget {
  const ProgrammeRow({super.key, required this.verdict, required this.category, required this.score, required this.onTap, this.couldClear = false});

  final DuVerdict verdict;
  final String category;
  final double? score;
  final VoidCallback onTap;

  /// The student's score meets the lowest cutoff of some round (the website's `couldClear`): a
  /// small volt dot springs in beside the name. False without a score.
  final bool couldClear;

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
    final v = roundOneVerdict(group, category, score);
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
                const SizedBox(height: MmSpace.s2),
                Text(collegesLine, style: type.caption.copyWith(color: colors.ink2)),
                if (range != null) Text(range, style: type.caption.copyWith(color: colors.ink2)),
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
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
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
