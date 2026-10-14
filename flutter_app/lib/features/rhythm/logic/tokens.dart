// The brass tokens on the shelf: one per milestone track (papers, repairs, weeks in rhythm). A
// token stands in its slot once the server dates any step of its track, captioned with the step
// that landed last; until then its slot is an honest empty recess with the line of what fills it.
import '../../../core/models/rhythm.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../copy.dart';
import 'milestone_tracks.dart';

enum MilestoneToken {
  // The paper token: scored sets and full mocks.
  firstMock(MilestoneTrack.papers, MmArt.tokenFirstMock, RhythmCopy.tokenFirstMockEmpty),
  // The tick token: finished repairs.
  firstRepair(MilestoneTrack.repairs, MmArt.tokenFirstRepair, RhythmCopy.tokenFirstRepairEmpty),
  // The turning-arrow token: weeks that came round to their goal.
  firstWeek(MilestoneTrack.rhythm, MmArt.tokenHeld, RhythmCopy.tokenFirstWeekEmpty);

  const MilestoneToken(this.track, this.art, this.emptyHint);

  final MilestoneTrack track;
  final MmArt art;

  /// What fills an empty slot, said plainly.
  final String emptyHint;

  String get label => track.title;
}

class TokenSlot {
  const TokenSlot(this.token, this.earnedAt, {this.title, this.latestId});

  final MilestoneToken token;

  /// When the latest step of the track landed; null while the slot is empty.
  final DateTime? earnedAt;

  /// The latest step's name ("5 repairs"), shown under an earned token.
  final String? title;

  /// The milestone id of that step, so the shelf can tell when it is the one that just landed.
  final String? latestId;

  bool get earned => earnedAt != null;
}

/// One slot per track, in shelf order, filled from [milestones].
List<TokenSlot> tokenSlots(List<RhythmMilestone> milestones) {
  final tracks = {for (final t in milestoneTracks(milestones)) t.track: t};
  return [
    for (final token in MilestoneToken.values)
      () {
        final latest = tracks[token.track]?.latest;
        return TokenSlot(token, latest?.earnedAt, title: latest?.step.name, latestId: latest?.step.id);
      }(),
  ];
}
