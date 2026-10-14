import 'package:flutter/material.dart';

import '../../../core/domain/repair_candidates.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'life_row.dart';
import 'review_bits.dart';

/// The one lit element on Review: tonight's repair, led by the sheet itself. No object art here
/// (that is Today's): the chapter, then tonight's mistakes as wrong bubbles with their question
/// numbers, where they came from, the thread every mistake walks (Found, Repaired, Checked,
/// Holds), the volt key and the evidence pill.
class TonightCard extends StatelessWidget {
  const TonightCard({
    super.key,
    required this.pick,
    required this.onRepair,
    required this.onShowMe,
    required this.now,
    this.lateNight = false,
  });

  final TonightPick pick;
  final VoidCallback onRepair;
  final VoidCallback onShowMe;

  /// The student's clock, for "tonight" or "today".
  final DateTime now;

  /// After 11 PM: sleepy Mobi says one line.
  final bool lateNight;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = pick.items.length;
    final minutes = repairMinutes(n);

    return LitEdge(
      glow: true,
      child: MmClip(
        borderRadius: MmRadius.panelAll,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.raised, boxShadow: colors.cardShadow),
          child: Stack(
            children: [
              Positioned.fill(child: IgnorePointer(child: Grain(opacity: colors.grain * 0.7))),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ReviewCopy.tonightOverline(now, subjectName(pick.subjectId)), style: type.caption.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s4),
                    Semantics(
                      header: true,
                      child: Text(
                        pick.chapter,
                        // Two lines at the default size; a third when the student reads larger.
                        maxLines: MediaQuery.textScalerOf(context).scale(10) > 11.5 ? 3 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: type.title.copyWith(fontSize: 24, height: 28 / 24),
                      ),
                    ),
                    const SizedBox(height: MmSpace.s16),
                    _MistakeSheet(items: pick.items),
                    const SizedBox(height: MmSpace.s12),
                    Text(
                      ReviewCopy.tonightCount(n, pick.source, pick.chapterOpen),
                      style: type.small.copyWith(color: colors.ink2),
                    ),
                    const SizedBox(height: MmSpace.s16),
                    const LifeRow(stage: MistakeStage.found, bubbleSize: 14, animate: false),
                    const SizedBox(height: MmSpace.s20),
                    KeyButton(label: ReviewCopy.tonightKey(n, minutes), onPressed: onRepair),
                    const SizedBox(height: MmSpace.s4),
                    Row(
                      children: [
                        ShowMeTag(
                          count: n,
                          onTap: onShowMe,
                          semanticsLabel: 'Show me the ${n == 1 ? 'question' : '$n questions'} behind this',
                        ),
                        const Spacer(),
                        // Mobi stands by the key, pointing at it (asleep on his feet after 11 PM).
                        if (!lateNight) const Mobi(pose: MobiPose.point, size: 48),
                      ],
                    ),
                    if (lateNight) ...[
                      const SizedBox(height: MmSpace.s8),
                      const Mobi(pose: MobiPose.sleepy, size: 44, motion: MobiMotion.settle, say: ReviewCopy.lateNight),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tonight's mistakes as a strip of the answer sheet: 22 dp wrong bubbles in five columns, each
/// with its question number beneath.
class _MistakeSheet extends StatelessWidget {
  const _MistakeSheet({required this.items});

  final List<MistakeItem> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final numbers = [for (final i in items) i.number];
    return Semantics(
      label: ReviewCopy.wrongQuestionsSpoken(numbers),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final column = (constraints.maxWidth / 5).clamp(44.0, 64.0);
          return Wrap(
            runSpacing: MmSpace.s8,
            children: [
              for (final n in numbers)
                SizedBox(
                  width: column,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Bubble(state: BubbleState.wrong, size: 22, animate: false),
                      const SizedBox(height: 4),
                      Text('Q$n', style: context.mmType.caption.copyWith(fontSize: 11, color: colors.ink3)),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
