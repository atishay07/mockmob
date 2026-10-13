import '../../core/copy/copy.dart';
import '../runner/nta/nta_copy.dart' show NtaRules;
import 'model/finish_reaction.dart';

/// Every user-facing string of the practice feature. Voice: a sharp senior who has been through
/// CUET. Sentence case, no middle dots, no emoji, no exclamation marks, no arrows, 12-hour times,
/// no prices. Costs appear only on the confirm sheet, written as what you get.
abstract final class PracticeCopy {
  // Practice tab.
  static const String tabTitle = 'Practice';
  static const String chooseOwn = 'Choose your own';
  static const String concepts = 'Concepts';
  static const String moreHeading = 'Explore and plan';
  static const String toolsTitle = 'CUET tools';
  static const String toolsNote = 'Which DU courses your subjects open, and last year’s cutoffs.';
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
  static String pickedStartReason(String subject) => 'No $subject paper yet. Ten questions shows where you stand.';

  static String heroSemantics(String title, String reason) => '$title. $reason';

  // The modes, as what you get.
  static const String quickTitle = 'Quick practice';
  static const String quickLine = '5 to 20 questions, your pick.';
  static const String chapterTitle = 'By chapter';
  static const String chapterLine = 'Pick up to 12 chapters, then 5 to 20 questions.';
  static const String smartTitle = 'Smart practice';
  static const String smartLine = 'Leans toward the chapters you miss. 10 to 20 questions.';
  static const String smartGatedLine = 'Comes with Pro. Quick practice is open to you now.';
  static const String fullMockTitle = 'Full mock';
  static String fullMockLine({required int questions, int? minutes}) =>
      minutes == null ? '$questions questions, timed like the exam.' : '$questions questions, $minutes minutes, timed like the exam.';
  static const String ntaTitle = 'NTA mode';
  static const String ntaLine = 'The exam-day screen, as you will meet it on the day.';
  static const String ntaGatedLine = 'Comes with Pro. A Full mock is open to you now.';

  /// The paper's size and clock come from [NtaRules], the same source as the NTA instructions.
  static const List<String> ntaChips = ['${NtaRules.questions} questions', '${NtaRules.minutes} minutes', 'Question palette', 'Mark for review'];
  static const String proTag = 'Pro';

  // Confirm sheet and setup page.
  static String confirmTitle(String mode, String subject) => '$mode, $subject';
  static String mockTitle(String? mockLabel, String subject) => '${mockLabel ?? 'Full mock'}, $subject';
  static const String subjectLabel = 'Subject';
  static const String questionsLabel = 'Questions';
  static const String chapterLabel = 'Chapters';
  static const String chooseChapter = 'Choose chapters';
  static const String chooseChapterFirst = 'Choose a chapter first.';
  static const String chooseChapterTitle = 'Choose chapters';
  static const String searchChapters = 'Search chapters';
  static const String noChapterMatch = 'No chapter matches that.';
  static String useChapters(int n) => n == 0 ? 'Choose at least one' : (n == 1 ? 'Use 1 chapter' : 'Use $n chapters');
  static const String clearChapters = 'Clear';
  static const String chapterLimit = 'Up to 12 chapters in one session.';
  static const String oneChapterOnly = 'This subject takes one chapter at a time for now.';

  /// "Goodwill", "Goodwill and Issue of shares", "Goodwill, Issue of shares and 2 more".
  static String chaptersSummary(List<String> names) => switch (names.length) {
    0 => '',
    1 => names.first,
    2 => '${names[0]} and ${names[1]}',
    _ => '${names[0]}, ${names[1]} and ${names.length - 2} more',
  };

  // Difficulty (Pro, Quick, chapter and Full only).
  static const String difficultyLabel = 'Difficulty';
  static const String difficultyBalanced = 'Balanced';
  static const String difficultyEasy = 'Easy';
  static const String difficultyMedium = 'Medium';
  static const String difficultyHard = 'Hard';
  static const String difficultyProNote = 'Choosing a level comes with Pro. Balanced is the exam’s own mix.';

  // The summary of what starts.
  static const String summarySubject = 'Subject';
  static const String summaryMode = 'Mode';
  static const String summaryQuestions = 'Questions';
  static const String summaryChapters = 'Chapters';
  static const String summaryTime = 'Time';
  static const String summaryMarking = 'Marking';
  static const String summaryCost = 'Cost';
  static const String markingValue = '+5 right, ${minusSign}1 wrong, 0 blank';
  static const String allChapters = 'All chapters';
  static const String costIncluded = 'Included with Pro';
  static const String costFree = 'Free';
  static const String costChecking = 'Checking';
  static String timeExact(int minutes) => plural(minutes, 'minute');
  static String timeAbout(int minutes) => 'About ${plural(minutes, 'minute')}';

  // Subjects.
  static const String editSubjects = 'Edit subjects';
  static String staleSubject(String name, String? reason) =>
      reason == null || reason.isEmpty ? '$name is saved on your account but is not open for practice.' : '$name: $reason';
  static String questionsAvailable(int n) => '${_grouped(n)} questions';
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

  /// A link asked for a length this mode does not offer; said before Start, never silently.
  static String lengthAdjusted(String mode, List<int> counts, int asked) {
    if (asked < counts.first) return '$mode starts at ${counts.first}. You asked for $asked.';
    if (asked > counts.last) return '$mode goes up to ${counts.last}. You asked for $asked.';
    final options = '${counts.sublist(0, counts.length - 1).join(', ')} or ${counts.last}';
    return '$mode comes in $options questions. You asked for $asked.';
  }

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
  static const String offlineAutoStart =
      'You are offline. Your answers and drafts are safe on this phone. This starts by itself when you are back online.';
  static const String quoteFailed = 'We could not check what this takes. Nothing was charged. Try again.';
  static String costChanged(String line) => 'This changed while you were here. $line Check it and start again.';

  // Pro gate, warm and true. No prices, no purchase links.
  static String proGateTitle(String mode) => '$mode comes with Pro';
  static const String proGateBody =
      'Everything else here is yours: Full mock, Quick practice and By chapter.';
  static const String takeFullInstead = 'Take a Full mock instead';
  static const String takeQuickInstead = 'Take Quick practice instead';

  // Start failures.
  /// A failure with no definite answer from the server (a timeout, an unknown error): the client
  /// cannot know whether credits moved, so it says it is checking (the balance is read again) and
  /// where to see it. "Nothing was charged" is only for the server's own refusals below.
  static const String startFailed =
      'We could not start the session. We are checking whether this was charged. Your credits show in You.';
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

  /// Mobi's line after the reaction. About the sheet, never about the person. Wrong answers and
  /// blanks are named apart, so the line never sums them beside "Repair these 3" (wrong only).
  static String finishLine(FinishTone tone, FinishMarks m) {
    final toLook = _toLook(m.wrong, m.blank);
    return switch (tone) {
      FinishTone.great || FinishTone.good when toLook == null => 'Every one right. Nothing to fix from this set.',
      FinishTone.great => 'Excellent set. $toLook to look at below.',
      FinishTone.good => 'Strong run. $toLook to look at below.',
      FinishTone.mixed => 'Let’s look at the $toLook. The reasons are below.',
      FinishTone.blank => 'A lot left blank. Try them below, no clock running.',
      FinishTone.low => 'Start with the first one below. The reason is right there.',
    };
  }

  /// "3 wrong answers and 1 blank", "1 wrong answer", "2 blanks"; null when there is nothing.
  static String? _toLook(int wrong, int blank) {
    final parts = [if (wrong > 0) plural(wrong, 'wrong answer'), if (blank > 0) plural(blank, 'blank')];
    return parts.isEmpty ? null : parts.join(' and ');
  }

  /// The website's arithmetic: right +5, wrong -1; each wrong answer costs 6 of the marks missed.
  static String marksLine(FinishMarks m) {
    final head = '${formatSignedNumber(m.scored)} of ${m.max} marks.';
    if (m.wrong > 0) return '$head ${plural(m.wrong, 'wrong answer')} cost ${m.lostToWrong} of the ${m.missed} marks you missed.';
    if (m.blank > 0) return '$head ${plural(m.blank, 'blank')} left ${m.leftOnBlanks} marks on the table.';
    return head;
  }

  static String repairThese(int n) => n == 1 ? 'Repair this one' : 'Repair these $n';
  static const String skipHint = 'Tap to skip';
  static const String save = 'Save';
  static const String saved = 'Saved';
  static const String saveSemantics = 'Save this question to your saved questions';
  static const String unsaveSemantics = 'Remove this question from your saved questions';
  static const String saveFull = 'Your 25 free save slots are full. Remove a saved question to make room.';
  static const String saveFailed = 'We could not save this. Nothing changed. Try again.';
  static const String saveOffline = 'Connect to save questions.';

  static String chapterResultLine(String name) => 'Chapter: ${name.endsWith('.') ? name.substring(0, name.length - 1) : name}.';
  static String recorded(DateTime at) => 'Practice finished. Recorded at ${formatTime12(at)}.';
  static String reviewWrong(int n) => n == 1 ? 'Review 1 wrong answer' : 'Review $n wrong answers';
  static const String practiceAnotherChapter = 'Practice another chapter';
  static const String tryTheBlanks = 'Try the blanks';
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
  static const String readingSheet = 'Reading your sheet';
  static const String readingSheetNote = 'Your marks and every answer open here in a moment.';
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

  static String _grouped(int n) {
    final digits = '$n';
    final out = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
      out.write(digits[i]);
    }
    return out.toString();
  }
}
