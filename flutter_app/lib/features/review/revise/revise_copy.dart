/// The app's own words in Revise (Mistake Lab v4 slice 4, spec 4.8). The head, the summary, each
/// recall's line and the box names come from the server, finished; these are the few sentences the
/// app builds itself, written in the website's words (`data/mistake_lab.copy.json`, `revise`), and
/// the controls. A test holds them equal to that file. Sentence case, no "!".
abstract final class ReviseCopy {
  static const String title = 'Revise';

  /// The website's `revise.unavailable`.
  static const String unavailable = 'Revise is not available right now. Try again shortly.';

  /// The website's `revise.notDue`: a 409 for a card that is not due, a changed question or a
  /// changed key.
  static const String notDue = 'That question is not due now.';

  /// The website's `revise.capReached`.
  static const String capReached = 'You have done today\'s questions. The rest come back tomorrow.';

  /// The website's `revise.nextNone`: nothing due and nothing coming.
  static const String nextNone =
      'Questions you get wrong in a paper or a practice set come back here after 1, 3, 7 and 21 days.';

  /// The website's `revise.minutes`.
  static String minutes(int m) => 'About $m minutes';

  /// The website's `revise.boxes`.
  static String box(int n) => 'Box $n';

  /// The website's `revise.end`: "8 recalled, 2 come back tomorrow". Null when nothing was answered.
  static String? end({required int right, required int wrong}) {
    if (right > 0 && wrong > 0) return '$right recalled, $wrong come back tomorrow';
    if (right > 0) return '$right recalled';
    if (wrong > 0) return '$wrong come back tomorrow';
    return null;
  }

  // The website's Revise page controls.
  static const String questionsADay = 'Questions a day';
  static const String back = 'Your papers';
  static const String backToReview = 'Back to Your papers';

  /// Under the end's key: the mistakes the student repaired, asked once more on the phone.
  static String reviewAgainMore(int n) => 'Review again: $n more you repaired';
  static const String checking = 'Checking your answer';
  static const String sendFailed = 'Your answer was not saved. Try again.';
  static const String tryAgain = 'Try again';
  static const String nextQuestion = 'Next question';
  static const String finish = 'Finish';
  static const String passage = 'Passage';
  static const String rightAnswer = 'Right answer';
  static const String yourPick = 'Your pick';
  static const String loading = 'Loading Revise';
  static const String cardsByBox = 'Your cards by box';

  /// Review's entry when no read has arrived yet, and its line before one does (the website's
  /// ReviseEntry).
  static const String entryTitle = 'Revise';
  static const String entryNote = 'Questions you got wrong come back after 1, 3, 7 and 21 days.';

  /// The first-time empty state: one sample card (tagged "Example") and the next action. Not on the
  /// website's copy list: the website's own sentence above them says when cards come back.
  static const String sampleTitle = 'Question 4, Partnership';
  static const String sampleNote = 'Comes back in 1 day';
  static const String startAction = 'Start 10 questions';

  static String questionOf(int n, int total) => 'Question $n of $total';
  static String capSpoken(int n) => '$n questions a day';
  static String optionSpoken(String letter, String text) => 'Option $letter. $text';
  static String laneSpoken(int n, int count, String? days) => '${box(n)}: $count${days == null ? '' : ', $days'}';

  // Revise as one queue (LEARN-REVIEW-1017 5.8, the website's `revise.run` strings).

  /// The website's `revise.run.head`: "8 due today, about 7 minutes."
  static String runHead(int n, int m) => '$n due today, about $m minutes.';

  /// The website's `revise.run.mix`: the parts that exist, in play order.
  static String mixBack(int n) => n == 1 ? '1 question back' : '$n questions back';
  static String mixChecks(int n) => '$n Check it held';
  static String mixCards(int n) => n == 1 ? '1 concept card' : '$n concept cards';
  static String mix({required int back, required int checks, required int cards}) => [
    if (back > 0) mixBack(back),
    if (checks > 0) mixChecks(checks),
    if (cards > 0) mixCards(cards),
  ].join(', ');

  /// The website's `revise.run.kind`.
  static const String kindQuestion = 'A question you got wrong';
  static const String kindAgain = 'A mistake you repaired';

  /// The website's `revise.run.position`: "3 of 8".
  static String position(int k, int n) => '$k of $n';

  /// The website's `revise.run.foot`.
  static const String foot = 'Free. Not counted in your marks or accuracy.';

  /// The website's `revise.run.schedule.title`.
  static const String scheduleTitle = 'How Revise schedules';
  static String scheduleLine(int cap) => 'Back after 1, 3, 7 and 21 days. Up to $cap a day.';
  static const String showSchedule = 'Show the schedule';
  static const String hideSchedule = 'Hide the schedule';

  /// The end's next step: the lesson recall cards due today, played by the Learn recall run.
  static String cardsKey(int n) => 'Revise ${mixCards(n)}';
  static const String cardsNote = 'From lessons you have read. Free.';

  /// A Check it held's line above its question: the mistake whose rule it checks.
  static String checkRule(int n) => 'Your Q$n rule';

  /// The website's `revise.run.skip`: leave a Check it held for later (it stays due).
  static const String skipCheck = 'Skip for today';

  /// The end's line for the checks this run marked, in the website's words (`revise.run.end.held`
  /// and `.slipped`). Null when none was marked.
  static String? checksEnd({required int held, required int slipped}) {
    final parts = [
      if (held > 0) '$held held on a new question',
      if (slipped > 0) '$slipped slipped on a new question, so ${slipped == 1 ? 'it is' : 'they are'} open again',
    ];
    if (parts.isEmpty) return null;
    final text = parts.join('. ');
    return '${text[0].toUpperCase()}${text.substring(1)}.';
  }

  /// The end's line for a Check it held left for later.
  static String checksLeft(int n) => n == 1 ? '1 Check it held is still due. It stays in Revise.' : '$n Check it held are still due. They stay in Revise.';
}
