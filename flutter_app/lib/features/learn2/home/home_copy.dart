// The words of Learn home (APP-1101 section 5, APP-1102-A section 3; the web's learn2/home/*.jsx and homeModel.mjs, rounds 2 to 4).
// Plain words, sentence case, no exclamation marks and no arrows on keys, and never "mastered" or a mastery percentage; a time after a
// label is " · N min" (the web's R3 ruling W), and a count that is 0 is never said. The words the server sends (the offer's headline,
// its keys, its Or rows) are drawn as they come; the words the rules of home_model.dart build (the meta lines, the option line, the
// Free line) live there.

abstract final class HomeCopy {
  // ---- The subject picker (phone, ruling R1)
  static const String pickerTitle = 'Choose a subject';
  static const String pickerClose = 'Close';
  static String pickerLabel(String name, {required bool many}) => many ? 'Subject: $name. Change subject' : 'Subject: $name';

  // ---- The search field
  static const String searchClear = 'Clear the search';
  static const String searchCancel = 'Cancel';

  // ---- The offer
  static const String orGroup = 'Or';
  static const String offerLoading = 'Loading your start';
  static String progressDone(int done, int of) => '$done of $of done';

  // ---- Find with nothing typed
  static const String findHeading = 'Your cards';
  static const String tryAWord = 'Try a word';

  // ---- Your roadmap
  static const String roadmap = 'Your roadmap';
  static const String noChapters = 'No chapters here yet.';
  static const String sortTitle = 'Sort chapters';
  static const String sortLabel = 'Sort chapters, now ';

  /// The pill on the chapter the student is in: a new student starts here, a returning one is up next.
  static const String hereNew = 'Start here';
  static const String hereNext = 'Up next';

  // ---- The part switch (LK2)
  static const String partSaving = 'Saving your choice';
  static const String partFailed = 'Your choice was not saved. Try again.';

  // ---- Free
  static const String seePro = 'See Pro';
  static const String tryAgain = 'Try again';

  // ---- Loading and failing
  static const String loading = 'Loading Learn';
  static const String errorTitle = 'Learn did not load';
  static const String errorLine = 'Check your connection and try again. Your cards and their schedule are safe.';

  // ---- An opened shelf set
  static const String setBack = 'Chapters';
  static const String setChips = 'Which set';
  static const String setDue = 'Due today';
  static const String setMissed = 'Missed lately';
  static const String setRevise = 'In Revise';
  static const String setMust = 'Must-know';
  static const String setLoading = 'Loading the cards';
  static const String setFailedTitle = 'The cards did not load';
  static const String setFailedLine = 'Check your connection and try again.';
  static String setKeyDue(int n) => 'Revise these $n';
  static String setKeyStudy(int n) => 'Study these $n';
  static String setOver(int n, int max) => '$n cards in this set. Open a chapter to study them, $max at a time.';
  static const Map<String, ({String title, String line})> setEmpty = {
    'due': (title: 'Nothing here now.', line: 'Cards you rate in a run come back here on the day they are due.'),
    'missed': (title: 'Nothing here now.', line: 'A card you miss in a run shows here until you get it right.'),
    'revise': (title: 'Nothing here now.', line: 'Rate a card in a run and it joins Revise.'),
    'must': (title: 'Nothing here now.', line: 'No Must-know cards are open in this subject yet.'),
  };
  static String setChapterCount(int cards) => cards == 1 ? '1 card' : '$cards cards';
}
