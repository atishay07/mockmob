import '../../core/auth/load_problem.dart';
import '../../core/copy/formatters.dart';

/// Every line the Review feature shows (spec 5.8, Night Sheet brief sections 8 and 10). The
/// steps of a mistake are Found, Repaired, Retested and Still right; never "fixed" or "mastered".
abstract final class ReviewCopy {
  /// Holds "11:08 PM" together: a no-break space before AM or PM, so the time never splits.
  static String bindTime(String text) => text.replaceAllMapped(RegExp(r' (AM|PM)'), (m) => ' ${m[1]}');

  // ---- The tab --------------------------------------------------------------------------

  static const title = 'Review';

  /// The header key that opens Ask Mobi (it answers from the record).
  static const askKey = 'Ask Mobi';
  static String tonightOverline(DateTime now, String subject) => "${tonightOrTodayTitle(now)}'s repair, $subject";
  static const mistakesHeading = 'Mistakes to repair';

  /// The switch under the hero: what is waiting, and what is done.
  static const tabRepair = 'To repair';
  static const tabHistory = 'History';
  static const sectionsLabel = 'Review sections';
  static const recordHeading = 'Repair record';
  static const pastHeading = 'Past results';
  static const seeRecord = 'See your record';

  /// The History side's first block: the SWOT's next step after the latest mock.
  static String nextFromMock(String mock) => 'Next from $mock';
  static const setUp = 'Set up';

  /// "Set up" is opening the practice setup, which starts nothing before its own key.
  static String setUpSpoken(String label) => 'Set up: $label. Opens the setup, nothing starts yet';
  static const replayRecap = 'Replay recap';
  static const showMe = 'Show me';

  /// What is left, in one count (never "7 mistakes" beside "1 of 8"): the repaired and found counts are the progress line's.
  static String mistakesSummary(int open, int chapters) => '$open left to repair across ${plural(chapters, 'chapter')}';

  /// A chapter's own progress, with its denominator: "1 of 5 repaired".
  static String chapterRepaired(int repaired, int total) => '$repaired of $total repaired';

  static String seeAllChapters(int chapters) => 'See all $chapters chapters';

  /// Where tonight's mistakes come from, reconciled with the chapter's count in the list below.
  static String tonightCount(int n, String source, int chapterOpen) {
    final head = '${plural(n, 'mistake')} from $source.';
    final rest = chapterOpen - n;
    if (rest <= 0) return '$head You can stop after any one.';
    return '$head ${rest == 1 ? '1 more' : '$rest more'} in this chapter from earlier papers.';
  }

  /// The line beside the hero's number, which already says how many: where they come from.
  static String tonightSource(String source, int n, int chapterOpen) {
    final rest = chapterOpen - n;
    if (rest <= 0) return 'From $source. You can stop after any one.';
    return 'From $source. ${rest == 1 ? '1 more' : '$rest more'} from earlier papers.';
  }

  /// The hero's key says what it does and what it costs in time: "Repair 3 mistakes, 10 min".
  static String tonightKey(int n, int? minutes) =>
      minutes == null ? 'Repair ${plural(n, 'mistake')}' : 'Repair ${plural(n, 'mistake')}, $minutes min';

  /// What a screen reader says for the same key: it does say how many.
  static String tonightKeySpoken(int n, int? minutes) =>
      minutes == null ? 'Repair ${plural(n, 'mistake')}' : 'Repair ${plural(n, 'mistake')}, about $minutes minutes';

  /// The one Hinglish caption on the tab.
  static String aajKaRepair(int minutes, String chapter) => 'Aaj ka repair: $minutes minutes, ${shortChapter(chapter)}.';

  /// "Partnership" for "Partnership: admission of a partner".
  static String shortChapter(String chapter) {
    final head = chapter.split(':').first.trim();
    return head.isEmpty ? chapter : head;
  }

  /// After 11 PM the hero's own line says it: any one repair is a fine place to stop. It takes the
  /// place of the source line, so the layout stays the day layout.
  static const lateNight = 'Repair a little, then sleep.';

  static String unopened(String label) => '$label was received. Your result is ready.';
  static const openResult = 'Open it';

  static String groupLine(String subject, int open, int repaired, int setAside) => [
    subject,
    if (open > 0) '${plural(open, 'mistake')} to repair',
    if (repaired > 0) '$repaired repaired',
    if (setAside > 0) '$setAside set aside',
  ].join('. ');

  /// "from Mock 2" or "from Mock 1 and Mock 2": where a chapter's open mistakes were found.
  ///
  /// The same source is said once: two Quick practices are "2 quick practices", never "Quick
  /// practice and Quick practice". A mock keeps its number, and a quick practice next to a mock
  /// is "a quick practice" ("from Mock 1 and a quick practice").
  static String fromPapers(List<String> sources) {
    final counts = <String, int>{};
    for (final s in sources) {
      counts[s] = (counts[s] ?? 0) + 1;
    }
    if (counts.length == 1) {
      final only = counts.keys.single;
      final n = counts[only]!;
      if (n == 1) return 'from $only';
      return only == quickPracticeSource ? 'from $n quick practices' : 'from $only, $n papers';
    }
    final parts = [
      for (final e in counts.entries)
        if (e.key == quickPracticeSource)
          (e.value == 1 ? 'a quick practice' : '${e.value} quick practices')
        else
          (e.value == 1 ? e.key : '${e.key}, ${e.value} papers'),
    ];
    return 'from ${_join(parts)}';
  }

  /// The source label of a paper that is not a numbered mock (see `sourceLabel`).
  static const quickPracticeSource = 'Quick practice';

  static String _join(List<String> parts) =>
      parts.length <= 2 ? parts.join(' and ') : '${parts.sublist(0, parts.length - 1).join(', ')} and ${parts.last}';

  static String repairGroupKey(int n) => n == 1 ? 'Repair this one' : 'Repair these $n';

  /// A chapter whose open mistakes sit in several papers gets one key per paper, so the number
  /// on the key is the number of steps the run holds.
  static String repairGroupFromKey(int n, String source, {String? date}) =>
      date == null ? 'Repair $n from $source' : 'Repair $n from $source, $date';
  static String groupExpandHint(bool expanded) => expanded ? 'Hide the questions' : 'Show the questions';

  static String questionLabel(int number) => 'Question $number';

  /// What a screen reader says over the strip of wrong bubbles: one question is singular, several
  /// are listed with "and" before the last ("Questions 3, 5 and 9, answered wrong").
  static String wrongQuestionsSpoken(List<int> numbers) {
    if (numbers.length == 1) return '${questionLabel(numbers.single)}, answered wrong';
    final head = numbers.sublist(0, numbers.length - 1).join(', ');
    return 'Questions $head and ${numbers.last}, answered wrong';
  }
  static String foundIn(String source, String date) => 'Found in $source on $date';

  static String notAttemptedHeading(String source, int n) => 'Not attempted in $source ($n)';
  static const notAttemptedNote = 'Skipped questions are not mistakes. Look at the answer or try one again.';
  static const seeAnswer = 'See the answer';
  static const tryAgain = 'Try it again';
  static const tryNotRecorded = 'This try stays here. It is not recorded.';
  static const keyHidden = "This question's answer key is being checked, so it is not shown yet.";

  static String pastLine(String date, int marks, int max) => '$date, ${formatSignedNumber(marks)} of $max';

  static const recordPreviewEmpty = 'Your first repair will show here, with when it was found and when it was repaired.';

  // ---- Features introduced at their moment (F18): one inline note each, never a tour ---------------

  static const noteReviseLead = 'Revise';
  static const noteRevise = 'Wrong answers come back after 1, 3, 7 and 21 days, so they stay fixed.';
  static const noteReviseAction = 'Open Revise';
  static const noteLabLead = 'Mistake Lab';
  static String noteLab(String mock) => 'The result of $mock shows where its marks went and which mistakes cost the most.';
  static const noteLabAction = 'Open the result';
  static const noteCollegesLead = 'Colleges';
  static const noteColleges = 'A full-mock score shows which DU programmes are within reach. Colleges and Compass use it.';
  static const noteCollegesAction = 'Open Colleges';
  static const noteAskLead = 'Ask Mobi';
  static const noteAsk = 'You can ask Mobi about any question you review. It starts from this one.';

  // ---- Stage words ----------------------------------------------------------------------
  //
  // The four steps of a mistake, the same words as the website's RUN_COPY.stages
  // (src/components/recovery/repairRun.js). What sets each one: Found, the question was answered
  // wrong in a paper; Repaired, the server acknowledged a repair (mistake_index.dart _stageFor,
  // RepairStepState.countsAsRepaired). Retested (right on a new question on the same idea) and
  // Still right (right again later) have no source yet, so they are never lit and the words say so.

  static const found = 'Found';
  static const repaired = 'Repaired';
  static const setAsideHeading = 'Set aside while the key is checked';
  static const retested = 'Retested';
  static const stillRight = 'Still right';

  /// The one line under the four steps (the website's RUN_COPY.laterSteps), wherever they carry a line.
  static const lifeCaption = 'The last two steps test you with new questions on the same idea. They are not ready yet.';

  /// What a screen reader says for the four steps: where this mistake is ([lifeRepaired] and the
  /// rest), then the two steps that are not ready. The website's ending lists the same four words
  /// (RUN_COPY.stagesLabel) with [lifeCaption] shown under them.
  static String lifeSpoken(String now) => '$now The last two steps, retested and still right, are not ready yet.';
  static const lifeRepaired = 'Found and repaired.';
  static const lifeReviewed = 'Found and read with the key, not repaired yet.';
  static const lifeSetAside = 'Found, set aside while the key is checked.';
  static const lifeFound = 'Found, not repaired yet.';
  static const reviewed = 'Reviewed';
  static const setAside = 'Set aside';
  static const notYet = 'Not open yet';

  // ---- Empty, error, offline ------------------------------------------------------------

  /// Shown only when the attempts read succeeded and came back with no papers (never for a read
  /// that failed or has not answered).
  static const emptyTitle = 'Nothing to review yet';
  static const emptyMessage = 'Finish one practice and every wrong answer comes here, sorted by chapter, with the paper and when you attempted it.';

  /// The sample row of the empty tab (tagged "Example"): a question, then its paper and time.
  static const sampleTitle = 'Question 4, Partnership';
  static const sampleSource = 'Mock 1';
  static const emptyAction = 'Start 10 questions';
  static const allClearTitle = 'Nothing waiting to repair';
  static const allClearMessage = "Every mistake you've found is repaired.";
  static const allClearAction = 'Start 10 questions';
  static String allClearSetAside(int n) =>
      'Nothing is open. ${plural(n, 'question')} ${n == 1 ? 'is' : 'are'} set aside while the answer key is checked.';

  /// Open mistakes exist, but none of them can carry tonight's repair.
  static const noTonightTitle = 'Nothing to repair tonight';
  static const noTonightShort =
      "Tonight's repair comes from a mock or a 10-question check. Your open mistakes are in a shorter practice, so they wait in the list below.";
  static const noTonightUnopened = "Your open mistakes are in a result you haven't opened yet. Open it first, then repair from it.";

  /// "3 repaired, 12 found": repaired mistakes and all mistakes found, nothing else.
  static String repairsProgress(int repaired, int found, {int setAside = 0}) =>
      '$repaired repaired, $found found${setAside > 0 ? ', $setAside set aside' : ''}';
  static String repairsProgressSemantics(int repaired, int found, {int setAside = 0}) =>
      '$repaired repaired of ${plural(found, 'mistake')} found so far${setAside > 0 ? ', $setAside set aside' : ''}';
  static const loadErrorTitle = 'Your record did not load';

  /// The named cause and what to do about it: the same words every "did not load" in the app uses.
  static String loadErrorMessage(LoadProblem problem) => '${problem.sentence} ${problem.advice}';
  static const offlineTitle = 'You are offline';
  static const offlineMessage = 'Your mistakes load when you are back online. Nothing was lost.';

  /// The header line over a saved copy: offline, or online but the refresh failed.
  static const savedOffline = 'Offline. Showing what is saved on this phone.';
  static const savedRefreshFailed = 'Could not refresh. Showing your saved record.';
  static const tryAgainKey = 'Try again';

  // ---- Repair entry ---------------------------------------------------------------------

  static String entryLead(int n, int? minutes) =>
      '${plural(n, 'mistake')}${minutes == null ? '' : ', about $minutes minutes'}. You can stop after any one.';
  /// The line under the entry's number, which already says how many.
  static String entryMeaning(int? minutes) => '${minutes == null ? 'Take your time' : 'About $minutes minutes'}. You can stop after any one.';
  static String creditLine(int balance) => 'Uses 1 AI credit per mistake. You have $balance.';

  /// The headline when the wallet covers fewer mistakes than the repair holds.
  static String shortfallHeadline(int needed, int balance) => 'You have ${plural(balance, 'AI credit')}, this repair needs $needed';
  static String startWith(int n) => 'Start with ${plural(n, 'mistake')}';
  static const begin = 'Begin';
  static const openSaved = 'Open saved repair';
  static const reopenLead = 'Already repaired. This opens your saved repair and changes nothing on your record.';

  /// What Repair gives, said on the entry before any call (L13): three lines, each with what it
  /// is and what it holds. The cost follows directly under them.
  static const givesHeading = 'What Repair gives you';
  static const givesTryLead = 'Try it again.';
  static const givesTry = 'You answer the question once more, with no key showing.';
  static const givesReasonLead = 'The reason.';
  static const givesReason = 'Why it looked right, where it breaks, and the trap named.';
  static const givesCheckLead = 'A checked question.';
  static const givesCheck = 'A new one on the same idea, marked for you, with no extra credit.';
  static const givesKeyLead = 'The answer key.';
  static const givesKey = 'Its explanation is free.';

  /// Under the cost line, when the repair holds more than one mistake: what the whole repair takes.
  static String costAfter(int mistakes, int balance) => 'This repair takes $mistakes and leaves ${balance - mistakes}.';

  /// The entry's second line under the paper: when it was attempted.
  static String attemptedAt(String when) => 'Attempted $when';

  /// A saved repair, on its row in Review (F17): when it was made, and that it opens free.
  static String savedRepairFrom(String when) => 'Saved repair from $when. Opens free.';
  static const savedRepairOpens = 'Saved repair. Opens free.';
  static String savedRepairFinePrint(String when) => 'Saved repair from $when. No credit used.';
  static const readKeys = 'Read the key explanations';
  static const readKey = 'Read the key explanation';
  static const pausedHeadline = 'Explanations are paused right now';
  static const pausedLine = 'The key explanations still work.';
  static const outOfCreditsHeadline = "You have used this month's AI credits";
  static String renewsOn(String date) => 'AI credits renew on $date.';

  // ---- Try it once more (L13) -----------------------------------------------------------------
  //
  // Every fresh repair opens on the question again, with no key showing. The step is free, kept on
  // the phone, and never changes what counts as repaired; the server's own answer wins over the
  // phone's on the key.

  static const tryTitle = 'Try it once more before the reason.';
  static const tryHint = 'Pick one. Your first answer here counts.';
  static const checkMyAnswer = 'Check my answer';
  static const checkMyAnswerNeedsPick = 'Check my answer, pick an option first';
  static const showReasonNow = 'Show the reason now';

  /// The tag on the option picked in the paper: "Your pick in Mock 2".
  static String yourPickIn(String source) => 'Your pick in $source';
  static const yourPickNow = 'Your pick now';
  static const yourPickAndKey = 'Your pick and the key';
  static const keyWord = 'Key';

  /// The cost line under "Check my answer". An unknown balance says nothing about the balance and
  /// never counts as zero.
  static String reasonCost(int balance) => 'The reason uses 1 AI credit. You have $balance.';
  static const reasonCostUnknown = 'The reason uses 1 AI credit.';
  static const keyExplanationFree = 'The key explanation is free.';

  /// The verdict, in words and never in colour alone.
  static const verdictRight = 'Right this time.';
  static const verdictRightLine = 'Here is why it holds.';
  static String verdictStill(String? pick) => pick == null ? 'Still the same pick.' : 'Still $pick.';
  static String verdictStillLine(String? key) => key == null ? 'Here is the trap.' : 'The key is $key. Here is the trap.';
  static String verdictDifferent(String? pick, String? key) =>
      pick == null || key == null ? 'Not this one.' : '$pick this time. The key is $key.';
  static String verdictDifferentLine(String? key) => key == null ? 'Here is why.' : 'Here is why $key.';

  // ---- Per mistake ----------------------------------------------------------------------

  static String progress(int i, int n) => '$i of ${plural(n, 'mistake')}';

  /// One segment of the run track, for TalkBack: "Mistake 2 of 3, repaired".
  static String trackSegment(int i, int n, String state) => 'Mistake $i of $n, $state';
  static const trackOnScreen = 'on screen';
  static const trackRepaired = 'repaired';
  static const trackReviewed = 'read with the key';
  static const trackSetAside = 'set aside';
  static const trackSeen = 'opened';
  static const trackAhead = 'not reached yet';
  static const trackGoHint = 'Show this mistake';

  /// The free line when the same question was also answered wrong in another paper.
  static String missedBefore(String source, String date) => 'You also missed this question in $source on $date.';
  static const openThatResult = 'Open that result';

  /// The quiet tag on a mistake row: "Missed twice", "Missed 3 times".
  static String missedTimes(int n) => n == 2 ? 'Missed twice' : 'Missed $n times';

  /// The Review map's quiet mark on a chapter that changed since the last look.
  static const changedNew = 'New';
  static String changedMore(int n) => '$n new';
  static String changedFewer(int n) => '$n fewer';
  static String changedSpoken(String mark) => 'Since your last look: $mark';
  static const finishForNow = 'Finish for now';
  static const nextMistake = 'Next mistake';
  static const finish = 'Finish';
  static const yourAnswer = 'Your answer';
  static const correctAnswer = 'Correct answer';
  static const passage = 'Passage';
  static const whatHappened = 'What happened here';
  static const theIdea = 'The idea';
  static const nextTime = 'Next time';
  static const concept = 'Concept';
  static const answerReview = 'Answer review';

  // ---- Repair v2 and v3 explanation -----------------------------------------------------------

  /// "Why B looked right", or without a known letter "Why it looked right".
  static String whyLookedRight(String? letter) => letter == null ? 'Why it looked right' : 'Why $letter looked right';
  static const whereItBreaks = 'Where it breaks';
  static const anotherWay = 'Another way to see it';
  static const keepThis = 'Keep this';

  /// The chip under the trap's name. The call is told the key before it explains, so this says
  /// where the explanation comes from and never claims a check.
  static String explainedFromKey(String? letter) => letter == null ? 'Explained from the answer key.' : 'Explained from the answer key ($letter).';

  /// "Why D is right", or without a known letter "Why the key is right".
  static String whyRight(String? letter) => letter == null ? 'Why the key is right' : 'Why $letter is right';
  static const otherOptions = 'The other options';

  /// The disclosure's label, with how many options it holds: "The other options (2)".
  static String otherOptionsCount(int n) => '$otherOptions ($n)';
  static String otherOptionsOpen(int n) => '${otherOptionsCount(n)}, expanded';
  static String otherOptionsClosed(int n) => '${otherOptionsCount(n)}, collapsed';

  /// One row of the disclosure, as a screen reader says it: "Option A. It reverses the ratio."
  static String otherOptionSpoken(String letter, String why) => 'Option $letter. $why';
  static String toRememberIt(String hook) => 'To remember it: $hook';
  static const explainAnotherWay = 'Explain it another way';

  /// The free lines the server built from the student's own records, under the explanation.
  static const fromYourRecord = 'From your record';

  /// Fine print under the repair. A saved repair opened again costs nothing; a fresh one says what
  /// it took and what is left. With no balance in the answer the count is left out, never guessed.
  static const savedRepairNoCredit = 'Saved repair. No credit used.';
  static const noCreditUsed = 'No credit used.';
  static String creditsUsed(int charged, int? left) => left == null ? '${plural(charged, 'credit')} used.' : '${plural(charged, 'credit')} used. $left left.';
  static const copyRule = 'Copy';
  static const copiedRule = 'Copied';
  static const copyRuleSpoken = 'Copy the rule';

  /// The folded question once the repair is on screen: "Q7. Your pick B. Key C." Unknown parts
  /// are left out (the website's `foldedQuestionLine`).
  static String foldedQuestion(int number, String? pick, String? key) =>
      ['Q$number.', if (pick != null) 'Your pick $pick.', if (key != null) 'Key $key.'].join(' ');
  static const showQuestion = 'Show the question';
  static const hideQuestion = 'Hide the question';

  /// While a repair is written: ONE line that replaces itself on real elapsed time, with the
  /// website's words and moments (`REPAIR_LOADING`): the first at once, the second after 8
  /// seconds, the third after 45 seconds (`RepairWaitLine`). Each says what is true: the credit
  /// is taken only if it arrives.
  static String writingRepair(int number) => 'Writing the repair for Q$number.';
  static const stillWriting = 'Still writing. You are charged only if it arrives.';
  static const takingLonger = 'Taking longer than usual. Still trying.';
  static const keyExplanationLabel = 'Key explanation. No explanation credit used.';
  static const noKeyExplanation = 'There is no written explanation for this question yet.';
  static const reviewedNote = 'Reviewed on this phone. It keeps its place in Review for a repair.';

  static const heldForRecheck = 'Answer key under check. You were not charged.';
  static const setAsideCheck = 'Answer key under check. Nothing was charged.';
  static const notExplained = 'We could not explain this one. You were not charged. Try another.';
  static const outOfCredits = "You have used this month's AI credits.";
  /// One line, no box: used up, and when they come back.
  static String creditsUsedLine(String? renewDate) => renewDate == null ? 'Credits used up for this month.' : 'Credits used up. They renew on $renewDate.';
  static const paused = 'Explanations are paused right now.';
  static const couldNotMake = 'The explanation could not be made. Try again.';
  // The server sends its own sentence for these (each says nothing was charged). These are the same
  // words for an answer that arrives without one; `tookTooLong` is also the app's own line when it
  // stops waiting.
  static const tookTooLong = 'This took too long. You were not charged.';
  static const providerUnavailable = "Repairs aren't available right now. Try again in a little while. You were not charged.";
  static const walletUnavailable = "We couldn't reach your credits. Nothing was charged. Try again.";
  static String repairsPausedUntil(String date) => 'Repairs are paused until $date. You were not charged.';
  static const repairsPaused = 'Repairs are paused for now. You were not charged.';
  static const waitAMinute = 'Please wait a minute.';
  static const stillWorking = 'Still working on this one. Try again in a moment.';
  static const offline = 'You are offline. Your place is kept.';
  static const cannotRepair = 'This one cannot be repaired here. The key explanation still works.';
  static const notFound = "We can't find this mistake any more. It may already be repaired.";
  static const backToReview = 'Back to Review';
  static const keyNeedsConnection = 'The key explanation needs a connection the first time.';
  static const questionNeedsConnection = 'Connect to load this question.';

  static String retryTitle(String chapter) => 'Practise 5 on ${shortChapter(chapter)}';
  static String retryLine(int? cost, bool free) => free
      ? 'A separate practice session. 5 questions, about 5 minutes. Free with your allowance.'
      : 'A separate practice session. 5 questions, about 5 minutes.${cost == null ? '' : ' ${plural(cost, 'credit')}.'}';
  static const retryKey = 'Practise 5 questions';
  static const retryShort = 'Not enough practice credits for a retry. The repair counts without one.';

  // ---- Ending ---------------------------------------------------------------------------

  /// What the new questions of this repair showed: only the checks answered, each marked by the server.
  static String endingHeld(int held, int answered) => 'Check it held: $held of $answered new ${answered == 1 ? 'question' : 'questions'}.';
  static String endingUnit(int n) => n == 1 ? 'mistake repaired' : 'mistakes repaired';
  /// The one fact the hero's number does not carry: what is left in the chapter, and anything set
  /// aside or read with the key. [left] is the open mistakes of this chapter in this paper (what
  /// the run covered), null when the open count is not known; [elsewhere] is the same chapter's
  /// open mistakes in other papers, which the run never touched, so the two are said apart.
  static String endingFact(String chapter, int? left, {int elsewhere = 0, int setAside = 0, int reviewed = 0}) {
    final name = shortChapter(chapter);
    final other = elsewhere > 0 ? ' $elsewhere ${left == 0 ? '' : 'more '}in other papers.' : '';
    return [
      if (left != null)
        left == 0
            ? (elsewhere > 0 ? 'Nothing left in $name from this paper.$other' : 'Nothing left in $name.')
            : (elsewhere > 0 ? '$left left in $name.$other' : '$left left in $name.'),
      if (setAside > 0) '$setAside set aside while ${setAside == 1 ? 'its key is' : 'their keys are'} checked.',
      if (reviewed > 0) '$reviewed read with the key explanation.',
    ].join(' ');
  }

  /// Under the result's repair key when the paper's wrong answers span chapters: what the key
  /// opens (one chapter of this paper) and where the rest are.
  static String repairKeyNote(String chapter, int others) =>
      '${shortChapter(chapter)}. The other $others ${others == 1 ? 'is' : 'are'} in Review.';

  /// Under the ending's four steps: the same one line as everywhere else.
  static const checkedLater = lifeCaption;
  static const firstRepair = 'This is your first repair.';
  static String goodPlaceToStop(DateTime now) => 'That is a good place to stop for ${tonightOrToday(now)}.';
  static String repairMore(int n) => 'Repair ${plural(n, 'more mistake')}';
  static String repairMoreLine(String chapter, int? minutes) => minutes == null ? chapter : '$chapter, about $minutes minutes';
  static String finishFor(DateTime now) => 'Finish for ${tonightOrToday(now)}';
  /// The ending's key when mistakes of this run were missed (a failed call, or one the server
  /// could not explain): the same mistakes, again.
  static const trySameAgain = 'Try the same mistakes again';
  static String trySameAgainLine(int n, String chapter) => '${plural(n, 'mistake')}, ${shortChapter(chapter)}';
  static const mobiEndingRepaired = 'Mobi, pleased with the repair';
  static const mobiEndingNothing = 'Mobi, ready for another try';
  static const nothingRepairedTitle = 'Nothing repaired this time';
  static String nothingRepaired(int setAside, int reviewed) {
    final parts = <String>[
      if (setAside > 0) '$setAside set aside',
      if (reviewed > 0) '$reviewed read with the key',
    ];
    if (parts.isEmpty) return 'Nothing was charged. Your mistakes stay in Review.';
    return '${parts.join(', ')}. They stay in Review.';
  }

  // ---- Record ---------------------------------------------------------------------------

  static const recordTitle = 'Repair record';
  static const onThisPhone = 'This record is on this phone only. Repairs made on another phone are not shown here.';
  static const checksGate = lifeCaption;
  static String recordTitleLine(int number, String chapter) => 'Question $number, $chapter';
  static String foundOn(String when, String source) => 'Found $when, $source';
  static String repairedOn(String when) => 'Repaired $when';
  static String reviewedOn(String when) => 'Read with the key $when, not repaired yet';
  static String setAsideOn(String when) => 'Set aside $when, answer key under check';
  static const checkedNotYet = 'Retested with a new question: not ready yet.';
  static const recordEmptyTitle = 'Nothing repaired yet';
  static const recordEmptyAction = 'See your mistakes';

  // ---- Mistakes page --------------------------------------------------------------------

  static const mistakesTitle = 'Mistakes';

  // ---- Loading (read by screen readers while a page loads) -------------------------------

  static const loadingMistakes = 'Loading your mistakes';
  static const loadingRecord = 'Loading your repair record';
  static const loadingRepair = 'Loading your repair';
  static const loadingAnswers = 'Loading the answer sheet';
}
