// "The road to May" (brief 11, 12; owner feedback 13 Oct "the road ... can be improved";
// ui-blitz/today.md 2.4 and 2.5): what the calendar really holds between now and the exam
// window, typeset on the ground. The weeks to the expected window as one condensed figure (or,
// from 1 May 2027, the window being open), the road drawn to scale with the stretch travelled
// and one tick a week, the stops as a timeline with how far each is and the next one marked,
// the study sessions the student's own goal gives them, then the colleges on one score scale.
// Calendar arithmetic and the student's choices only: nothing here predicts marks or chances.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'college_ladder.dart';
import 'road_timeline.dart';
import 'section_heading.dart';

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
        const TodaySectionHeading(title: TodayCopy.roadTitle),
        const SizedBox(height: MmSpace.s16),
        // One figure; the road itself is the picture.
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
        const SizedBox(height: MmSpace.s20),
        RoadTimeline(today: road.today, stops: road.stops, end: road.end),
        if (road.stops.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s16),
          RoadStops(stops: road.stops, today: road.today),
        ],
        if (road.phase != RoadPhase.countdown)
          const SizedBox.shrink()
        else if (road.studyDays case final n? when road.goal != null) ...[
          const SizedBox(height: MmSpace.s20),
          Text(TodayCopy.sessionsLine(n, road.goal!), style: type.body.copyWith(color: colors.ink2)),
        ] else if (road.weeksToBoards == 0) ...[
          const SizedBox(height: MmSpace.s20),
          Text(TodayCopy.boardsOn, style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s40),
        CollegeLadder(road: road, onChoose: onChooseColleges),
      ],
    );
  }
}

/// The figure with its two-line meaning beside it.
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
              MonumentalNumber(value: value, style: type.figure.copyWith(fontSize: 76, height: 68 / 76), roll: false),
              const SizedBox(width: MmSpace.s12),
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(unit, style: type.labelLarge.copyWith(color: colors.ink, fontSize: 16, height: 21 / 16)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
