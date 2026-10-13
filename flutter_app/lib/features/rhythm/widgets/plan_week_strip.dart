// The week as seven columns, Monday first: the weekday letter, then one answer bubble that says
// what the day is (counted, planned, rest, or not yet), and the date under it when [showDates].
// Today is the bubble with a 2 dp ink ring and the letter in a heavier weight (no tile). Every bubble is a state, never
// decoration. Shared by Today's week row and the week sheet.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show Bubble, BubbleState;
import '../copy.dart';
import '../logic/plan_week.dart';

class PlanWeekStrip extends StatelessWidget {
  const PlanWeekStrip({super.key, required this.days, this.bubble = 22, this.showDates = false, this.daySemantics = false});

  final List<PlanDay> days;
  final double bubble;
  final bool showDates;

  /// Each day is its own screen-reader stop ("Wednesday, today, planned study day"). Off where
  /// the strip sits inside a control that reads [describe] as one label (Today's week row).
  final bool daySemantics;

  String describe() => days.map((d) => d.describe()).join('; ');

  @override
  Widget build(BuildContext context) {
    final row = Row(
      children: [
        for (final d in days)
          Expanded(
            child: daySemantics
                ? Semantics(container: true, label: d.describe(), excludeSemantics: true, child: _DayColumn(day: d, bubble: bubble, showDate: showDates))
                : _DayColumn(day: d, bubble: bubble, showDate: showDates),
          ),
      ],
    );
    return daySemantics ? row : ExcludeSemantics(child: row);
  }
}

/// The one-line key under the strip: a small mark and its word, for each kind of mark the strip
/// shows now (owner 13 Oct: every dot must mean something, so the marks are named). Decorative
/// for screen readers, which read each day in words.
class PlanWeekKey extends StatelessWidget {
  const PlanWeekKey({super.key, required this.days});

  final List<PlanDay> days;

  static BubbleState stateOf(PlanDayMark mark) => switch (mark) {
        PlanDayMark.done => BubbleState.filled,
        PlanDayMark.rest => BubbleState.rest,
        PlanDayMark.planned || PlanDayMark.open => BubbleState.hollow,
      };

  static String wordOf(PlanDayMark mark) => switch (mark) {
        PlanDayMark.done => RhythmCopy.keyCounted,
        PlanDayMark.planned => RhythmCopy.keyPlanned,
        PlanDayMark.rest => RhythmCopy.keyRest,
        PlanDayMark.open => RhythmCopy.keyOpen,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = {for (final d in days) d.mark};
    final marks = [for (final m in PlanDayMark.values) if (shown.contains(m)) m];
    return ExcludeSemantics(
      child: Wrap(
        spacing: MmSpace.s16,
        runSpacing: MmSpace.s4,
        children: [
          for (final m in marks)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Opacity(opacity: m == PlanDayMark.open ? 0.55 : 1, child: Bubble(state: stateOf(m), size: 12, animate: false)),
                const SizedBox(width: MmSpace.s6),
                Text(wordOf(m), style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink2)),
              ],
            ),
        ],
      ),
    );
  }
}

class _DayColumn extends StatelessWidget {
  const _DayColumn({required this.day, required this.bubble, required this.showDate});

  final PlanDay day;
  final double bubble;
  final bool showDate;

  BubbleState get _state => PlanWeekKey.stateOf(day.mark);

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
    // A planned day ahead is a brighter ring than a day with nothing planned; [PlanWeekKey]
    // names each mark under the strip.
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
