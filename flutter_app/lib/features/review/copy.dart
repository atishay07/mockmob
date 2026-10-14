import '../../core/copy/formatters.dart';

/// Every line the Review feature shows (spec 5.8, Night Sheet brief sections 8 and 10). The
/// mistake vocabulary is Found, Repaired, Checked and Holds; never "fixed" or "mastered".
abstract final class ReviewCopy {
  // ---- The tab --------------------------------------------------------------------------

  static const title = 'Review';
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

  static String tonightKey(int n, int? minutes) =>
      minutes == null ? 'Repair ${plural(n, 'mistake')}' : 'Repair ${plural(n, 'mistake')}, about $minutes minutes';

  /// The one Hinglish caption on the tab.
  static String aajKaRepair(int minutes, String chapter) => 'Aaj ka repair: $minutes minutes, ${shortChapter(chapter)}.';

  /// "Partnership" for "Partnership: admission of a partner".
  static String shortChapter(String chapter) {
    final head = chapter.split(':').first.trim();
    return head.isEmpty ? chapter : head;
  }

  /// Mobi's line under tonight's card after 11 PM: any one repair is a fine place to stop. One line
  /// in his bubble.
  static const lateNight = 'Repair a little, then sleep.';

  static String unopened(String label) => '$label was received. Your result is ready.';
  static const openResult = 'Open it';

  static String groupLine(String subject, int open, int repaired, int setAside) => [
    subject,
    if (open > 0) '${plural(open, 'mistake')} to repair',
    if (repaired > 0) '$repaired repaired',
    if (setAside > 0) '$setAside set aside',
  ].join('. ');

  static String repairGroupKey(int n) => n == 1 ? 'Repair this one' : 'Repair these $n';

  /// A chapter whose open mistakes sit in several papers gets one key per paper, so the number
  /// on the key is the number of steps the run holds.
  static String repairGroupFromKey(int n, String source) => '${repairGroupKey(n)} from $source';
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
  static const emptyMessage = 'Finish a mock or a practice and every wrong answer lands here, grouped by chapter, ready to repair.';
  static const emptyAction = 'Start practice';
  static const allClearTitle = 'Nothing waiting to repair';
  static const allClearMessage = "Every mistake you've found is repaired. A Quick 10 finds the next one.";
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
  static const loadErrorMessage = 'Check the connection and try again.';
  static const offlineTitle = 'You are offline';
  static const offlineMessage = 'Your mistakes load once you are back online.';
  static const tryAgainKey = 'Try again';

  // ---- Repair entry ---------------------------------------------------------------------

  static String entryLead(int n, int? minutes) =>
      '${plural(n, 'mistake')}${minutes == null ? '' : ', about $minutes minutes'}. You can stop after any one.';
  static String creditLine(int balance) => 'Uses 1 explanation credit for each mistake. You have $balance.';
  static String shortfallLine(int needed, int balance) =>
      'This repair needs $needed explanation credits. You have $balance. '
      '${balance > 0 ? 'Start with ${plural(balance, 'mistake')}, or read the key explanations.' : 'You can read the key explanations instead.'}';
  static String startWith(int n) => 'Start with ${plural(n, 'mistake')}';
  static const begin = 'Begin';
  static const reopenLead = 'Already repaired. Opening it again is free and changes nothing on your record.';
  static const readKeys = 'Read the key explanations';
  static const readKey = 'Read the key explanation';
  static const pausedLine = 'Explanations are paused right now. The key explanations still work.';
  static String renewsOn(String date) => 'Explanation credits renew on $date.';
  static const lifeCaption = 'Each mistake moves from Found to Repaired. Checked and Holds come from fresh questions later.';

  // ---- Per mistake ----------------------------------------------------------------------

  static String progress(int i, int n) => '$i of ${plural(n, 'mistake')}';
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
  static const keyExplanationLabel = 'Key explanation. No explanation credit used.';
  static const noKeyExplanation = 'There is no written explanation for this question yet.';
  static const reviewedNote = 'Reviewed on this phone. It keeps its place in Review for a repair.';

  static const heldForRecheck = "We are checking this question's answer key. It is set aside for now and you were not charged.";
  static const setAsideCheck = 'This question is being checked. It is set aside for now, and nothing was charged.';
  static const notExplained = 'We could not explain this one. You were not charged. Try another.';
  static const outOfCredits = "You have used this month's explanation credits.";
  static const paused = 'Explanations are paused right now.';
  static const couldNotMake = 'The explanation could not be made. Try again.';
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
  static String endingLine(String chapter, int repaired, int total, {required DateTime now, int setAside = 0, int reviewed = 0}) {
    final when = tonightOrToday(now);
    final head = repaired == total
        ? '${shortChapter(chapter)}: ${repaired == 1 ? 'the mistake' : 'all $repaired'} repaired $when.'
        : '${shortChapter(chapter)}: $repaired of $total repaired $when.';
    return [
      head,
      if (setAside > 0) '$setAside set aside while ${setAside == 1 ? 'its key is' : 'their keys are'} checked.',
      if (reviewed > 0) '$reviewed read with the key explanation.',
    ].join(' ');
  }

  static const checkedLater = "Checked comes later, on questions you haven't seen. That's how we know it holds.";
  static const firstRepair = 'This is your first repair.';
  static String goodPlaceToStop(DateTime now) => 'That is a good place to stop for ${tonightOrToday(now)}.';
  static String repairMore(int n) => 'Repair ${plural(n, 'more mistake')}';
  static String repairMoreLine(String chapter, int? minutes) => minutes == null ? chapter : '$chapter, about $minutes minutes';
  static String finishFor(DateTime now) => 'Finish for ${tonightOrToday(now)}';
  static const nothingRepairedTitle = 'Nothing was repaired this time';
  static String nothingRepaired(int setAside, int reviewed) {
    final parts = <String>[
      if (setAside > 0) '${plural(setAside, 'question')} set aside while the key is checked.',
      if (reviewed > 0) '${plural(reviewed, 'question')} read with the key explanation.',
    ];
    if (parts.isEmpty) return 'Nothing was charged. Your mistakes stay in Review for another go.';
    return '${parts.join(' ')} They stay in Review for another go.';
  }

  // ---- Record ---------------------------------------------------------------------------

  static const recordTitle = 'Repair record';
  static const onThisPhone = 'This record is on this phone only. Repairs made on another phone are not shown here.';
  static const checksGate = 'Fresh checks are not available yet, so Checked and Holds stay open.';
  static String recordTitleLine(int number, String chapter) => 'Question $number, $chapter';
  static String foundOn(String when, String source) => 'Found on $when in $source.';
  static String repairedOn(String when) => 'Repaired on $when.';
  static String reviewedOn(String when) => 'Reviewed with the key explanation on $when. Not a repair yet.';
  static String setAsideOn(String when) => 'Set aside on $when while the answer key is checked.';
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
