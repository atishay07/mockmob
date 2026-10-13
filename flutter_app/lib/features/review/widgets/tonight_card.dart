import 'package:flutter/material.dart';

import '../../../core/domain/repair_candidates.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'review_bits.dart';

/// The one lit element on Review: tonight's repair. The subject's object sits in its own light
/// field at the top right; the reading side stays on the solid card. One monumental number
/// (the open mistakes in that chapter), its meaning, the volt key and the evidence tag.
class TonightCard extends StatelessWidget {
  const TonightCard({super.key, required this.pick, required this.onRepair, required this.onShowMe, this.lateNight = false});

  final TonightPick pick;
  final VoidCallback onRepair;
  final VoidCallback onShowMe;

  /// After 11 PM: sleepy Mobi says one line instead of the Hinglish caption.
  final bool lateNight;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = pick.items.length;
    final minutes = repairMinutes(n);
    final light = SubjectLight.forSubject(pick.subjectId);
    final art = MmArt.subjectObject(pick.subjectId);
    final brightness = Theme.of(context).brightness;

    return LitEdge(
      glow: true,
      child: MmClip(
        borderRadius: MmRadius.panelAll,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.raised, boxShadow: colors.cardShadow),
          child: Stack(
            children: [
              // Environment: the subject's colour pooled behind its object, the lamp from the
              // upper left. Both stay in the art corner, away from the text.
              Positioned(
                right: -40,
                top: -30,
                width: 260,
                height: 220,
                child: LightField(
                  pools: [
                    if (light != null) LightPool(color: light.of(brightness), center: const Alignment(0.1, -0.1), radius: 0.62),
                    LightPool(
                      color: colors.lamp.withValues(alpha: colors.isNight ? 0.16 : 0.12),
                      center: const Alignment(-0.3, -0.6),
                      radius: 0.5,
                    ),
                  ],
                ),
              ),
              Positioned.fill(
                child: IgnorePointer(child: Grain(opacity: colors.grain * 0.7)),
              ),
              if (art != null) Positioned(right: 6, top: 10, child: ArtImage(art, height: 128, width: 128)),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 120),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(ReviewCopy.tonightOverline, style: type.caption.copyWith(color: colors.ink2)),
                          const SizedBox(height: MmSpace.s4),
                          Semantics(header: true, child: Text(pick.chapter, style: type.headline)),
                        ],
                      ),
                    ),
                    const SizedBox(height: MmSpace.s12),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: MonumentalNumber(
                        value: '$n',
                        unit: ReviewCopy.tonightUnit(n),
                        style: type.figure.copyWith(fontSize: 76, height: 0.9),
                        semanticsLabel: '${ReviewCopy.tonightUnit(n)}: $n',
                      ),
                    ),
                    const SizedBox(height: MmSpace.s8),
                    Text(
                      ReviewCopy.tonightSource(pick.source, subjectName(pick.subjectId)),
                      style: type.small.copyWith(color: colors.ink2),
                    ),
                    const SizedBox(height: MmSpace.s20),
                    KeyButton(label: ReviewCopy.tonightKey(n), onPressed: onRepair),
                    const SizedBox(height: MmSpace.s8),
                    Row(
                      children: [
                        ShowMeTag(
                          count: n,
                          onTap: onShowMe,
                          semanticsLabel: 'Show me the ${n == 1 ? 'question' : '$n questions'} behind this',
                        ),
                        const SizedBox(width: MmSpace.s12),
                        if (!lateNight && minutes != null)
                          Expanded(
                            child: Text(ReviewCopy.aajKaRepair(minutes, pick.chapter), style: type.caption.copyWith(color: colors.ink3)),
                          ),
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
