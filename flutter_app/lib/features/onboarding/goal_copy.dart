/// Words for the daily goal (H1, option A, 19 Oct): the fourth "More" bubble, its sheet, Mobi's line
/// under the bubbles and the goal sheet in You. Plain, full sentences (R6, D84), read aloud.
abstract final class GoalCopy {
  // The fourth bubble.
  static const String more = 'more';
  static const String moreSpoken = 'More, for an hour or longer';

  /// What a goal is called in a sentence: "45 minutes", "1 hour", "1 hour 30 minutes", "2 hours".
  static String words(int m) {
    if (m < 60) return m == 1 ? '1 minute' : '$m minutes';
    final h = m ~/ 60, r = m % 60;
    final hours = h == 1 ? '1 hour' : '$h hours';
    return r == 0 ? hours : '$hours $r minutes';
  }

  /// The figure inside a bubble: "45", "1h", "1h 30".
  static String short(int m) {
    if (m < 60) return '$m';
    final h = m ~/ 60, r = m % 60;
    return r == 0 ? '${h}h' : '${h}h $r';
  }

  /// The word under a long goal's bubble.
  static String caption(int m) => switch (m) {
        60 => 'a mock a day',
        120 => 'two mocks a day',
        < 60 => 'minutes',
        _ => 'a day',
      };

  static String spoken(int m) => '${words(m)} a day';

  /// Mobi's line under the bubbles in onboarding. There is no history yet, so it follows the
  /// choice alone and claims nothing about the student.
  static String slotLine(int m) {
    if (m <= 30) return 'Full mocks are in Practice whenever you want one. Tap More for an hour or longer.';
    if (m < 60) return 'That leaves room for a long practice and a repair. Full mocks are in Practice whenever you want one.';
    if (m == 60) return 'One hour fits a full mock, timed like the exam. You can change this any time in You.';
    if (m < 120) return '${_capital(words(m))} fits a full mock, with time left to repair what it finds. You can change this any time in You.';
    if (m == 120) return 'Two hours fits two full mocks. A short break between them helps.';
    if (m < 240) return '${_capital(words(m))} fits two full mocks and the repairs after them. A short break between them helps.';
    return 'That is a big day. Short breaks between papers help the marks stick.';
  }

  // The More sheet.
  static const String moreTitle = 'Aim for more each day';
  static const String moreLead = 'A full mock takes about an hour. Pick what you can really keep.';
  static const String oneHour = '1 hour';
  static const String oneHourLine = 'Time for one full mock a day.';
  static const String twoHours = '2 hours';
  static const String twoHoursLine = 'Time for two full mocks a day.';
  static const String yourOwn = 'Your own';
  static const String yourOwnLine = 'Any length, in 15-minute steps.';
  static String use(int m) => 'Use ${words(m)} a day';
  static const String shorter = 'Fifteen minutes shorter';
  static const String longer = 'Fifteen minutes longer';
  static const String shortest = '15 minutes is the shortest';
  static const String longest = 'This is the longest goal the app holds';
  static String ownSpoken(int m) => 'Your own length, ${words(m)} a day';

  // The goal sheet in You.
  static const String rowTitle = 'Your goal';
  static String rowValue(int? minutes, int? days) {
    final d = days == null ? null : (days == 1 ? '1 day a week' : '$days days a week');
    if (minutes == null) return d ?? '';
    return d == null ? '${words(minutes)} a day' : '${words(minutes)} a day, $d';
  }

  static const String sheetTitle = 'Your daily goal';
  static const String sheetLead = 'Today plans around this, and your study days set your week.';
  static const String studyDays = 'Study days';
  static const String fewerDays = 'One study day fewer';
  static const String moreDays = 'One study day more';
  static String daysSpoken(int n) => n == 1 ? '1 study day a week' : '$n study days a week';
  static const String save = 'Save my goal';
  static String saved(String at) => 'Goal saved at $at.';
  static const String daysOffline = 'You are offline. Your daily time is saved on this phone; your study days were not changed. Try again when you are connected.';
  static const String daysFailed = 'Your daily time is saved on this phone, but we could not save your study days. Try again.';
  static const String fromRecord = 'From your own record';
  static String useMinutes(int m) => 'Use ${words(m)}';
  static String usualLine(int m) => 'You usually practise about ${words(m)} at a time.';
  static String usualLineAt(int m, String t) => 'You usually practise about ${words(m)} at a time, mostly after $t.';
  static String raiseLine(int m, int n, int outOf) =>
      'You have done about ${words(m)} on $n of your last $outOf study days. A $m-minute goal would match how you really study.';
  static String fitLine(int goal, int m) =>
      'Your $goal-minute goal has been hard to reach lately. A $m-minute goal you meet beats a big one you miss.';
  static String learning(int n) => "I'm still learning how you study. After $n more ${n == 1 ? 'session' : 'sessions'}, I can suggest a goal from your own record.";

  static String _capital(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}
