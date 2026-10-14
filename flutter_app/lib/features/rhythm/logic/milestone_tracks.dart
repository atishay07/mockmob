// The server's nine milestones (`GET /api/me/rhythm`), laid out as three short paths: papers,
// repairs and weeks in rhythm. Each step is earned only when the server dates it. The first step
// not earned yet is "next" and says exactly what lands it; the ones after it are named, quietly.
// Nothing here counts toward a step: the server sends dates, not progress, so the app never
// guesses "2 to go".
import '../../../core/models/rhythm.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';

enum MilestoneTrack {
  papers(RhythmCopy.trackPapers, RhythmCopy.trackPapersLink, AppRoutes.review),
  repairs(RhythmCopy.trackRepairs, RhythmCopy.trackRepairsLink, AppRoutes.reviewRecord),
  rhythm(RhythmCopy.trackRhythm, RhythmCopy.trackRhythmLink, AppRoutes.youRhythm);

  const MilestoneTrack(this.title, this.linkLabel, this.location);

  final String title;

  /// The record behind the track ("See your repair record").
  final String linkLabel;
  final String location;
}

class MilestoneStep {
  const MilestoneStep(this.id, this.track, this.name, this.condition);

  /// The id in `milestones[]`.
  final String id;
  final MilestoneTrack track;
  final String name;

  /// What lands it, said exactly as the server decides it.
  final String condition;
}

const List<MilestoneStep> milestoneSteps = [
  MilestoneStep('first_scored_session', MilestoneTrack.papers, RhythmCopy.stepFirstSet, RhythmCopy.condFirstSet),
  MilestoneStep('first_full_mock', MilestoneTrack.papers, RhythmCopy.stepFirstMock, RhythmCopy.condFirstMock),
  MilestoneStep('sessions_10', MilestoneTrack.papers, RhythmCopy.stepTenSets, RhythmCopy.condTenSets),
  MilestoneStep('first_repair', MilestoneTrack.repairs, RhythmCopy.stepFirstRepair, RhythmCopy.condFirstRepair),
  MilestoneStep('repairs_5', MilestoneTrack.repairs, RhythmCopy.stepRepairs5, RhythmCopy.condRepairs5),
  MilestoneStep('repairs_10', MilestoneTrack.repairs, RhythmCopy.stepRepairs10, RhythmCopy.condRepairs10),
  MilestoneStep('repairs_25', MilestoneTrack.repairs, RhythmCopy.stepRepairs25, RhythmCopy.condRepairs25),
  MilestoneStep('first_week_met', MilestoneTrack.rhythm, RhythmCopy.stepFirstWeek, RhythmCopy.condFirstWeek),
  MilestoneStep('weeks_met_4', MilestoneTrack.rhythm, RhythmCopy.stepFourWeeks, RhythmCopy.condFourWeeks),
];

enum StepStatus { earned, next, later }

class StepView {
  const StepView(this.step, this.status, this.earnedAt);

  final MilestoneStep step;
  final StepStatus status;
  final DateTime? earnedAt;
}

class TrackView {
  const TrackView(this.track, this.steps);

  final MilestoneTrack track;
  final List<StepView> steps;

  List<StepView> get earned => [for (final s in steps) if (s.status == StepStatus.earned) s];

  /// The step earned last (by date), or null before the first.
  StepView? get latest {
    StepView? best;
    for (final s in earned) {
      if (best == null || s.earnedAt!.isAfter(best.earnedAt!)) best = s;
    }
    return best;
  }

  StepView? get next {
    for (final s in steps) {
      if (s.status == StepStatus.next) return s;
    }
    return null;
  }

  bool get complete => next == null;
}

/// The three tracks in shelf order, filled from [milestones]. A step is earned only with a date.
List<TrackView> milestoneTracks(List<RhythmMilestone> milestones) {
  final at = <String, DateTime>{
    for (final m in milestones)
      if (m.achievedAt != null) m.id: m.achievedAt!,
  };
  return [
    for (final track in MilestoneTrack.values)
      () {
        var nextTaken = false;
        return TrackView(track, [
          for (final step in milestoneSteps.where((s) => s.track == track))
            if (at[step.id] case final date?)
              StepView(step, StepStatus.earned, date)
            else if (!nextTaken && (nextTaken = true))
              StepView(step, StepStatus.next, null)
            else
              StepView(step, StepStatus.later, null),
        ]);
      }(),
  ];
}
