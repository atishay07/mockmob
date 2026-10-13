// Everything `buildToday` needs, as plain values, so the whole screen logic is a pure function
// that tests can feed fixtures. `today_providers.dart` gathers these from the repositories.
import 'package:timezone/timezone.dart' as tz;

import '../../../core/models/attempt.dart';
import '../../../core/models/learning_plan.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/repositories/dismissal_repository.dart';
import '../data/today_profile.dart';

/// The current week from the rhythm module: which days were study days, which one is today.
class TodayWeek {
  const TodayWeek({required this.studied, required this.label, this.todayIndex});

  /// Seven flags, Monday first.
  final List<bool> studied;

  /// "2 of 4 study days".
  final String label;
  final int? todayIndex;
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
    this.attemptsFetchedAt,
    this.attemptsStale = false,
    this.plan,
    this.planFetchedAt,
    this.planStale = false,
    this.week,
    this.returning = false,
    this.draft,
    this.unopened = const [],
    this.dismissed = const {},
    this.repaired = const {},
    this.profile,
    this.offline = false,
    this.selectedMinutes,
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
  final DateTime? attemptsFetchedAt;

  /// Showing cached attempts because the read failed.
  final bool attemptsStale;
  final LearningPlan? plan;
  final DateTime? planFetchedAt;
  final bool planStale;
  final TodayWeek? week;

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
