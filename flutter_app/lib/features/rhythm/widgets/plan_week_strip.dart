// The week as seven columns, Monday first: the weekday letter, then one answer bubble that says
// what the day is (counted, planned, rest, or not yet), and the date under it when [showDates].
// Today is the bubble with a 2 dp ink ring and the letter in a heavier weight (no tile). Every bubble is a state, never
// decoration. Shared by Today's week row and the week sheet.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show Bubble, BubbleState;
import '../logic/plan_week.dart';

class PlanWeekStrip extends StatelessWidget {
  const PlanWeekStrip({super.key, required this.days, this.bubble = 22, this.showDates = false});

  final List<PlanDay> days;
  final double bubble;
  final bool showDates;

  String describe() => days.map((d) => d.describe()).join('; ');

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Row(
        children: [for (final d in days) Expanded(child: _DayColumn(day: d, bubble: bubble, showDate: showDates))],
      ),
    );
  }
}

class _DayColumn extends StatelessWidget {
  const _DayColumn({required this.day, required this.bubble, required this.showDate});

  final PlanDay day;
  final double bubble;
  final bool showDate;

  BubbleState get _state => switch (day.mark) {
        PlanDayMark.done => BubbleState.filled,
        PlanDayMark.rest => BubbleState.rest,
        PlanDayMark.planned || PlanDayMark.open => BubbleState.hollow,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final today = day.isToday;
    final letterStyle = type.caption.copyWith(
      fontSize: 12,
      height: 16 / 12,
      fontWeight: today ? FontWeight.w700 : FontWeight.w500,
      color: today ? colors.ink : (day.mark == PlanDayMark.rest ? colors.ink3 : colors.ink2),
      letterSpacing: 0.4,
    );
    // A planned day ahead is a brighter ring than a day with nothing planned, so the plan reads
    // at a glance without a legend.
    final planned = day.mark == PlanDayMark.planned;
    final mark = Opacity(
      opacity: day.mark == PlanDayMark.open && !today ? 0.55 : 1,
      child: Bubble(state: _state, size: bubble, emphasis: today && planned, animate: false),
    );
    // Today: a 2 dp ink ring around the bubble, 3 dp clear of it.
    final ringed = !today
        ? mark
        : DecoratedBox(
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink, width: 2)),
            child: Padding(padding: const EdgeInsets.all(3), child: mark),
          );
    final column = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(day.initial, style: letterStyle, textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3)),
          const SizedBox(height: MmSpace.s6),
          SizedBox(height: bubble + 10, child: Center(child: ringed)),
          if (showDate && day.date != null) ...[
            const SizedBox(height: MmSpace.s2),
            Text(
              '${day.date}',
              style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: today ? colors.ink : colors.ink3),
              textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
            ),
          ],
        ],
      ),
    );
    return column;
  }
}
