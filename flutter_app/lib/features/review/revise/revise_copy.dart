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
  static const String back = 'Review';
  static const String backToReview = 'Back to Review';
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

  static String questionOf(int n, int total) => 'Question $n of $total';
  static String capSpoken(int n) => '$n questions a day';
  static String optionSpoken(String letter, String text) => 'Option $letter. $text';
  static String laneSpoken(int n, int count, String? days) => '${box(n)}: $count${days == null ? '' : ', $days'}';
}
