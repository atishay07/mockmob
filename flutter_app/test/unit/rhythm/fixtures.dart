import 'package:mockmob/core/models/rhythm.dart';

/// Monday 12 October 2026 is the current week in these fixtures.
Rhythm rhythmFixture({
  String weekStart = '2026-10-12',
  List<String> studyDayDates = const ['2026-10-12', '2026-10-14'],
  int goal = 4,
  bool met = false,
  bool paused = false,
  int streak = 3,
  int best = 6,
  bool returning = false,
  int? daysSince,
  List<RhythmMilestone> milestones = const [],
  List<RhythmWeek>? history,
  int? repairs,
  int? mocks,
  RhythmWeek? lastClosed,
}) =>
    Rhythm(
      timeZone: 'Asia/Kolkata',
      weekStart: weekStart,
      studyDays: studyDayDates.length,
      studyDayDates: studyDayDates,
      daysGoal: goal,
      metThisWeek: met,
      paused: paused,
      weeksMetStreak: streak,
      bestRun: best,
      returning: returning,
      daysSinceLastActivity: daysSince,
      milestones: milestones,
      history: history,
      repairsThisWeek: repairs,
      mocksThisWeek: mocks,
      lastClosedWeek: lastClosed,
    );
