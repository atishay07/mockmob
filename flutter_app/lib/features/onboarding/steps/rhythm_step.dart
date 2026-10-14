import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/calendar.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/choice_tile.dart';
import '../widgets/day_picker.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';

/// Step 8: a pace the student can keep: minutes as three big bubbles, study days as seven, and a
/// time of day as four tiles with their sky. The sessions it adds up to before May roll live
/// (plain arithmetic on their own choices, boards weeks at two).
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

    Widget timeTile(StudyTime w) => _TimeTile(window: w, selected: answers.window == w, onTap: () => c.setWindow(w));

    return StepLayout(
      title: OnboardingCopy.rhythmTitle,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EntranceItem.answer(
            0,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                label(OnboardingCopy.minutesLabel),
                _MinuteBubbles(value: answers.minutes, onChanged: c.setMinutes),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s32),
          EntranceItem.answer(
            1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                label(OnboardingCopy.daysLabel),
                DayPicker(days: answers.days, onToggle: c.toggleDay),
                const SizedBox(height: MmSpace.s8),
                Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s4),
                  child: Text(OnboardingCopy.restDays, style: type.caption.copyWith(color: colors.ink3)),
                ),
              ],
            ),
          ),
          if (sessions > 0) ...[
            const SizedBox(height: MmSpace.s32),
            EntranceItem.answer(
              2,
              child: Semantics(
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
            ),
          ],
          const SizedBox(height: MmSpace.s32),
          EntranceItem.answer(
            3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                label(OnboardingCopy.timeLabel),
                for (var i = 0; i < StudyTime.values.length; i += 2) ...[
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(child: timeTile(StudyTime.values[i])),
                        const SizedBox(width: MmSpace.s8),
                        Expanded(child: i + 1 < StudyTime.values.length ? timeTile(StudyTime.values[i + 1]) : const SizedBox()),
                      ],
                    ),
                  ),
                  const SizedBox(height: MmSpace.s8),
                ],
              ],
            ),
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

/// 10, 20 and 30 minutes as three big answer bubbles with the figure inside; the chosen one is
/// inked, its figure in the ink on volt. A radio group, 64 dp each.
class _MinuteBubbles extends ConsumerWidget {
  const _MinuteBubbles({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  static const double _size = 64;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: OnboardingCopy.minutesLabel,
      child: Row(
        children: [
          for (final m in const [10, 20, 30])
            Expanded(
              child: Builder(
                builder: (context) {
                  final on = m == value;
                  return MmPressable(
                    semanticsLabel: OnboardingCopy.minutesSpoken(m),
                    selected: on,
                    inMutuallyExclusiveGroup: true,
                    pressedScale: 0.92,
                    focusRadius: MmRadius.pillAll,
                    onTap: () {
                      if (on) return;
                      ref.read(hapticsProvider).selection();
                      GuideGlance.at(context);
                      onChanged(m);
                    },
                    builder: (context, pressed, _) => Column(
                      children: [
                        SizedBox.square(
                          dimension: _size,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Bubble(state: on ? BubbleState.filled : BubbleState.hollow, size: _size - 4, inkOrigin: const Offset(-0.3, 0.5)),
                              Text(
                                '$m',
                                style: type.figureCompact.copyWith(
                                  fontSize: 30,
                                  height: 1,
                                  color: on ? colors.voltInk : colors.ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: MmSpace.s4),
                        Text(OnboardingCopy.minutesUnit, style: type.caption.copyWith(color: on ? colors.ink : colors.ink3)),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

/// A time of day as a tile: its sky (sunrise, sun, moon, moon and stars), the name and the time.
class _TimeTile extends StatelessWidget {
  const _TimeTile({required this.window, required this.selected, required this.onTap});

  final StudyTime window;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final icon = switch (window) {
      StudyTime.early => LucideIcons.sunrise,
      StudyTime.afternoon => LucideIcons.sun,
      StudyTime.evening => LucideIcons.moon,
      StudyTime.late => LucideIcons.moonStar,
    };
    return ChoiceTile(
      selected: selected,
      onTap: onTap,
      semanticsLabel: '${window.label}, ${window.time}',
      bubble: BubbleSpot.none,
      minHeight: 64,
      padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s8, MmSpace.s12, MmSpace.s8),
      child: Row(
        children: [
          GlyphMedallion(size: 44, lit: selected, child: Icon(icon, size: 21, color: selected ? colors.ink : colors.ink2)),
          const SizedBox(width: MmSpace.s8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(window.label, style: type.labelLarge.copyWith(fontSize: 14, height: 18 / 14, color: selected ? colors.ink : colors.ink2)),
                Text(window.time, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
