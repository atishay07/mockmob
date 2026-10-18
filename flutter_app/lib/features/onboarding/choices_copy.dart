/// Words for the course, subjects, marks and pace steps added with the owner's 18 Oct notes
/// (D41-D47) and the usage-data default (D49). Plain, short and true; kept apart from
/// `copy.dart` so the onboarding's two packets of work never edit the same lines.
abstract final class ChoicesCopy {
  // Course step (D41).
  /// G4, G5: the order is aspirant demand (never "top"), and the one course can change any time.
  static const String courseSupport = 'Commerce students aim for these most. You can change your course any time.';
  static const String moreCourses = 'More courses';
  static String moreCoursesNote(int n) => 'All $n DU courses that had seats in Round 1 of 2026';
  static const String moreCoursesTitle = 'Every DU course';
  static const String courseSearchHint = 'Search courses';
  static String courseListCount(int n) => 'There are $n courses here. Each line shows the CUET subjects a course takes, from the DU Bulletin.';
  static String noCourseMatch(String q) => 'No DU course matches "$q".';
  static String collegesShort(int n) => n == 1 ? '1 college' : '$n colleges';
  static const String combosSpoken = 'CUET subjects';

  // Subjects step (D42).
  static const String subjectsSupportOpen = 'Add your CUET subjects, then be harsh about each one.';
  static const String quickSetsLabel = 'Common sets, one tap';

  /// Under the sets while a chosen subject has no rating yet: Okay is only the plan's default
  /// (walk 19 Oct, #16), so it is named as a guess and the three taps are asked for.
  static const String ratingGuess = 'Every subject starts at Okay, which is only a guess. Tap Shaky, Okay or Strong on each one.';

  /// The one quiet row the other sets fold into once a set is chosen.
  static const String otherSets = 'Other sets';
  static String neededFor(String course) => 'Needed for $course';
  static String setSpoken(String names) => 'Set: $names';
  static const String setOn = 'on your sheet';

  // Marks step (D45).
  static const String worrySupport = 'Pick up to three. The first one decides where you start.';
  static const String worrySwapped = 'You can pick three at most, so your oldest pick made room.';

  /// Mobi, when a fourth pick replaces the third: names the pick that went (v15 taste pass).
  static String worrySwappedOut(String words) => "I swapped out '${_capital(words)}'. You can pick three at most.";

  static String _capital(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
  static String worryRank(int i) => switch (i) { 0 => 'First', 1 => 'Second', _ => 'Third' };

  // Pace step (D46, D47).
  static const String fullMocksLine = 'Full mocks are in Practice whenever you want one.';
  static const String daysPerWeek = 'days a week';
  static String daysSpoken(int n) => n == 1 ? '1 study day a week' : '$n study days a week';
  static const String daysSlider = 'Study days a week';
  static const String tapDays = 'Tap a day to swap it.';
  static String runwaySpoken(int weeks, int days) => '$weeks weeks to CUET, $days study days in each.';
  static const String weeksLeft = 'weeks to CUET';
  static String mobiFewDays(int n) => n == 1 ? 'One day a week is fine. Short and steady works.' : 'Two days a week is fine. Short and steady works.';
  static const String mobiEveryDay = 'Are you studying every day? Keep one day for rest.';

  /// The live readout beside the sessions figure: "About 37 hours of practice before May, if you
  /// keep this." Hours come from the chosen session length.
  static String sessionsLine({required int sessions, required int minutes, required bool estimate, required int year, required bool boards}) {
    final hours = (sessions * minutes / 60).round();
    final about = estimate ? 'About ' : '';
    final time = hours >= 2 ? '$about$hours hours' : '$about${sessions * minutes} minutes';
    final when = 'before May${year == 2028 ? ' 2028' : ''}';
    return '$time of practice $when, if you keep this.${boards ? ' During board exams we count two sessions a week.' : ''}';
  }

  /// The hero line beside the sessions figure at the top of the pace step (v15 taste pass): what
  /// the pace adds up to, in a few words. "About 31 hours before May".
  static String sessionsHours({required int sessions, required int minutes, required bool estimate, required int year}) {
    final hours = (sessions * minutes / 60).round();
    final about = estimate ? 'About ' : '';
    final time = hours >= 2 ? '$about$hours hours' : '$about${sessions * minutes} minutes';
    return '$time before May${year == 2028 ? ' 2028' : ''}';
  }

  /// Under the runway: how the count treats the board weeks.
  static const String boardsCount = 'During board exams we count two sessions a week.';

  static String sessionsSpoken({required int sessions, required int minutes, required bool estimate}) =>
      '${estimate ? 'About ' : ''}$sessions sessions of $minutes minutes before CUET.';
  static const String sessionsUnit = 'sessions';

  // Colleges (19 Oct, G6/D103): the number beside each one on a list.
  /// "907.5 of 1000 last year": the Round 1 closing mark of the DU CSAS list the data comes from,
  /// for the student's course and category. A college with no seat for it says so plainly.
  static String closingLast(String? score) => score == null ? 'No number from last year' : '$score of 1000 last year';

  // Usage data (D49).
  static const String usageOffAnyTime = 'Turn it off any time in You, under Account and privacy.';
  static const String usageChangeAnyTime = 'Change it any time in You, under Account and privacy.';
}
