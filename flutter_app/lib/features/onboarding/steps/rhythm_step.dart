import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../choices_copy.dart';
import '../copy.dart';
import '../goal_copy.dart';
import '../data/calendar.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/choice_tile.dart';
import '../widgets/day_picker.dart';
import '../widgets/entrance.dart';
import '../widgets/goal_bubbles.dart';
import '../widgets/runway_strip.dart';
import '../widgets/step_layout.dart';

/// Step 6 of 7: a pace the student can keep: minutes as three big bubbles and a fourth, More, for a
/// longer day (H1, option A: 1 hour, 2 hours or their own length; full mocks stay in Practice),
/// study days as a "days a week" slider synced both ways with the seven day bubbles, and a time of
/// day as four tiles with their sky. What the choice adds up to rolls live, as the step's hero
/// right under the title (v15 taste pass: below the fold the student dragged the slider and saw
/// nothing change): the sessions and the hours before May (plain arithmetic on their own choices,
/// board weeks at two, "about" because the exam date is expected). The runway of the weeks left
/// fills or empties under the days (owner, 18 Oct, D46 and D47).
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
    final now = ref.watch(nowProvider)();
    final weekly = CuetCalendar.weeklySessions(stage.cuetYear, now, daysPerWeek: answers.days.length, boards: stage.boards);
    final sessions = weekly.fold(0, (a, b) => a + b);

    Widget label(String text) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s12),
          child: Text(text, style: type.label.copyWith(color: colors.ink2)),
        );

    Widget timeTile(StudyTime w) => _TimeTile(window: w, selected: answers.window == w, onTap: () => c.setWindow(w));

    return StepLayout(
      title: OnboardingCopy.rhythmTitle,
      // The Evening and Late tiles end the list: they scroll fully clear of Continue.
      endInset: StepLayout.tileEndInset,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (sessions > 0) ...[
            EntranceItem.answer(
              0,
              child: _PaceHero(sessions: sessions, minutes: answers.minutes, weekly: weekly, year: stage.cuetYear),
            ),
            const SizedBox(height: MmSpace.s24),
          ],
          EntranceItem.answer(
            1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                label(OnboardingCopy.minutesLabel),
                // H1, option A (19 Oct): 10, 20 and 30 as they were, and More for a longer day.
                GoalBubbles(value: answers.minutes, onChanged: c.setMinutes),
                const SizedBox(height: MmSpace.s12),
                // Mobi's line (the smart layer's slot): with no history yet it follows the choice
                // alone. D46: the quick sessions stay; the full paper is never far.
                Semantics(
                  liveRegion: true,
                  child: Text(GoalCopy.slotLine(answers.minutes), style: type.caption.copyWith(color: colors.ink3)),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s32),
          EntranceItem.answer(
            2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                label(OnboardingCopy.daysLabel),
                _DaysSlider(days: answers.days.length, onChanged: c.setDayCount),
                const SizedBox(height: MmSpace.s8),
                DayPicker(days: answers.days, onToggle: c.toggleDay),
                const SizedBox(height: MmSpace.s8),
                Text('${OnboardingCopy.restDays} ${ChoicesCopy.tapDays}', style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
          if (sessions > 0) ...[
            const SizedBox(height: MmSpace.s32),
            EntranceItem.answer(
              3,
              child: _Readout(weekly: weekly, year: stage.cuetYear, boards: stage.boards),
            ),
          ],
          const SizedBox(height: MmSpace.s32),
          EntranceItem.answer(
            4,
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

/// "Days a week" as a big figure and a slider from 1 to 7, one haptic tick per stop. It moves
/// when a day bubble is tapped, because both read the same answer.
class _DaysSlider extends ConsumerWidget {
  const _DaysSlider({required this.days, required this.onChanged});

  final int days;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExcludeSemantics(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              MonumentalNumber(value: '$days', style: type.figure, fromZeroOnFirstBuild: false),
              const SizedBox(width: MmSpace.s8),
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s8),
                child: Text(ChoicesCopy.daysPerWeek, style: type.body.copyWith(color: colors.ink2)),
              ),
            ],
          ),
        ),
        // The track runs edge to edge on the gutter, its thumb a 48 dp target.
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 6,
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 12),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 24),
            tickMarkShape: const RoundSliderTickMarkShape(tickMarkRadius: 2),
            activeTickMarkColor: colors.voltInk.withValues(alpha: 0.5),
            inactiveTickMarkColor: colors.ink3,
            padding: EdgeInsets.zero,
          ),
          child: Semantics(
            label: ChoicesCopy.daysSlider,
            child: SizedBox(
              height: 48,
              child: Slider(
                value: days.toDouble(),
                min: 1,
                max: 7,
                divisions: 6,
                semanticFormatterCallback: (v) => ChoicesCopy.daysSpoken(v.round()),
                onChanged: (v) {
                  final n = v.round();
                  if (n == days) return;
                  ref.read(hapticsProvider).segmentTick();
                  onChanged(n);
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// What the pace adds up to, the step's hero under the title: the sessions before May as a
/// rolling figure and the hours they make, beside it. It rolls whenever the minutes or the days
/// change, and a selection tick lands with it (the control's own tick comes first).
class _PaceHero extends ConsumerWidget {
  const _PaceHero({required this.sessions, required this.minutes, required this.weekly, required this.year});

  final int sessions;
  final int minutes;
  final List<int> weekly;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The window's date is expected, not published: every count here is "about".
    const estimate = true;
    final shown = sessions < 20 ? sessions : (sessions / 10).round() * 10;
    return Semantics(
      liveRegion: true,
      container: true,
      label: '${ChoicesCopy.sessionsSpoken(sessions: shown, minutes: minutes, estimate: estimate)} '
          '${ChoicesCopy.runwaySpoken(weekly.length, weekly.isEmpty ? 0 : weekly.first)}',
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          MonumentalNumber(
            value: '$shown',
            unit: ChoicesCopy.sessionsUnit,
            style: type.figure,
            onLanded: () => ref.read(hapticsProvider).selection(),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Text(
              ChoicesCopy.sessionsHours(sessions: sessions, minutes: minutes, estimate: estimate, year: year),
              style: type.body.copyWith(color: colors.ink2),
            ),
          ),
        ],
      ),
    );
  }
}

/// The runway of weeks left, with the chosen days lit, under the days; how board weeks count.
class _Readout extends StatelessWidget {
  const _Readout({required this.weekly, required this.year, required this.boards});

  final List<int> weekly;
  final int year;
  final bool boards;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RunwayStrip(weeks: weekly),
        const SizedBox(height: MmSpace.s8),
        Row(
          children: [
            Expanded(child: Text('${weekly.length} ${ChoicesCopy.weeksLeft}', style: type.caption.copyWith(color: colors.ink3))),
            Text('May $year', style: type.caption.copyWith(color: colors.ink3)),
          ],
        ),
        if (boards) ...[
          const SizedBox(height: MmSpace.s4),
          Text(ChoicesCopy.boardsCount, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ],
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
