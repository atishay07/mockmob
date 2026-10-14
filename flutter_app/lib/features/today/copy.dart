// Every line Today says (Night Sheet brief sections 1.1, 8 and 12; design spec 5.3, 6.7, 6.8).
// Voice: a sharp senior who has been through CUET. Short, specific, warm, never defensive.
// Sentence case, no exclamation marks, no arrows, 12-hour times, real dates.
import '../../core/copy/formatters.dart';
import '../../core/domain/cuet_dates.dart';

abstract final class TodayCopy {
  // Header.
  static String greeting(int hour, String? firstName) {
    final who = firstName == null || firstName.isEmpty ? null : firstName;
    final part = switch (hour) {
      >= 5 && < 12 => 'Morning',
      >= 12 && < 17 => 'Afternoon',
      >= 17 && < 23 => 'Evening',
      _ => 'Up late',
    };
    // One pattern: "Good morning, Asha". After 11 PM the line changes to "Up late, Asha".
    final salutation = part == 'Up late' ? 'Up late' : 'Good ${part.toLowerCase()}';
    if (who == null) return part == 'Up late' ? 'Up late tonight' : salutation;
    return '$salutation, $who';
  }

  static String updatedAt(DateTime time) => 'Updated ${formatTime12(time)}';
  static const String offlineSuffix = 'You are offline.';
  static String updatedOffline(DateTime time) => 'Updated ${formatTime12(time)}. You are offline.';

  // Hero overlines.
  static String moveOverline(DateTime now) => "${tonightOrTodayTitle(now)}'s move";
  static const String firstMoveOverline = 'Your first move';
  static const String resumeOverline = 'Still open';
  static const String endedOverline = 'While you were away';
  static const String sealedOverline = 'Back from marking';

  // Day one and new user (brief 11.11).
  static const String questionsUnit = 'questions';
  static String startingPointLine(String subject) =>
      'Ten CUET-style questions in $subject. The result shows where your marks go, chapter by chapter.';
  static String startingPointWith(String subject, String framing) => 'Ten CUET-style questions in $subject. $framing';
  static String checkSetFor(DateTime at) => 'Your check is set for ${formatTime12(at)}.';
  static const String startNow = 'Start now, about 10 minutes';
  static const String startNowShort = 'Start now, 10 min';
  static const String fullMockInstead = 'Sit a full mock instead';
  static const String subjectChanged = 'You changed your subjects. Earlier results stay under the old ones.';

  // Ready (client-built repair).
  /// "to repair\ntonight": the big number is tonight's batch, not mistakes made today.
  static String mistakesLabel(int n, DateTime now) => 'to repair\n${tonightOrToday(now)}';

  /// Where tonight's batch comes from, said the same way on Today and in Review: "3 of the 4 in
  /// Admission of a partner, from Mock 7 on 11 Oct." Never "holds": that word is kept for a
  /// passed fresh check.
  static String tonightLine(int n, int chapterOpen, String source, String chapter, DateTime marked) {
    final from = 'from $source on ${formatDayMonthShort(marked)}';
    if (n < chapterOpen) return '$n of the $chapterOpen in $chapter, $from.';
    return n == 1 ? 'The one in $chapter, $from.' : 'All $n in $chapter, $from.';
  }

  static const String repairLength = "Length of today's repair";

  // Mobi in the header (a tap says one of these, in turn).
  static const List<String> mobiIdle = ['One move at a time. This one is ready.'];
  static const List<String> mobiPoint = ['That one, just below. Start when you are set.'];
  /// Only when today's opened result improved or held. A sealed or lower result never gets it.
  static const List<String> mobiCheer = ["Today's paper held or beat the last one."];

  /// A paper was submitted today and its result is lower or has nothing to compare with.
  static const List<String> mobiRecorded = ["Today's paper is on your sheet."];

  /// A paper from today is still sealed: the line says nothing about how it went.
  static const List<String> mobiSealed = ['Your result is ready when you are.', 'Open it whenever you are set.'];
  static const List<String> mobiSleepy = ['Late one. Something short, then sleep.'];

  static String questionNumbers(List<int> numbers) {
    final shown = numbers.take(3).map((n) => '$n').toList();
    final more = numbers.length > 3 ? ' and ${numbers.length - 3} more' : '';
    return 'Questions ${joinWithAnd(shown)}$more.';
  }

  static String startRepair(int minutes) => 'Start repair, about $minutes minutes';

  /// The same key for large text: the chips above it already say "10 min".
  static String startRepairShort(int minutes) => 'Start repair, $minutes min';
  static String aajKaRepair(int minutes, String chapter) => 'Aaj ka repair: $minutes minutes, $chapter.';
  static String basedOn(DateTime date) => 'Marked on ${formatDayMonth(date)}.';
  static const String earlySignal = 'From one paper. Another mock sharpens this.';

  // Other next-move states (spec 5.3 table, in this voice).
  static String staleLabel(int days) => '${pluralWord(days, 'day')}\nsince a mock';
  static String staleLine(DateTime date) => 'Your last mock was on ${formatDayMonth(date)}. A fresh set will update this.';
  static const String practiseToRefresh = 'Practise to refresh';
  static String thinLabel(int n) => '${pluralWord(n, 'question')}\nso far';
  static const String thinLine = 'From one paper. Ten more questions sharpen this.';
  static const String checkThisSkill = 'Check this skill';
  static String repairedLabel(int n) => 'repaired\nfrom $n';
  static String repairedNumberLabel(String source) => 'repaired\nfrom $source';
  static const String repairedLine = 'Fresh checks are not open yet. Practise another skill while those settle.';
  static const String practiseAnother = 'Practise another skill';
  static const String questionsOfMixed = 'mixed\nquestions';
  /// Said only when the record holds no open mistake (blanks are not mistakes). A repair the
  /// student hid for today keeps [noStrongWeakness]: the mistakes are there, just set aside.
  static const String noOpenMistakes = 'No open mistakes to repair right now.';
  static const String noStrongWeakness = 'Nothing stands out right now.';
  static String startMixed(int count) => 'Start mixed practice, $count questions';

  /// A practice key states its length: "Check this skill, 10 questions".
  static String withCount(String label, int count) => '$label, $count questions';
  static const String practiceLength = 'How many questions?';
  /// The label on the error card: a failed read is not tonight's move.
  static const String unavailableOverline = 'Could not load';
  static const String unavailableTitle = 'Your earlier results are still there.';
  static const String unavailableLine = 'We could not load a new suggestion just now.';
  static const String tryAgain = 'Try again';
  static const String choosePractice = 'Choose practice';
  static const String chooseSomethingElse = 'Choose something else';
  static const String hiddenUntilTomorrow = 'Hidden until tomorrow. Your mistakes are still in Review.';
  static const String connectToStart = 'Connect to start.';
  static const String showMe = 'Show me';

  // Returning and late night (brief 1.1, spec 6.7, 6.8).
  /// The greeting already says the name, so the returning hero never repeats it.
  /// Mobi already says hello, so the headline only adds the real gap when there is one.
  static String? returningHeadline(int? daysSincePaper) =>
      daysSincePaper != null && daysSincePaper >= 3 ? '$daysSincePaper days since your last paper.' : null;
  static String howLong(DateTime now) => 'How long have you got ${tonightOrToday(now)}?';
  static String lastMockStillHere(String source, DateTime date, int mistakes) => mistakes > 0
      ? 'Your last mock was $source on ${formatDayMonth(date)}. Its ${plural(mistakes, 'mistake')} are still here.'
      : 'Your last mock was $source on ${formatDayMonth(date)}. Nothing was lost.';
  /// Mobi's line on Today's card. Practice and Review keep "Late one tonight. Ten minutes, then
  /// sleep.", so Today says its own: the card's move is already short.
  static const String lateNight = 'Still up? One short move, then sleep.';
  static const String mobiWelcomeBack = 'Good to see you.';
  static const String mobiDayOne = "Let's find your marks.";

  // Resume and ended (spec 5.3 item 2).
  static String resumeTitle(String label, String subject) => '$label, $subject';
  static String answeredLabel(int total) => 'of $total\nanswered';
  static String endsAt(DateTime at) => 'Ends at ${formatTime12(at)}.';
  static String savedAt(DateTime at) => 'Saved on the server at ${formatTime12(at)}.';
  static const String answersOnPhone = 'Answers are on this phone.';
  static String resumeKey(String label) => 'Resume $label';
  static String endedRecorded(String label, DateTime at, int answered) =>
      '$label ended at ${formatTime12(at)}. Your ${plural(answered, 'answer')} sent before then were recorded.';
  static String endedSending(String label, DateTime at) =>
      '$label ended at ${formatTime12(at)}. Your answers are on this phone and are being sent.';
  static String endedClosed(String label, DateTime at, int answered) =>
      'The submission window for $label has ended, so it could not be recorded. '
      '${plural(answered, 'answer')} ${answered == 1 ? 'was' : 'were'} sent before ${formatTime12(at)}.';
  static String endedChecking(String label, DateTime at) =>
      '$label ended at ${formatTime12(at)}. Checking what reached the server.';
  static const String openResult = 'Open result';

  // Sealed result (spec 5.3 item 3, brief 12 Result).
  static String sealedTitle(String label, String subject) => '$label, $subject';
  static String receivedAt(DateTime at) => 'Received at ${formatTime12(at)}. Your result is ready.';
  static const String openSheet = 'Open your sheet';
  static const String openDirectly = 'Open results directly';
  static String moreResults(int n) => n == 1 ? '1 more result is ready to open.' : '$n more results are ready to open.';

  // Compact slots.
  static String nextUp(String what) => 'Next: $what';
  static String repairWhat(int n, String source) => 'repair ${plural(n, 'mistake')} from $source';

  // Recent papers.
  static const String yourSheet = 'Recent papers';
  static String sheetCaption(int n) => n == 1 ? 'Your last paper' : 'Your last $n';
  static const String sealed = 'Sealed';
  static String quickLabel(int total) => 'Quick $total';
  static String marksOf(int outOf) => 'of $outOf';
  static String changeUp(int by, String than) => '+$by on $than';
  static String changeDown(int by, String than) => '$minusSign$by on $than';
  static String changeLevel(String than) => 'Level with $than';
  static String splitLine(int right, int wrong, int blank) => '$right right, $wrong wrong, $blank blank';

  // The road.
  static const String roadTitle = 'The road to May';
  static String daysToWindowLabel(int days) => '${days == 1 ? 'day' : 'days'} to the expected\nCUET window, ${CuetDates.windowMonth}';
  static String weeksLabel(int weeks) => '${weeks == 1 ? 'week' : 'weeks'} to the expected\nCUET window, ${CuetDates.windowMonth}';
  static String weeksToBoardsUnit(int weeks) => weeks == 1 ? 'week before\nboards begin' : 'weeks before\nboards begin';
  static const String boardsOn = 'Boards are on. The plan stays light until they end.';
  static const String windowOpen = 'Exam window open';
  static String windowDaysLeft(int days) => '${days == 1 ? 'day' : 'days'} left in the expected\nexam window';
  static String sessionsLine(int n, int goal) {
    if (n <= 0) return 'Your first session starts the count.';
    final about = n < 20 ? n : (n / 10).round() * 10;
    return 'About $about study ${about == 1 ? 'session' : 'sessions'} at $goal a week.';
  }
  static const String stopRegistration = 'CUET registration';
  static const String whenRegistration = CuetDates.registrationMonths;
  static const String stopBoards = 'Class 12 boards';
  static const String whenBoards = CuetDates.boardsWhen;
  static const String noteBoards = 'The plan goes lighter from mid-February.';
  static const String stopExam = 'CUET UG';
  static const String whenExam = CuetDates.windowMonth;
  /// The tag on a stop whose date NTA or CBSE has not published.
  static const String expectedTag = 'Expected';
  /// Said once above the stops when every date is still expected.
  static const String expectedDates = 'Expected dates';
  static const String nowLabel = 'Now';
  static String weekNeedsOnTrack(int n) => n == 1 ? 'This week: 1 more study day by Sunday.' : 'This week: $n more study days by Sunday.';
  static const String weekNeedsMet = 'This week: your goal is met. Anything more is extra.';
  static const String weekNeedsPaused = 'This week is paused. Your run is kept.';
  static const String weekNeedsOutOfReach = 'This week: the goal is out of reach. Each study day still goes on the sheet.';
  /// The scale ("of 1000") is on every row, so the caption names only the year and the category;
  /// it stays on one line instead of leaving "1000" alone on a second.
  static String ladderCaption(String? category) => 'Last year\'s DU closing scores, ${categoryWords(category)}';

  /// A college-portal category in words a student says: "UR" is "unreserved", never the portal code.
  /// A name in common use (SC, ST, EWS, PwBD) stays; an unknown value is shown as it came, so
  /// the caption never hides the category it was built for.
  static String categoryWords(String? category) {
    final code = category?.trim() ?? '';
    return switch (code.toUpperCase()) {
      '' || 'UR' => 'unreserved',
      'OBC-NCL' => 'OBC',
      'SIKH' => 'Sikh minority',
      'KM' => 'Kashmiri migrant',
      'SGC' => 'single girl child',
      'ORPHAN-FEMALE' => 'orphan (female)',
      'ORPHAN-MALE' => 'orphan (male)',
      _ => code,
    };
  }
  static const String ladderTitle = 'Your colleges';
  static const String dreamTag = 'Dream';
  static const String chooseColleges = 'Choose your colleges';
  static const String changeColleges = 'Change';
  static const String ladderEmpty = 'Pick up to three colleges and see where each one closed last year.';

  // Why this sheet.
  static const String whyTitle = 'Why this';
  static String whyFrom(String source, String subject, DateTime date) => 'From $source, $subject, on ${formatDayMonth(date)}.';
  static String whyCounts(int wrong, int correct, int blank) =>
      '$wrong wrong, $correct right, $blank not attempted.';
  static String chapterRow(int wrong, int blank) {
    if (blank == 0) return '$wrong wrong';
    if (wrong == 0) return '$blank not attempted';
    return '$wrong wrong, $blank not attempted';
  }
  static const String whyEarly = 'One paper so far. Each mock you add sharpens it.';
  static const String whyRepair =
      'A repair walks you through each mistake with a worked explanation, then lets you try a similar question.';
  static const String seeMyAnswers = 'See my answers';
  static const String whyMissing = 'This suggestion has changed since you opened it.';

  // Alternatives sheet.
  static const String alternativesTitle = 'Something else instead';
  static const String altFullMock = 'Full mock';
  static const String altFullMockLine = '50 questions, 60 minutes.';
  static const String altQuick = 'Quick practice';
  static const String altQuickLine = '10 questions, about 10 minutes.';
  static const String altChapter = 'One chapter';
  static const String altChapterLine = 'Pick a chapter and practise only that.';
  static const String altReview = 'Review your mistakes';
  static const String altReviewLine = 'Read the worked explanations, free.';
  static const String notToday = 'Not today';
  static const String notTodayNote = 'Hides this repair until tomorrow.';

  // Weekly ending page.
  static const String weeklyEndingTitle = 'Your week';
  static const String back = 'Back to Today';

  // Loading.
  static const String loading = 'Loading Today';
}
