// What other modules hand to the CelebrationController. Every celebration is triggered by a
// server fact with a stable id and fires once (spec 6.2).
import '../../../core/copy/state_words.dart';
import '../../../core/models/rhythm.dart';
import '../copy.dart';

/// L0 (an answer was recorded) is plain text in the host screen and never comes here.
/// L1 repair finished or week met; L2 firsts; L3 a dated row that fades into the timeline.
enum CelebrationLevel { l1, l2, l3 }

enum CelebrationKind { repairFinished, weekMet, milestone }

/// Moments when a celebration must not fire (spec 6.2). Pass the one that applies.
enum CelebrationSuppression { firstMock, lowerResult, heldResult, failedRepair }

/// Where a celebration is shown. A scope gets at most one celebration, which is the "at most
/// one celebration per session end" rule. A `CelebrationSlot` shows the one for its scope.
abstract final class CelebrationScope {
  static const String today = 'today';
  static String weeklyEnding(String weekStart) => 'weekly-ending:$weekStart';
  static String result(String attemptId) => 'result:$attemptId';
  static String repair(String attemptId) => 'repair:$attemptId';
}

class CelebrationEvent {
  const CelebrationEvent({
    required this.id,
    required this.kind,
    required this.level,
    required this.scope,
    this.sentence,
    this.receipt,
    this.ring = false,
    this.extraIds = const [],
    this.suppressedBy,
  });

  /// A repair finished: the stable local id is `repair:<attemptId>:<first acknowledged requestId of the run>`. [at] is the server acknowledgment time; the receipt line is shown only with
  /// it. [firstEver] raises it to L2 (one Mobi hop and a sentence); then the `first_repair`
  /// milestone id is consumed too, so it never fires a second time.
  factory CelebrationEvent.repairFinished({
    required String attemptId,
    required String firstRequestId,
    required DateTime at,
    String? scope,
    bool firstEver = false,
    CelebrationSuppression? suppressedBy,
  }) =>
      CelebrationEvent(
        id: 'repair:$attemptId:$firstRequestId',
        kind: CelebrationKind.repairFinished,
        level: firstEver ? CelebrationLevel.l2 : CelebrationLevel.l1,
        scope: scope ?? CelebrationScope.repair(attemptId),
        sentence: firstEver ? RhythmCopy.firstRepairSentence : null,
        receipt: Receipts.repairFinished(at),
        extraIds: firstEver ? const ['first_repair'] : const [],
        suppressedBy: suppressedBy,
      );

  /// A week closed as met: id `week:<weekStart>` (the server's `lastClosedWeek.id`).
  /// [firstEver] is the first week met (L2) and consumes the `first_week_met` milestone id.
  factory CelebrationEvent.weekMet({
    required String weekStart,
    required int studyDays,
    required int goal,
    String? scope,
    bool firstEver = false,
  }) =>
      CelebrationEvent(
        id: 'week:$weekStart',
        kind: CelebrationKind.weekMet,
        level: firstEver ? CelebrationLevel.l2 : CelebrationLevel.l1,
        scope: scope ?? CelebrationScope.weeklyEnding(weekStart),
        sentence: firstEver ? RhythmCopy.firstWeekSentence : RhythmCopy.weekDoneSentence,
        receipt: RhythmCopy.weekReceipt(studyDays, goal),
        ring: true,
        extraIds: firstEver ? const ['first_week_met'] : const [],
      );

  /// A milestone from `rhythm.milestones[]`; its id is the celebration id. Only `first_repair`
  /// (L2, a sentence and one hop) and `first_week_met` (L2, with the ring) get a moment; the
  /// others, including `first_full_mock`, are dated rows (L3) and never tied to a score.
  factory CelebrationEvent.milestone(RhythmMilestone milestone, {String scope = CelebrationScope.today}) {
    switch (milestone.id) {
      case 'first_repair':
        return CelebrationEvent(
          id: milestone.id,
          kind: CelebrationKind.milestone,
          level: CelebrationLevel.l2,
          scope: scope,
          sentence: RhythmCopy.firstRepairSentence,
        );
      case 'first_week_met':
        return CelebrationEvent(
          id: milestone.id,
          kind: CelebrationKind.milestone,
          level: CelebrationLevel.l2,
          scope: scope,
          sentence: RhythmCopy.firstWeekSentence,
          ring: true,
        );
      default:
        return CelebrationEvent(id: milestone.id, kind: CelebrationKind.milestone, level: CelebrationLevel.l3, scope: scope);
    }
  }

  final String id;
  final CelebrationKind kind;
  final CelebrationLevel level;
  final String scope;

  /// One plain sentence (L2, and the week).
  final String? sentence;

  /// The receipt line. Only given for something the server acknowledged.
  final String? receipt;

  /// The 500 ms ring sweep of a met week.
  final bool ring;

  /// Other ids that fire with this one and are consumed with it.
  final List<String> extraIds;
  final CelebrationSuppression? suppressedBy;
}
