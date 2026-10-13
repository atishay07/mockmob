// What other modules hand to the CelebrationController. Every celebration is triggered by a
// server fact with a stable id and fires once (spec 6.2).
import '../../../core/copy/state_words.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';

/// L0 (an answer was recorded) is plain text in the host screen and never comes here.
/// L1 repair finished or week met; L2 firsts; L3 a dated row that fades into the timeline.
enum CelebrationLevel { l1, l2, l3 }

enum CelebrationKind {
  repairFinished,
  weekMet,
  milestone,

  /// A milestone that landed while the app was away for more than 48 hours: one quiet receipt
  /// line with a link to the milestones, never a replayed moment.
  milestoneReceipt,
}

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
    this.linkLabel,
    this.link,
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
  /// [date] is the student's calendar date of the server's `achievedAt` ("11 October"); with it
  /// the moment carries the dated receipt line ("First repair finished on 11 October.").
  factory CelebrationEvent.milestone(RhythmMilestone milestone, {String scope = CelebrationScope.today, String? date}) {
    final receipt = date == null ? null : RhythmCopy.milestoneRow(milestone.id, date);
    switch (milestone.id) {
      case 'first_repair':
        return CelebrationEvent(
          id: milestone.id,
          kind: CelebrationKind.milestone,
          level: CelebrationLevel.l2,
          scope: scope,
          sentence: RhythmCopy.firstRepairSentence,
          receipt: receipt == null ? null : '$receipt.',
        );
      case 'first_week_met':
        return CelebrationEvent(
          id: milestone.id,
          kind: CelebrationKind.milestone,
          level: CelebrationLevel.l2,
          scope: scope,
          sentence: RhythmCopy.firstWeekSentence,
          receipt: receipt == null ? null : '$receipt.',
          ring: true,
        );
      default:
        return CelebrationEvent(id: milestone.id, kind: CelebrationKind.milestone, level: CelebrationLevel.l3, scope: scope);
    }
  }

  /// Milestones that landed while the app was away (older than 48 hours): one L1 receipt for
  /// the newest of them, with a link to the milestones. The others are named by count and used
  /// up with it, so the receipt shows once. [date] is the student's calendar date of [newest].
  factory CelebrationEvent.milestoneReceipt({
    required RhythmMilestone newest,
    required String date,
    List<String> others = const [],
    String scope = CelebrationScope.today,
  }) =>
      CelebrationEvent(
        id: newest.id,
        kind: CelebrationKind.milestoneReceipt,
        level: CelebrationLevel.l1,
        scope: scope,
        receipt: RhythmCopy.milestoneReceipt(newest.id, date, others: others.length),
        extraIds: others,
        linkLabel: RhythmCopy.seeMilestones,
        link: AppRoutes.youMilestones,
      );

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

  /// The moment that must not celebrate, as the caller knows it (spec 6.2): a suppressed event
  /// is refused and not used up, so it can fire later. The caller that fires a repair or a
  /// result moment passes it; the rhythm watcher never needs it.
  final CelebrationSuppression? suppressedBy;

  /// A quiet key under the receipt ("See your milestones") and the in-app route it opens.
  final String? linkLabel;
  final String? link;
}
