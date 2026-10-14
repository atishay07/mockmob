/// The real dates the onboarding may use (directions-final 0.10), always called "expected" until
/// NTA publishes: CUET in May; Class 12 boards from mid-February to early April.
abstract final class CuetCalendar {
  /// The start of the expected window for a CUET year (May 1st, the earliest it could open).
  static DateTime windowStart(int year) => DateTime(year, 5, 1);

  /// Mid-February to early April of [year]: Class 12 boards.
  static DateTime boardsStart(int year) => DateTime(year, 2, 15);
  static DateTime boardsEnd(int year) => DateTime(year, 4, 5);

  /// During board weeks a Class 12 plan drops to this many sessions a week.
  static const int boardWeekSessions = 2;

  /// Whole weeks from [now] to the window of [year], or null once the window has started.
  static int? weeksTo(int year, DateTime now) {
    final days = windowStart(year).difference(DateTime(now.year, now.month, now.day)).inDays;
    if (days <= 0) return null;
    return (days / 7).floor();
  }

  /// Sessions before the window if the student keeps [daysPerWeek]; board weeks count at most
  /// [boardWeekSessions] when [boards] is true. Plain arithmetic on the student's own choices.
  static int sessionsBefore(int year, DateTime now, {required int daysPerWeek, required bool boards}) {
    final weeks = weeksTo(year, now);
    if (weeks == null || daysPerWeek <= 0) return 0;
    var total = 0;
    final start = DateTime(now.year, now.month, now.day);
    for (var w = 0; w < weeks; w++) {
      final weekStart = start.add(Duration(days: w * 7));
      final inBoards = boards && !weekStart.isBefore(boardsStart(year)) && weekStart.isBefore(boardsEnd(year));
      total += inBoards ? (daysPerWeek < boardWeekSessions ? daysPerWeek : boardWeekSessions) : daysPerWeek;
    }
    return total;
  }

  /// "about 120": rounded to the nearest ten above twenty, exact below.
  static String about(int n) => n < 20 ? '$n' : 'about ${(n / 10).round() * 10}';
}
