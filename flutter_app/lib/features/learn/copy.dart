// Every user-facing string of the Learn feature (spec 5.9). Sentence case, no middle dots,
// no emoji, no appended arrows, no exclamation successes, 12-hour times.

import '../../core/copy/copy.dart';
import '../../core/models/study.dart';

abstract final class LearnCopy {
  // Tab.
  static const String title = 'Concepts';
  static const String subtitle = 'Short lessons and recall cards, from the chapters you practise.';
  static const String back = 'Back';
  static const String lessonsHeading = 'Lessons';
  static const String nextLessonHeading = 'Next lesson';
  static const String nothingDue = 'Nothing is due right now.';
  static const String startReview = 'Review due cards';
  static const String startNewCards = 'Learn new cards';
  static const String newCardsPaused = 'New cards are paused until your reviews are caught up.';
  static const String resumeHeading = 'Pick up where you left off';
  static const String resumeKey = 'Continue';
  static const String disabledTitle = 'Concepts are paused right now.';
  static const String disabledMessage = 'Practice and Review are still open.';
  static const String disabledAction = 'Open Practice';
  static const String loadFailedTitle = 'We could not load Concepts';
  static const String loadFailedMessage = 'Check your connection and try again.';
  static const String offlineTitle = 'You are offline';
  static const String offlineMessage = 'Your lessons show here once they have loaded. Connect and try again.';
  static const String tryAgain = 'Try again';
  static const String closeRun = 'Close';
  static const String noLessonsTitle = 'No lessons yet';
  static const String noLessonsMessage = 'New lessons will appear here when they are published.';

  static String dueSummary(int n) => '${plural(n, 'card')} due.';

  static String newReady(int n) => '${plural(n, 'new card')} ${pluralWord(n, 'is', pluralForm: 'are')} ready from lessons you have read.';

  static String pendingOnPhone(int n) =>
      n == 1 ? '1 review is on this phone. Not sent yet.' : '$n reviews are on this phone. Not sent yet.';

  static String stepOf(int step, int total) => 'Step $step of $total';

  // Lesson status words. Never "mastered".
  static String statusWord(StudyUnitStatus status) => switch (status) {
    StudyUnitStatus.newUnit => 'New',
    StudyUnitStatus.inProgress || StudyUnitStatus.lockIn => 'In progress',
    StudyUnitStatus.due => 'Due',
    StudyUnitStatus.learned => 'Done for now',
    StudyUnitStatus.unknown => 'New',
  };

  static String minutes(int m) => 'about ${plural(m, 'minute')}';

  // Offline.
  static const String offlineHeading = 'On this phone';
  static const String keepForOffline = 'Keep for offline';
  static const String keepNothingYet = 'Lessons you open are kept. Nothing kept yet.';
  static String keepSize(String size) => '$size kept on this phone';
  static const String connectToStart = 'Connect to start. Your downloaded reviews still work.';

  // Start errors.
  static const String dailyNewLimit = "You have done today's new cards. Review is still open.";
  static const String lessonNotRead = 'Finish the lesson first. Its cards open after that.';
  static const String startFailed = 'We could not start that. Try again.';
  static const String contentChangedOpening = 'This lesson was updated. Opening the new version.';

  // Unit.
  static const String unitObjectives = 'What you will cover';
  static const String unitLesson = 'The lesson';
  static const String startLesson = 'Start lesson';
  static const String continueLesson = 'Continue lesson';
  static const String lessonAgain = 'Go through it again';
  static const String unitMissingTitle = 'This lesson is not available';
  static const String unitMissingMessage = 'It may have been updated or withdrawn. Go back to Concepts for the current list.';
  static const String unitOfflineTitle = 'This lesson is not on this phone';
  static const String unitOfflineMessage = 'Connect to open it. Lessons you open can be kept for offline use.';
  static const String backToLearn = 'Back to Concepts';

  static String reviewLessonCards(int n) => 'Review ${plural(n, 'card')} from this lesson';

  // Run.
  static const String reviewRunTitle = 'Review cards';
  static const String tapToReveal = 'Tap to show the answer';
  static const String howWell = 'How well did you remember it?';
  static const String forgot = 'Forgot';
  static const String hard = 'Hard';
  static const String gotIt = 'Got it';
  static const String easy = 'Easy';
  static const String checkAnswer = 'Check answer';
  static const String dontKnow = 'I do not know';
  static const String showHint = 'Show a hint';
  static const String typeAnswer = 'Type your answer';
  static const String correct = 'Correct.';
  static const String notQuite = 'Not quite.';
  static const String skipped = 'Skipped.';
  static const String yourAnswer = 'Your answer';
  static const String correctAnswer = 'Correct answer';
  static const String theAnswer = 'Answer';
  static const String nextCard = 'Next card';
  static const String continueKey = 'Continue';
  static const String finishRun = 'Finish run';
  static const String finishLesson = 'Finish lesson';
  static const String reviewedOffline = 'Reviewed offline, sending when online';
  static const String connectToReveal = 'Connect to see the answer.';
  static const String connectToCheck = 'Connect to check your answer.';
  static const String sendFailed = 'We could not send that just now. It is on this phone.';
  static const String sending = 'Sending';
  static const String leaveRun = 'Leave run. Your place is kept.';
  static const String runUnavailableTitle = 'We could not open this run';
  static const String runUnavailableMessage = 'It may have finished or been removed.';
  static const String runOfflineTitle = 'This run is not on this phone';
  static const String runOfflineMessage = 'Connect to continue. Your place is kept.';
  static const String hintLabel = 'Hint';
  static const String memoryCue = 'Memory cue';
  static const String similarWord = 'Similar';
  static const String oppositeWord = 'Opposite';
  static const String objectiveLabel = 'Idea';

  static String position(String? mode, int number, int total) => mode == 'learn' ? stepOf(number, total) : 'Card $number of $total';

  // Lesson block labels, by the server's block kind.
  static String? blockKindLabel(String? kind) => switch (kind) {
    'worked_example' => 'Worked example',
    'mistake' => 'Common mistake',
    'contrast' => 'Compare',
    'word_set' => 'The words',
    _ => null,
  };

  static String stepSemantics(int n, int total, String text) => 'Step $n of $total. $text';

  // Run ending (spec 5.9).
  static const String doneBack = 'Back to Concepts';
  static const String doneFinish = 'Finish for now';
  static const String doneAgainHeading = 'Marked Forgot or Hard';
  static const String doneRetry = 'Send now';
  static const String doneSetAside = 'You moved on to another lesson. Your earlier steps are kept.';
  static const String doneInvalidated = 'This lesson was updated.';
  static const String doneOpenNew = 'Open the new version';

  // The space inside the time is a no-break space so "6:12 PM" never splits across lines.
  static String _time(DateTime at) => formatTime12(at).replaceAll(' ', ' ');

  static String recallFinished(int cards, DateTime? at) =>
      'Run finished. ${plural(cards, 'card')} reviewed.${at == null ? '' : ' Recorded at ${_time(at)}.'}';

  static String lessonFinished(DateTime? at) => 'Lesson finished.${at == null ? '' : ' Recorded at ${_time(at)}.'}';

  static String stillDue(int n) => n == 1 ? '1 card is still due.' : '$n cards are still due.';

  /// "4.2 MB", "310 KB", "0 KB".
  static String bytes(int n) {
    if (n >= 1024 * 1024) {
      final mb = n / (1024 * 1024);
      return '${mb.toStringAsFixed(mb >= 10 ? 0 : 1)} MB';
    }
    return '${(n / 1024).round()} KB';
  }

  /// Fallback subject label from an id such as "business-studies".
  static String subjectLabel(String id) {
    if (id.isEmpty) return id;
    final words = id.split(RegExp(r'[-_ ]')).where((w) => w.isNotEmpty).toList();
    return [for (var i = 0; i < words.length; i++) i == 0 ? words[i][0].toUpperCase() + words[i].substring(1) : words[i]].join(' ');
  }
}
