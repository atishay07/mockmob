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
import '../widgets/choice_tile.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';
import '../widgets/week_track.dart';

/// Step 3: where the student is. Four tiles, two by two, each leading with what the choice means:
/// the real number of weeks to that student's expected CUET window. The weeks then roll onto the
/// sheet above.
class StageStep extends ConsumerWidget {
  const StageStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stage = answers.stage;
    final now = ref.watch(nowProvider)();
    final note = switch (stage) {
      Stage.classTwelve => OnboardingCopy.boardsNote,
      Stage.classEleven => OnboardingCopy.classElevenNote,
      _ => null,
    };
    final nearWeeks = CuetCalendar.weeksTo(2027, now);
    final farWeeks = CuetCalendar.weeksTo(2028, now);
    Widget tile(int i) {
      final s = Stage.values[i];
      return EntranceItem.answer(
        i,
        child: _StageTile(
          stage: s,
          weeks: CuetCalendar.weeksTo(s.cuetYear, now),
          selected: stage == s,
          onTap: () => ref.read(onboardingAnswersProvider.notifier).setStage(s),
        ),
      );
    }

    return StepLayout(
      title: OnboardingCopy.stageTitle,
      support: note ?? OnboardingCopy.stageSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (nearWeeks != null && farWeeks != null)
            EntranceItem.answer(
              0,
              child: Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s16),
                child: WeekTrack(
                  nearWeeks: nearWeeks,
                  farWeeks: farWeeks,
                  litWeeks: stage == null ? null : CuetCalendar.weeksTo(stage.cuetYear, now),
                ),
              ),
            ),
          for (var i = 0; i < Stage.values.length; i += 2) ...[
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: tile(i)),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: i + 1 < Stage.values.length ? tile(i + 1) : const SizedBox()),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s12),
          ],
        ],
      ),
      bottom: KeyButton(label: OnboardingCopy.next, onPressed: stage == null ? null : onNext),
    );
  }
}

/// A stage as a tall tile: the weeks to its CUET in condensed figures with the unit at 55%, the
/// choice in the student's words beneath, the answer bubble in the corner.
class _StageTile extends StatelessWidget {
  const _StageTile({required this.stage, required this.weeks, required this.selected, required this.onTap});

  final Stage stage;
  final int? weeks;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = weeks;
    final figure = type.figureCompact.copyWith(fontSize: 44, height: 1);
    final caption = stage == Stage.notSure ? OnboardingCopy.stageWeeksProbably : OnboardingCopy.stageWeeksUnit(stage.cuetYear);
    return ChoiceTile(
      selected: selected,
      onTap: onTap,
      semanticsLabel: w == null ? stage.option : '${stage.option}. $w ${OnboardingCopy.stageWeeksSpoken(stage.cuetYear)}',
      minHeight: 132,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(w == null ? '--' : '$w', style: figure.copyWith(color: selected ? colors.ink : colors.ink.withValues(alpha: 0.86))),
              const SizedBox(width: 4),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  OnboardingCopy.weeksShort,
                  style: figure.copyWith(fontSize: 44 * 0.45, color: colors.ink2),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(caption, style: type.caption.copyWith(color: colors.ink3)),
          ),
          const SizedBox(height: MmSpace.s12),
          Text(stage.option, style: type.labelLarge.copyWith(height: 20 / 15, color: selected ? colors.ink : colors.ink2)),
        ],
      ),
    );
  }
}
