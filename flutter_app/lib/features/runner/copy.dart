import '../../core/copy/formatters.dart';
import '../../core/router/quick_start.dart' show subjectDisplayName;

/// Every word the runner shows (spec 5.5 and 5.5.1, brief section 8). Sentence case, 12-hour
/// times, no exclamation marks, and "saved" only after the server acknowledged.
abstract final class RunnerCopy {
  // Identity.
  static String sessionLabel({required bool isMock, required String mode, int? mockNumber}) {
    if (!isMock) return 'Quick practice';
    if (mockNumber != null) return 'Mock $mockNumber';
    return mode == 'nta' ? 'NTA-style mock' : 'Full mock';
  }

  static String subjectLine(String subject, String? chapter) {
    final name = subjectDisplayName(subject);
    return chapter == null || chapter.isEmpty ? name : '$name, $chapter';
  }

  static String noun(bool isMock) => isMock ? 'mock' : 'practice';

  // Top bar.
  static String countSemantics(int current, int total) => 'Question $current of $total';
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
  static String waiting(int n) => '${plural(n, 'answer')} on this phone, waiting for network';
  static String waitingShort(int n) => '${plural(n, 'answer')} on this phone';

  // Warnings.
  static const String fiveMinutes = '5 minutes left';
  static const String oneMinute = '1 minute left';

  // The question.
  static const String passage = 'Passage';
  static String passageRange(int from, int to) => 'Questions $from to $to use this passage.';
  static String optionSemantics(String key, String text) => 'Option $key, $text';
  static const String clearAnswer = 'Clear my answer';
  static const String mark = 'Mark for review';
  static const String marked = 'Marked for review';
  /// A practice has no visible timer, but it does close: say when, once, as plain text.
  static String practiceNote(DateTime openUntil) => 'Feedback comes after you finish. Open until ${formatTime12(openUntil)}.';
  static String openUntil(DateTime at) => 'Open until ${formatTime12(at)}';

  // Bottom bar.
  static const String previous = 'Previous';
  static const String saveAndNext = 'Save and next';
  static const String reviewAndSubmit = 'Review and submit';

  // Return after an interruption.
  static String awayFor(Duration d) => 'You were away for ${durationWords(d)}. The timer kept running.';
  static const String awaySaved = 'All answers are saved on the server.';
  static const String awayOnPhone = 'Your answers are on this phone and will be sent when you are online.';
  static const String awayDismiss = 'Got it';

  // Palette.
  static const String paletteTitle = 'Your answer sheet';
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
  static String markedCount(int n) => '$n marked for review';
  static String notAnsweredCount(int n) => '$n not answered';
  static const String cannotChange = 'You cannot change answers after you submit.';
  static String submitKey(bool isMock) => isMock ? 'Submit mock' : 'Submit practice';
  static const String keepWorking = 'Keep working';
  static const String sending = 'Sending your answers';
  static String received(DateTime at) => 'Answers received. Saved on the server at ${formatTime12(at)}.';
  static String openResult(bool isMock) => isMock ? 'Open your sheet' : 'See your answers';
  static const String pendingBody = 'Your answers are on this phone. We will send them when you are online.';
  static const String timeUpPending = 'Your answers are on this phone. We will try to send them.';
  static const String sendingTitle = 'Handing in your sheet';
  static const String receivedTitle = 'Your sheet is in.';
  static const String pendingTitle = 'Not sent yet';
  static const String notRecordedTitle = 'Not recorded';
  static const String notOnServer = 'Not on the server yet';
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
  static const String failedTitle = 'This session did not open.';
  static const String failedBody = 'Your answers are still on this phone. Try again in a moment.';
}
