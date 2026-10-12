import 'json_helpers.dart';

class RhythmMilestone {
  const RhythmMilestone({required this.id, this.achievedAt});

  factory RhythmMilestone.fromJson(Json j) => RhythmMilestone(id: asStringOr(j['id'], ''), achievedAt: asDate(j['achievedAt']));

  final String id;

  /// Null when not earned.
  final DateTime? achievedAt;

  bool get earned => achievedAt != null;
}

/// One closed week (`history` of backend module B2, not live yet).
class RhythmWeek {
  const RhythmWeek({required this.weekStart, required this.studyDays, required this.goal, required this.met, this.paused = false});

  factory RhythmWeek.fromJson(Json j) => RhythmWeek(
    weekStart: asStringOr(j['weekStart'] ?? j['id'], ''),
    studyDays: asInt(j['studyDays']) ?? 0,
    goal: asInt(j['goal']) ?? 0,
    met: asBool(j['met']) ?? false,
    paused: asBool(j['paused']) ?? false,
  );

  final String weekStart;
  final int studyDays;
  final int goal;
  final bool met;

  /// True when the week was closed while rhythm was paused.
  final bool paused;
}

/// `GET /api/me/rhythm` [API 2.3]. Week boundaries are the server's; the client only renders.
class Rhythm {
  const Rhythm({
    required this.timeZone,
    required this.weekStart,
    required this.studyDays,
    required this.studyDayDates,
    required this.daysGoal,
    required this.metThisWeek,
    required this.paused,
    required this.weeksMetStreak,
    required this.bestRun,
    this.lastActivityAt,
    this.daysSinceLastActivity,
    this.returning = false,
    this.milestones = const [],
    this.history,
    this.repairsThisWeek,
    this.mocksThisWeek,
    this.lastClosedWeek,
  });

  factory Rhythm.fromJson(Json j) => Rhythm(
    timeZone: asStringOr(j['timeZone'], 'Asia/Kolkata'),
    weekStart: asStringOr(j['weekStart'], ''),
    studyDays: asInt(j['studyDays']) ?? 0,
    studyDayDates: asStringList(j['studyDayDates']),
    daysGoal: asInt(j['daysGoal']) ?? 4,
    metThisWeek: asBool(j['metThisWeek']) ?? false,
    paused: asBool(j['paused']) ?? false,
    weeksMetStreak: asInt(j['weeksMetStreak']) ?? 0,
    bestRun: asInt(j['bestRun']) ?? 0,
    lastActivityAt: asDate(j['lastActivityAt']),
    daysSinceLastActivity: asInt(j['daysSinceLastActivity']),
    returning: asBool(j['returning']) ?? false,
    milestones: [for (final m in asJsonList(j['milestones'])) RhythmMilestone.fromJson(m)],
    history: j['history'] is List ? [for (final w in asJsonList(j['history'])) RhythmWeek.fromJson(w)] : null,
    repairsThisWeek: asInt(j['repairsThisWeek']),
    mocksThisWeek: asInt(j['mocksThisWeek']),
    lastClosedWeek: j['lastClosedWeek'] is Map ? RhythmWeek.fromJson(asJson(j['lastClosedWeek'])) : null,
  );

  final String timeZone;

  /// Monday of the current week, `YYYY-MM-DD`.
  final String weekStart;
  final int studyDays;
  final List<String> studyDayDates;
  final int daysGoal;
  final bool metThisWeek;
  final bool paused;
  final int weeksMetStreak;
  final int bestRun;
  final DateTime? lastActivityAt;
  final int? daysSinceLastActivity;

  /// True after 3 or more days away.
  final bool returning;
  final List<RhythmMilestone> milestones;

  /// B2 fields, null until the server ships them.
  final List<RhythmWeek>? history;
  final int? repairsThisWeek;
  final int? mocksThisWeek;
  final RhythmWeek? lastClosedWeek;
}

/// `GET/PUT /api/me/goal`. The goal unit is study days per week.
class Goal {
  const Goal({required this.daysPerWeek, this.timezone, this.pausedUntil});

  factory Goal.fromJson(Json j) => Goal(
    daysPerWeek: (asInt(j['daysPerWeek']) ?? 4).clamp(1, 7),
    timezone: asString(j['timezone']),
    pausedUntil: asString(j['pausedUntil']),
  );

  final int daysPerWeek;
  final String? timezone;

  /// `YYYY-MM-DD` or null.
  final String? pausedUntil;

  Goal copyWith({int? daysPerWeek, String? pausedUntil, bool clearPause = false}) => Goal(
    daysPerWeek: daysPerWeek ?? this.daysPerWeek,
    timezone: timezone,
    pausedUntil: clearPause ? null : (pausedUntil ?? this.pausedUntil),
  );
}
