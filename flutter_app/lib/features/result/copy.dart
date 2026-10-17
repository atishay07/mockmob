import '../../core/copy/formatters.dart';
import '../../core/domain/domain.dart' show MarkBreakdown, RepairCandidates, RepairKeyScope, shortChapterName;
import 'widgets/marks_bar.dart' show MarkPart;
import '../../core/widgets/bubbles/bubble_painter.dart' show BubbleState;

/// Every line of the result feature (spec 5.6 and 5.7, Night Sheet brief sections 1.1 and 8).
/// Sentence case, no middle dots, no exclamation marks, no arrows, 12-hour times. "Saved" only
/// for what the server acknowledged.
abstract final class ResultCopy {
  // ---- Identity -------------------------------------------------------------------------

  /// "Mock 7" or "Quick practice".
  static String mockLabel(int? ordinal) => ordinal == null ? 'Quick practice' : 'Mock $ordinal';

  /// "Mock 7, Accountancy".
  static String title(int? ordinal, String subject) => '${mockLabel(ordinal)}, $subject';

  /// "50 questions, 60 minutes."
  static String paperShape(int questions, int? minutes) =>
      minutes == null ? '${plural(questions, 'question')}.' : '${plural(questions, 'question')}, ${plural(minutes, 'minute')}.';

  static String submittedAt(DateTime at) => 'Submitted at ${formatTime12(at)}.';
  static const savedOnServer = 'Saved to your account.';
  static const answerSheet = 'Answer sheet';

  /// The step before the key on a mistake (v15 spec 3.2, from the website's fix round).
  static const tryFirstTitle = 'Try it again before you see the answer';
  static const tryFirstLine = 'Answer the question once more with no key showing. This try is not recorded.';
  static const tryItAgain = 'Try it again';
  static const showTheAnswer = 'Show the answer';
  static const answers = 'Answers';
  static String range(int n) => '1 to $n';
  static const mapHint = 'Tap a bubble to open that answer.';

  // ---- Sealed sheet (5.6.2) -------------------------------------------------------------

  static const sheetBack = 'Your sheet is back.';
  static const markedOnServer = 'Marked on the server.';
  static const openWhenReady = markedOnServer;
  static const openTab = 'Open your result';
  static const openWithoutReveal = 'Open without the reveal';
  static const dragHint = 'Swipe up to unfold';

  /// Above the open sheet: "Mock 7 is marked." A first mock is acknowledged, never celebrated.
  static String markedLine(String mock, {bool first = false}) => first ? '$mock is marked. Here is your map.' : '$mock is marked.';

  /// "Mock 7 result, sealed."
  static String sealedLabel(String mock) => '$mock result, sealed.';

  // ---- Effort, separate from the score (brief 1.1) -----------------------------------------

  /// Mobi's line on card 4: "Third full paper this month." Effort, said once, never after a
  /// lower or held result. The first mock is counted per subject, so the line names it ("Your
  /// first Business Studies paper."): a student with seven Accountancy papers is not on a first.
  static String effort(int monthCount, {required bool firstInSubject, required String subject}) {
    if (firstInSubject) return 'Your first $subject paper.';
    if (monthCount <= 1) return 'First full paper this month.';
    final word = ordinalWord(monthCount);
    return '${word[0].toUpperCase()}${word.substring(1)} full paper this month.';
  }

  static String ordinalWord(int n) {
    const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    if (n >= 1 && n <= words.length) return words[n - 1];
    final mod100 = n % 100;
    final suffix = (mod100 >= 11 && mod100 <= 13)
        ? 'th'
        : switch (n % 10) {
            1 => 'st',
            2 => 'nd',
            3 => 'rd',
            _ => 'th',
          };
    return '$n$suffix';
  }

  // ---- Story bar --------------------------------------------------------------------------

  static String cardOf(int card, int count) => 'Card $card of $count';

  /// "Card 2 of 4: Where the marks went" for a story-bar segment.
  static String cardNamed(int card, int count, String name) => 'Card $card of $count: $name';
  static const nextCard = 'Next card';

  /// The names of the four cards, by card number.
  static const cardNames = <int, String>{1: 'Your result', 2: nextMarks, 3: sectionFirstFix, 4: 'What is recorded'};
  static const skip = 'Skip to full result';

  /// What the story bar's key shows: short, so the four segments keep a 48 dp width beside it. A
  /// screen reader still hears [skip].
  static const skipShort = 'Skip';
  static const previousCard = 'Previous card';

  // ---- Evidence behind a claim --------------------------------------------------------

  static const seeWrong = 'See the wrong answers';
  static const seeBlank = 'See the blank answers';
  static String seeQuestions(int n) => n == 1 ? 'See the question' : 'See the $n questions';

  // ---- Card 1, the marks ------------------------------------------------------------------

  static const marks = 'Marks';
  static String outOf(int max) => 'of $max';
  static String figureLabel(int marks, int max) => formatMarks(marks, max);
  static const scheme = '5 marks for each correct answer, minus 1 for each wrong answer.';
  static String correct(int n) => '$n correct';
  static String wrong(int n) => '$n wrong';
  static String notAttempted(int n) => '$n not attempted';
  static String sum(int c, int w, int u) => '$c + $w + $u = ${plural(c + w + u, 'question')}.';
  // Scores read "115 of 250" everywhere on screen (the figure, the comparison, Recent papers).
  static String previous(String mock, int marks, int max) => '$mock, same format: ${formatSignedNumber(marks)} of $max.';
  static String higherCompare(String prev, int pm, String now, int m, int max) =>
      '$prev: ${formatSignedNumber(pm)} of $max. $now: ${formatSignedNumber(m)} of $max.';
  static const nextMarks = 'Where the marks went';
  static const heldTitle = 'Marks held';

  /// Above the open sheet while marks are held: the paper is marked, some answers are not final.
  static String heldMarkedLine(String mock, int n) => '$mock is marked, ${plural(n, 'answer')} still being checked.';
  static String heldBody(int n) =>
      '${plural(n, 'question')} ${n == 1 ? 'is' : 'are'} being checked. Your marks will update here, and we will tell you.';
  static const keysUnavailable = 'We could not check for answer-key updates just now. Your marks may change.';
  static String heldCell(int n) => '${plural(n, 'question')} being checked';

  // ---- Card 2, where the marks went ---------------------------------------------------------

  /// A negative score makes the lost marks exceed the paper (5 not earned and 1 taken off for a wrong
  /// answer), so a paper of 50 would read "the other 51". There the title names no figure.
  static String breakdownTitle(int lost, {int? max}) =>
      max != null && lost > max ? 'Where the marks went' : 'Where the other $lost marks went';

  /// A negative score, in one sentence that never counts more marks than the paper holds as one
  /// total: "You lost 6 marks to 1 wrong answer and left 45 unearned." Blanks are said only when there are some.
  static String negativeLoss(int wrong, int blank) {
    final wrongPart = 'You lost ${wrong * 6} marks to ${plural(wrong, 'wrong answer')}';
    return blank > 0 ? '$wrongPart and left ${blank * 5} unearned.' : '$wrongPart.';
  }

  /// The chapter behind it, with its marks and no denominator that is bigger than the paper:
  /// "Financial Markets: 4 questions, 1 wrong, 3 blank, 21 marks."
  static String negativeChapterDetail(String chapter, int questions, int wrong, int blank, int marks) =>
      '$chapter: ${plural(questions, 'question')}, $wrong wrong, $blank blank, ${plural(marks, 'mark')}.';
  static String allScored(int max) => 'All $max marks scored.';
  static const rowScored = 'Scored';
  static const rowTakenOff = 'Taken off by wrong answers';
  static const rowNotEarnedWrong = 'Not earned on wrong answers';
  static const rowNotEarnedBlank = 'Not earned on blank answers';
  static String marksValue(int n) => '${formatSignedNumber(n)} ${n == 1 || n == -1 ? 'mark' : 'marks'}';
  static String eachOf(int per, int count) => '$per for each of $count';
  static String breakdownCaption(int max, int scored, int takenOff, int wrongNot, int blankNot) =>
      'Of $max marks: ${formatSignedNumber(scored)} scored, $takenOff taken off, $wrongNot not earned on wrong answers, '
      '$blankNot not earned on blanks. $takenOff + $wrongNot + $blankNot = ${takenOff + wrongNot + blankNot}.';
  /// The one line that leads card 2: where most of the lost marks went.
  static String breakdownLead(int wrong, int onWrong, int onBlank) => wrong > 0 && onWrong >= onBlank
      ? '$onWrong went on answers you got wrong.'
      : '$onBlank went on questions left blank.';
  /// The one line under the flow for the ribbon the student picked: "15 wrong answers, 75 marks
  /// not earned."
  static String flowSentence(MarkPart part, MarkBreakdown b) => switch (part) {
    MarkPart.scored => '${plural(b.correct, 'correct answer')}, ${marksValue(b.scored)} scored.',
    MarkPart.takenOff => '${plural(b.wrong, 'wrong answer')}, ${marksValue(b.takenOff)} taken off.',
    MarkPart.notEarnedWrong => '${plural(b.wrong, 'wrong answer')}, ${marksValue(b.notEarnedOnWrong)} not earned.',
    MarkPart.notEarnedBlank => '${b.unattempted} not attempted, ${marksValue(b.notEarnedOnBlank)} not earned.',
  };

  /// The state of a bubble in words, for a tile's TalkBack label.
  static String stateWord(BubbleState s) => switch (s) {
    BubbleState.filled => statusCorrect.toLowerCase(),
    BubbleState.wrong => statusWrong.toLowerCase(),
    BubbleState.marked => statusHeld.toLowerCase(),
    _ => statusBlank.toLowerCase(),
  };

  static const showArithmetic = 'Show the arithmetic';
  static const hideArithmetic = 'Hide the arithmetic';
  static String arithmetic(int correct, int wrong, int scored) => '$correct × 5 $minusSign $wrong = ${formatSignedNumber(scored)}';
  static const nextFix = 'The first thing to fix';
  static const barLabelStart = '0';
  static String flowSource(int max) => 'All $max marks on the paper';

  // ---- Card 3, the first thing to fix -------------------------------------------------------

  static String startWith(String chapter) => 'Start with $chapter';
  static String startWithBlanks(String chapter) => 'Start with the questions you left blank in $chapter';
  static const startWithWrong = 'Start with your wrong answers';
  static const nothingToFix = 'Nothing to repair in this mock.';
  static const costMost = 'This chapter cost the most marks in this mock.';

  /// Beside the chapter's cost figure: "of 135 missed".
  ///
  /// When the score is negative the marks missed exceed the paper, so the unit is just "marks".
  static String costUnit(int missed, {int? max}) => max != null && missed > max ? 'marks' : 'of $missed missed';
  static String costLabel(int cost, int missed, {int? max}) => max != null && missed > max
      ? '${plural(cost, 'mark')} cost in this chapter.'
      : '$cost of the $missed marks you missed were in this chapter.';
  static String chapterCounts(int q, int c, int w, int u) => '${plural(q, 'question')}: $c correct, $w wrong, $u not attempted.';
  static String blanksEvidence(int u, int q) => 'You did not attempt $u of $q questions here. Blank answers are not mistakes to repair.';
  static String wrongByNumber(int n) =>
      'No chapter had enough questions to single out, so here ${n == 1 ? 'is the one answer' : 'are the $n answers'} you got wrong.';
  static const everyAnswerRight = 'Every answer you gave was correct.';
  static const yourAnswersHere = 'Your answers in this chapter';
  static const yourWrongAnswers = 'Your wrong answers';
  static const whyThis = 'Why this?';
  static const whyTitle = 'Why this chapter';
  static String whyBody(int wrong, int blank) =>
      'Each wrong answer is 6 marks below a right one: 5 not earned and 1 taken off. Each blank is 5. '
      'Here that is ${wrong * 6 + blank * 5} marks, more than any other chapter with 3 or more questions in this mock.';
  static const nextChoose = 'Choose how to fix it';
  static const practiseChapter = 'Practise this chapter';
  static const nextWhatsNext = 'See what is recorded';
  static String questionTile(int n, String state) => 'Question $n, $state. Opens the answer.';

  // ---- Card 4, the record and the next ask ----------------------------------------------------

  static String inRecord(String mock) => '$mock is in your record.';
  static String savedAt(DateTime at) => 'Saved to your record at ${formatTime12(at)}.';

  /// The receipt line on card 4: a time only when the server's acknowledgment was received on
  /// this phone, otherwise the plain fact.
  static String receiptLine(DateTime? acknowledgedAt) => acknowledgedAt == null ? markedOnServer : savedAt(acknowledgedAt);
  static String readyToRepair(int n, int? minutes) => minutes == null
      ? '${plural(n, 'wrong answer')} ready to repair.'
      : '${plural(n, 'wrong answer')} ready to repair, about $minutes minutes.';

  /// When some of the paper's wrong answers cannot be repaired right now (already repaired, or their
  /// answer key is being checked), the line says what it counts: "13 of 15 wrong answers ready to
  /// repair." with the other 2 named, so card 3's wrong count and this one never look like two
  /// different numbers.
  static String readyToRepairOf(int n, int wrong) => '$n of ${plural(wrong, 'wrong answer')} ready to repair.';
  static String readyToRepairRest(int rest) =>
      '${rest == 1 ? 'The other one is' : 'The other $rest are'} repaired already, or ${rest == 1 ? 'its' : 'their'} answer ${rest == 1 ? 'key is' : 'keys are'} being checked.';
  static String blanksInReview(int n) => '$n not attempted. ${n == 1 ? 'It is' : 'They are'} in Review.';
  static String blanksCount(int n) => '$n not attempted.';
  static const noMistakes = 'No wrong answers to repair from this mock.';
  static String walletShort(int needed, int balance) => balance <= 0
      ? 'This repair needs $needed AI credits. You have none. Read the key explanations in Review.'
      : 'This repair needs $needed AI credits. You have $balance. Start with ${plural(balance, 'mistake')}, or read the key explanations in Review.';
  static const tryAgain = 'Try again';
  static String chip(int minutes) => '$minutes min';
  static String chipLabel(int minutes, int mistakes) => '$minutes minutes, ${plural(mistakes, 'mistake')}';
  /// The repair key, saying exactly what opens. The run is one chapter of the paper: when it holds
  /// all the paper's mistakes the key gives their count and the time ("Repair 5 mistakes, about 10
  /// min"); when other chapters are left in Review it names the chapter ("Repair Principles of
  /// management, 1 mistake").
  static String repairKey(RepairKeyScope scope, int minutes) => RepairCandidates.keyLabel(scope);

  /// The words above the key, in two short lines: the chapter the run opens (and how many of its
  /// wrong answers the length chosen holds, when it is not all of them), then the time and what waits
  /// in Review. "Admission of a partner, 3 of its 4 wrong answers." and "About 10 minutes. The other
  /// 12 are in Review." A screen reader hears them as one sentence ([repairScopeSpoken]).
  static String repairScopeLine(RepairKeyScope scope, int minutes, {int? chapterTotal}) {
    final where = scope.hasNamedChapter ? shortChapterName(scope.chapter) : 'Questions with no chapter';
    final part = chapterTotal != null && scope.count < chapterTotal ? ', ${scope.count} of its ${plural(chapterTotal, 'wrong answer')}' : '';
    final rest = scope.othersInPaper <= 0 ? '' : ' The other ${scope.othersInPaper} ${scope.othersInPaper == 1 ? 'is' : 'are'} in Review.';
    return '$where$part.\nAbout $minutes minutes.$rest';
  }

  static String repairScopeSpoken(RepairKeyScope scope, int minutes, {int? chapterTotal}) =>
      repairScopeLine(scope, minutes, chapterTotal: chapterTotal).replaceAll('\n', ' ');

  /// What a screen reader hears for the key: the key and where the rest of the paper's mistakes are.
  static String repairKeySpoken(RepairKeyScope scope, int minutes, {int? chapterTotal}) =>
      '${repairKey(scope, minutes)}. ${repairScopeSpoken(scope, minutes, chapterTotal: chapterTotal)}';

  static String startRepair(int minutes) => 'Start $minutes-minute repair';
  static const chooseElse = 'Choose something else';
  static const finishForNow = 'Finish for now';
  static const continueToToday = 'Continue to Today';
  static const goodnight = 'Goodnight';
  static const more = 'More';
  static const somethingElse = 'Something else';
  static const otherOptions = 'See other options';
  static const reminderAsk = 'Want a reminder when your repair is due? You choose the time.';
  static const setReminder = 'Set a reminder';
  static const notNow = 'Not now';
  static const skipHint = 'Prefer to skip the reveal? Change it in You.';

  // ---- Your sheet, to keep (card 4) ----------------------------------------------------------

  static const shareSheet = 'Share your sheet';
  /// Heard by a screen reader on the share chip; the preview shows exactly what is shared.
  static const shareSheetHint = 'Your answers as a card. No marks on it.';
  static const shareTitle = 'Share your sheet';
  static const share = 'Share';
  static const addSubject = 'Add the subject';
  static const shareFailed = 'Could not make the card. Try again.';
  static String answeredOf(int n, int of) => '$n of $of answered';
  static String shareText(String mock) => '$mock done on MockMob.';
  static String shareCardLabel(String mock, int n, int of, DateTime day, String? subject) =>
      '$mock${subject == null ? '' : ', $subject'}. ${answeredOf(n, of)}. ${formatDayMonth(day)}.';
  static String firstMockToken(DateTime at) => 'First full mock. Recorded on ${formatDayMonth(at)}.';
  static String finishLine(String mock, int mistakes) => mistakes == 0
      ? '$mock is in your record.'
      : '$mock is in your record. Your ${plural(mistakes, 'mistake')} ${mistakes == 1 ? 'is' : 'are'} waiting in Review.';

  // ---- Full result (5.7) ----------------------------------------------------------------------

  static const replay = 'Replay recap';
  static String continueRecap(int card) => 'Continue recap, card $card of 4';
  static String submittedOn(DateTime at) => 'Submitted at ${formatTime12(at)}, ${formatDayMonth(at)}.';
  static String countsWithDenominators(int c, int w, int u, int n) => '$c of $n correct, $w wrong, $u not attempted.';
  /// The Lab's section title (Mistake Lab v4: the owner's own word, in place of "Where the marks
  /// went"). With a server `lab` the ledger uses the server's `labels.name`, the same word.
  static const sectionWhere = 'Mistake Lab';
  static const sectionFirstFix = 'The first thing to fix';
  static const sectionAnswers = 'Answer by answer';
  static String groupWrong(int n) => 'Wrong answers ($n)';
  /// A long press on a bubble of the answer map: "Q12, Accountancy: wrong".
  static String bubbleTip(int number, String subject, BubbleState state) {
    final word = switch (state) {
      BubbleState.filled => 'correct',
      BubbleState.wrong => 'wrong',
      BubbleState.marked => 'being checked',
      _ => 'not attempted',
    };
    return 'Q$number, $subject: $word';
  }

  static String groupBlank(int n) => 'Not attempted ($n)';

  /// The "Not attempted" header for TalkBack: it shows or hides the rows.
  static String groupBlankToggle(int n, {required bool open}) => '${plural(n, 'question')} not attempted. ${open ? 'Hide' : 'Show'} them.';
  static String groupCorrect(int n) => 'Correct ($n)';
  static String groupHeld(int n) => 'Being checked ($n)';
  static String question(int n) => 'Question $n';
  static const statusCorrect = 'Correct';
  static const statusWrong = 'Wrong';
  static const statusBlank = 'Not attempted';
  static const statusHeld = 'Being checked';
  static const yourAnswer = 'Your answer';
  static const correctAnswer = 'Correct answer';
  static const didNotAnswer = 'You did not answer this question.';
  static const keyHeld = 'The answer for this question is being checked, so it is not shown yet.';
  static const keysOff = 'Answers and explanations are not available for this result right now.';
  static const changedAnswer = 'You changed this answer during the mock.';
  static const repairThis = 'Repair this mistake';
  static const repaired = 'Repaired. Recorded in your account.';
  static const explanation = 'Explanation';
  static const passage = 'Passage';
  static String repairN(int n) => 'Repair ${plural(n, 'mistake')}';
  static String corrected(int n) =>
      '${plural(n, 'answer key')} ${n == 1 ? 'was' : 'were'} corrected after this mock. Marked answers follow the corrected ${n == 1 ? 'key' : 'keys'}.';
  static String lastLoaded(DateTime at) => 'Offline. Showing what was last loaded at ${formatTime12(at)}.';
  static const loadFailed = 'We could not load this result. Your result was recorded. Try again.';
  static const notFound = 'This result is not on this account.';
  static const loading = 'Loading your result';
  static const slowTitle = 'Your result is taking longer to load';
  static const slowBody = 'It is saved to your account. Try again, or find it later in Review.';
  static const backToReview = 'Go to Review';

  // ---- After this mock: the plan and the read of the paper (SWOT) --------------------------------
  // The server writes every line of the read. These are only the headings and the buttons.

  static const swotTitle = 'After this mock';
  static const swotPlanTitle = 'Do these next';
  static const swotReadTitle = 'SWOT for this mock';
  static const swotSetUp = 'Set up';

  /// What a screen reader hears for a plan row's key: the key, then the set it opens.
  static String swotSetUpFor(String label) => 'Set up. $label';
  static const swotSee = 'See';
  static String swotQuestionChip(int n) => 'Q$n';
  static String swotGoToQuestion(int n) => 'Go to question $n';

  // ---- Mistake Lab: the server writes every sentence; these are only the chips. -----------------

  static String labQuestionChip(int n) => swotQuestionChip(n);
  static String labGoToQuestion(int n) => swotGoToQuestion(n);

  // ---- Replay (Mistake Lab v4 slice 2): the server writes every sentence. The moving clock reads the
  // server's own row words ("By {clock}: {a} of {total} answered. Even pace: {p}.") at the moment
  // shown, and the rest are what a screen reader hears. ---------------------------------------------

  /// The server's `replay.row.pace` / `noPace` words at any moment: every count with its denominator.
  static String replayAnsweredBy(String clock, int answered, int total, int? evenPace) => evenPace == null
      ? 'By $clock: $answered of $total answered.'
      : 'By $clock: $answered of $total answered. Even pace: $evenPace.';

  static String replayClockSpoken(String clock) => 'Replay at $clock';

  static String replayMapSpoken(int answered, int opened, int total) => '$answered of $total questions answered and $opened opened at this moment.';

  static String replayBarSpoken(int n, String result, String from, String to, List<String> away) {
    final word = switch (result) {
      'right' => 'right',
      'wrong' => 'wrong',
      'held' => 'under re-check',
      _ => 'left blank',
    };
    final gaps = away.where((a) => a.isNotEmpty).map((a) => ' $a.').join();
    return 'Question $n, $word, on screen from $from to $to.$gaps Open the answer.';
  }

  /// The heading word of a group when the server sends none (it always should).
  static String swotGroupWord(String id) => switch (id) {
    'strength' => 'Strengths',
    'weakness' => 'Weaknesses',
    'opportunity' => 'Opportunities',
    'threat' => 'Threats',
    _ => '',
  };
}
