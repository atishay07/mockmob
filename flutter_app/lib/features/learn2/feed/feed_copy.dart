/// Every word the Explore feed says on the phone, as the web's `ChapterFeed.jsx` and `feedModel.mjs` say it (A1 3.12,
/// R3-SPEC ruling W: sentence case, no exclamation marks, nothing appended to a key's words; a label's length is the server's
/// " · N min"). The words shared with Learn home, the run and the ends are `LearnWords`.
library;

import '../data/learn_words.dart';

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

  /// The title's note on a feed that carries on from where it stopped.
  static String pickedUp(int at, int of) => 'Carrying on from $at of $of';

  // ---------------------------------------------------------------- keys
  static const String turnOver = 'Turn over';
  static const String next = 'Next';
  static const String seeHow = 'See how it went';
  static const String keepGoing = 'Keep going';
  static const String stopHere = 'Stop here';
  static const String reviseLater = 'Revise later';
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
  static const String openMistake = 'An open mistake';
  static String questionOf(int n, int of) => 'Question $n of $of';
  static String cardLabel(int n, int of) => 'Card $n of $of';
  static String questionLabel(int n, int of) => 'Question $n of $of';
  static String checkpointLabel(int done, int of) => 'Checkpoint after $done of $of';
  static const String endLabel = 'How it went';
  static const String endSaid = 'The end of the feed';

  // ---------------------------------------------------------------- what the item says
  static const String keepProStamp = 'This card is part of Pro.';
  static const String notAdded = 'Not added. Try again.';
  static const String couldNotAdd = "Couldn't add that card to Revise. Try again.";
  static const String savedSaid = 'Saved.';
  static const String saveOnPro = 'Saving more questions is part of Pro.';
  static const String couldNotSave = "Couldn't save that question. Try again.";
  static const String notSaved = "That answer wasn't saved. Try again.";
  static const String closedLine = "This feed has ended, so this answer wasn't counted.";
  static const String questionChanged = 'This question was just updated, so we skipped it.';
  static const String questionHeld = "This question is in a Mob paper that's still open, so we skipped it for now.";
  static const String freeDoneShort = LearnFreeWords.doneHeadline;
  static const String cardSide = 'The card side.';
  static String ncertLine(String back) => "NCERT's line. $back";
  static String keptSaid(String line) => 'In Revise. $line'.trim();
  static String right(int streak) => streak >= 3 ? 'Right. $streak in a row.' : 'Right.';
  static String notQuite(String letter, String text, String line) => 'Not quite. The answer is $letter, $text.$line';
  static String lineSaid(String back) => ' The line you needed: $back';

  // ---------------------------------------------------------------- the first visit's cue
  static const String cue = 'Swipe up for the next one';

  // ---------------------------------------------------------------- the end
  static const String endTitleFallback = 'This feed';
  static const String endErrorTitle = 'Your feed is saved';
  static const String endErrorLine = "The summary didn't load, but everything you did is saved.";
  static const String endErrorUnsavedLine = "The summary didn't load either. Everything else you did is kept.";
  static const String backToExplore = 'Back to Explore';
  static const String startingAgain = 'Starting';

  // ---------------------------------------------------------------- states without items
  static const String errorTitle = "The feed didn't start";
  static const String errorLine = 'Check your connection and try again.';
  static const String notFoundTitle = 'This chapter is not in your book list';
  static const String notFoundLine = 'The link may be old. Your chapters are on Explore.';
  static const String emptyTitle = 'Nothing here yet';
  static const String emptyLine = "This chapter's cards and questions are still being checked.";
  static const String openChapter = 'Open the chapter';
}
