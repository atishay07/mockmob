// "The road to May" (brief 11, 12; owner feedback 13 Oct "the road ... can be improved"): what
// the calendar really holds between now and the exam window, made useful. The weeks to the
// expected window (or, from 1 May 2027, the window being open), the road drawn to scale with
// every stop listed under it with its dates, the study days the student's own goal gives them,
// and the dream ladder with last year's closing score of each pick.
// Calendar arithmetic and the student's choices only: nothing here predicts marks or chances.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'road_timeline.dart';

class RoadSection extends StatelessWidget {
  const RoadSection({super.key, required this.road, this.onChooseColleges});

  final RoadModel road;
  final VoidCallback? onChooseColleges;

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
                Semantics(
                  header: true,
                  child: Text(TodayCopy.roadTitle, style: type.title),
                ),
                const SizedBox(height: MmSpace.s12),
                // One hero figure; the road itself is the picture.
                switch (road.phase) {
                  // Under a week out the card counts days; "0 weeks" would read as the window being here.
                  RoadPhase.countdown when road.weeks < 1 && (road.daysToWindow ?? 0) > 0 =>
                    _Stat(value: '${road.daysToWindow}', unit: TodayCopy.daysToWindowLabel(road.daysToWindow!)),
                  RoadPhase.countdown => _Stat(value: '${road.weeks}', unit: TodayCopy.weeksLabel(road.weeks)),
                  RoadPhase.window => _Stat(
                      value: '${road.daysLeft ?? 0}',
                      unit: TodayCopy.windowDaysLeft(road.daysLeft ?? 0),
                      headline: TodayCopy.windowOpen,
                    ),
                },
                const SizedBox(height: MmSpace.s16),
                RoadTimeline(today: road.today, stops: road.stops, end: road.end),
                if (road.stops.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s8),
                  RoadStops(stops: road.stops),
                ],
                if (road.phase != RoadPhase.countdown)
                  const SizedBox.shrink()
                else if (road.studyDays case final n? when road.goal != null) ...[
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
  const _Stat({required this.value, required this.unit, this.headline});

  final String value;
  final String unit;

  /// A line above the figure ("Exam window open").
  final String? headline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '${headline == null ? '' : '$headline. '}$value ${unit.replaceAll('\n', ' ')}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (headline != null) ...[
            Text(headline!, style: type.labelLarge.copyWith(color: colors.isNight ? colors.volt : colors.accentText)),
            const SizedBox(height: MmSpace.s4),
          ],
          Row(
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
                              TodayCopy.dreamTag,
                              style: type.caption.copyWith(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w700, color: colors.accentText),
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
