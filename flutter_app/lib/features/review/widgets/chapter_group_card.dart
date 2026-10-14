import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'review_bits.dart';

/// One chapter's mistakes as a thread card: the subject's object in its light, the chapter, a
/// line of bubbles (open mistakes as wrong bubbles, repaired ones ringed), and on tap the
/// questions themselves with a key to repair them.
class ChapterGroupCard extends StatefulWidget {
  const ChapterGroupCard({super.key, required this.group, required this.clock, required this.onOpen, this.initiallyExpanded = false});

  final ChapterGroup group;
  final ReviewClock clock;

  /// Opens the repair at a mistake.
  final ValueChanged<MistakeItem> onOpen;
  final bool initiallyExpanded;

  @override
  State<ChapterGroupCard> createState() => _ChapterGroupCardState();
}

class _ChapterGroupCardState extends State<ChapterGroupCard> {
  static const int _stripMax = 10;

  late bool _expanded = widget.initiallyExpanded;

  static QuestionCell _cell(MistakeStage s) => switch (s) {
    MistakeStage.repaired => QuestionCell.repaired,
    MistakeStage.setAside => QuestionCell.changed,
    _ => QuestionCell.wrong,
  };

  List<MistakeItem> get _ordered {
    int rank(MistakeItem i) => i.stage.isOpen ? 0 : (i.stage == MistakeStage.repaired ? 1 : 2);
    return [...widget.group.items]..sort((a, b) {
      final r = rank(a) - rank(b);
      if (r != 0) return r;
      final t = b.foundAt.compareTo(a.foundAt);
      return t != 0 ? t : a.number.compareTo(b.number);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final g = widget.group;
    final items = _ordered;
    final papers = g.openByPaper;
    final summary = ReviewCopy.groupLine(subjectName(g.subjectId), g.openCount, g.repairedCount, g.setAsideCount);

    return SolidPanel(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmPressable(
            onTap: () => setState(() => _expanded = !_expanded),
            pressedScale: 0.985,
            focusRadius: MmRadius.panelAll,
            semanticsLabel: '${g.chapter}. $summary. ${ReviewCopy.groupExpandHint(_expanded)}',
            builder: (context, pressed, _) => Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      SubjectGlyphTile(g.subjectId),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.chapter, style: type.cardTitle),
                            const SizedBox(height: 2),
                            Text(summary, style: type.caption.copyWith(color: colors.ink2)),
                          ],
                        ),
                      ),
                      AnimatedRotation(
                        turns: _expanded ? 0.5 : 0,
                        duration: Motion.of(context, Motion.ui),
                        curve: Motion.glide,
                        child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
                      ),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s12),
                  // At most ten marks on one line, then "+3": the count is in the line above.
                  Padding(
                    padding: const EdgeInsets.only(left: 52),
                    child: Row(
                      children: [
                        QuestionStrip(
                          cells: [for (final i in items.take(_stripMax)) _cell(i.stage)],
                          columns: _stripMax,
                          cellSize: 14,
                          gap: 6,
                          semanticsLabel: summary,
                        ),
                        if (items.length > _stripMax) ...[
                          const SizedBox(width: MmSpace.s6),
                          ExcludeSemantics(
                            child: Text('+${items.length - _stripMax}', style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // The size snaps (no layout animation inside a scrolling list); the rows fade in.
          AnimatedSwitcher(
            duration: Motion.of(context, Motion.card),
            switchInCurve: Motion.glide,
            switchOutCurve: Motion.exit,
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [?current]),
            child: !_expanded
                ? const SizedBox(key: ValueKey('closed'), width: double.infinity)
                : Column(
                    key: const ValueKey('open'),
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Divider(height: 1, color: colors.line),
                      for (final item in items) MistakeRow(item: item, clock: widget.clock, onTap: () => widget.onOpen(item)),
                      // One key per paper: a run covers one chapter of one paper, so the number on
                      // the key is the number of mistakes the run holds.
                      if (papers.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s8, MmSpace.s16, MmSpace.s16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              for (var i = 0; i < papers.length; i++) ...[
                                if (i > 0) const SizedBox(height: MmSpace.s8),
                                KeyButton.secondary(
                                  label: papers.length == 1
                                      ? ReviewCopy.repairGroupKey(papers[i].items.length)
                                      : ReviewCopy.repairGroupFromKey(papers[i].items.length, papers[i].source),
                                  onPressed: () => widget.onOpen(papers[i].items.first),
                                ),
                              ],
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// One mistake: its bubble, the question number, where and when it was found, its stage.
class MistakeRow extends StatelessWidget {
  const MistakeRow({super.key, required this.item, required this.clock, required this.onTap});

  final MistakeItem item;
  final ReviewClock clock;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final found = ReviewCopy.foundIn(item.source, formatDayMonth(clock.local(item.foundAt)));
    final tappable = item.stage != MistakeStage.setAside;
    final label = '${ReviewCopy.questionLabel(item.number)}, ${item.chapter}. $found. ${_stageWord(item.stage)}.';
    return MmPressable(
      onTap: tappable ? onTap : null,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      semanticsLabel: label,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ReviewCopy.questionLabel(item.number), style: type.labelLarge),
                    const SizedBox(height: 2),
                    Text(found, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              StageChip(item.stage),
            ],
          ),
        ),
      ),
    );
  }

  static String _stageWord(MistakeStage s) => switch (s) {
    MistakeStage.found => ReviewCopy.found,
    MistakeStage.reviewed => ReviewCopy.reviewed,
    MistakeStage.repaired => ReviewCopy.repaired,
    MistakeStage.setAside => ReviewCopy.setAside,
  };
}

/// "12 mistakes across 4 chapters".
String mistakesSummaryOf(ReviewIndex index) => ReviewCopy.mistakesSummary(index.openCount, index.openGroups.length);

/// "3 October" style for an attempt date, in the student's day.
String attemptDate(ReviewClock clock, DateTime t) => formatDayMonth(clock.local(t));
