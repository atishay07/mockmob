import '../../core/copy/copy.dart';

/// Every user-facing string of the practice feature (binding rules of spec 0): sentence case,
/// no middle dots, no emoji, no exclamation marks, 12-hour times, no prices.
abstract final class PracticeCopy {
  // Practice tab.
  static const String tabTitle = 'Practice';
  static const String subjectLabel = 'Subject';
  static const String otherSubjects = 'Other subjects';
  static const String otherSubjectsTitle = 'Other subjects';

  static const String fullMockTitle = 'Full mock';
  static String fullMockLine({required int questions, int? minutes}) =>
      minutes == null ? '$questions questions' : '$questions questions, $minutes minutes';
  static const String quickTitle = 'Quick practice';
  static const String quickLine = '5 to 20 questions';
  static const String chapterTitle = 'Chapter practice';
  static const String chapterModeLine = 'Practice, not proof';
  static const String ntaTitle = 'NTA-style mode';
  static String ntaLine({required int questions, int? minutes}) =>
      minutes == null ? 'Exam style, $questions questions' : 'Exam style, $questions questions, $minutes minutes';
  static const String lengthChecking = 'Checking the length.';
  static const String sheetNoLength = 'We could not confirm how long this mock is. Close this and try again.';

  static const String partOfPro = 'Part of Pro';
  static const String partOfProAlternative = 'Part of Pro. You can take a Full mock instead.';
  static const String takeFullInstead = 'Take a Full mock instead';
  static const String lockedSemantics = 'Locked';

  // Costs and free paths (the numbers always come from the quote).
  static const String freeToday = 'Free today';
  static String freeFirstIn(String subject) => 'Free, your first one in $subject';
  static String usesCredits(int cost, int? balance) =>
      balance == null ? 'Uses ${plural(cost, 'credit')}.' : 'Uses ${plural(cost, 'credit')}. You have $balance.';
  static const String unavailableFallback = 'This is not available right now.';
  static const String notEnoughQuestionsYet = 'We do not have enough questions for this yet.';
  static const String subjectNotOpen = 'This subject is not open for practice right now.';
  static const String modeUnavailable = 'This mode is not available right now.';
  static const String tryLater = 'Try again in a little while.';
  static const String signInAgain = 'Sign in again to continue.';

  // Resume slot on the tab.
  static String resumeMock(String label, String subject, DateTime endsAt) =>
      '$label, $subject is still running. It ends at ${formatTime12(endsAt)}.';
  static String resumePractice(String subject, int answered, int total) => '$subject practice is still open. $answered of $total answered.';
  static const String resumeKey = 'Continue';

  // Setup.
  static String setupTitle(String mode) => mode;
  static const String questionsLabel = 'Questions';
  static const String chapterLabel = 'Chapter';
  static const String chooseChapter = 'Choose a chapter';
  static const String chooseChapterFirst = 'Choose a chapter first.';
  static const String chooseChapterTitle = 'Choose a chapter';
  static const String chaptersLoadFailed = 'We could not load the chapters. Try again.';
  static const String chaptersOffline = 'Connect to see the chapters.';
  static const String fewerQuestions = 'Fewer questions';
  static const String moreQuestions = 'More questions';
  static const String startPractice = 'Start practice';
  static const String startChapter = 'Start chapter practice';
  static const String startMock = 'Start mock';
  static const String checkingCost = 'Checking what this costs.';
  static const String feedbackAfter = 'Feedback comes after you finish.';
  static String countSummary(int count, Duration? time) =>
      time == null ? '$count questions' : '$count questions, ${formatDurationAbout(time)}';
  static String mockSummary(int count, Duration? time) => countSummary(count, time);
  static const String retry = 'Try again';
  static const String otherSubjectsEmpty = 'No other subjects are open for practice right now.';

  // Quote states.
  static String creditsLowPractice(int balance, int cost) =>
      'You have ${plural(balance, 'credit')}. A Quick practice costs $cost, and chapter practice costs the same.';
  static String creditsLowMock(int balance, int cost, String modeLabel) =>
      'You have ${plural(balance, 'credit')}. A $modeLabel costs $cost.';
  static const String freeRightNow = 'Free right now';
  static const String freeDaily = 'Today’s free 10-question practice';
  static const String freeLearn = 'Learn';
  static const String freeReview = 'Review your answers and keys, explanations included';
  static const String offlineStart = 'Connect to start. Your downloaded reviews still work.';
  static const String quoteFailed = 'We could not check what this costs. Nothing was charged. Try again.';
  static String costChanged(String line) => 'The cost changed. $line Check it and start again.';

  // Pro gate on a direct link to a gated mode.
  static String proGateTitle(String mode) => '$mode is part of Pro';
  static const String proGateBody = 'Your account includes Full mock, Quick practice and Chapter practice.';

  // Start failures.
  static const String startFailed =
      'We could not start the session. Try again. If you were charged, trying again will not charge you twice.';
  static const String notEnoughQuestions = 'We do not have enough questions for this yet. Nothing was charged.';
  static const String notEnoughCredits = 'You do not have enough credits for this. Nothing was charged.';
  static const String notIncluded = 'This is part of Pro. Nothing was charged.';
  static const String slowDown = 'Please wait a minute and try again. Nothing was charged.';
  static const String earlierPending =
      'Your earlier answers for this are on this phone and have not been sent yet. Open that session to finish it first.';
  static const String openEarlier = 'Open that session';

  // Pre-start sheet (mocks).
  static String sheetTitle(String? mockLabel, String subject) => '${mockLabel ?? 'Full mock'}, $subject';
  static String sheetSize(int count, int minutes) => '$count questions, $minutes minutes.';
  static String sheetSizeCount(int count) => '$count questions.';
  static const String sheetTimer = 'The timer keeps running if you leave the app. Submit ends the mock.';
  static String sheetTicket(DateTime by) => 'If you leave, open MockMob again before ${formatTime12(by)} so your answers can be sent.';
  static const String sheetDnd = 'For fewer interruptions, turn on Do Not Disturb from Quick Settings.';
  static const String notNow = 'Not now';

  // Start screen (auto start).
  static const String gettingReady = 'Getting your questions ready.';
  static const String gettingReadyNote = 'This can take a few seconds.';
  static const String backToPractice = 'Back to Practice';
  static const String chooseAnother = 'Choose another';

  // Practice result (5.4.1).
  static const String resultTitle = 'Practice result';
  static String figureNumber(int correct) => '$correct';
  static String figureRest(int total) => ' of $total correct';
  static String figureSemantics(int correct, int total) => '$correct of $total correct';
  static String countsLine(int wrong, int blank) {
    if (wrong == 0 && blank == 0) return 'No wrong answers, and none left blank.';
    return [if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank not attempted'].join(', ');
  }

  static String chapterLine(String name) => 'Chapter: ${name.endsWith('.') ? name.substring(0, name.length - 1) : name}.';
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
  static const String tryNote = 'This try is not recorded. It is practice, not proof.';
  static const String tryRight = 'That is the right answer.';
  static const String tryWrong = 'That is not the right answer.';
  static const String tryNoKey = 'There is no answer to check this against yet.';
  static const String loadingAnswers = 'Loading your answers';
  static const String resultLoadFailed = 'We could not load this result. Your practice was recorded. Try again.';
  static const String resultLoadFailedUnknown = 'We could not load this result. Try again.';
  static const String otherAccount = 'We could not find this result. It may belong to another account.';
  static String lastLoaded(DateTime at) => 'Showing what was last loaded at ${formatTime12(at)}.';
  static const String backSemantics = 'Back';
}
