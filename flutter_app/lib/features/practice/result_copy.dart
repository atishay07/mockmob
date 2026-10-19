// Words of the practice result's analysis (WEB-PARITY A7, A8): observations, timing, answer
// changes, reporting a problem and the fresh-questions check. Kept apart from copy.dart so each
// file stays readable.

abstract final class ResultCopy {
  // What the set shows (observations from the session's own record).
  static const String showsTitle = 'What this set shows';
  static const String showMe = 'Show me';
  static String questionsLine(List<int> numbers) =>
      numbers.length == 1 ? 'Question ${numbers.first}' : 'Questions ${numbers.join(', ')}';
  static String timingLine(String total, String average) => 'You spent $total on this set, about $average a question.';
  static const String timingHidden = 'Time per question is not shown: the timing from this phone did not add up.';

  // A row.
  static const String answerChanged = 'Answer changed';
  static String timeOn(String t) => '$t on it';
  static String timeSemantics(String t) => 'You spent $t on this question';

  // Report a problem.
  static const String report = 'Report a problem';
  static const String reportTitle = 'What looks wrong?';
  static const String reportNote = 'We read every report. The question stays in your result.';
  static const List<String> reportReasons = ['The answer key', 'An option', 'The explanation', 'Unclear wording'];
  static const String reported = 'Reported. Thank you.';
  static const String reportFailed = 'We could not send that. Nothing changed. Try again.';
  static const String reporting = 'Sending';

  // Prove: five fresh questions.
  static const String proveTitle = 'Prove the repair';
  static String proveLine(String chapter) => 'Five questions you have not seen, from $chapter. Free, five minutes, no answers until you finish.';
  static const String proveNote = 'A day or two later is how you know a repair stuck.';

  /// A chapter only left blank: no repair to prove, so the card says what the set shows instead.
  static const String proveBlankTitle = 'Try the chapter you left blank';
  static const String proveBlankNote = 'A blank answer costs you marks too. This set shows where you really stand on the chapter.';
  static const String proveKey = 'Try 5 fresh questions';
}
