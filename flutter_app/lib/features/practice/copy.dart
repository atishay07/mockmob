import '../../core/copy/copy.dart';

/// Every user-facing string of the practice feature. Voice: a sharp senior who has been through
/// CUET. Sentence case, no middle dots, no emoji, no exclamation marks, no arrows, 12-hour times,
/// no prices. Costs appear only on the confirm sheet, written as what you get.
abstract final class PracticeCopy {
  // Practice tab.
  static const String tabTitle = 'Practice';
  static const String chooseOwn = 'Choose your own';
  static const String concepts = 'Concepts';
  static const String allConcepts = 'See all';
  static const String moreSubjects = 'More subjects';
  static const String otherSubjectsTitle = 'More subjects';
  static const String otherSubjectsEmpty = 'No other subjects are open for practice right now.';

  // The suggestion at the top.
  static const String suggestedOverline = 'Your next practice';
  static const String lateOverline = 'Late one tonight. Ten minutes, then sleep.';
  static const String resumeOverline = 'Still open';
  static const String showMe = 'Show me';
  static const String showMeSemantics = 'Show me, the attempt behind this';
  static const String startKey = 'Start';
  static const String resumeKey = 'Resume';
  static const String questionsUnit = 'questions';

  static String resumeMockTitle(String? mockLabel, String subject) => '${mockLabel ?? 'Your mock'}, $subject';
  static String resumePracticeTitle(String subject) => '$subject practice';
  static String resumeOf(int total) => 'of $total';
  static String resumeMockReason(DateTime endsAt) => 'The clock kept running. It ends at ${formatTime12(endsAt)}.';
  static const String resumePracticeReason = 'Pick up where you left off.';

  static String chapterKicker(String subject) => '$subject, one chapter';
  static String chapterReasonMock(int marks, String mockLabel) => 'It cost you $marks marks in $mockLabel.';
  static String chapterReasonPractice(int missed) =>
      missed == 1 ? 'You missed 1 here in your last practice.' : 'You missed $missed here in your last practice.';

  static String subjectTitle(String subject) => '$subject, quick practice';
  static const String subjectKicker = 'Mixed chapters';
  static String subjectReason(String subject, String when) => 'Your last $subject paper was $when.';

  static const String startingTitle = 'Your starting point';
  static String startingKicker(String subject) => '$subject, mixed chapters';
  static String startingReason(String subject) => '$subject is first on your list. Ten questions shows where you stand.';
  static String firstOnListReason(String subject) => '$subject is first on your list.';

  static String heroSemantics(String title, String reason) => '$title. $reason';

  // The modes, as what you get.
  static const String quickTitle = 'Quick practice';
  static const String quickLine = '5 to 20 questions, your pick.';
  static const String chapterTitle = 'One chapter';
  static const String chapterLine = 'Pick a chapter, then 5 to 20 questions.';
  static const String fullMockTitle = 'Full mock';
  static String fullMockLine({required int questions, int? minutes}) =>
      minutes == null ? '$questions questions, timed like the exam.' : '$questions questions, $minutes minutes, timed like the exam.';
  static const String ntaTitle = 'Exam-day layout';
  static String ntaLine({required int questions}) => 'The NTA screen, $questions questions, timed.';
  static const String ntaGatedLine = 'Comes with Pro. A Full mock is open to you now.';
  static const String proTag = 'Pro';

  // Confirm sheet and setup page.
  static String confirmTitle(String mode, String subject) => '$mode, $subject';
  static String mockTitle(String? mockLabel, String subject) => '${mockLabel ?? 'Full mock'}, $subject';
  static const String subjectLabel = 'Subject';
  static const String questionsLabel = 'Questions';
  static const String chapterLabel = 'Chapter';
  static const String chooseChapter = 'Choose a chapter';
  static const String chooseChapterFirst = 'Choose a chapter first.';
  static const String chooseChapterTitle = 'Choose a chapter';
  static const String chaptersLoadFailed = 'We could not load the chapters. Try again.';
  static const String chaptersOffline = 'Connect to see the chapters.';
  static const String whatYouGet = 'What you get';
  static String getLine(int count, Duration? time) =>
      time == null ? '${plural(count, 'question')}.' : '${plural(count, 'question')}, ${formatDurationAbout(time)}.';
  static String mockGetLine(int count, int? minutes) =>
      minutes == null ? '${plural(count, 'question')}.' : '${plural(count, 'question')}, ${plural(minutes, 'minute')}.';
  static const String startPractice = 'Start practice';
  static const String startChapter = 'Start chapter practice';
  static const String startMock = 'Start mock';
  static const String checkingCost = 'Checking what this takes.';
  static const String feedbackAfter = 'You see what was right once you finish.';
  static const String retry = 'Try again';
  static const String notNow = 'Not now';

  // Costs and free paths (the numbers always come from the quote).
  static const String freeToday = 'Free today';
  static String freeFirstIn(String subject) => 'Free, your first one in $subject';
  static String usesCredits(int cost, int? balance) =>
      balance == null ? '${plural(cost, 'credit')}.' : '${plural(cost, 'credit')}. You have $balance.';
  static const String unavailableFallback = 'This is not open right now.';
  static const String notEnoughQuestionsYet = 'We do not have enough questions for this yet.';
  static const String subjectNotOpen = 'This subject is not open for practice right now.';
  static const String modeUnavailable = 'This mode is not open right now.';
  static const String tryLater = 'Try again in a little while.';
  static const String signInAgain = 'Sign in again to continue.';

  // Credits low.
  static String creditsLowPractice(int balance, int cost) =>
      'You have ${plural(balance, 'credit')}, and this takes $cost. One chapter takes the same.';
  static String creditsLowMock(int balance, int cost, String modeLabel) =>
      'You have ${plural(balance, 'credit')}, and a $modeLabel takes $cost.';
  static const String freeRightNow = 'Free right now';
  static const String freeDaily = 'Today’s free 10-question practice';
  static const String freeLearn = 'Concepts';
  static const String freeReview = 'Your answers and keys, explanations included';
  static const String offlineStart = 'Connect to start. Your downloaded reviews still work.';
  static const String quoteFailed = 'We could not check what this takes. Nothing was charged. Try again.';
  static String costChanged(String line) => 'This changed while you were here. $line Check it and start again.';

  // Pro gate, warm and true. No prices, no purchase links.
  static String proGateTitle(String mode) => '$mode comes with Pro';
  static const String proGateBody =
      'Everything else here is yours: Full mock, Quick practice and One chapter. A Full mock is the same length.';
  static const String takeFullInstead = 'Take a Full mock instead';

  // Start failures.
  static const String startFailed =
      'We could not start the session. Try again. If you were charged, trying again will not charge you twice.';
  static const String notEnoughQuestions = 'We do not have enough questions for this yet. Nothing was charged.';
  static const String notEnoughCredits = 'You do not have enough credits for this. Nothing was charged.';
  static const String notIncluded = 'This comes with Pro. Nothing was charged.';
  static const String slowDown = 'Give it a minute and try again. Nothing was charged.';
  static const String earlierPending =
      'Your earlier answers for this are on this phone and have not been sent yet. Open that session to finish it first.';
  static const String openEarlier = 'Open that session';

  // Before a mock (on the same confirm sheet, not a wizard).
  static const String sheetMarking = '5 marks for each correct answer, minus 1 for each wrong one.';
  static const String sheetTimer = 'The timer keeps running if you leave the app. Submit ends the mock.';
  static String sheetTicket(DateTime by) => 'If you leave, open MockMob again before ${formatTime12(by)} so your answers can be sent.';
  static const String sheetDnd = 'For fewer interruptions, turn on Do Not Disturb from Quick Settings.';
  static const String sheetAside = 'Water, pencil, rough sheet. Ready when you are.';
  static const String sheetNoLength = 'We could not confirm how long this mock is. Close this and try again.';

  // Auto start.
  static const String gettingReady = 'Getting your questions ready.';
  static const String gettingReadyNote = 'This can take a few seconds.';
  static const String backToPractice = 'Back to Practice';
  static const String chooseAnother = 'Choose another';

  // Practice result. Feedback after finishing, never during.
  static const String resultTitle = 'Practice result';
  static String resultOverline(String subject) => '$subject practice';
  static String figureNumber(int correct) => '$correct';
  static String figureUnit(int total) => 'of $total';
  static String figureSemantics(int correct, int total) => '$correct of $total correct';
  static String countsLine(int right, int wrong, int blank) {
    if (wrong == 0 && blank == 0) return '$right right. Nothing wrong, nothing left blank.';
    return ['$right right', if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank not attempted'].join(', ');
  }

  static String chapterResultLine(String name) => 'Chapter: ${name.endsWith('.') ? name.substring(0, name.length - 1) : name}.';
  static String recorded(DateTime at) => 'Practice finished. Recorded at ${formatTime12(at)}.';
  static String reviewWrong(int n) => n == 1 ? 'Review 1 wrong answer' : 'Review $n wrong answers';
  static const String practiseAnotherChapter = 'Practise another chapter';
  static const String finishForNow = 'Finish for now';
  static String finished(DateTime at) => 'Practice recorded at ${formatTime12(at)}.';
  static String sectionWrong(int n) => 'Wrong answers ($n)';
  static String sectionBlank(int n) => 'Not attempted ($n)';
  static String sectionCorrect(int n) => 'Correct ($n)';
  static const String statusCorrect = 'Correct';
  static const String statusWrong = 'Wrong';
  static const String statusBlank = 'Not attempted';
  static String questionNumber(int n) => 'Question $n';
  static const String yourAnswer = 'Your answer';
  static const String correctAnswer = 'Correct answer';
  static const String explanation = 'Explanation';
  static const String notAnswered = 'You did not answer this question.';
  static const String keyHeld = 'The answer for this question is being checked, so it is not shown yet.';
  static const String keysUnavailable = 'Answers and explanations are not available for this result right now.';
  static const String tryAgain = 'Try it again';
  static const String seeAnswer = 'See the answer';
  static const String yourTry = 'Your try';
  static const String tryNote = 'This try stays on your phone.';
  static const String tryRight = 'That is the right answer.';
  static const String tryWrong = 'That is not the right answer.';
  static const String tryNoKey = 'There is no answer to check this against yet.';
  static const String loadingAnswers = 'Loading your answers';
  static const String resultLoadFailed = 'We could not load the answers. Your practice was recorded. Try again.';
  static const String resultLoadFailedUnknown = 'We could not load this result. Try again.';
  static const String otherAccount = 'We could not find this result. It may belong to another account.';
  static String lastLoaded(DateTime at) => 'Showing what was last loaded at ${formatTime12(at)}.';
  static const String backSemantics = 'Back';

  /// "today", "yesterday", "on Sunday" within a week, else "on 3 October".
  static String when(DateTime at, DateTime now) {
    final day = DateTime(at.year, at.month, at.day);
    final today = DateTime(now.year, now.month, now.day);
    final days = today.difference(day).inDays;
    if (days <= 0) return 'today';
    if (days == 1) return 'yesterday';
    if (days < 7) return 'on ${weekdayName(at.weekday)}';
    return 'on ${formatDayMonth(at)}';
  }
}
