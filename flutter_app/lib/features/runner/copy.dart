import '../../core/copy/formatters.dart';
import '../../core/router/quick_start.dart' show subjectDisplayName;

/// Every word the runner shows (spec 5.5 and 5.5.1, brief section 8). Sentence case, 12-hour
/// times, no exclamation marks, and "saved" only after the server acknowledged.
abstract final class RunnerCopy {
  // Identity.
  static String sessionLabel({required bool isMock, required String mode, int? mockNumber}) {
    if (!isMock) return 'Quick practice';
    if (mockNumber != null) return 'Mock $mockNumber';
    return mode == 'nta' ? 'NTA mode' : 'Full mock';
  }

  /// The one name a paper carries on the submit page and the receipt (finding 25). A practice is
  /// "Accountancy practice", with its chapter after a comma when it was started for one: the same
  /// words the practice result opens with. A mock is "Mock 7, Accountancy".
  static String paperName({required bool isMock, required String mode, required String subject, int? mockNumber, String? chapter}) {
    final name = subjectDisplayName(subject);
    if (isMock) return '${sessionLabel(isMock: true, mode: mode, mockNumber: mockNumber)}, $name';
    return chapter == null || chapter.isEmpty ? '$name practice' : '$name practice, $chapter';
  }

  static String subjectLine(String subject, String? chapter) {
    final name = subjectDisplayName(subject);
    return chapter == null || chapter.isEmpty ? name : '$name, $chapter';
  }

  static String noun(bool isMock) => isMock ? 'mock' : 'practice';

  // Top bar.
  static String countSemantics(int current, int total) => 'Question $current of $total';

  /// The bubble strip under the top bar: "Question 3 of 20, answered".
  static String trackSemantics({required int number, required int total, required bool answered}) =>
      'Question $number of $total, ${answered ? 'answered' : 'not answered'}';
  static const String questionsKey = 'Questions';
  static String leaveSemantics(bool isMock) => 'Leave the ${noun(isMock)}';

  /// "Time left, 47 minutes 12 seconds".
  static String timerSemantics(Duration left) => 'Time left, ${durationWords(left)}';

  /// "1 hour 2 minutes 18 seconds", "2 minutes 10 seconds", "40 seconds".
  static String durationWords(Duration d) {
    final total = d.inSeconds < 0 ? 0 : d.inSeconds;
    final h = total ~/ 3600;
    final m = (total % 3600) ~/ 60;
    final s = total % 60;
    final parts = [if (h > 0) plural(h, 'hour'), if (m > 0) plural(m, 'minute'), if (s > 0 || (h == 0 && m == 0)) plural(s, 'second')];
    return parts.join(' ');
  }

  // Save glyph (the save-state truth model).
  static const String saved = 'Saved';
  static const String saving = 'Saving';
  static const String onThisPhone = 'On this phone';

  /// The server refused the answers it was sent: they are still on this phone.
  static const String notSavedYet = 'Not saved yet. Tap to retry';
  static String waiting(int n) => '${plural(n, 'answer')} on this phone, waiting for network';
  static String waitingShort(int n) => '${plural(n, 'answer')} on this phone';

  // Warnings.
  static const String fiveMinutes = '5 minutes left';
  static const String oneMinute = '1 minute left';

  // The question.
  static const String passage = 'Passage';
  static String passageRange(int from, int to) => 'Questions $from to $to use this passage.';
  static const String passageHide = 'Hide passage';
  static const String passageShow = 'Show passage';
  static String optionSemantics(String key, String text, {bool crossedOut = false}) =>
      crossedOut ? 'Option $key, $text, crossed out' : 'Option $key, $text';

  /// Practice only, after 90 s untouched on one question: the real time spent, as a plain fact.
  static String onThisQuestion(Duration d) {
    final m = d.inMinutes;
    final sec = (d.inSeconds % 60).toString().padLeft(2, '0');
    return 'On this question for $m:$sec';
  }

  static const String strikeHint = 'Press and hold an option to cross it out.';
  static const String strikeAction = 'Cross out';
  static const String unstrikeAction = 'Bring back';
  static const String answerCleared = 'Answer cleared.';
  static const String undo = 'Undo';
  static const String clearAnswer = 'Clear my answer';
  static const String mark = 'Mark for review';
  static const String marked = 'Marked for review';

  /// A practice has no visible timer: the one line at the start says when marks come.
  static const String practiceNote = 'Marks come after you submit.';
  static String openUntil(DateTime at) => 'Open until ${formatTime12(at)}';

  // Bottom bar.
  static const String previous = 'Previous';
  static const String next = 'Next';
  static const String reviewAndSubmit = 'Review and submit';

  /// The last question's key on a narrow phone or at large text, where the long label would wrap.
  static const String review = 'Review';

  // Return after an interruption.
  static String awayFor(Duration d) => 'You were away for ${durationWords(d)}. The timer kept running.';
  static const String awaySaved = 'All answers are saved on the server.';
  static const String awayOnPhone = 'Your answers are on this phone and will be sent when you are online.';
  static const String awayDismiss = 'Got it';

  /// The glass strip over the meta line: short enough for two lines at 1.3x text.
  static String awayStrip(Duration d, {required bool allSaved}) =>
      'Away for ${durationWords(d)}. Timer kept running. ${allSaved ? awaySavedShort : awayOnPhoneShort}';
  static const String awaySavedShort = 'Answers saved.';
  static const String awayOnPhoneShort = 'Answers on this phone.';

  // Palette.
  static const String paletteTitle = 'Your answer sheet';

  /// The palette's key that jumps to the first question without an answer.
  static String goToFirstOpen(int number) => 'Go to question $number, first not answered';

  /// Beside the counts on the submit page: the question the count takes the student back to.
  static String goToQuestion(int number) => 'Go to question $number';
  static const String answered = 'Answered';
  static const String notAnswered = 'Not answered';
  static const String notVisited = 'Not visited';
  static const String markedShort = 'Marked';
  static String legendSummary({
    required int answered,
    required int notAnswered,
    required int notVisited,
    required int marked,
    required int total,
  }) => '$answered answered, $notAnswered not answered, $notVisited not visited, $marked marked for review, of $total';
  static String cellSemantics({
    required int number,
    required bool answered,
    required bool visited,
    required bool marked,
    required bool unsynced,
    required bool current,
  }) {
    return [
      'Question $number',
      if (answered) 'answered' else if (visited) 'not answered' else 'not visited',
      if (marked) 'marked for review',
      if (unsynced) 'on this phone',
      if (current) 'current question',
    ].join(', ');
  }

  // Leave guard.
  static String leaveTitle(bool isMock) => 'Leave this ${noun(isMock)}?';
  static String leaveBody({required bool isMock, required DateTime until}) => isMock
      ? 'The clock keeps running. Your answers stay in the mock and you can continue until ${formatTime12(until)}.'
      : 'This practice stays open until ${formatTime12(until)}. Your answers stay in it.';
  static const String keepGoing = 'Keep going';
  static String leaveKey(bool isMock) => 'Leave the ${noun(isMock)}';

  // Submit.
  static const String submitTitle = 'Submit now?';
  static const String timeUpTitle = 'Time is up.';
  static String answeredOf(int total) => 'of $total answered';
  static String markedCount(int n) => '$n $markedWord';
  static String notAnsweredCount(int n) => '$n $notAnsweredWord';
  static const String markedWord = 'marked for review';
  static const String legendMarkedAnswered = 'Marked, answered';
  static const String legendMarkedBlank = 'Marked, not answered';
  static const String notAnsweredWord = 'not answered';
  static const String cannotChange = 'You cannot change answers after you submit.';
  static String submitKey(bool isMock) => isMock ? 'Submit mock' : 'Submit practice';
  static const String keepWorking = 'Keep working';
  static const String sending = 'Sending your answers';

  /// After 12 seconds of sending: the wait settles into words, so nothing spins without saying why.
  static const String stillSending = 'Still sending. Your answers are safe on this phone.';
  static String received(DateTime at) => 'Saved on the server at ${formatTime12(at)}.';
  static String openResult(bool isMock) => isMock ? 'Open your sheet' : 'See your answers';

  /// Mobi's one line on a practice's submit page: plain facts from the sheet, nothing more.
  static String sheetMobiLine({
    required int total,
    required int notAnswered,
    required int firstOpen,
    required int marked,
    required int firstMarked,
  }) {
    if (notAnswered > 0) return '$notAnswered not answered. Go to ${firstOpen + 1}?';
    if (marked > 0) return '$marked marked for review. Go to ${firstMarked + 1}?';
    return 'All $total answered.';
  }

  /// One honest line for answers the server does not have yet: where they are, and that they go
  /// by themselves (the engine retries when the phone is back online; "Try again" asks at once).
  static const String pendingBody = 'Saved on this phone, not on the server yet. We send it when you are online.';
  static const String timeUpPending = pendingBody;
  static const String sendingTitle = 'Handing in your sheet';
  static const String receivedTitle = 'Your sheet is in.';
  static const String pendingTitle = 'Not sent yet';
  static const String notRecordedTitle = 'Not recorded';
  static const String tryAgain = 'Try again';
  static String windowClosed(bool isMock) => 'The submission window has ended, so this ${noun(isMock)} could not be recorded.';
  static String rejected(bool isMock) => 'The server did not accept this ${noun(isMock)}, so it was not recorded.';
  static const String goToToday = 'Go to Today';
  static const String goToPractice = 'Go to Practice';
  static const String sheetSemantics = 'Your answer sheet';
  static String sheetSummary({required int answered, required int notAnswered, required int marked}) =>
      '$answered answered, $notAnswered not answered, $marked marked for review';

  // Opening states.
  static String endedTitle(bool isMock) => 'Time ran out on this ${noun(isMock)}.';
  static const String endedBody = 'Today shows what was recorded and what is still being sent.';
  static const String missingTitle = 'This session is not on this phone.';
  static const String missingBody = 'It may have finished on another device, or it was cleared when you signed out.';
  static const String badPaperTitle = 'This paper is not complete.';
  static String badPaperBody(int count) =>
      'NTA mode needs all 50 questions and this paper has $count, so it was not opened and no clock is running on this phone. Start it again from Practice.';

  /// After 8 seconds of opening: what is slow, and that nothing is lost.
  static const String stillOpening = 'Still opening your session. Your answers are safe on this phone.';
  static const String failedTitle = 'This session did not open.';
  static const String failedBody = 'Your answers are still on this phone. Try again in a moment.';
}
