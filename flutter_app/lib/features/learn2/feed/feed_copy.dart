/// Every word the Explore feed says on the phone, as the web's `ChapterFeed.jsx` and `feedModel.mjs` say it (A1 3.12:
/// sentence case, no middle dots, no exclamation marks, nothing appended to a key's words).
library;

abstract final class FeedCopy {
  // ---------------------------------------------------------------- the stage
  static const String closeLabel = 'Close the feed';
  static const String starting = 'Starting the feed';
  static const String slow = 'Taking longer than usual.';
  static const String tryAgain = 'Try again';

  /// The stage's name for a screen reader.
  static String stageLabel(String title) => '${title.isEmpty ? 'Chapter' : title} feed';

  /// The track's name ("Admission of a Partner, 21 items").
  static String feedLabel(String title, int of) => '${title.isEmpty ? 'Chapter' : title}, $of items';

  /// The counter's spoken name.
  static String counterLabel(int position, int of) => '$position of $of. Open the list of this feed';

  /// The title's note on a picked-up feed.
  static String pickedUp(int at, int of) => 'Picked up at $at of $of';

  // ---------------------------------------------------------------- keys
  static const String turnOver = 'Turn over';
  static const String next = 'Next';
  static const String seeHow = 'See how it went';
  static const String keepGoing = 'Keep going';
  static const String endHere = 'End here';
  static const String keep = 'Keep';
  static const String kept = 'Kept';
  static const String inRevise = 'In Revise';
  static const String pro = 'Pro';
  static const String save = 'Save';
  static const String saved = 'Saved';
  static const String chapter = 'Chapter';
  static const String optionsBelow = 'Options below';

  // ---------------------------------------------------------------- pages
  static const String backFromEarlier = 'Back from earlier';
  static const String lineYouNeeded = 'The line you needed';
  static const String question = 'Question';
  static const String missedBefore = 'You missed this before';
  static const String oldMistake = 'An old mistake';
  static String questionOf(int n, int of) => 'Question $n of $of';
  static String cardLabel(int n, int of) => 'Card $n of $of';
  static String questionLabel(int n, int of) => 'Question $n of $of';
  static String checkpointLabel(int done, int of) => 'Checkpoint after $done of $of';
  static const String endLabel = 'How it went';
  static const String endSaid = 'The end of the feed';

  // ---------------------------------------------------------------- what the item says
  static const String keepProStamp = 'This card is on Pro.';
  static const String notKept = 'Not kept. Try again.';
  static const String couldNotKeep = 'Could not keep that card. Try again.';
  static const String savedSaid = 'Saved.';
  static const String saveOnPro = 'Saving more questions is on Pro.';
  static const String couldNotSave = 'Could not save that question. Try again.';
  static const String notSaved = 'That answer was not saved. Try again.';
  static const String closedLine = 'This feed is finished, so this one is not counted.';
  static const String questionChanged = 'This question changed a moment ago, so it is left out.';
  static const String questionHeld = 'This question is in an open Mob paper, so it is left out for now.';
  static const String freeDoneShort = 'Your free Learn session for today is done.';
  static const String cardSide = 'The card side.';
  static String ncertLine(String back) => "NCERT's line. $back";
  static String keptSaid(String line) => 'Kept. $line.';
  static String right(int streak) => streak >= 3 ? 'Right. $streak in a row.' : 'Right.';
  static String notQuite(String letter, String text, String line) => 'Not quite. The answer is $letter, $text.$line';
  static String lineSaid(String back) => ' The line you needed: $back';

  // ---------------------------------------------------------------- the stop sheet
  static String questionsRight(int right, int answered) => '$right of $answered ${answered == 1 ? 'question' : 'questions'} right.';
  static String mistakesFixed(int fixed, int mistakes) => '$fixed of $mistakes old ${mistakes == 1 ? 'mistake' : 'mistakes'} fixed.';
  static String keptInRevise(int kept) => '$kept kept in Revise.';

  // ---------------------------------------------------------------- the end
  static const String endTitleFallback = 'This feed';
  static const String nothingKept = 'Nothing kept this time. Keep a card and it comes back in Revise.';
  static const String endErrorTitle = 'Your feed is saved';
  static const String endErrorLine = 'Its summary did not load.';
  static const String backToExplore = 'Back to Explore';
  static const String startingAgain = 'Starting';
  static const String seePro = 'See Pro';

  // ---------------------------------------------------------------- states without items
  static const String errorTitle = 'The feed did not start';
  static const String errorLine = 'Check your connection and try again.';
  static const String notFoundTitle = 'This chapter is not in your book list';
  static const String notFoundLine = 'The link may be old. Your chapters are on Explore.';
  static const String emptyTitle = 'Nothing to play here yet';
  static const String emptyLine = "This chapter's cards and questions are still being checked.";
  static const String openChapter = 'Open the chapter';
  static const String freeTitle = "Today's free session is used";
  static const String freeLine = 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.';
  static String pickUp(int done, int of) => 'Pick up where you stopped, $done of $of';
  static String aboutMinutes(int minutes) => 'About $minutes min.';
}
