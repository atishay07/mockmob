/// Every word the Learn run says on the phone, as the web's `RunPlayer.jsx`, `RunParts.jsx`, `RunEnd.jsx` and `runView.mjs`
/// say it (A4 3.6, R3 ruling W: sentence case, no exclamation marks, nothing appended to a key's words, never "mastered"; a
/// label's length is the server's " · N min"). The words shared with Learn home and the ends are `LearnWords`.
library;

import '../data/learn_words.dart';

abstract final class RunCopy {
  // ---------------------------------------------------------------- the stage
  static const String closeLabel = 'Close';
  static const String loadingLabel = 'Getting your session ready';

  /// The stage's name for a screen reader ("Admission of a Partner session").
  static String stageLabel(String title) => '${title.isEmpty ? 'Chapter' : title} session';

  /// The count in the top bar, as a screen reader says it.
  static String reviseLabel(int count) => '$count ${count == 1 ? 'card' : 'cards'} in Revise';

  /// "3 of 21", spoken.
  static String counterLabel(int position, int of) => '$position of $of';

  // ---------------------------------------------------------------- keys
  static const String turnOver = 'Turn over';
  static const String missed = LearnWords.missedIt;
  static const String gotIt = 'Got it';
  static const String easy = 'Easy';
  static const String ratingGroup = 'How well did you know it?';
  static const String next = 'Next';
  static const String seeHow = 'See how it went';
  static const String previous = 'Previous';
  static const String finish = 'Finish';
  static const String skip = 'Skip';
  static const String skipIt = 'Skip it';
  static const String readLesson = 'Read the lesson';
  static const String save = 'Save';
  static const String saved = 'Saved';
  static const String pro = 'Pro';
  static const String saveLabel = 'Save this question';
  static const String savedLabel = 'Saved';
  static const String proSaveLabel = 'Save, part of Pro';
  static const String seePro = 'See Pro';
  static const String tryAgain = 'Try again';
  static const String backToChapter = 'Back to the chapter';
  static const String backToLearn = 'Back to Learn';
  static const String nextRound = 'Next round';
  static const String finishHere = 'Finish here';
  static const String quickRecapAgain = 'Quick recap again';
  static String studyThese(int n) => 'Study these $n';

  // ---------------------------------------------------------------- the card and the question
  static const String question = 'Question';
  static const String missedBefore = 'You missed this';
  static String lessonKind(int? minutes) => minutes != null && minutes > 0 ? 'Lesson, $minutes min' : 'Lesson';
  static const String lessonFallbackTitle = 'This chapter’s lesson';
  static const String lessonLine = 'Read this first. Its cards come next.';
  static const String lineYouNeeded = ' The line you needed is shown below.';

  /// The old mistake's head: its own label, else "You missed this in Mock 3 on 16 Oct".
  static String mistakeHead({String? label, String? where, String? when}) => label != null && label.isNotEmpty
      ? label
      : '$missedBefore${where != null && where.isNotEmpty ? ' in $where' : ''}${when != null && when.isNotEmpty ? ' on $when' : ''}';

  // ---------------------------------------------------------------- what the status line says
  static const String coachFront = 'Tap the card to turn it over';
  static const String coachRate = LearnWords.coachRatings;
  static const String coachPick = 'Pick the answer you think is right.';
  static const String coachRecap = "Answers are shown. This won't change when your cards come back.";
  static const String ratingNotSaved = "That rating wasn't saved. Try again.";
  static const String answerNotSaved = "That answer wasn't saved. Try again.";
  static const String questionNotSaved = "That question wasn't saved. Try again.";
  static const String questionChanged = 'This question was just updated, so we skipped it.';
  static const String questionHeld = "This question is in a Mob paper that's still open, so we skipped it for now.";

  // ---------------------------------------------------------------- the round, the recap's end
  static const String roundTitle = 'cards rated';
  static String roundLine(int left) => '$left more to go.';
  static const String recapDone = 'Quick recap done';
  static String recapAll(int n) => 'That was all $n Must-know ${n == 1 ? 'line' : 'lines'}';

  // ---------------------------------------------------------------- states without items
  static const String errorTitle = "This session didn't start";
  static const String errorLine = 'Nothing was lost. Check your connection and try again.';
  static const String notFoundTitle = 'This chapter is not in your book list.';
  static const String emptyTitle = 'Nothing here yet';
  static const String emptyLine = 'This chapter has no cards or questions for this session.';

  // ---------------------------------------------------------------- the end
  static const String endErrorTitle = 'Your session is saved';
  static const String endErrorLine = "The summary didn't load, but every rating and answer is saved.";
  static String levelSub(int right, int of) => 'Your weakest part: $right of $of right';
  static const String endSaid = 'How it went';
}
