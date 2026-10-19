import '../../core/copy/copy.dart';
import '../runner/nta/nta_copy.dart' show NtaRules;
import '../../core/widgets/question_strip.dart' show QuestionCell;
import '../result/copy.dart' show ResultCopy;
import 'model/finish_reaction.dart';

/// Every user-facing string of the practice feature. Voice: a sharp senior who has been through
/// CUET. Sentence case, no middle dots, no emoji, no exclamation marks, no arrows, 12-hour times,
/// no prices. Costs appear only on the confirm sheet, written as what you get.
abstract final class PracticeCopy {
  // Practice tab.
  static const String tabTitle = 'Practice';
  /// The subject strip's heading, first on the tab: the subject decides every mode's facts.
  static const String practiseIn = 'Practise in';

  /// The modes' heading, under the suggestion.
  static const String waysHeading = 'Ways to practise';
  /// The lesson library keeps the name Learn (owner D20).
  static const String concepts = 'Learn';
  static const String moreHeading = 'More ways in';

  /// The Repairs row under the suggestion: the whole account's open mistakes, the count Review's header and Today's tile print.
  static const String repairsTitle = 'Repairs';
  static String repairsNote(int open) => open == 1 ? '1 open mistake to repair' : '$open open mistakes to repair';

  // Your papers (D105, G20): the Review screen lives inside Practice, one row under the suggestion.
  static const String papersTitle = 'Your papers';

  /// What the row says: every paper is kept here, newest first; with papers, how many and the open
  /// mistakes, in one sentence each.
  static String papersNote({required int papers, required int open}) {
    final mistakes = open == 1 ? '1 mistake' : '$open mistakes';
    if (papers <= 0) {
      // The papers are not on the phone yet, but the open count of the account is known: say that.
      return open > 0 ? '$mistakes to repair, with the papers they came from.' : 'Every paper you sit is kept here, newest first, with its answers.';
    }
    final kept = papers == 1 ? '1 paper so far, with its answers.' : '$papers papers so far, newest first.';
    if (open <= 0) return kept;
    return '$kept $mistakes still to repair.';
  }

  /// The Learn row under the suggestion (D20): the lesson Learn would open next, and why.
  static const String learnTitle = 'Learn';
  static String learnNote(String lesson, String why) => '$lesson. $why';
  static const String toolsTitle = 'Admission Compass';
  static const String toolsNote = 'Which DU courses your subjects open, with the 2026 Round 1 cutoffs.';
  static const String allConcepts = 'See all';
  static const String moreSubjects = 'More subjects';
  static const String otherSubjectsTitle = 'More subjects';
  static const String otherSubjectsEmpty = 'No other subjects are open for practice right now.';

  // The suggestion at the top.
  static const String suggestedOverline = 'Your next practice';

  /// The overline after 11 PM: points at the card's one set, with no length the set may not keep.
  static const String lateOverline = 'This one, then sleep';
  static const String resumeOverline = 'Still open';
  static const String showMe = 'Show me';
  static const String showMeSemantics = 'Show me, the attempt behind this';
  static const String startKey = 'Start';

  /// The suggestion's one volt key, with the set's real length.
  static String startCount(int n) => 'Start $n questions';
  static const String resumeKey = 'Resume';
  static const String questionsUnit = 'questions';

  static String resumeMockTitle(String? mockLabel, String subject) => '${mockLabel ?? 'Your mock'}, $subject';
  static String resumePracticeTitle(String subject) => '$subject practice';
  static String resumeOf(int total) => 'of $total';
  static String resumeMockReason(DateTime endsAt) => 'The clock ends at ${formatTime12(endsAt)}.';
  static const String resumePracticeReason = 'Pick up where you left off.';

  // A paper that is open and not on this phone: a start the app never saw the answer to (killed, or the
  // signal went after the request left, so the server may have opened it and taken the credits), or a
  // paper the server holds. The card offers to continue it; a second paid start waits for it.
  static const String pendingOverline = 'Not opened yet';

  /// "full mock", "NTA mock" or "practice set": what the paper is called in the card's key and its lines.
  static String openKind({required String apiMode}) => switch (apiMode) {
    'full' => 'full mock',
    'nta' => 'NTA mock',
    _ => 'practice set',
  };

  /// "Mock 7, Accountancy" when the paper has its number, else "Your full mock, Accountancy".
  static String openTitle({required String apiMode, required String subject, int? mockNumber}) =>
      mockNumber != null && (apiMode == 'full' || apiMode == 'nta') ? 'Mock $mockNumber, $subject' : 'Your ${openKind(apiMode: apiMode)}, $subject';
  static const String openPendingReason = 'It did not finish opening. Continue it: credits are taken once, never twice.';
  static String openKey({required String apiMode}) => 'Continue your ${openKind(apiMode: apiMode)}';
  static const String openNotNow = 'Not now';
  static const String openOffline = 'Connect to continue this paper.';
  static String openFirst({required String apiMode}) =>
      'Your ${openKind(apiMode: apiMode)} is still open. Continue it first, so nothing is charged twice.';
  static const String paperEnded = 'That paper has ended, so it cannot be opened. Nothing more was charged. Start again for a new one.';

  static String chapterKicker(String subject) => '$subject, one chapter';
  static String chapterReasonMock(int marks, String mockLabel) => 'It cost you $marks marks in $mockLabel.';
  static String chapterReasonPractice(int missed) =>
      missed == 1 ? 'You missed 1 here last time.' : 'You missed $missed here last time.';

  /// The hero's title is the subject alone, so it never wraps to an ellipsis beside the object;
  /// the kind of paper is the kicker under it.
  static String subjectTitle(String subject) => subject;
  static const String subjectKicker = 'Quick practice, mixed chapters';
  static const String mixedChapters = 'Mixed chapters';
  /// The hero's reason for a subject with no nameable chapter: the last paper's real score with its
  /// denominator and when it was ("34 of 50 right, yesterday"). A paper with no questions says only when.
  static String subjectReason(int correct, int total, String when) =>
      total <= 0 ? 'Your last paper was $when.' : 'Last paper: $correct of $total right, $when.';

  static const String startingTitle = 'Your starting point';
  static String startingKicker(String subject) => '$subject, mixed chapters';
  static String startingReason(String subject) => 'Ten questions show where you stand.';
  static String firstOnListReason(String subject) => '$subject is first on your list.';
  static String pickedStartReason(String subject) => 'No paper here yet. Ten questions will do.';

  /// The picked subject while the attempts have not loaded: it claims nothing about papers.
  static const String pickedUnknownReason = 'Ten questions show where you stand.';

  static String heroSemantics(String title, String reason) => '$title. $reason';

  // The modes, as what you get.
  static const String quickTitle = 'Quick practice';
  static const String quickLine = '5 to 20 questions, your pick.';
  static const String chapterTitle = 'By chapter';
  static const String chapterLine = 'Pick up to 12 chapters, then 5 to 20 questions.';
  static const String smartTitle = 'Smart practice';
  static const String smartLine = 'Leans toward the chapters you miss. 10 to 20 questions.';
  static const String smartGatedLine = 'Leans toward the chapters you miss. Comes with Pro.';
  static const String fullMockTitle = 'Full mock';
  static String fullMockLine({required int questions, int? minutes}) =>
      minutes == null ? '$questions questions, timed like the exam.' : '$questions questions, $minutes minutes, timed like the exam.';
  static const String ntaTitle = 'NTA mode';
  static const String ntaLine = 'The exam-day screen, as you will meet it on the day.';
  static const String ntaGatedLine = 'The exam-day screen. Comes with Pro.';

  /// The paper's size and clock come from [NtaRules], the same source as the NTA instructions.
  static const List<String> ntaChips = [
    '${NtaRules.questions} questions',
    '${NtaRules.minutes} minutes',
    'Question palette',
    'Mark for review',
  ];
  static const String proTag = 'Pro';

  /// The band that holds the exam-shaped modes.
  static const String examBandTitle = 'Exam conditions';

  /// The exam band's quiet foot (owner, 16 Oct: the one question bank is the headline, said
  /// plainly and never in the face). True on every plan: each paper is drawn fresh from the live
  /// bank. Only Pro says "unlimited" (Free spends Practice credits on a mock), and nothing here
  /// promises a question never comes back (the selector prefers unseen ones, it does not
  /// guarantee them). An unknown or zero count drops the number, never shows 0.
  static String bankLine({required bool pro, String? subject, int? questions}) {
    final lead = pro ? 'Unlimited mocks.' : 'No fixed set of mocks.';
    if (subject == null || questions == null || questions <= 0) return '$lead Each paper is built fresh from the live question bank.';
    return '$lead Each paper is built fresh from the ${_grouped(questions)} questions in $subject.';
  }

  // Confirm sheet and setup page.
  static String confirmTitle(String mode, String subject) => '$mode, $subject';
  static String mockTitle(String? mockLabel, String subject) => '${mockLabel ?? 'Full mock'}, $subject';
  static const String subjectLabel = 'Subject';
  static const String questionsLabel = 'Questions';
  static const String chapterLabel = 'Chapters';
  static const String chooseChapter = 'Choose chapters';
  static const String addChapters = 'Add chapters';
  static const String editChapters = 'Change chapters';
  static String chaptersChosen(int n, int max) => '$n of $max';
  static String chaptersChosenSemantics(int n, int max) => '$n of $max chapters chosen';
  static const String chooseChapterFirst = 'Choose a chapter first.';
  static const String chooseChapterTitle = 'Choose chapters';
  static const String searchChapters = 'Search chapters';
  static const String noChapterMatch = 'No chapter matches that.';
  static String useChapters(int n) => n == 0 ? 'Choose at least one' : (n == 1 ? 'Use 1 chapter' : 'Use $n chapters');
  static const String clearChapters = 'Clear';
  static const String fromYourRecord = 'From your record';
  static String recordChipMarks(int marks) => '${plural(marks, 'mark')} lost in your last paper';
  static String recordChipSemantics(String chapter, int marks) => '$chapter, ${plural(marks, 'mark')} lost in your last paper';
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
  static const String difficultyBalancedNote = 'Balanced is the exam’s own mix.';
  static const String difficultyLocked = 'Easy, Medium and Hard come with Pro.';
  static const String difficultyLockedHint = 'Comes with Pro';
  // With the Pro nudges off (PLAY_BILLING off) a lock names no other plan: the plain fact.
  static const String difficultyLockedPlain = 'Easy, Medium and Hard are not part of your plan.';
  static const String difficultyLockedHintPlain = 'Not part of your plan';

  // Fine-tune (owner, 17 Oct, F8 and F9): one block above Start, scoped by mode. Chapters and level
  // belong to Quick practice; a Full mock keeps the level; Smart practice and NTA mode choose for you.
  static const String fineTuneLabel = 'Fine-tune';
  static const String fineTuneQuick = 'For Quick practice you can pick the chapters and the difficulty.';
  static const String fineTuneFull = 'For a Full mock you can set the difficulty. It covers every chapter, like the exam.';
  // Owner, 17 Oct night (N3): trust, not a shrug. NTA mode is built exactly as the exam is; Smart practice
  // is built from the student's own weak topics (it is not the NTA mix, so it does not say it is).
  static const String fineTuneSmart = "We build it from the topics where you get under 60% right. You don't need to choose anything.";
  static const String fineTuneNta = "We build it exactly the NTA way. You don't need to choose anything.";

  // The summary of what starts.
  static const String summarySubject = 'Subject';
  static const String summaryMode = 'Mode';
  static const String summaryQuestions = 'Questions';
  static const String summaryChapters = 'Chapters';
  static const String summaryTime = 'Time';
  static const String summaryMarking = 'Marking';
  static const String summaryCost = 'Cost';
  static const String markingValue = '+5 right, ${minusSign}1 wrong, 0 not attempted';
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

  /// The Start key once the server has said yes, while the paper opens.
  static const String startingNow = 'Starting';
  static const String checkingCost = 'Checking what this takes.';
  static const String feedbackAfter = 'You see what was right once you finish.';
  static const String retry = 'Try again';
  static const String refreshFailed = 'We could not refresh Practice. Showing what was here before.';
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
  /// C-dec 1 (release 11): the first full mock in each subject costs nothing (allowance `first_full_mock:<subject>`).
  static const String freeFirstFullMock = 'Free: your first full mock in this subject is on us.';
  static String usesCredits(int cost, int? balance) =>
      balance == null ? '${plural(cost, 'credit')}.' : '${plural(cost, 'credit')}. You have $balance.';
  static const String unavailableFallback = 'This is not open right now.';
  static const String notEnoughQuestionsYet = 'We do not have enough questions for this yet.';
  static const String subjectNotOpen = 'This subject is not open for practice right now.';
  static const String modeUnavailable = 'This mode is not open right now.';
  static const String tryLater = 'Try again in a little while.';
  static const String signInAgain = 'Sign in again to continue.';

  // Credits low.
  static String creditsLowPractice(int balance, int cost, {bool shorterPossible = false}) =>
      'You have ${plural(balance, 'credit')}, and this takes $cost.${shorterPossible ? ' A shorter set takes fewer.' : ''}';
  static String creditsLowMock(int balance, int cost, String modeLabel) =>
      'You have ${plural(balance, 'credit')}, and a $modeLabel takes $cost.';

  /// The one line above a dead Start key when credits are short.
  static String creditsNeeded(int cost, int balance) => 'Needs ${plural(cost, 'credit')}. You have $balance.';
  static const String freeRightNow = 'Free right now';
  static const String freeDaily = 'Today’s free 10-question practice';
  static const String freeLearn = 'Learn';
  static const String freeReview = 'Your answers and keys, explanations included';
  static const String offlineStart = 'Connect to start. Your downloaded reviews still work.';
  static const String offlineAutoStart =
      'You are offline. Your answers and drafts stay on this phone. This starts by itself when you are back online.';
  static const String quoteFailed = 'We could not check what this takes. Nothing was charged. Try again.';
  static String costChanged(String line) => 'This changed while you were here. $line Check it and start again.';

  // Pro gate, warm and true. No prices, no purchase links.
  static String proGateTitle(String mode) => '$mode comes with Pro';
  // The same gate with the Pro nudges off (PLAY_BILLING off, D101): Pro is named calmly, with no price
  // and no way to buy elsewhere, and the open mode that comes closest.
  static String planGateTitle(String mode) => '$mode is part of Pro';
  static const String ntaGatedPlain =
      'NTA mode is part of Pro. Pro opens in the app soon. Until then, a Full mock gives you the same 50 questions in 60 minutes.';

  // A Free student taps a mode Pro holds while Pro cannot be had here (D101): the calm sheet.
  static String lockedTitle(String mode) => '$mode is part of Pro';
  static const String lockedSoon = 'Pro opens in the app soon.';
  static const String lockedNtaInstead = 'Until then, a Full mock gives you the same 50 questions in 60 minutes, timed like the exam.';
  static const String lockedSmartInstead = 'Until then, Quick practice and By chapter are open to you. You choose the subject, the chapters and how many questions.';
  static const String lockedNotNow = 'Not now';
  static const String proGateBody = 'Everything else here is yours: Full mock, Quick practice and By chapter.';
  static const String takeFullInstead = 'Take a Full mock instead';
  static const String takeQuickInstead = 'Take Quick practice instead';

  // Start failures.
  /// A failure with no definite answer from the server (a timeout, an unknown error): the client
  /// cannot know whether credits moved, so it says it is checking (the balance is read again) and
  /// where to see it. "Nothing was charged" is only for the server's own refusals below.
  static const String startFailed = 'We could not start the session. We are checking whether this was charged. Your credits show in You.';
  static const String notEnoughQuestions = 'We do not have enough questions for this yet. Nothing was charged.';
  static const String notEnoughCredits = 'You do not have enough credits for this. Nothing was charged.';
  static const String notIncluded = 'This is not part of your plan. Nothing was charged.';
  static const String slowDown = 'Give it a minute and try again. Nothing was charged.';

  // Before a mock (on the same confirm sheet, not a wizard).
  static const String sheetMarking = '5 marks for each correct answer, minus 1 for each wrong one.';
  static const String sheetTimer = 'The timer keeps running if you leave the app. Submit ends the mock.';
  static String sheetTicket(DateTime by) => 'If you leave, open MockMob again before ${formatTime12(by)} so your answers can be sent.';
  static const String sheetDnd = 'For fewer interruptions, turn on Do Not Disturb from Quick Settings.';

  /// The three things to know, one short line each, in the icon row under the mock's details.
  static const String ruleTimer = 'Timer keeps running';
  static const String ruleSubmit = 'Submit ends the mock';
  static const String ruleSilence = 'Do Not Disturb on';
  static const String sheetNoLength = 'We could not confirm how long this mock is. Close this and try again.';

  // Auto start.
  static const String gettingReady = 'Getting your questions ready.';

  /// The three stages a start goes through, as the code reaches them.
  static const String stageChecking = 'Checking the cost';
  static const String stageDrawing = 'Drawing your questions';
  static const String stageOpening = 'Opening your paper';
  static const String gettingReadyNote = 'This can take a few seconds.';

  /// The start is still waiting after [PracticeStartScreen.slowAfter] (MOTION.md P1-7).
  static const String gettingReadySlow = 'Still fetching. This sometimes takes a moment on slow networks.';
  static const String backToPractice = 'Back to Practice';
  static const String chooseAnother = 'Choose another';

  // Practice result. Feedback after finishing, never during.
  static const String resultTitle = 'Practice result';
  static String resultOverline(String subject) => '$subject practice';
  static const String resultFinished = 'finished';
  static String figureNumber(int correct) => '$correct';
  static String figureUnit(int total) => 'of $total';
  static String figureSemantics(int correct, int total) => '$correct of $total correct';
  static String countsLine(int right, int wrong, int blank) {
    if (wrong == 0 && blank == 0) return '$right right. Nothing wrong, nothing left out.';
    return ['$right right', if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank not attempted'].join(', ');
  }

  /// Mobi's line after the reaction. About the sheet, never about the person. The counts are said
  /// once on the page, in the figure and under it, so this line reacts instead of counting again
  /// (AP3-06, A14): "Most of this set is right. The reasons for the other 3 are below." when 6 in
  /// 10 or more are right (3 is the wrong answers, the same number as "Repair these 3"), otherwise
  /// "The reasons are below."
  static String finishLine(FinishTone tone, FinishMarks m) {
    final mostRight = m.correct * 10 >= m.total * 6;
    final String reasons;
    if (m.wrong > 0) {
      reasons = mostRight ? 'Most of this set is right. The reasons for the other ${m.wrong} are below.' : 'The reasons are below.';
    } else if (m.blank > 0) {
      reasons = mostRight ? 'Most of this set is right. The ${m.blank} not attempted are below.' : 'The ones not attempted are below.';
    } else {
      reasons = 'Every one right. Nothing to fix from this set.';
    }
    return switch (tone) {
      FinishTone.great || FinishTone.good || FinishTone.mixed => reasons,
      FinishTone.blank => 'A lot was not attempted. Try those below, no clock running.',
      FinishTone.low => 'Start with the first one below. The reason is right there.',
    };
  }

  /// The website's arithmetic: right +5, wrong -1; each wrong answer costs 6 of the marks missed.
  static String marksLine(FinishMarks m) {
    final head = '${formatSignedNumber(m.scored)} of ${m.max} marks.';
    final detail = marksDetail(m);
    return detail.isEmpty ? head : '$head $detail';
  }

  /// What the missed marks went to, without the marks themselves (the finish moment's completion
  /// line says those, D108); empty when nothing was missed.
  static String marksDetail(FinishMarks m) {
    // Below zero the marks missed would exceed the paper ("18 of the 18" on 15), so say what was lost instead.
    if (m.scored < 0) return ResultCopy.negativeLoss(m.wrong, m.blank);
    if (m.wrong > 0) return '${plural(m.wrong, 'wrong answer')} cost ${m.lostToWrong} of the ${m.missed} marks you missed.';
    if (m.blank > 0) return '${plural(m.blank, 'question')} not attempted left ${m.leftOnBlanks} marks on the table.';
    return '';
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
  /// With a [chapter] (a By-chapter run) the receipt names it, the same way the result does.
  static String recorded(DateTime at, {String? chapter}) => chapter == null || chapter.trim().isEmpty
      ? 'Practice finished. Recorded at ${formatTime12(at)}.'
      : 'Chapter practice finished, ${_noStop(chapter)}. Recorded at ${formatTime12(at)}.';
  /// Under the result's figure, where the eyebrow already says the practice is finished: just the time.
  static String recordedLine(DateTime at) => 'Recorded at ${formatTime12(at)}.';
  static String _noStop(String s) {
    final t = s.trim();
    return t.endsWith('.') ? t.substring(0, t.length - 1) : t;
  }

  /// What Mobi says for a long press on bubble [number] of the sheet.
  static String cellSays(int number, QuestionCell cell) => '${questionNumber(number)}: ${switch (cell) {
    QuestionCell.right => 'correct',
    QuestionCell.wrong => 'wrong',
    QuestionCell.blank => 'not attempted',
    QuestionCell.changed => 'answer changed',
    QuestionCell.repaired => 'repaired',
  }}';
  static String reviewWrong(int n) => n == 1 ? 'Review 1 wrong answer' : 'Review $n wrong answers';
  static const String practiceAnotherChapter = 'Practice another chapter';
  static const String tryTheBlanks = 'Try the blanks';
  static const String finishForNow = 'Finish for now';

  /// The ending says it the way the result page does: one wording for the same fact.
  static String finished(DateTime at, {String? chapter}) => recorded(at, chapter: chapter);
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
