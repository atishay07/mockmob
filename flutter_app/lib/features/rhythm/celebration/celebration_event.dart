// What other modules hand to the CelebrationController. Every celebration is triggered by a
// server fact with a stable id and fires once (spec 6.2).
import '../../../core/copy/state_words.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';
import '../logic/milestone_tracks.dart';

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
    this.studyDays,
    this.goal,
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
        studyDays: studyDays,
        goal: goal,
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
        // The two new server badges (`first_hold`, `run_weeks_3`) get one quiet line when they land
        // ("It held landed."). The badges the server already dated stay dated rows, and so do the ones the
        // phone works out from a paper (clean set, new best, ...): the result of that paper announces them
        // once, in its own "Badge earned" row (BADGES-REFINE-1018 3), so Today never says them a second time.
        final badge = milestoneSteps.where((s) => s.id == milestone.id && s.source == BadgeSource.newServer).firstOrNull;
        if (badge != null) {
          return CelebrationEvent(
            id: milestone.id,
            kind: CelebrationKind.milestone,
            level: CelebrationLevel.l1,
            scope: scope,
            sentence: RhythmCopy.badgeLanded(badge.name),
            receipt: receipt == null ? null : '$receipt.',
          );
        }
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

  /// The ring of a met week.
  final bool ring;

  /// The counts behind the ring, when the caller has them: the moment then draws the week dial
  /// with the real numbers instead of a bare ring.
  final int? studyDays;
  final int? goal;

  /// Other ids that fire with this one and are consumed with it.
  final List<String> extraIds;

  /// The moment that must not celebrate, as a caller can state it (spec 6.2): the controller
  /// refuses a suppressed event and does not use it up, so it can fire later. No production
  /// caller sets it today: the repair run and the result flow simply do not fire a moment when
  /// the repair failed or the result is held, and the rhythm watcher never needs it. It stays
  /// as the controller's tested guard for a caller that would rather fire and be refused.
  final CelebrationSuppression? suppressedBy;

  /// A quiet key under the receipt ("See your milestones") and the in-app route it opens.
  final String? linkLabel;
  final String? link;
}
