// Every line Today says (Night Sheet brief sections 1.1, 8 and 12; design spec 5.3, 6.7, 6.8).
// Voice: a sharp senior who has been through CUET. Short, specific, warm, never defensive.
// Sentence case, no exclamation marks, no arrows, 12-hour times, real dates.
import '../../core/copy/formatters.dart' as fmt;
import '../../core/copy/formatters.dart';
import '../../core/domain/cuet_dates.dart';
import '../../core/domain/next_move.dart' show isLateNightHour;

abstract final class TodayCopy {
  // Header.
  static String greeting(int hour, String? firstName) {
    final who = firstName == null || firstName.isEmpty ? null : firstName;
    // Late night comes from the one shared definition, so the greeting and Mobi's late-night
    // line change at the same minute.
    final part = isLateNightHour(hour)
        ? 'Up late'
        : switch (hour) {
            < 12 => 'Morning',
            < 17 => 'Afternoon',
            _ => 'Evening',
          };
    // One pattern: "Good morning, Asha". From 11 PM to 5 AM the line is "Up late, Asha".
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
  /// One wording at every text size: the chips above already say "10 min", and the key never
  /// has to swap to a shorter sentence when the text grows.
  static const String startNow = 'Start now, 10 min';
  static const String fullMockInstead = 'Sit a full mock instead';
  static const String subjectChanged = 'You changed your subjects. Earlier results stay under the old ones.';

  // Ready (client-built repair).
  /// "to repair\ntonight": the big number is tonight's batch, not mistakes made today. Said only
  /// when the run holds the whole chapter, the number Review's badge shows.
  static String mistakesLabel(int n, DateTime now) => 'to repair\n${tonightOrToday(now)}';

  /// "to repair\nin 10 min": a shorter run than the whole chapter names its length, so its number
  /// never reads as tonight's total next to Review's badge.
  static String mistakesInLabel(int minutes) => 'to repair\nin $minutes min';

  /// Where tonight's batch comes from: "3 of the 4 open mistakes in Admission of a partner, from
  /// Mock 7 on 11 Oct." The denominator names its noun, so the 4 reads as what Review's badge
  /// counts (the chapter's open mistakes) and the hero's 3 as the part that fits the chosen
  /// length. Never "holds": that word is kept for a passed fresh check.
  static String tonightLine(int n, int chapterOpen, String source, String chapter, DateTime marked) {
    final from = 'from $source on ${formatDayMonthShort(marked)}';
    if (n < chapterOpen) return '$n of the $chapterOpen open mistakes in $chapter, $from.';
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

  static String startRepair(int minutes) => 'Start repair, $minutes min';
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
  static const String unavailableTitle = 'Your earlier results are still there.';
  static const String unavailableLine = 'Could not reach MockMob just now.';
  static const String unavailableOffline = 'You are offline. Your record loads again when you reconnect.';
  static const String tryAgain = 'Try again';
  static const String choosePractice = 'Choose practice';
  static const String chooseSomethingElse = 'Choose something else';
  static const String hiddenUntilTomorrow = 'Hidden until tomorrow. Your mistakes are still in Review.';
  static const String connectToStart = 'Needs a connection to start.';
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
  /// Mobi's line on Today's card, its own (Practice and Review say theirs): the card's move is
  /// already short.
  static const String lateNight = 'Still up? One short move, then sleep.';
  static const String mobiWelcomeBack = 'Good to see you.';
  static const String mobiDayOne = "Let's find your marks.";

  // Resume and ended (spec 5.3 item 2).
  static String resumeTitle(String label, String subject) => '$label, $subject';
  static String answeredLabel(int total) => 'of $total\nanswered';
  static String endsAt(DateTime at) => 'Ends at ${formatTime12(at)}.';
  static String savedAt(DateTime at) => 'Saved on the server at ${formatTime12(at)}.';
  /// How long ago the answers were last saved on the server, in words that stay true: a minute
  /// is "a minute ago", an hour "an hour ago". Said from the real save time.
  static String savedAgo(Duration since) {
    final s = since.inSeconds;
    if (s < 45) return 'Saved just now';
    if (s < 90) return 'Saved a minute ago';
    final m = since.inMinutes;
    if (m < 60) return 'Saved $m minutes ago';
    final h = since.inHours;
    if (h < 24) return h == 1 ? 'Saved an hour ago' : 'Saved $h hours ago';
    final d = since.inDays;
    return d == 1 ? 'Saved yesterday' : 'Saved $d days ago';
  }
  static const String answersOnPhone = 'Answers are on this phone.';
  static String resumeKey(String label) => 'Resume $label';
  static String endedRecorded(String label, DateTime at, int answered) =>
      '$label ended at ${formatTime12(at)}. Your ${plural(answered, 'answer')} sent before then were recorded.';
  static String endedSending(String label, DateTime at) =>
      '$label ended at ${formatTime12(at)}. Your answers are on this phone and are being sent.';
  static String endedClosed(String label, DateTime at, int answered) =>
      '$label ended at ${formatTime12(at)} and could not be recorded. '
      '${plural(answered, 'answer')} reached the server.';
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
  // One name per set, each with its real count (owner recording 15 Oct, item 4): "papers" are
  // every finished paper, the rows; the strip is one kind of them, named with its subject.
  /// The rows under "Recent papers": "Newest 4 of 8", or "All 3" when every paper is shown.
  static String sheetCaption(int shown, int total) {
    if (shown < total) return 'Newest $shown of $total';
    return total == 1 ? 'Your only paper' : 'All $total';
  }

  /// The kind the strip draws, said the way the rows label them: "Accountancy mocks",
  /// "Accountancy NTA mode mocks", "Accountancy Quick 10 papers".
  static String trendKind({required String subject, required bool mock, bool nta = false, required int questions}) =>
      mock ? '$subject ${nta ? 'NTA mode mocks' : 'mocks'}' : '$subject ${quickLabel(questions)} papers';

  /// The strip above the rows: "Marks in your newest 6 of 7 Accountancy mocks", or "Marks in all
  /// 3 of your Accountancy mocks" when it draws every one.
  static String trendCaption(int shown, int total, String kind) =>
      shown < total ? 'Marks in your newest $shown of $total $kind' : 'Marks in all $total of your $kind';
  static String trendDot(String label, String date, int marks, int outOf) => '$label, $date. $marks of $outOf marks. Opens the result.';
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
  /// How far a stop on the road is.
  static const String onNow = 'On now';
  static String inDays(int days) => days <= 0 ? 'Today' : 'in ${plural(days, 'day')}';
  static String inWeeks(int weeks) => 'in ${plural(weeks, 'week')}';
  /// The first stop still ahead.
  static const String nextTag = 'Next';
  /// The stops' short names where they are drawn on the road itself.
  static const String laneRegistration = 'Registration';
  static const String laneBoards = 'Boards';
  static const String laneExam = 'CUET UG';
  /// The stretch from Now to the next stop, written over it on the road ("15 weeks").
  static String stretchTo(int days) => days < 7 ? plural(days < 1 ? 1 : days, 'day') : plural(days ~/ 7, 'week');
  /// How far a day under the finger is from today (the road's scrub readout).
  static String scrubDistance(int days) => days == 0 ? 'today' : (days > 0 ? '${plural(days, 'day')} from now' : '${plural(-days, 'day')} ago');
  static String weekNeedsOnTrack(int n) => n == 1 ? 'This week: 1 more study day by Sunday.' : 'This week: $n more study days by Sunday.';
  static const String weekNeedsMet = 'This week: your goal is met. Anything more is extra.';
  static const String weekNeedsPaused = 'This week is paused. Your run is kept.';
  static const String weekNeedsOutOfReach = 'This week: the goal is out of reach. Each study day still goes on the sheet.';
  /// The scale ("of 1000") is on every row, so the caption names only the source and the
  /// category; it stays on one line instead of leaving "1000" alone on a second. The figures are
  /// the 2026 Round 1 minimum allocation scores, and the caption says so in plain words.
  static String ladderCaption(String? category) => 'Round 1 minimum, 2026, ${categoryWords(category)}';

  /// A college-portal category in words a student says (the shared mapping in core).
  static String categoryWords(String? category) => fmt.categoryWords(category);
  static const String ladderTitle = 'Your colleges';
  static const String dreamTag = 'Dream';
  static const String chooseColleges = 'Choose your colleges';
  static const String changeColleges = 'Change';
  static const String ladderEmpty = 'Pick up to three colleges and see where each one closed in Round 1, 2026.';

  // The road board (owner test 15 Oct): the student's own tiles under the road.
  static const String boardTitle = 'Your road';
  static const String boardCaption = 'Tap a tile to see it or change it.';
  static const String boardExpectedDate = 'Expected exam date';
  static const String boardYourDate = 'Your exam date';
  static String boardDaysLeft(int days) => days <= 0 ? 'Today' : (days < 14 ? '${plural(days, 'day')} to go' : '${days ~/ 7} weeks to go');
  static const String boardMocks = 'Full mocks taken';
  static const String boardNotRead = 'Not read yet';
  static const String boardSetTarget = 'Tap to set a target';
  static String boardOfTarget(int target) => 'of your target of $target';
  static const String boardStudyDays = 'Study days left';
  static const String boardNoGoal = 'Not set';
  static const String boardSetDays = 'Set your study days';
  static String boardAtGoal(int goal) => 'at $goal a week';
  static const String boardThisWeek = 'This week';
  static String boardStudyDaysWord(int n) => n == 1 ? 'study day' : 'study days';
  static const String boardDateTitle = 'Your exam date';
  static const String boardDateBody =
      'NTA has not published the 2027 dates yet. CUET UG is expected in May 2027. Choose the day you are aiming for and your road counts to it.';
  static const String boardDateInWindow = 'In the expected window';
  static const String boardDateOther = 'Pick another day';
  static const String boardDateReset = 'Count to the expected window';
  static const String boardOnThisPhone = 'Saved on this phone.';
  static const String boardMocksTitle = 'Full mocks';
  static const String boardMocksUnread = 'Your record has not loaded yet, so the count is not shown.';
  static String boardMocksSoFar(int n, DateTime? last) => n == 0 || last == null
      ? 'No full mock on your record yet. The first one shows where you stand.'
      : '${plural(n, 'full mock')} on your record. The last one was on ${formatDayMonth(last)}.';
  static String boardTargetLabel(String date) => 'Your target by $date';
  static const String boardFewer = 'One fewer';
  static const String boardMore = 'One more';
  static String boardTargetSemantics(int n) => 'Target, ${plural(n, 'full mock')}';
  static const String boardTargetMet = 'Target reached. Anything more is extra.';
  static String boardPace(int left, int weeks, int? every) =>
      every == null || weeks < 1 ? '$left more to go.' : '$left more in ${plural(weeks, 'week')}, about one every ${plural(every, 'day')}.';
  static const String boardSaveTarget = 'Save target';
  static const String boardStartMock = 'Start a full mock';
  static const String boardStudyDaysTitle = 'Study days left';
  static String boardStudyDaysBody(int n, int goal, String date) =>
      'At $goal study ${goal == 1 ? 'day' : 'days'} a week, you have about $n study days before $date.';
  static const String boardStudyDaysNone = 'Choose how many days a week you study and your road counts the study days left.';
  static const String boardBoardsCount = 'Board weeks, mid-February to early April, count two study days at most.';
  static const String boardChangeDays = 'Change study days';
  static String weeksToOwnDate(int weeks, String date) => '${weeks == 1 ? 'week' : 'weeks'} to your exam\ndate, $date';
  static String daysToOwnDate(int days, String date) => '${days == 1 ? 'day' : 'days'} to your exam\ndate, $date';

  /// The cue under the first screen that the road is further down (owner test 15 Oct: "something
  /// in the UI should be leading them below").
  static const String moreBelow = 'Your road to May';

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
