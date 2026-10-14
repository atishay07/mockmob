// Pure derivations from the server's rhythm response. The client never computes week
// boundaries: it renders `weekStart` and `studyDayDates` and only locates "today" inside them.
import '../../../core/models/rhythm.dart';
import '../../../core/widgets/week_strip.dart';
import '../copy.dart';
import 'dates.dart';

enum WeekStatus { open, met, extra, paused }

/// One day of the current week with its calendar date.
class WeekDayMark {
  const WeekDayMark({required this.date, required this.studyDay, required this.isToday});

  final DateTime? date;
  final bool studyDay;
  final bool isToday;
}

class WeekView {
  const WeekView({
    required this.days,
    required this.studyDays,
    required this.goal,
    required this.status,
    required this.label,
    this.pausedUntil,
  });

  final List<WeekDayMark> days;
  final int studyDays;
  final int goal;
  final WeekStatus status;

  /// The line beside the strip: "2 of 4 study days".
  final String label;
  final String? pausedUntil;

  bool get met => status == WeekStatus.met || status == WeekStatus.extra;

  List<WeekStripDay> get stripDays => [for (final d in days) WeekStripDay(studyDay: d.studyDay, isToday: d.isToday)];
}

/// Builds the current week from [rhythm]. [today] is the student's calendar date (a UTC
/// midnight date); when it falls outside the week (a stale cache) nothing is marked as today.
/// [pausedUntil] is the goal's `pausedUntil` (`YYYY-MM-DD`), used only for the words.
WeekView buildWeekView(Rhythm rhythm, {DateTime? today, String? pausedUntil}) {
  final start = parseIsoDate(rhythm.weekStart);
  final study = rhythm.studyDayDates.toSet();
  final days = <WeekDayMark>[
    for (var i = 0; i < 7; i++)
      () {
        final date = start?.add(Duration(days: i));
        return WeekDayMark(
          date: date,
          studyDay: date != null && study.contains(formatIsoDate(date)),
          isToday: date != null && today != null && date == today,
        );
      }(),
  ];
  final count = rhythm.studyDays;
  final goal = rhythm.daysGoal;
  final untilDate = pausedUntil == null ? null : parseIsoDate(pausedUntil);
  final until = untilDate == null ? null : formatDayMonthDate(untilDate);

  final WeekStatus status;
  final String label;
  if (rhythm.paused) {
    status = WeekStatus.paused;
    label = RhythmCopy.paused(until);
  } else if (rhythm.metThisWeek && count > goal) {
    status = WeekStatus.extra;
    label = RhythmCopy.stripExtra(count);
  } else if (rhythm.metThisWeek) {
    status = WeekStatus.met;
    label = RhythmCopy.stripMet(count, goal);
  } else {
    status = WeekStatus.open;
    label = RhythmCopy.stripOpen(count, goal);
  }
  return WeekView(days: days, studyDays: count, goal: goal, status: status, label: label, pausedUntil: until);
}

/// What the Weeks in rhythm row says. Never "0".
String weeksInRhythmText(Rhythm rhythm) =>
    rhythm.weeksMetStreak > 0 ? RhythmCopy.weeksInRhythm(rhythm.weeksMetStreak) : RhythmCopy.weeksInRhythmNone;

/// "A new run starts this week. Your best is still 6 weeks." when the run is not running and
/// there is a best to keep. Null otherwise (a brand new student has no best to mention).
String? runNote(Rhythm rhythm) {
  if (rhythm.weeksMetStreak > 0 || rhythm.bestRun <= 0) return null;
  return RhythmCopy.newRun(rhythm.bestRun);
}

/// Closed weeks for the hairline rows, newest first, as the server sends them.
List<RhythmWeek> closedWeeks(Rhythm rhythm) => rhythm.history ?? const [];

String closedWeekText(RhythmWeek week) {
  final start = parseIsoDate(week.weekStart);
  final weekOf = start == null ? week.weekStart : formatDayMonthDate(start);
  return RhythmCopy.closedWeekRow(weekOf, week.studyDays, week.goal);
}

/// The three ways to pause, as the server holds them: the Sunday of this week, the Sunday after
/// next, and 100 days from the student's today (the longest pause the server accepts).
enum PauseOption { thisWeek, twoWeeks, threeMonths }

/// The day the run is back on for [option]: the Monday after the pause ends, from the student's
/// own today as marked in [week]. Null when the week is a stale cache (no day is today), because
/// then the date would be a guess.
DateTime? pauseBackOn(PauseOption option, WeekView week) {
  final todayIndex = week.days.indexWhere((d) => d.isToday);
  if (todayIndex < 0) return null;
  final today = week.days[todayIndex].date;
  if (today == null) return null;
  final monday = today.subtract(Duration(days: todayIndex));
  return switch (option) {
    PauseOption.thisWeek => monday.add(const Duration(days: 7)),
    PauseOption.twoWeeks => monday.add(const Duration(days: 14)),
    PauseOption.threeMonths => today.add(const Duration(days: 101)),
  };
}
