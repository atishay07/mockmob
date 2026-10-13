// The brass milestone tokens: three server milestones that get an object on the shelf. Each one
// lands only when `GET /api/me/rhythm` says it was achieved; until then its slot is an honest
// empty recess with the plain line of what fills it. Nothing is locked, counted or chased.
import '../../../core/models/rhythm.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../copy.dart';

enum MilestoneToken {
  firstMock('first_full_mock', MmArt.tokenFirstMock, RhythmCopy.tokenFirstMock, RhythmCopy.tokenFirstMockEmpty),
  firstRepair('first_repair', MmArt.tokenFirstRepair, RhythmCopy.tokenFirstRepair, RhythmCopy.tokenFirstRepairEmpty),
  // The turning-arrow token: a week that came round to its goal.
  firstWeek('first_week_met', MmArt.tokenHeld, RhythmCopy.tokenFirstWeek, RhythmCopy.tokenFirstWeekEmpty);

  const MilestoneToken(this.milestoneId, this.art, this.label, this.emptyHint);

  /// The id in `milestones[]`.
  final String milestoneId;
  final MmArt art;
  final String label;

  /// What fills the slot, said plainly.
  final String emptyHint;
}

class TokenSlot {
  const TokenSlot(this.token, this.earnedAt);

  final MilestoneToken token;

  /// When the server says it was achieved; null while the slot is empty.
  final DateTime? earnedAt;

  bool get earned => earnedAt != null;
}

/// One slot per token, in shelf order, filled from [milestones].
List<TokenSlot> tokenSlots(List<RhythmMilestone> milestones) {
  DateTime? at(String id) {
    for (final m in milestones) {
      if (m.id == id && m.achievedAt != null) return m.achievedAt;
    }
    return null;
  }

  return [for (final t in MilestoneToken.values) TokenSlot(t, at(t.milestoneId))];
}
