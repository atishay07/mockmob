import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/choices.dart';

/// The student's first seven days from today, read off their own pace: a ring for each study
/// day, the rest mark for each rest day, today ringed. Not a control and not progress (nothing
/// is inked, since nothing is done yet), so the first move reads as the start of a week the
/// student chose. Sits flat on the ground under the hero: no card in a card.
class WeekAhead extends StatelessWidget {
  const WeekAhead({super.key, required this.days, required this.minutes, required this.window, required this.now});

  /// Study days, 0 = Monday.
  final Set<int> days;
  final int minutes;
  final StudyTime window;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final today = DateTime(now.year, now.month, now.day);
    final week = [for (var i = 0; i < 7; i++) today.add(Duration(days: i))];
    final study = [for (final d in week) if (days.contains(d.weekday - 1)) weekdayNames[d.weekday - 1]];
    final spoken = OnboardingCopy.weekAheadSpoken(study, minutes, window.time);

    return Semantics(
      container: true,
      label: spoken,
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(child: Text(OnboardingCopy.weekAheadTitle, style: type.label.copyWith(color: colors.ink2))),
              Text(OnboardingCopy.weekAheadPace(minutes, window.time), style: type.caption.copyWith(color: colors.ink3)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          Row(
            children: [
              for (final d in week)
                Expanded(
                  child: _Day(
                    initial: weekdayInitials[d.weekday - 1],
                    date: d.day,
                    study: days.contains(d.weekday - 1),
                    today: d == today,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Day extends StatelessWidget {
  const _Day({required this.initial, required this.date, required this.study, required this.today});

  final String initial;
  final int date;
  final bool study;
  final bool today;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ink = today ? colors.ink : (study ? colors.ink2 : colors.ink3);
    return Column(
      children: [
        Text(initial, style: type.caption.copyWith(fontWeight: FontWeight.w600, color: ink)),
        const SizedBox(height: MmSpace.s6),
        SizedBox(
          height: 34,
          child: Center(
            child: Bubble(state: study ? BubbleState.hollow : BubbleState.rest, size: 26, emphasis: today, animate: false),
          ),
        ),
        const SizedBox(height: MmSpace.s4),
        Text(
          today ? OnboardingCopy.today : '$date',
          maxLines: 1,
          style: type.caption.copyWith(fontSize: 11.5, color: ink, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
      ],
    );
  }
}
