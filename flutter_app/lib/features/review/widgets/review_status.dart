import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import 'review_bits.dart';

/// "3 of 12 repaired": how many of the mistakes found so far are repaired, read from the index
/// and nothing else. A quiet neutral bar, no Mobi, no volt: the volt belongs to the repair key.
class RepairsProgress extends StatelessWidget {
  const RepairsProgress({super.key, required this.repaired, required this.found});

  final int repaired;
  final int found;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final fraction = found <= 0 ? 0.0 : (repaired / found).clamp(0.0, 1.0);
    return Semantics(
      label: ReviewCopy.repairsProgressSemantics(repaired, found),
      excludeSemantics: true,
      child: Row(
        children: [
          Text(ReviewCopy.repairsProgress(repaired, found), style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: SizedBox(
                height: 4,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(color: colors.line),
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: fraction),
                      duration: Motion.of(context, Motion.card),
                      curve: Motion.glide,
                      builder: (context, value, _) =>
                          Align(alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: value, child: ColoredBox(color: colors.ink2))),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Open mistakes exist but none can carry tonight's repair: say why, and offer the one repair
/// that does run. Never the all-clear card, which would deny the list below it.
class NoTonightCard extends StatelessWidget {
  const NoTonightCard({super.key, required this.inShortPractice, required this.inUnopenedResult, this.offer, this.onRepair});

  /// Some open mistakes are in a practice shorter than 10 questions.
  final bool inShortPractice;

  /// Some open mistakes are in a mock whose result has not been opened yet.
  final bool inUnopenedResult;

  /// The paper whose open mistakes the key repairs; null offers no key.
  final PaperOpen? offer;
  final VoidCallback? onRepair;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reasons = [
      if (inShortPractice) ReviewCopy.noTonightShort,
      if (inUnopenedResult) ReviewCopy.noTonightUnopened,
    ];
    final offer = this.offer;
    return SolidPanel(
      padding: const EdgeInsets.all(MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(ReviewCopy.noTonightTitle, style: type.cardTitle)),
          for (final r in reasons) ...[const SizedBox(height: MmSpace.s8), Text(r, style: type.small.copyWith(color: colors.ink2))],
          if (offer != null && onRepair != null) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: ReviewCopy.repairGroupFromKey(offer.items.length, offer.source), onPressed: onRepair),
          ],
        ],
      ),
    );
  }
}
