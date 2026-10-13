import '../../../core/copy/formatters.dart';
import '../../../core/router/quick_start.dart' show subjectDisplayName;

/// The rules of an NTA mode paper, mirrored from the server (`data/test_modes.js`, the scoring
/// contract and `INTEGRITY_STRIKES`). The instructions read them from here, never from guesses.
abstract final class NtaRules {
  static const int questions = 50;
  static const int minutes = 60;
  static const int correct = 5;
  static const int wrong = -1;
  static const int blank = 0;
  static const int strikes = 3;
}

/// Every word of the NTA mode skin. The exam's own button names keep their exam spelling
/// ("Save & Next", "Mark for Review & Next") because students meet exactly those on exam day;
/// everything else is the app's sentence case.
abstract final class NtaCopy {
  static String subject(String id) => subjectDisplayName(id);
  static const String noSubjectTitle = 'Choose a subject for NTA mode.';
  static const String noSubjectBody = 'Open NTA mode from Practice, where your subjects are.';

  // Header.
  static const String modeLine = 'NTA mode';
  static String questionOf(int n, int total) => 'Question $n of $total';
  static String answeredCount(int n) => '$n answered';
  static const String palette = 'Palette';
  static String timerSemantics(Duration d) {
    final s = d.inSeconds < 0 ? 0 : d.inSeconds;
    return 'Time remaining: ${plural(s ~/ 60, 'minute')} ${plural(s % 60, 'second')}';
  }

  /// "60:00", "59:07", "4:03": minutes unpadded, never hours (the exam clock).
  static String clock(Duration d) {
    final s = d.inSeconds < 0 ? 0 : d.inSeconds;
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }

  static const String section = 'Section';
  static String sectionSemantics(String subject) => 'Section 1 of 1, $subject';
  static String warningsPill(int n) => 'Warnings $n/${NtaRules.strikes}';

  // Paper.
  static String questionTitle(int n) => 'Question $n';
  static const String passageSet = 'Passage set';
  static const String passage = 'Passage';
  static String passageRange(int from, int to) => 'Questions $from to $to use this passage.';
  static const String mark = 'Mark';
  static const String unmark = 'Unmark';
  static const String markSemantics = 'Mark for review';
  static const String smaller = 'Smaller text';
  static const String larger = 'Larger text';
  static String difficulty(String d) => switch (d.toLowerCase()) {
    'easy' => 'Easy',
    'medium' => 'Medium',
    'hard' => 'Hard',
    _ => d,
  };

  // The exam keys.
  static const String markAndNext = 'Mark for Review & Next';
  static const String clearResponse = 'Clear response';
  static const String previous = 'Previous';
  static const String saveAndNext = 'Save & Next';
  static const String submitTest = 'Submit Test';
  static const String submitTestShort = 'Submit test';
  static const String questionPaper = 'Question paper';

  // Palette states (legend words).
  static const String answered = 'Answered';
  static const String notAnswered = 'Not answered';
  static const String notVisited = 'Not visited';
  static const String marked = 'Marked for review';
  static const String answeredMarked = 'Answered & marked for review';
  static const String paletteTitle = 'Question palette';
  static String answeredOf(int a, int t) => '$a/$t answered';
  static String pending(int n, int total) => '$n of $total still to answer';
  static const String close = 'Close';

  // Integrity (ExamIntegrityGuard, adapted to a phone).
  static const String reasonLeft = 'You left the exam screen';
  static const String reasonWindow = 'Another window covered the exam';
  static const String reasonRestored = 'The exam was closed and opened again';
  static String warningTitle(int n) => 'Warning $n of ${NtaRules.strikes}';
  static String warningBody(String reason, int n) {
    final left = NtaRules.strikes - n;
    final tail = left == 1 ? 'One more warning will end and submit your session.' : 'Two more warnings will end and submit your session.';
    return '$reason. The timer keeps running. $tail';
  }

  static const String returnKey = 'Return to the exam';
  static const String endedTitle = 'Session ended';
  static const String submitting = 'Submitting your answers';
  static const String endedBody = 'You reached three warnings. Answering is locked. We will submit the answers you already gave.';
  static const List<String> rules = [
    'Leaving the app, switching apps or locking the screen counts as a warning.',
    'A quick look at notifications does not count.',
    'The third warning submits the answers you already gave.',
    'Warnings are counted on this phone.',
  ];
  static String leaveBody(int next, DateTime until) =>
      'Leaving counts as warning $next of ${NtaRules.strikes}. The clock keeps running until ${formatTime12(until)}, and your answers stay in the paper.';
  static const String leaveEnds = 'Leaving now is your third warning, so the paper will be submitted with the answers you gave.';

  // Submit page.
  static const String submitTitle = 'Submit test?';
  static String confirmLine({required int pending, required int marked}) {
    if (pending == 0 && marked == 0) return 'Every question has an answer.';
    final unanswered = 'You have ${plural(pending, 'unanswered question')}';
    return marked > 0 ? '$unanswered and $marked marked for review. Submit anyway?' : '$unanswered. Submit anyway?';
  }

  static const String summaryTitle = 'Exam summary';
  static const String total = 'Total questions';
  static String summarySemantics(String subject) => 'Exam summary for $subject';
}
