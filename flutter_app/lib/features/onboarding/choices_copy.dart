/// Words for the course, subjects, marks and pace steps added with the owner's 18 Oct notes
/// (D41-D47) and the usage-data default (D49). Plain, short and true; kept apart from
/// `copy.dart` so the onboarding's two packets of work never edit the same lines.
abstract final class ChoicesCopy {
  // Course step (D41).
  static const String courseSupport = 'The most chosen DU courses first, with the CUET subjects each one takes.';
  static const String moreCourses = 'More courses';
  static String moreCoursesNote(int n) => 'All $n DU courses with seats in Round 1, 2026';
  static const String moreCoursesTitle = 'Every DU course';
  static const String courseSearchHint = 'Search courses';
  static String courseListCount(int n) => '$n courses. Each line is its CUET subject combination from the DU Bulletin.';
  static String noCourseMatch(String q) => 'No DU course matches "$q".';
  static String collegesShort(int n) => n == 1 ? '1 college' : '$n colleges';
  static const String combosSpoken = 'CUET subjects';

  // Subjects step (D42).
  static const String subjectsSupportOpen = 'Add your CUET subjects, then be harsh about each one.';
  static const String quickSetsLabel = 'Common sets, one tap';
  static String neededFor(String course) => 'Needed for $course';
  static String setSpoken(String names) => 'Set: $names';
  static const String setOn = 'on your sheet';

  // Marks step (D45).
  static const String worrySupport = 'Pick up to three. The first one decides where you start.';
  static const String worrySwapped = 'Three is the most. Your oldest pick made room.';
  static String worryRank(int i) => switch (i) { 0 => 'First', 1 => 'Second', _ => 'Third' };

  // Pace step (D46, D47).
  static const String fullMocksLine = 'Full mocks are in Practice whenever you want one.';
  static const String daysPerWeek = 'days a week';
  static String daysSpoken(int n) => n == 1 ? '1 study day a week' : '$n study days a week';
  static const String daysSlider = 'Study days a week';
  static const String tapDays = 'Tap a day to swap it.';
  static String runwaySpoken(int weeks, int days) => '$weeks weeks to CUET, $days study days in each.';
  static const String weeksLeft = 'weeks to CUET';
  static String mobiFewDays(int n) => n == 1 ? 'One day a week. Short and steady works.' : 'Two days a week. Short and steady works.';
  static const String mobiEveryDay = 'Every day? Keep one day to rest.';

  /// The live readout: "about 110 sessions, about 37 hours by May".
  static String sessionsLine({required int sessions, required int minutes, required bool estimate, required int year, required bool boards}) {
    final hours = (sessions * minutes / 60).round();
    final about = estimate ? 'about ' : '';
    final time = hours >= 2 ? '$about$hours hours' : '$about${sessions * minutes} minutes';
    final when = 'before May${year == 2028 ? ' 2028' : ''}';
    return '$time of practice $when, if you keep this.${boards ? ' During boards we count two a week.' : ''}';
  }

  static String sessionsSpoken({required int sessions, required int minutes, required bool estimate}) =>
      '${estimate ? 'About ' : ''}$sessions sessions of $minutes minutes before CUET.';
  static const String sessionsUnit = 'sessions';

  // Usage data (D49).
  static const String usageOffAnyTime = 'Turn it off any time in You, under Account and privacy.';
  static const String usageChangeAnyTime = 'Change it any time in You, under Account and privacy.';
}
