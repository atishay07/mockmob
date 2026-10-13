// "The road to May" (brief 11, 12; owner feedback 13 Oct "the road ... can be improved"): what
// the calendar really holds between now and the CSAS rounds, made useful. The weeks to the
// expected window, the weeks before boards take the evenings, the study days the student's own
// goal gives them, what this week still asks for, the road drawn to scale with its stops in
// words, and the dream ladder with the real CSAS 2026 Round 1 closing score of each pick.
// Calendar arithmetic and the student's choices only: nothing here predicts marks or chances.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'road_timeline.dart';

class RoadSection extends StatelessWidget {
  const RoadSection({super.key, required this.road, this.onChooseColleges, this.onWeek});

  final RoadModel road;
  final VoidCallback? onChooseColleges;

  /// Kept for callers; the week lives in the strip at the top of Today.
  final VoidCallback? onWeek;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FakeGlass(
          borderRadius: MmRadius.panelAll,
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.cardPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(header: true, child: Text(TodayCopy.roadTitle, style: type.title)),
                const SizedBox(height: MmSpace.s12),
                // One hero number; the road itself is the picture.
                _Stat(value: '${road.weeks}', unit: TodayCopy.weeksLabel(road.weeks)),
                const SizedBox(height: MmSpace.s16),
                RoadTimeline(today: road.today, stops: road.stops),
                const SizedBox(height: MmSpace.s8),
                RoadLegend(stops: road.stops),
                if (road.studyDays case final n? when road.goal != null) ...[
                  const SizedBox(height: MmSpace.s16),
                  Text(TodayCopy.sessionsLine(n, road.goal!), style: type.body.copyWith(color: colors.ink2)),
                ] else if (road.weeksToBoards == 0) ...[
                  const SizedBox(height: MmSpace.s16),
                  Text(TodayCopy.boardsOn, style: type.body.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.group),
        FakeGlass(
          borderRadius: MmRadius.panelAll,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s16, MmSpace.cardPadding, MmSpace.s16),
            child: _Ladder(road: road, onChoose: onChooseColleges),
          ),
        ),
      ],
    );
  }
}

/// The hero figure with its two-line meaning beside it.
class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.unit});

  final String value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '$value ${unit.replaceAll('\n', ' ')}',
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          MonumentalNumber(value: value, style: type.figure, roll: false),
          const SizedBox(width: MmSpace.s12),
          Flexible(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(unit, style: type.labelLarge.copyWith(color: colors.ink)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Ladder extends StatelessWidget {
  const _Ladder({required this.road, this.onChoose});

  final RoadModel road;
  final VoidCallback? onChoose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rungs = road.ladder;
    final heading = Row(
      children: [
        Expanded(child: Semantics(header: true, child: Text(TodayCopy.ladderTitle, style: type.labelLarge.copyWith(fontSize: 16)))),
        if (onChoose != null && rungs.isNotEmpty) KeyButton.quiet(label: TodayCopy.changeColleges, onPressed: onChoose),
      ],
    );
    if (rungs.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading,
          const SizedBox(height: MmSpace.s4),
          Text(TodayCopy.ladderEmpty, style: type.body.copyWith(color: colors.ink2)),
          if (onChoose != null) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: TodayCopy.chooseColleges, onPressed: onChoose),
          ],
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        heading,
        Text(TodayCopy.ladderCaption(road.category), style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s8),
        for (final r in rungs)
          Semantics(
            container: true,
            label: '${r.college}, ${r.course}. Closed at ${r.score}${r.outOf == null ? '' : ' of ${r.outOf}'}${r.dream ? '. Your dream pick' : ''}',
            excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (r.dream)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 2),
                            child: Text(
                              TodayCopy.dreamTag.toUpperCase(),
                              style: type.caption.copyWith(fontSize: 11, height: 14 / 11, letterSpacing: 0.8, fontWeight: FontWeight.w700, color: colors.accentText),
                            ),
                          ),
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
    );
  }
}
