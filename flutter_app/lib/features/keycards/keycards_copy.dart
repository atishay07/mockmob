/// Every word of Key cards in the app (KEYCARDS-BUILD-SPEC sections 3 and 4, owner D200-D206). Plain, sentence
/// case, no exclamation marks, no emoji, no arrows on keys, no build talk, 12-hour clock. Never "mastered",
/// "mastery", a mastery percentage or "marks to recover".
library;

abstract final class KeyCardsCopy {
  static const String title = 'Key cards';

  /// The Learn door's row and Review's chapter link.
  static const String learnRowNote = "NCERT's own lines, chapter by chapter";
  static String learnRowDue(int due, int minutes) => '$due due today, about ${minutesWord(minutes)}';
  static String chapterLink(String chapter) => 'Key cards for $chapter';

  // Home.
  static String dueHead(int due) => due == 1 ? '1 card due today' : '$due cards due today';
  static const String nothingDue = 'Nothing due today';
  static String aboutMinutes(int minutes) => 'About ${minutesWord(minutes)}';
  static String minutesWord(int m) => m <= 1 ? '1 minute' : '$m minutes';
  static const String nothingDueNote = 'Add a chapter to Revise and its cards come back on a schedule.';
  static const String reviseNow = 'Revise now';
  static String newLeft(int n) => n == 1 ? '1 new card left today' : '$n new cards left today';
  static String reviewsLeft(int n) => n == 1 ? '1 review left today on Free' : '$n reviews left today on Free';
  static const String subjectSwitch = 'Subject';
  static String asOf(String time) => 'As of $time';
  static const String offlineCached = 'Offline. Showing what this phone kept.';
  static const String loading = 'Loading Key cards';
  static const String loadFailed = 'Key cards did not load';
  static const String loadFailedNote = 'Check your connection and try again.';
  static const String tryAgain = 'Try again';
  static const String off = 'Key cards are not open yet';
  static const String offNote = 'They will appear in Learn when they are ready.';
  static const String noSubjects = 'No cards for your subjects yet';
  static const String noSubjectsNote = 'Cards arrive chapter by chapter. Your subjects show here when theirs are ready.';
  static const String optionSaving = 'Saving';
  static const String optionFailed = 'Your choice was not saved. Try again.';
  static const String syllabusNote = 'Chapters in the CUET 2026 syllabus, in NCERT order.';

  /// "18 cards, 6 due" (the spec's row line, with a comma: no middle-dot strings, as on the website).
  static String cardsDue(int cards, int due) => '${cards == 1 ? '1 card' : '$cards cards'}, $due due';
  static String cardsOnly(int cards) => cards == 1 ? '1 card' : '$cards cards';

  /// Free: "5 of 38 open".
  static String openOf(int open, int total) => '$open of $total open';
  static const String noCardsYet = 'No cards yet';

  /// "Business Studies Part 1, Ch 1".
  static String ncertChapter(String book, int chapter) => '$book, Ch $chapter';

  /// "Business Studies Part 1, Ch 1, p. 3".
  static String reference(String book, int? chapter, int? page) =>
      [book, if (chapter != null) 'Ch $chapter', if (page != null) 'p. $page'].join(', ');

  /// Where an English card's words come from (it has no book), the website's own lines.
  static const String sourceWordNet = 'Meaning from WordNet';
  static const String sourceAuthored = 'Written for the MockMob English deck';

  // Chapter states (the Label column of the spec, exactly).
  static const String stateNone = 'Not started';
  static const String stateThin = 'Too few answers';
  static const String stateWeak = 'Needs work';
  static const String stateMid = 'Getting there';
  static const String stateStrong = 'Holding';
  /// Beside Holding when it is slipping (21 days untouched, or under half the added cards holding).
  static const String fadingWord = 'fading';
  static String stateText(String label, {required bool fading}) => fading ? '$label, $fadingWord' : label;

  // Deck.
  static const String read = 'Read';
  static const String study = 'Study';
  static const String lastLook = 'Last look';
  static const String modes = 'How to go through the cards';
  static const String addToRevise = 'Add chapter to Revise';
  static const String adding = 'Adding';
  static String added(int n) => n == 1 ? 'Added to Revise. 1 card.' : 'Added to Revise. $n cards.';
  static const String inRevise = 'In Revise';
  static const String addFailed = 'The chapter was not added. Try again.';
  static const String shareSheet = 'Share chapter sheet';
  static const String inShort = 'In short';
  static const String emptyChapter = 'No cards for this chapter yet';
  static const String emptyChapterNote = 'Cards are checked line by line against the NCERT book before they appear.';
  static String locked(int n) => n == 1 ? '1 more card in this chapter' : '$n more cards in this chapter';
  static const String proLine = 'Pro opens every card in every chapter and keeps them on a schedule.';
  static const String upgrade = 'Upgrade to Pro';
  static const String mustKnow = 'Must-know';
  static String asked(int n) => n == 1 ? 'Asked once in CUET' : 'Asked $n times in CUET';
  static const String moreActions = 'More for this card';
  static const String deckLoading = 'Loading the cards';

  // Study and Revise.
  static String position(int k, int n) => '$k of $n';
  static const String tapToReveal = 'Show the answer';
  static const String missed = 'Missed';
  static const String gotIt = 'Got it';
  static const String easy = 'Easy';
  static const String howDidItGo = 'How did it go';
  static const String nextCard = 'Next card';
  static const String finish = 'Finish';
  static const String savedOnPhone = 'Saved on this phone. It is sent when you are back online.';
  static const String notSaved = 'That card was not saved. Try again.';
  static String studyEnd({required int missed, required int gotIt, required int easy}) =>
      [if (gotIt > 0) '$gotIt got it', if (easy > 0) '$easy easy', if (missed > 0) '$missed missed'].join(', ');
  static const String studyDone = 'Chapter session done';
  static const String studyAgain = 'Go through again';
  static const String backToChapter = 'Back to the chapter';
  static const String studyNothing = 'No cards to study here yet.';
  static const String lastLookNote = 'Must-know cards only. Nothing is scheduled.';
  static const String lastLookDone = 'That was every Must-know card in this chapter.';
  static const String lastLookNone = 'This chapter has no Must-know cards open yet.';
  static const String reviewCapTitle = 'You have used today\'s 10 card reviews on Free';
  static const String reviewCapNote = 'The rest wait until tomorrow. $proLine';

  // Revise.
  static String mixKeyCards(int n) => n == 1 ? '1 Key card' : '$n Key cards';
  static const String kindKeyCard = 'A Key card';
  static String reviseEnd(int n) => '${reviseEndHead(n)}.';
  static String reviseEndHead(int n) => n == 1 ? '1 Key card reviewed' : '$n Key cards reviewed';
  static const String reviseCardsDone = 'Key cards done';
  static const String questionsWaitOffline = 'You are offline. Your questions come back here when you are online.';
  static const String questionsWaitServer = 'Your questions could not be read just now. The Key cards can.';

  // Report.
  static const String report = 'Report this card';
  static const String reportTitle = 'What is wrong with this card';
  static const List<String> reportReasons = [
    'The text does not match the NCERT book',
    'The answer is wrong or incomplete',
    'The question is unclear',
    'Something else',
  ];
  static const String reportSent = 'Reported. The card is checked before it comes back.';
  static const String reportWaiting = 'Saved on this phone. The report is sent when you are back online.';
  static const String reportFailed = 'The report did not go through. Try again.';
  static const String cancel = 'Cancel';

  // The line you needed.
  static const String lineTitle = 'The line you needed';
  static const String lineLinked = 'Linked to this question';
  static const String lineMatched = 'Matched by its words';
  static const String lineAdd = 'Add to Revise';
  static const String lineAdded = 'In Revise';
  static String lineLeft(int n) => n == 1 ? '1 more today on Free' : '$n more today on Free';

  // Kinds (KEYCARDS-CONTENT-SPEC section 2, the Label column exactly).
  static String kindLabel(String kind) => switch (kind) {
    'definition' => 'Definition',
    'term' => 'Term',
    'key_line' => 'Key line',
    'list' => 'List',
    'difference' => 'Difference',
    'steps' => 'Steps',
    'types' => 'Types',
    'formula' => 'Formula',
    'fact' => 'Fact',
    'example' => 'Example',
    'entry' => 'Entry',
    'quote' => 'Quote',
    'word' => 'Word',
    'idiom' => 'Idiom',
    'one_word' => 'One word',
    'usage' => 'Usage',
    'rule' => 'Rule',
    _ => 'Card',
  };
}
