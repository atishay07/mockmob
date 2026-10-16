// The badges (app-you-1016 section 3): sixteen on four paths, papers, repairs, weeks at the goal
// and your best work. Nine are the server's milestones (`GET /api/me/rhythm`), five are worked out
// on the phone from the complete attempts list (`derived_badges.dart`, merged into the same list
// with the attempt's date), and two are new server ids shown only once the server lists them, so
// none is ever shown as falsely locked. Each step is earned only when a record dates it. The first step
// not earned yet is "next" and says exactly what lands it; the ones after it are named, quietly.
// Nothing here counts toward a step: the server sends dates, not progress, so the app never
// guesses "2 to go".
import '../../../core/models/rhythm.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';

enum MilestoneTrack {
  papers(RhythmCopy.trackPapers, RhythmCopy.trackPapersLink, AppRoutes.review),
  repairs(RhythmCopy.trackRepairs, RhythmCopy.trackRepairsLink, AppRoutes.reviewRecord),
  rhythm(RhythmCopy.trackRhythm, RhythmCopy.trackRhythmLink, AppRoutes.youRhythm),
  // Not a sequence: each of its badges says its own condition and none waits on another.
  best(RhythmCopy.trackBest, RhythmCopy.trackBestLink, AppRoutes.youBests);

  const MilestoneTrack(this.title, this.linkLabel, this.location);

  final String title;

  /// The record behind the track ("See your repair record").
  final String linkLabel;
  final String location;
}

/// Where a badge's date comes from.
enum BadgeSource {
  /// The server's milestone list.
  server,

  /// Worked out on the phone from the complete attempts list.
  derived,

  /// A new server id: shown only once the server's list contains it.
  newServer,
}

class MilestoneStep {
  const MilestoneStep(this.id, this.track, this.name, this.condition, {this.source = BadgeSource.server});

  /// The id in `milestones[]`.
  final String id;
  final MilestoneTrack track;
  final String name;

  /// What lands it, said exactly as the server decides it.
  final String condition;
  final BadgeSource source;
}

const List<MilestoneStep> milestoneSteps = [
  MilestoneStep('first_scored_session', MilestoneTrack.papers, RhythmCopy.stepFirstSet, RhythmCopy.condFirstSet),
  MilestoneStep('first_full_mock', MilestoneTrack.papers, RhythmCopy.stepFirstMock, RhythmCopy.condFirstMock),
  MilestoneStep('first_nta', MilestoneTrack.papers, RhythmCopy.stepFirstNta, RhythmCopy.condFirstNta, source: BadgeSource.derived),
  MilestoneStep('sessions_10', MilestoneTrack.papers, RhythmCopy.stepTenSets, RhythmCopy.condTenSets),
  MilestoneStep('full_mocks_5', MilestoneTrack.papers, RhythmCopy.stepFiveMocks, RhythmCopy.condFiveMocks, source: BadgeSource.derived),
  MilestoneStep('first_repair', MilestoneTrack.repairs, RhythmCopy.stepFirstRepair, RhythmCopy.condFirstRepair),
  MilestoneStep('repairs_5', MilestoneTrack.repairs, RhythmCopy.stepRepairs5, RhythmCopy.condRepairs5),
  MilestoneStep('repairs_10', MilestoneTrack.repairs, RhythmCopy.stepRepairs10, RhythmCopy.condRepairs10),
  MilestoneStep('repairs_25', MilestoneTrack.repairs, RhythmCopy.stepRepairs25, RhythmCopy.condRepairs25),
  MilestoneStep('first_hold', MilestoneTrack.repairs, RhythmCopy.stepFirstHold, RhythmCopy.condFirstHold, source: BadgeSource.newServer),
  MilestoneStep('first_week_met', MilestoneTrack.rhythm, RhythmCopy.stepFirstWeek, RhythmCopy.condFirstWeek),
  MilestoneStep('weeks_met_4', MilestoneTrack.rhythm, RhythmCopy.stepFourWeeks, RhythmCopy.condFourWeeks),
  MilestoneStep('run_weeks_3', MilestoneTrack.rhythm, RhythmCopy.stepRunThree, RhythmCopy.condRunThree, source: BadgeSource.newServer),
  MilestoneStep('clean_set', MilestoneTrack.best, RhythmCopy.stepCleanSet, RhythmCopy.condCleanSet, source: BadgeSource.derived),
  MilestoneStep('four_subjects', MilestoneTrack.best, RhythmCopy.stepFourSubjects, RhythmCopy.condFourSubjects, source: BadgeSource.derived),
  MilestoneStep('new_best', MilestoneTrack.best, RhythmCopy.stepNewBest, RhythmCopy.condNewBest, source: BadgeSource.derived),
];

/// The badges shown for [milestones]: every server and derived badge, and a new server id only
/// once the server lists it (earned or not).
List<MilestoneStep> shownSteps(List<RhythmMilestone> milestones) {
  final listed = {for (final m in milestones) m.id};
  return [for (final s in milestoneSteps) if (s.source != BadgeSource.newServer || listed.contains(s.id)) s];
}

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

/// The four tracks in shelf order, filled from [milestones] (the server's list with the derived
/// badges merged in, see `mergeDerived`). A step is earned only with a date. On the best-work path
/// every badge not earned is "next", since none of them waits on another.
List<TrackView> milestoneTracks(List<RhythmMilestone> milestones) {
  final shown = shownSteps(milestones);
  final at = <String, DateTime>{
    for (final m in milestones)
      if (m.achievedAt != null) m.id: m.achievedAt!,
  };
  return [
    for (final track in MilestoneTrack.values)
      () {
        var nextTaken = false;
        return TrackView(track, [
          for (final step in shown.where((s) => s.track == track))
            if (at[step.id] case final date?)
              StepView(step, StepStatus.earned, date)
            else if (track == MilestoneTrack.best)
              StepView(step, StepStatus.next, null)
            else if (!nextTaken && (nextTaken = true))
              StepView(step, StepStatus.next, null)
            else
              StepView(step, StepStatus.later, null),
        ]);
      }(),
  ];
}

/// The name of the newest badge in [fresh] that is earned in [milestones], or null: the one that
/// landed since the last visit (Mobi reads it once on You).
String? freshBadgeName(Set<String> fresh, List<RhythmMilestone> milestones) {
  RhythmMilestone? newest;
  for (final m in milestones) {
    final at = m.achievedAt;
    if (at == null || !fresh.contains(m.id)) continue;
    if (!milestoneSteps.any((s) => s.id == m.id)) continue;
    if (newest == null || at.isAfter(newest.achievedAt!)) newest = m;
  }
  if (newest == null) return null;
  return milestoneSteps.firstWhere((s) => s.id == newest!.id).name;
}
