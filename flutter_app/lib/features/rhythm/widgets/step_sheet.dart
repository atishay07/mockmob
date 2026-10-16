// A milestone step opened in a sheet: its medal at 120 dp, what lands it said exactly, the date it
// landed or (for the next step, where the app can count it) how far along it is, and one key for
// the next step. Nothing here is a guess: a step that has not landed shows no date, and a count
// shows only where the app holds it exactly (`milestoneProgress`). Later steps say what comes
// first and offer no key.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/milestone_progress.dart';
import '../logic/milestone_tracks.dart';
import 'medal.dart';
import 'milestone_track_card.dart' show engravingOf;

/// The one key of a next step: its label and where it goes. Null for a step that has landed or
/// that is not next yet.
({String label, String location})? stepAction(MilestoneStep step) => switch (step.id) {
      'first_scored_session' || 'sessions_10' => (label: RhythmCopy.startSet, location: AppRoutes.practiceStart),
      'first_full_mock' || 'full_mocks_5' || 'new_best' => (label: RhythmCopy.stepActionFullMock, location: AppRoutes.practiceStart),
      'first_nta' => (label: RhythmCopy.stepActionNta, location: AppRoutes.examNta),
      'clean_set' || 'four_subjects' => (label: RhythmCopy.startSet, location: AppRoutes.practiceStart),
      'first_hold' => (label: RhythmCopy.stepActionRepair, location: AppRoutes.reviewMistakes),
      'run_weeks_3' => (label: RhythmCopy.stepActionRhythm, location: AppRoutes.youRhythm),
      'first_repair' || 'repairs_5' || 'repairs_10' || 'repairs_25' => (label: RhythmCopy.stepActionRepair, location: AppRoutes.reviewMistakes),
      'first_week_met' || 'weeks_met_4' => (label: RhythmCopy.stepActionRhythm, location: AppRoutes.youRhythm),
      _ => null,
    };

/// Opens [view] in a sheet. [previous] is the step before it on its path (for a later step),
/// [count] the exact count toward it, when there is one. [onAction] defaults to going to the
/// step's own place; it is told the location.
Future<void> showStepSheet(
  BuildContext context, {
  required StepView view,
  required String Function(DateTime) dateOf,
  StepView? previous,
  int? count,
  ValueChanged<String>? onAction,
}) {
  return showMmSheet<void>(
    context: context,
    title: view.step.name,
    builder: (sheet) => StepSheetBody(
      view: view,
      dateOf: dateOf,
      previous: previous,
      count: count,
      onAction: (location) {
        Navigator.of(sheet).pop();
        if (onAction != null) {
          onAction(location);
        } else {
          GoRouter.maybeOf(context)?.push(location);
        }
      },
    ),
  );
}

class StepSheetBody extends StatelessWidget {
  const StepSheetBody({super.key, required this.view, required this.dateOf, this.previous, this.count, required this.onAction});

  final StepView view;
  final String Function(DateTime) dateOf;
  final StepView? previous;
  final int? count;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final step = view.step;
    final status = view.status;
    final face = engravingOf(step.id);
    final target = milestoneTargets[step.id];
    final fraction = status == StepStatus.next && count != null ? milestoneFraction(step.id, {step.id: count!}) : null;
    final action = status == StepStatus.next ? stepAction(step) : null;
    final date = view.earnedAt == null ? null : dateOf(view.earnedAt!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(
          child: Medal(
            status: switch (status) {
              StepStatus.earned => MedalStatus.landed,
              StepStatus.next => MedalStatus.next,
              StepStatus.later => MedalStatus.later,
            },
            icon: face.icon,
            text: face.text,
            size: 120,
            arc: fraction,
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        // The date of a landed step; the count of the next one; what comes first for a later one.
        if (date != null)
          Semantics(
            liveRegion: true,
            child: Text(RhythmCopy.stepLandedOn(date), textAlign: TextAlign.center, style: type.subhead),
          )
        else if (status == StepStatus.next && count != null && target != null)
          Text(RhythmCopy.soFar(count!, target), textAlign: TextAlign.center, style: type.subhead)
        else if (status == StepStatus.later && previous != null)
          Text(RhythmCopy.stepAfter(previous!.step.name), textAlign: TextAlign.center, style: type.subhead),
        const SizedBox(height: MmSpace.s8),
        Text(step.condition, textAlign: TextAlign.center, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s24),
        if (action != null)
          KeyButton(label: action.label, onPressed: () => onAction(action.location))
        else
          Align(child: KeyButton.quiet(label: RhythmCopy.close, onPressed: () => Navigator.of(context).pop())),
      ],
    );
  }
}
