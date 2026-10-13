import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/calendar.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/day_picker.dart';
import '../widgets/step_layout.dart';

/// Step 8: a pace the student can keep: minutes, study days and a time. The sessions it adds up
/// to before May recount live (plain arithmetic on their own choices, boards weeks at two).
class RhythmStep extends ConsumerWidget {
  const RhythmStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = ref.read(onboardingAnswersProvider.notifier);
    final stage = answers.stage ?? Stage.notSure;
    final sessions = CuetCalendar.sessionsBefore(
      stage.cuetYear,
      ref.watch(nowProvider)(),
      daysPerWeek: answers.days.length,
      boards: stage.boards,
    );

    Widget label(String text) => Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s8, left: MmSpace.s4),
      child: Text(text, style: type.label.copyWith(color: colors.ink2)),
    );

    return StepLayout(
      title: OnboardingCopy.rhythmTitle,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          label(OnboardingCopy.minutesLabel),
          MmSegmented<int>(
            semanticsLabel: OnboardingCopy.minutesLabel,
            segments: [
              for (final m in const [10, 20, 30]) MmSegment(m, OnboardingCopy.minutes(m)),
            ],
            value: answers.minutes,
            onChanged: c.setMinutes,
          ),
          const SizedBox(height: MmSpace.s24),
          label(OnboardingCopy.daysLabel),
          DayPicker(days: answers.days, onToggle: c.toggleDay),
          const SizedBox(height: MmSpace.s8),
          Padding(
            padding: const EdgeInsets.only(left: MmSpace.s4),
            child: Text(OnboardingCopy.restDays, style: type.caption.copyWith(color: colors.ink3)),
          ),
          if (sessions > 0) ...[
            const SizedBox(height: MmSpace.s16),
            Semantics(
              liveRegion: true,
              label: 'That\'s ${CuetCalendar.about(sessions)} sessions before May',
              excludeSemantics: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  MonumentalNumber(value: '${sessions < 20 ? sessions : (sessions / 10).round() * 10}', style: type.figure),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Text(
                      [
                        if (sessions >= 20)
                          'About this many sessions before May${stage.cuetYear == 2028 ? ' 2028' : ''}, if you keep this.'
                        else
                          'Sessions before May, if you keep this.',
                        if (stage.boards) OnboardingCopy.boardWeeks,
                      ].join(' '),
                      style: type.small.copyWith(color: colors.ink2),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s24),
          label(OnboardingCopy.timeLabel),
          Wrap(
            spacing: MmSpace.s8,
            children: [
              for (final w in StudyTime.values)
                MmChip(label: '${w.label}, ${w.time}', selected: answers.window == w, onTap: () => c.setWindow(w)),
            ],
          ),
        ],
      ),
      bottom: KeyButton(
        label: OnboardingCopy.next,
        onPressed: () {
          c.confirmRhythm();
          onNext();
        },
      ),
    );
  }
}
