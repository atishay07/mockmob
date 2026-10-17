// Everything `buildToday` needs, as plain values, so the whole screen logic is a pure function
// that tests can feed fixtures. `today_providers.dart` gathers these from the repositories.
import 'package:timezone/timezone.dart' as tz;

import '../../../core/auth/load_problem.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/learning_plan.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/repositories/dismissal_repository.dart';
import '../data/today_profile.dart';
import 'road_board.dart' show RoadPlan;

/// One question in today's Revise round: its id (to find the paper it was missed on), subject and
/// chapter, as the server sends them.
typedef ReviseCard = ({String questionId, String? subject, String? chapter});

/// The current week from the rhythm module: which days were study days, which one is today,
/// the goal and the student's own planned days.
class TodayWeek {
  const TodayWeek({
    required this.studied,
    required this.label,
    this.todayIndex,
    this.goal,
    this.planned,
    this.paused = false,
    this.met = false,
    this.dates,
  });

  /// Seven flags, Monday first.
  final List<bool> studied;

  /// "2 of 4 study days".
  final String label;
  final int? todayIndex;

  /// Study days a week, from the server.
  final int? goal;

  /// The student's chosen study days (0 = Monday), null without a plan.
  final Set<int>? planned;
  final bool paused;
  final bool met;

  /// Day of the month for each weekday, when the server's week is known.
  final List<int?>? dates;
}

/// The latest local session draft, reduced to what Today says about it.
class TodayDraft {
  const TodayDraft({
    required this.sessionId,
    required this.subject,
    required this.isMock,
    required this.total,
    required this.answered,
    required this.acknowledgedAnswered,
    required this.endsAt,
    required this.resumable,
    this.mockNumber,
    this.lastAckAt,
    this.attemptExists,
  });

  final String sessionId;
  final String subject;
  final bool isMock;
  final int? mockNumber;
  final int total;
  final int answered;

  /// Answers covered by the server's acknowledgement (the ended copy counts these).
  final int acknowledgedAnswered;
  final DateTime endsAt;
  final DateTime? lastAckAt;

  /// `resumableDraft` says it can still be continued.
  final bool resumable;

  /// After the deadline: true when `GET /api/attempts/{id}` found it, false on 404, null when
  /// not asked yet or the read failed.
  final bool? attemptExists;
}

class TodayInputs {
  const TodayInputs({
    required this.now,
    this.timezone = defaultTimezoneName,
    this.firstName,
    this.subjects = const [],
    this.attempts,
    this.attemptsFailed = false,
    this.readProblem,
    this.attemptsFetchedAt,
    this.attemptsStale = false,
    this.plan,
    this.planFetchedAt,
    this.planStale = false,
    this.week,
    this.weekLoading = false,
    this.weekFailed = false,
    this.returning = false,
    this.draft,
    this.unopened = const [],
    this.dismissed = const {},
    this.repaired = const {},
    this.profile,
    this.offline = false,
    this.selectedMinutes,
    this.roadPlan = const RoadPlan(),
    this.lastTriedAt,
    this.reviseDue,
    this.reviseShown,
    this.reviseCards = const [],
    this.reviseCap = 10,
    this.isPro = false,
    this.email,
    this.repairedToday = 0,
  });

  final DateTime now;
  final String timezone;
  final String? firstName;

  /// The student's subjects (public ids).
  final List<String> subjects;

  /// Newest first. Null while the first read is still running.
  final List<Attempt>? attempts;

  /// The attempts read failed with nothing cached.
  final bool attemptsFailed;

  /// Why the record did not load, when it did not: the cause the failed read reported (offline,
  /// slow, refused, an answer the app could not read), so the card says what happened instead of
  /// one sentence for everything. Null when nothing is known, and the card keeps its general line.
  final LoadProblem? readProblem;
  final DateTime? attemptsFetchedAt;

  /// Showing cached attempts because the read failed.
  final bool attemptsStale;
  final LearningPlan? plan;
  final DateTime? planFetchedAt;
  final bool planStale;
  final TodayWeek? week;

  /// The rhythm is visible and its first read has not landed: Today shows the strip as a skeleton.
  final bool weekLoading;

  /// The rhythm is visible, its first read failed and nothing is cached: the strip's slot stays,
  /// saying so, so a later read that lands fills it in place instead of adding a section (L03).
  final bool weekFailed;

  /// The server's `returning` (3 or more days away).
  final bool returning;
  final TodayDraft? draft;

  /// Results received and not opened yet: attempt id and when it arrived, newest first.
  final List<({String attemptId, DateTime receivedAt})> unopened;
  final Set<DismissalKey> dismissed;

  /// Questions repaired on this phone, per attempt.
  final Map<String, Set<String>> repaired;
  final TodayProfile? profile;
  final bool offline;

  /// The duration chip the student chose, or null for the default.
  final int? selectedMinutes;

  /// The student's own road: their exam date and mock target, when they set them.
  final RoadPlan roadPlan;

  /// When the last Try again ended with the record still not loaded, or null (L01: the failure
  /// card says "Tried again at 10:41 PM. Still not loading.", so a repeated tap visibly ran).
  final DateTime? lastTriedAt;

  /// Revise questions due today (`GET /api/me/revise`), or null while unread or when Revise cannot
  /// be read: an unknown count never makes Revise the move.
  final int? reviseDue;

  /// Questions today's Revise round asks at the default cap of 10 (the server's `shown`: at most
  /// 10, less what was answered today), or null when unknown (then [reviseDue] stands in).
  final int? reviseShown;

  /// The round's questions in the order the server sends them: what the move names its subjects,
  /// chapters and papers from.
  final List<ReviseCard> reviseCards;

  /// Questions a day the student chose for Revise: 5 or 10 (the Revise screen's own setting).
  final int reviseCap;

  /// A Pro account: Smart practice is a Pro mode, so only Pro gets it as the move.
  final bool isPro;

  /// The account's email: a first name equal to its local part is a handle, never a name.
  final String? email;

  /// Mistakes whose repair the server acknowledged today (the student's date): the done state.
  final int repairedToday;

  /// Whole days since the newest paper, or null with no paper on record.
  int? get daysAway {
    final all = attempts;
    if (all == null || all.isEmpty) return null;
    return daysSince(all.first.completedAt);
  }

  /// The day of the first week (1 to 7) while the first paper is under 7 days old, else null.
  int? get firstWeekDay {
    final all = attempts;
    if (all == null || all.isEmpty) return null;
    final day = daysSince(all.last.completedAt) + 1;
    return day >= 1 && day <= 7 ? day : null;
  }

  tz.Location get _location => locationFor(timezone);

  /// The student's wall clock for [instant] (default: now).
  DateTime clock([DateTime? instant]) {
    final local = tz.TZDateTime.from(instant ?? now, _location);
    return DateTime(local.year, local.month, local.day, local.hour, local.minute);
  }

  /// The student's calendar date for [instant], at midnight.
  DateTime date([DateTime? instant]) {
    final c = clock(instant);
    return DateTime.utc(c.year, c.month, c.day);
  }

  /// Whole calendar days between [instant] and today, in the student's zone.
  int daysSince(DateTime instant) => date().difference(date(instant)).inDays;
}
