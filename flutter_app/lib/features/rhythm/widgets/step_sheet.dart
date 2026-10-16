// A badge opened in a sheet (app-you-1016 Screen C): its medal at 96 dp, the name, "Earned on 12
// October" or "Not yet", what lands it said exactly, the paper it came from when the phone holds
// that record, how far along it is where the app can count it exactly, where it sits on its path,
// and one key. Nothing here is a guess: a badge not earned shows no date, a count shows only where
// the app holds it (`milestoneProgress`), and there is no padlock and no plan anywhere near it.
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
/// [count] the exact count toward it, when there is one, [pathLine] where it sits on its path,
/// [record] the paper that earned it ("From your Accountancy full mock, 12 October: 152 of 250")
/// and [paperId] the attempt behind it. [onAction] defaults to going to the step's own place; it is
/// told the location.
Future<void> showStepSheet(
  BuildContext context, {
  required StepView view,
  required String Function(DateTime) dateOf,
  StepView? previous,
  int? count,
  String? pathLine,
  String? record,
  String? paperId,
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
      pathLine: pathLine,
      record: record,
      paperId: paperId,
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
  const StepSheetBody({
    super.key,
    required this.view,
    required this.dateOf,
    this.previous,
    this.count,
    this.pathLine,
    this.record,
    this.paperId,
    required this.onAction,
  });

  final StepView view;
  final String Function(DateTime) dateOf;
  final StepView? previous;
  final int? count;

  /// "Papers, step 3 of 5." (null on a path with no order).
  final String? pathLine;

  /// The paper behind an earned badge, in words. Null when the phone does not hold it.
  final String? record;
  final String? paperId;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final step = view.step;
    final status = view.status;
    final face = engravingOf(step.id);
    final target = milestoneTargets[step.id];
    final earned = status == StepStatus.earned;
    final counted = !earned && count != null && target != null;
    final fraction = counted ? milestoneFraction(step.id, {step.id: count!}) : null;
    final action = earned ? null : stepAction(step);
    final date = view.earnedAt == null ? null : dateOf(view.earnedAt!);
    final order = [
      ?pathLine,
      if (!earned && status == StepStatus.later && previous != null) RhythmCopy.stepAfter(previous!.step.name),
    ].join(' ');
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
            size: 96,
            arc: fraction,
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        // The state, said in words as well as drawn: the date it landed, or "Not yet".
        Semantics(
          liveRegion: true,
          child: Text(
            earned && date != null ? RhythmCopy.badgeEarnedOn(date) : RhythmCopy.badgeNotYet,
            textAlign: TextAlign.center,
            style: type.subhead.copyWith(color: earned ? colors.ink : colors.ink2),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(step.condition, textAlign: TextAlign.center, style: type.body),
        if (earned && record != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(record!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (counted) ...[
          const SizedBox(height: MmSpace.s16),
          _CountBar(fraction: (count! / target).clamp(0.0, 1.0)),
          const SizedBox(height: MmSpace.s8),
          Text(RhythmCopy.soFar(count!, target), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (order.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          Text(order, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        if (action != null)
          KeyButton(label: action.label, onPressed: () => onAction(action.location))
        else ...[
          if (paperId != null && earned)
            Align(child: KeyButton.quiet(label: RhythmCopy.openThatPaper, onPressed: () => onAction(AppRoutes.result(paperId!)))),
          Align(child: KeyButton.quiet(label: RhythmCopy.badgeDone, onPressed: () => Navigator.of(context).pop())),
        ],
      ],
    );
  }
}

/// The 4 dp bar of a counted badge: the volt fill over the hairline.
class _CountBar extends StatelessWidget {
  const _CountBar({required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: SizedBox(
          height: 4,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: colors.line),
              FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: fraction, child: ColoredBox(color: colors.volt)),
            ],
          ),
        ),
      ),
    );
  }
}
