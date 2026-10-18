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
import '../widgets/answer_sheet_card.dart' show WeeksReadout;
import '../widgets/choice_tile.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';
import '../widgets/week_track.dart';

/// Step 3: where the student is. Four tiles, two by two, each leading with what the choice means:
/// the real number of weeks to that student's expected CUET window. The weeks then roll onto the
/// sheet above.
class StageStep extends ConsumerWidget {
  const StageStep({super.key, required this.answers, required this.onNext, this.mobi});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  /// The guide bar's Mobi, the screen's one Mobi: he answers when the mark reaches the window.
  final MobiController? mobi;

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
                padding: const EdgeInsets.only(bottom: MmSpace.s12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    WeekTrack(
                      nearWeeks: nearWeeks,
                      farWeeks: farWeeks,
                      litWeeks: stage == null ? null : CuetCalendar.weeksTo(stage.cuetYear, now),
                      mobi: mobi,
                    ),
                    const SizedBox(height: MmSpace.s8),
                    // The weeks land here, under the road, at the same height before and after the
                    // choice, so nothing below moves when the number rolls in.
                    SizedBox(height: 40, child: WeeksReadout(stage: stage, now: now, compact: true)),
                  ],
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

/// A stage as a tile: the choice in the student's words, and when that CUET is. The weeks to it
/// are said once, under the road above, so no tile repeats a figure that is the
/// same on three of four; a spoken label still carries them.
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
    final caption = stage == Stage.notSure ? OnboardingCopy.stageWindowProbably : OnboardingCopy.stageWindow(stage.cuetYear);
    return ChoiceTile(
      selected: selected,
      onTap: onTap,
      semanticsLabel: w == null ? stage.option : '${stage.option}. $w ${OnboardingCopy.stageWeeksSpoken(stage.cuetYear)}',
      minHeight: 104,
      // 14 dp above and below: with Mobi in the group the four answers stay above the fold on a
      // 360 by 800 phone (D40, D44).
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, 14, MmSpace.s16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Clear of the chosen tick at the top right (22 dp at 12 dp from the edge, plus an 8 dp
          // gap), so the tick never sits on the title.
          Padding(
            padding: const EdgeInsets.only(right: 22 + MmSpace.s12 + MmSpace.s8 - MmSpace.s16),
            child: Text(stage.option, style: type.cardTitle.copyWith(color: selected ? colors.ink : colors.ink2)),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(caption, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ),
    );
  }
}
