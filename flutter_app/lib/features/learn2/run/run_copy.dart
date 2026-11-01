/// Every word the Learn run says on the phone, as the web's `RunPlayer.jsx`, `RunParts.jsx`, `RunEnd.jsx` and `runView.mjs`
/// say it (A4 3.6: sentence case, no middle dots, no exclamation marks, nothing appended to a key's words, never
/// "mastered").
library;

abstract final class RunCopy {
  // ---------------------------------------------------------------- the stage
  static const String closeLabel = 'Close';
  static const String loadingLabel = 'Lining up your run';

  /// The stage's name for a screen reader ("Admission of a Partner run").
  static String stageLabel(String title) => '${title.isEmpty ? 'Chapter' : title} run';

  /// The count in the top bar, as a screen reader says it.
  static String reviseLabel(int count) => 'In Revise $count';

  /// "3 of 21", spoken.
  static String counterLabel(int position, int of) => '$position of $of';

  // ---------------------------------------------------------------- keys
  static const String showAnswer = 'Show answer';
  static const String missed = 'Missed';
  static const String gotIt = 'Got it';
  static const String easy = 'Easy';
  static const String ratingGroup = 'How well did you recall it?';
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
  static const String lessonLine = 'Read this first. Its cards come next in this run.';
  static const String lineYouNeeded = ' The line you needed is shown below.';

  /// The old mistake's head: its own label, else "You missed this in Mock 3 on 16 Oct".
  static String mistakeHead({String? label, String? where, String? when}) => label != null && label.isNotEmpty
      ? label
      : '$missedBefore${where != null && where.isNotEmpty ? ' in $where' : ''}${when != null && when.isNotEmpty ? ' on $when' : ''}';

  // ---------------------------------------------------------------- what the status line says
  static const String coachFront = 'Say the answer in your head, then show it.';
  static const String coachRate = 'Got it sends the card to Revise. It comes back when it is due.';
  static const String coachPick = 'Tap the answer you think is right.';
  static const String coachRecap = 'Answers are showing. Nothing is scheduled.';
  static const String ratingNotSaved = 'That rating was not saved. Try again.';
  static const String answerNotSaved = 'That answer was not saved. Try again.';
  static const String questionNotSaved = 'That question was not saved. Try again.';
  static const String questionChanged = 'This question was updated, so it was skipped.';
  static const String questionHeld = 'This question is in a paper that is still open, so it was skipped.';

  // ---------------------------------------------------------------- the round, the recap's end
  static const String roundTitle = 'cards rated';
  static String roundLine(int left) => '$left more ${left == 1 ? 'is' : 'are'} lined up.';
  static const String recapLead = 'Quick recap of';
  static const String thisChapter = 'this chapter';
  static String recapAll(int n) => 'That was all $n Must-know ${n == 1 ? 'line' : 'lines'}.';
  static const String recapNothing = 'Nothing was scheduled.';
  static const String mustKnow = 'Must-know';
  static const String revise = 'Revise';

  // ---------------------------------------------------------------- the stop sheet
  static String questionsRight(int right, int asked) => '$right of $asked ${asked == 1 ? 'question' : 'questions'} right.';
  static String sentToRevise(int n) => '$n sent to Revise.';

  // ---------------------------------------------------------------- states without items
  static const String errorTitle = 'This run did not start';
  static const String errorLine = 'Nothing was lost. Check your connection and try again.';
  static const String notFoundTitle = 'This chapter is not in your book list.';
  static const String emptyTitle = 'Nothing to line up here yet';
  static const String emptyLine = 'This chapter has no cards or questions for this run.';
  static const String freeTitle = "Today's free session is used";
  static const String freeLine = 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.';
  static String pickUp(int done, int of) => 'Pick up where you stopped, $done of $of';

  // ---------------------------------------------------------------- the end
  static const String endErrorTitle = 'Your run is saved';
  static const String endErrorLine = 'Its summary did not load. Every rating and answer is already in.';
  static const String nothingSent = 'No cards went to Revise this time.';
  static String inRevise(int n) => '$n in Revise';
  static String reviseLabelOf(int n) => '$n in Revise from this run';
  static String levelLine(String title, int right, int of) => 'Your lowest score was in $title: $right of $of right.';
  static String movedLabel(String from, String to) => 'This chapter moved from $from to $to.';
  static String movedWas(String from) => 'was $from';
  static const String endSaid = 'How it went';
}
