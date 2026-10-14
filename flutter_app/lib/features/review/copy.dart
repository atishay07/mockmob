import '../../core/copy/formatters.dart';

/// Every line the Review feature shows (spec 5.8, Night Sheet brief sections 8 and 10). The
/// mistake vocabulary is Found, Repaired, Checked and Holds; never "fixed" or "mastered".
abstract final class ReviewCopy {
  /// Holds "11:08 PM" together: a no-break space before AM or PM, so the time never splits.
  static String bindTime(String text) => text.replaceAllMapped(RegExp(r' (AM|PM)'), (m) => ' ${m[1]}');

  // ---- The tab --------------------------------------------------------------------------

  static const title = 'Review';

  /// The header key that opens Ask Mobi (it answers from the record).
  static const askKey = 'Ask Mobi';
  static String tonightOverline(DateTime now, String subject) => "${tonightOrTodayTitle(now)}'s repair, $subject";
  static const mistakesHeading = 'Mistakes to repair';
  static const recordHeading = 'Repair record';
  static const pastHeading = 'Past results';
  static const seeRecord = 'See your record';
  static const replayRecap = 'Replay recap';
  static const showMe = 'Show me';

  static String mistakesSummary(int open, int chapters) => '${plural(open, 'mistake')} across ${plural(chapters, 'chapter')}';

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

  /// The hero's key: the number of mistakes is the figure above it, so the key carries the time.
  static String tonightKey(int? minutes) => minutes == null ? 'Start repairing' : 'Start, $minutes minutes';

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
  static String fromPapers(List<String> sources) => 'from ${_join(sources)}';

  static String _join(List<String> parts) =>
      parts.length <= 2 ? parts.join(' and ') : '${parts.sublist(0, parts.length - 1).join(', ')} and ${parts.last}';

  static String repairGroupKey(int n) => n == 1 ? 'Repair this one' : 'Repair these $n';

  /// A chapter whose open mistakes sit in several papers gets one key per paper, so the number
  /// on the key is the number of steps the run holds.
  static String repairGroupFromKey(int n, String source) => 'Repair $n from $source';
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

  static String pastLine(String date, int marks, int max) => '$date, $marks of $max';

  static const recordPreviewEmpty = 'Your first repair will show here, with when it was found and when it was repaired.';

  // ---- Stage words ----------------------------------------------------------------------

  static const found = 'Found';
  static const repaired = 'Repaired';
  static const setAsideHeading = 'Set aside while the key is checked';
  static const checked = 'Checked';
  static const holds = 'Holds';
  static const reviewed = 'Reviewed';
  static const setAside = 'Set aside';
  static const notYet = 'Not open yet';

  // ---- Empty, error, offline ------------------------------------------------------------

  static const emptyTitle = 'Your mistakes gather here';
  static const emptyMessage = 'Every wrong answer lands here, grouped by chapter.';
  static const emptyAction = 'Start practice';
  static const allClearTitle = 'Nothing waiting to repair';
  static const allClearMessage = "Every mistake you've found is repaired.";
  static const allClearAction = 'Start a Quick 10';
  static String allClearSetAside(int n) =>
      'Nothing is open. ${plural(n, 'question')} ${n == 1 ? 'is' : 'are'} set aside while the answer key is checked.';

  /// Open mistakes exist, but none of them can carry tonight's repair.
  static const noTonightTitle = 'Nothing to repair tonight';
  static const noTonightShort =
      "Tonight's repair comes from a mock or a 10-question check. Your open mistakes are in a shorter practice, so they wait in the list below.";
  static const noTonightUnopened = "Your open mistakes are in a result you haven't opened yet. Open it first, then repair from it.";

  /// "3 of 12 repaired": repaired mistakes of all mistakes found, nothing else.
  static String repairsProgress(int repaired, int found) => '$repaired of $found repaired';
  static String repairsProgressSemantics(int repaired, int found) => '$repaired of ${plural(found, 'mistake')} found so far repaired';
  static const loadErrorTitle = 'We could not load your mistakes';
  static const loadErrorMessage = 'Check your connection and try again.';
  static const offlineTitle = 'You are offline';
  static const offlineMessage = 'Your mistakes load when you are back online.';
  static const tryAgainKey = 'Try again';

  // ---- Repair entry ---------------------------------------------------------------------

  static String entryLead(int n, int? minutes) =>
      '${plural(n, 'mistake')}${minutes == null ? '' : ', about $minutes minutes'}. You can stop after any one.';
  /// The line under the entry's number, which already says how many.
  static String entryMeaning(int? minutes) => '${minutes == null ? 'Take your time' : 'About $minutes minutes'}. You can stop after any one.';
  static String creditLine(int balance) => 'Uses 1 credit per mistake. You have $balance.';

  /// The headline when the wallet covers fewer mistakes than the repair holds.
  static String shortfallHeadline(int needed, int balance) => 'You have ${plural(balance, 'credit')}, this repair needs $needed';
  static String startWith(int n) => 'Start with ${plural(n, 'mistake')}';
  static const begin = 'Begin';
  static const reopenLead = 'Already repaired. Opening it again is free and changes nothing on your record.';
  static const readKeys = 'Read the key explanations';
  static const readKey = 'Read the key explanation';
  static const pausedHeadline = 'Explanations are paused right now';
  static const pausedLine = 'The key explanations still work.';
  static const outOfCreditsHeadline = "You have used this month's explanation credits";
  static String renewsOn(String date) => 'Explanation credits renew on $date.';
  static const lifeCaption = 'Checked and Holds come later, from fresh questions.';

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
  static const working = 'Working out the explanation';
  static const whatHappened = 'What happened here';
  static const theIdea = 'The idea';
  static const nextTime = 'Next time';
  static const concept = 'Concept';
  static const answerReview = 'Answer review';

  // ---- Repair v2 explanation ----------------------------------------------------------------

  /// "Why B looked right", or without a known letter "Why it looked right".
  static String whyLookedRight(String? letter) => letter == null ? 'Why it looked right' : 'Why $letter looked right';
  static const whereItBreaks = 'Where it breaks';
  static const anotherWay = 'Another way to see it';
  static const keepThis = 'Keep this';
  static const copyRule = 'Copy';
  static const copiedRule = 'Copied';
  static const copyRuleSpoken = 'Copy the rule';

  /// The folded question once the repair is on screen: "Q7. Your pick B. Key C." Unknown parts
  /// are left out (the website's `foldedQuestionLine`).
  static String foldedQuestion(int number, String? pick, String? key) =>
      ['Q$number.', if (pick != null) 'Your pick $pick.', if (key != null) 'Key $key.'].join(' ');
  static const showQuestion = 'Show the question';
  static const hideQuestion = 'Hide the question';

  /// After 8 seconds of waiting for an explanation: still honest, nothing promised.
  static const stillWorkingSlow = 'Still working on this one';
  static const keyExplanationLabel = 'Key explanation. No explanation credit used.';
  static const noKeyExplanation = 'There is no written explanation for this question yet.';
  static const reviewedNote = 'Reviewed on this phone. It keeps its place in Review for a repair.';

  static const heldForRecheck = 'Answer key under check. You were not charged.';
  static const setAsideCheck = 'Answer key under check. Nothing was charged.';
  static const notExplained = 'We could not explain this one. You were not charged. Try another.';
  static const outOfCredits = "You have used this month's explanation credits.";
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

  static String retryTitle(String chapter) => 'Practise 5 on ${shortChapter(chapter)}';
  static String retryLine(int? cost, bool free) => free
      ? 'A separate practice session. 5 questions, about 5 minutes. Free with your allowance.'
      : 'A separate practice session. 5 questions, about 5 minutes.${cost == null ? '' : ' ${plural(cost, 'credit')}.'}';
  static const retryKey = 'Practise 5 questions';
  static const retryShort = 'Not enough practice credits for a retry. The repair counts without one.';

  // ---- Ending ---------------------------------------------------------------------------

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

  static const checkedLater = 'Checked comes later, on fresh questions.';
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
  static const checksGate = 'Fresh checks are not available yet, so Checked and Holds stay open.';
  static String recordTitleLine(int number, String chapter) => 'Question $number, $chapter';
  static String foundOn(String when, String source) => 'Found $when, $source';
  static String repairedOn(String when) => 'Repaired $when';
  static String reviewedOn(String when) => 'Read with the key $when, not repaired yet';
  static String setAsideOn(String when) => 'Set aside $when, answer key under check';
  static const checkedNotYet = 'Checked on fresh questions: not available yet.';
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
