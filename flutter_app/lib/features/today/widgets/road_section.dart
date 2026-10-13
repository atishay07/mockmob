// "The road to May" (brief 12, 11): the weeks to the expected CUET window and the student's
// dream ladder, each college with the score that closed it in CSAS 2026 Round 1. The ladder is a
// rail of bubbles, dream at the top. Real figures only: without onboarding picks, no ladder.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';

class RoadSection extends StatelessWidget {
  const RoadSection({super.key, required this.road, this.onChooseColleges});

  final RoadModel road;
  final VoidCallback? onChooseColleges;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return FakeGlass(
      borderRadius: MmRadius.panelAll,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: Text(TodayCopy.roadTitle, style: type.title)),
            const SizedBox(height: MmSpace.s12),
            Semantics(
              container: true,
              label: 'About ${road.weeks} ${road.weeks == 1 ? 'week' : 'weeks'} to the expected May 2027 window',
              excludeSemantics: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  MonumentalNumber(value: '${road.weeks}', style: type.figure, roll: false),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(TodayCopy.weeksLabel(road.weeks), style: type.labelLarge.copyWith(color: colors.ink)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s8),
            Text(TodayCopy.boardsLine, style: type.caption.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            Divider(height: 1, thickness: 1, color: colors.line),
            const SizedBox(height: MmSpace.s16),
            if (road.ladder.isEmpty)
              Row(
                children: [
                  Expanded(child: Text(TodayCopy.ladderEmpty, style: type.body.copyWith(color: colors.ink2))),
                  if (onChooseColleges != null) KeyButton.quiet(label: TodayCopy.chooseColleges, onPressed: onChooseColleges),
                ],
              )
            else ...[
              Text(TodayCopy.ladderCaption(road.category), style: type.caption.copyWith(color: colors.ink3)),
              const SizedBox(height: MmSpace.s12),
              _Ladder(rungs: road.ladder),
            ],
          ],
        ),
      ),
    );
  }
}

class _Ladder extends StatelessWidget {
  const _Ladder({required this.rungs});

  final List<LadderRung> rungs;

  static const double _rail = 22;

  /// The fake-glass tint over the ground, as one opaque colour.
  static Color _cardColour(MmColors c) =>
      Color.alphaBlend((c.isNight ? c.raised2 : c.raised).withValues(alpha: c.isNight ? 0.56 : 0.7), c.ground);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Stack(
      children: [
        // The rail joining the rungs.
        Positioned(
          left: _rail / 2 - 0.5,
          top: 18,
          bottom: 18,
          child: SizedBox(width: 1, child: ColoredBox(color: colors.lineStrong)),
        ),
        Column(
          children: [
            for (final r in rungs)
              Semantics(
                container: true,
                label: '${r.college}, ${r.course}. Closed at ${r.score}${r.outOf == null ? '' : ' of ${r.outOf}'}${r.dream ? '. Your dream pick' : ''}',
                excludeSemantics: true,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
                  child: Row(
                    children: [
                      SizedBox(
                        width: _rail,
                        child: Center(
                          // A disc of the card's own colour keeps the rail from showing through.
                          child: DecoratedBox(
                            decoration: BoxDecoration(shape: BoxShape.circle, color: _cardColour(colors)),
                            child: Bubble(state: BubbleState.hollow, size: r.dream ? 14 : 12, emphasis: r.dream, animate: false),
                          ),
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.college, style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
                            Text(r.course, style: type.caption.copyWith(color: colors.ink2)),
                          ],
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Text(r.score, style: type.title.copyWith(fontSize: 22, height: 1)),
                      if (r.outOf != null) ...[
                        const SizedBox(width: MmSpace.s4),
                        Text('of ${r.outOf}', style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
