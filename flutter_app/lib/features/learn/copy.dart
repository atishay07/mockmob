// Every user-facing string of the Learn feature (spec 5.9). Sentence case, no middle dots,
// no emoji, no appended arrows, no exclamation successes, 12-hour times.

import '../../core/api/api_error.dart';
import '../../core/copy/copy.dart';
import '../../core/models/study.dart';

abstract final class LearnCopy {
  // Screen.
  // The library keeps the name Learn (owner D20); "concept cards" are its recall cards.
  static const String title = 'Learn';
  static const String subtitle = 'Short lessons on the ideas behind your mistakes.';
  static const String back = 'Back';
  static const String lessonsHeading = 'Lessons';
  static const String nextLessonHeading = 'Next lesson';
  static const String nothingDue = 'Nothing is due right now.';
  static const String startReview = 'Review due cards';
  static const String startNewCards = 'Learn new cards';
  static const String newCardsPaused =
      'New cards are paused until your reviews are caught up.';
  static const String resumeHeading = 'Pick up where you left off';
  static const String resumeKey = 'Continue';
  static const String disabledTitle = 'Lessons are paused right now.';
  static const String disabledMessage = 'Practice and Your papers are still open.';
  static const String disabledAction = 'Open Practice';
  static const String loadFailedTitle = 'We could not load Learn';
  static const String loadFailedMessage =
      'Check your connection and try again.';
  static const String offlineTitle = 'You are offline';
  static const String offlineMessage =
      'Your lessons show here once they have loaded. Connect and try again.';
  static const String tryAgain = 'Try again';
  static const String closeRun = 'Close';
  static const String noLessonsTitle = 'No lessons yet';
  static const String noLessonsMessage =
      'New lessons will appear here when they are published.';
  static const String noLessonsMobi = 'Lessons are on the way.';
  static const String nothingDueMobi = 'A lesson is ready to read.';
  static const String howTitle = 'How Learn works';
  static const String howLine =
      'Learn a short lesson, lock it in with recall cards, then apply it in practice.';
  static const String untaughtHeading = 'Untaught chapters';
  static const String untaughtNote =
      'No lesson yet. Practise the questions while the lesson is written.';
  static const String practiseKey = 'Practise';
  static const String chapterSummariesHeading = 'Chapter summaries';
  static const String upNext = 'Up next';
  static const String readSummary = 'Read the chapter summary';

  // The library (LEARN-REVIEW-1017 5.9, P-LR6), in the website's words.
  static const String searchHint = 'Search chapters and lessons';
  static const String resultsHeading = 'Results';
  static const String nothingMatches = 'Nothing matches that. Try a chapter name or a topic.';
  static String resultsCount(int lessons, int chapters) => lessons == 0
      ? untaughtCount(chapters)
      : [
          lessonCount(lessons),
          if (chapters > 0) '${chapters == 1 ? '1 chapter' : '$chapters chapters'} without one',
        ].join(', ');

  /// The lesson page opened from a chapter that costs marks (5.10, `?from=chapter:`).
  static String fromChapter(int open) => open == 1 ? '1 open mistake in this chapter.' : '$open open mistakes in this chapter.';

  /// The lesson page opened from a question (5.10, `?from=q:`).
  static String fromQuestion(int n) => 'You are here from Question $n. This lesson covers the idea behind it.';
  static String backToQuestion(int n) => 'Back to Question $n';
  static String noLessonChapter(String subject) => '$subject. No lesson yet. Practise the chapter';
  static const String loseHeading = 'Where you lose marks';
  static const String loseNote = 'From your papers';
  static String allChapters(String subject) => 'All $subject chapters';
  static const String chaptersPreparing = 'Lessons are still being prepared';
  static const String subjectSwitch = 'Subject';
  static const String syllabusFoot =
      'Chapter list from the CUET UG 2026 syllabus; the 2027 syllabus is provisional until NTA publishes it.';
  static const String showChapter = 'Show the lessons';
  static const String hideChapter = 'Hide the lessons';
  static String reviseCards(int n) => n == 1 ? 'Revise 1 concept card' : 'Revise $n concept cards';
  /// About half a minute a card, ten at most a run, never under 2 minutes (the website's line).
  static String reviseCardsNote(int n) {
    final m = ((n < 10 ? n : 10) / 2).ceil();
    return 'From lessons you have read. About ${plural(m < 2 ? 2 : m, 'minute')}, free.';
  }
  static const String finishRevise = 'Finish your Revise session';
  static String finishReviseNote(int? step, int? total) =>
      step == null || total == null ? 'Everything before it is saved.' : 'You stopped at card $step of $total. Everything before it is saved.';
  static const String fullMockTitle = 'Test it in a full mock';
  static const String fullMockNote = 'Shows which chapters still cost marks. Access and cost are shown first.';
  static const String marksFailed = 'Your mistakes did not load, so lessons are not ordered by marks yet.';

  // Chapter reader.
  static const String summaryLabel = 'Chapter summary';
  static const String shareAsText = 'Share as text';
  static const String practiseChapter = 'Practise this chapter';
  static String summaryCount(int n) =>
      n == 1 ? 'From 1 published lesson.' : 'From $n published lessons.';
  static const String summaryEmptyTitle = 'No lessons in this chapter yet';
  static const String summaryEmptyMessage =
      'Its lessons show here once they are published.';
  static const String summaryOfflineTitle = 'This summary is not on this phone';
  static const String summaryOfflineMessage = 'Connect to read it.';
  static const String summaryFailedTitle = 'We could not open this summary';

  /// Says what failed when the phone is online: the server, the rate limit, the sign-in, or a
  /// reply the app could not read. Never blames the connection.
  static String summaryFailedMessage(ApiError? error) => switch (error?.kind) {
    ApiErrorKind.server || ApiErrorKind.unavailable =>
      'MockMob could not send it just now. Try again in a moment.',
    ApiErrorKind.rateLimited =>
      'Too many requests at once. Wait a minute, then try again.',
    ApiErrorKind.unauthorized =>
      'Your sign-in has ended. Sign in again to read it.',
    ApiErrorKind.forbidden => 'This summary is not part of your account.',
    _ => 'Something went wrong opening it. Try again.',
  };

  // The first load took too long: the skeleton gives way to this.
  static const String loadSlowTitle = 'Learn is taking too long';
  static const String loadSlowMessage =
      'MockMob has not answered yet. Try again.';

  static String dueSummary(int n) => '${plural(n, 'card')} due.';

  /// The headline of the card when nothing is due but new cards are ready: good news first.
  static String newReadyHeadline(int n) => '${plural(n, 'new card')} ready.';
  static const String newReadyFrom = 'From lessons you have read.';

  static String newReady(int n) =>
      '${plural(n, 'new card')} ${pluralWord(n, 'is', pluralForm: 'are')} ready from lessons you have read.';

  static String pendingOnPhone(int n) => n == 1
      ? '1 review is on this phone. Not sent yet.'
      : '$n reviews are on this phone. Not sent yet.';

  static String stepOf(int step, int total) => 'Step $step of $total';

  /// A lesson row's note about where it can be opened from.
  static const onThisPhone = 'On this phone';
  static const needsConnection = 'Needs connection';

  /// Mobi's line after a run of one card that was kept.
  static const thatOneStuck = 'That one stuck.';

  /// Mobi's line when many cards are waiting (above 20).
  static const aLotWaiting = 'A lot is waiting. Start with a few.';

  // Lesson status words. Never "mastered".
  static String statusWord(StudyUnitStatus status) => switch (status) {
    StudyUnitStatus.newUnit => 'New',
    StudyUnitStatus.inProgress || StudyUnitStatus.lockIn => 'In progress',
    StudyUnitStatus.due => 'Due',
    StudyUnitStatus.learned => 'Done for now',
    StudyUnitStatus.unknown => 'New',
  };

  static String minutes(int m) => 'about ${plural(m, 'minute')}';

  static String lessonCount(int n) => n == 1 ? '1 lesson' : '$n lessons';

  static String untaughtCount(int n) => n == 1
      ? '1 chapter without a lesson yet'
      : '$n chapters without a lesson yet';

  static const String showChapters = 'Show chapters';
  static const String hideChapters = 'Hide chapters';

  // Offline.
  static const String offlineHeading = 'On this phone';
  static const String keepForOffline = 'Keep for offline';
  static const String keepNothingYet = 'Nothing kept yet.';
  static const String packRemove = 'Remove';
  static const String packUndo = 'Undo';
  static const String packRemoved = 'Removed from this phone.';
  static String packRemoveLabel(String subject) => 'Remove kept lessons from this phone, $subject';
  static String keepSize(String size) => '$size kept on this phone';
  static const String connectToStart =
      'Connect to start. Your downloaded reviews still work.';

  // Start errors.
  static const String dailyNewLimit =
      "You have done today's new cards. Review is still open.";
  static const String lessonNotRead =
      'Finish the lesson first. Its cards open after that.';
  static const String startFailed = 'We could not start that. Try again.';
  static const String contentChangedOpening =
      'This lesson was updated. Opening the new version.';

  // Unit.
  static const String unitObjectives = 'What you will cover';
  static const String unitLesson = 'The lesson';
  static const String startLesson = 'Start lesson';
  static const String continueLesson = 'Continue lesson';
  static const String lessonAgain = 'Go through it again';
  static const String unitMissingTitle = 'This lesson is not available';
  static const String unitMissingMessage =
      'It may have been updated or withdrawn. Go back to Learn for the current list.';
  static const String unitOfflineTitle = 'This lesson is not on this phone';
  static const String unitOfflineMessage =
      'Connect to open it. Lessons you open can be kept for offline use.';
  static const String backToLearn = 'Back to Learn';

  static String reviewLessonCards(int n) =>
      'Review ${plural(n, 'card')} from this lesson';

  // Run.
  static const String reviewRunTitle = 'Review cards';
  static const String tapToReveal = 'Tap to show the answer';
  static const String showAnswer = 'Show the answer';
  static const String sendNow = 'Send now';
  static const String ratingOnPhone = 'Your rating is kept on this phone.';
  static const String answerOnPhone = 'Your answer is kept on this phone.';
  static const String progressOnPhone = 'Your place is kept on this phone.';
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

  /// The one short line under a miss, beside Mobi (the website's `NUDGE_LINES.miss`, kept equal by
  /// the shared copy test): it never says how close it was, only that the answer is there.
  static const String missNudge = 'Good to find out here. The answer is below.';

  /// The line under a skipped card (the website's `NUDGE_LINES.skipped`).
  static const String skippedNudge = 'That is fine. The answer is below.';
  static const String yourAnswer = 'Your answer';
  static const String correctAnswer = 'Correct answer';
  static const String theAnswer = 'Answer';
  static const String nextCard = 'Next card';
  static const String continueKey = 'Continue';
  static const String finishRun = 'Finish review';
  static const String finishLesson = 'Finish lesson';
  static const String reviewedOffline = 'Reviewed offline, sending when online';
  static const String connectToReveal = 'Connect to see the answer.';
  static const String connectToCheck = 'Connect to check your answer.';
  static const String sendFailed =
      'We could not send that just now. It is on this phone.';
  static const String sending = 'Sending';
  static const String leaveRun = 'Leave for now. Your place is kept.';
  static const String runUnavailableTitle = 'We could not open this review';
  static const String runUnavailableMessage =
      'It may have finished or been removed.';
  static const String runOfflineTitle = 'This review is not on this phone';
  static const String runOfflineMessage =
      'Connect to continue. Your place is kept.';
  static const String hintLabel = 'Hint';
  static const String memoryCue = 'Memory cue';
  static const String similarWord = 'Similar';
  static const String oppositeWord = 'Opposite';
  static const String objectiveLabel = 'Idea';
  static String objectiveNumber(int n) => 'Idea $n';
  static const String supersededElsewhere =
      'That step was already answered on another device. Here is where you are now.';
  static const String unknownStep =
      'This step needs a newer version of MockMob to open.';
  static const String skipStep = 'Skip this step';
  static const String skipNote =
      'Skipping moves on. Your other cards are not affected.';
  static const String stillActive =
      'You are part way through. Your place is kept.';

  static String position(String? mode, int number, int total) =>
      mode == 'learn' ? stepOf(number, total) : 'Card $number of $total';

  // Lesson block labels, by the server's block kind.
  static String? blockKindLabel(String? kind) => switch (kind) {
    'worked_example' => 'Worked example',
    'mistake' => 'Common mistake',
    'contrast' => 'Compare',
    'word_set' => 'The words',
    _ => null,
  };

  static String stepSemantics(int n, int total, String text) =>
      'Step $n of $total. $text';

  // Run ending (spec 5.9).
  static const String doneBack = 'Back to Learn';
  static const String doneFinish = 'Finish for now';
  static const String doneAgainHeading = 'Marked forgot or hard';
  static const String doneRetry = 'Send now';
  static const String doneSetAside =
      'You moved on to another lesson. Your earlier steps are kept.';
  static const String doneInvalidated = 'This lesson was updated.';
  static const String doneOpenNew = 'Open the new version';

  // The space inside the time is a no-break space so "6:12 PM" never splits across lines.
  static String _time(DateTime at) => formatTime12(at).replaceAll(' ', ' ');

  /// The title of a finished review, naming the lessons the cards came from when the run says.
  /// "Review finished. 8 cards from Goodwill on admission."
  static String recallFinished(int cards, {List<String> lessons = const []}) {
    final n = plural(cards, 'card');
    final named = lessons.where((l) => l.trim().isNotEmpty).toList();
    return switch (named.length) {
      0 => 'Review finished. $n reviewed.',
      1 => 'Review finished. $n from ${named[0]}.',
      2 => 'Review finished. $n from ${named[0]} and ${named[1]}.',
      _ => 'Review finished. $n from ${named.length} lessons.',
    };
  }

  /// "Lesson finished: Sacrificing and gaining ratios."
  static String lessonFinished(String? lesson) =>
      lesson == null || lesson.trim().isEmpty
      ? 'Lesson finished.'
      : 'Lesson finished: ${lesson.trim()}.';

  /// The receipt under a finished run, only from the server's own time: "Recorded at 6:12 PM."
  static String recordedAt(DateTime at) => 'Recorded at ${_time(at)}.';

  /// Mobi's line when most cards came back Forgot: it points at the list.
  static const String doneMostlyForgot = 'These are the ones to see again.';

  /// Under the first five Forgot or Hard cards: "and 3 more to see again".
  static String againMore(int n) => 'and $n more to see again';

  static const String openLesson = 'Open the lesson';

  static String stillDue(int n) =>
      n == 1 ? '1 card is still due.' : '$n cards are still due.';

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
    final words = id
        .split(RegExp(r'[-_ ]'))
        .where((w) => w.isNotEmpty)
        .toList();
    return [
      for (var i = 0; i < words.length; i++)
        i == 0 ? words[i][0].toUpperCase() + words[i].substring(1) : words[i],
    ].join(' ');
  }
}
