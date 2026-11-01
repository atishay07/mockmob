// The words of Learn home (APP-1101 section 5, H home; the web's learn2/home/*.jsx and homeModel.mjs). Plain words, sentence
// case, no exclamation marks, no middle dots and no arrows on keys, and never "mastered" or a mastery percentage. Words
// the rules of homeModel.mjs build (the sort names, the meta lines, the shelf tiles' spoken names) live in home_model.dart.

abstract final class HomeCopy {
  // ---- The subject row
  static const String subjectGroup = 'Subject';

  /// "9 due": the Key cards due today in that subject, under its name.
  static String subjectDue(int due) => '${_grouped(due)} due';

  // ---- The search field
  static const String searchClear = 'Clear the search';
  static const String searchCancel = 'Cancel';

  // ---- The shelf tiles
  static const String shelvesGroup = 'Your cards';
  static const String shelvesNothing = 'Nothing in Revise yet. Cards you study land here.';
  static const String shelvesFailed = 'Your cards did not load.';
  static const String tryAgain = 'Try again';

  // ---- Free's line, at the real limit only
  static const String seePro = 'See Pro';
  static const String dismiss = 'Dismiss';

  // ---- The suggestions
  static const String suggestionsGroup = 'Where to start';
  static String progressDone(int done, int of) => '$done of $of done';

  // ---- The chapter map
  static const String chapters = 'Chapters';
  static const String noChapters = 'No chapters here yet.';
  static const String sortTitle = 'Sort chapters';
  static const String sortLabel = 'Sort chapters, now ';
  static String allNew(int total) => total == 1 ? 'This chapter is new to you.' : 'All $total chapters are new to you.';
  static const String notStarted = 'Not started';

  // ---- The part switch (LK2)
  static const String partSaving = 'Saving your choice';
  static const String partFailed = 'Your choice was not saved. Try again.';
  static const String partChosen = 'Only your part’s chapters show here and in your practice.';
  static const String partNone = 'Both parts show until you choose.';

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

  /// 1234 as "1,234" (the Key cards due in a subject, as the web draws it).
  static String _grouped(int n) {
    final s = n.abs().toString();
    final out = StringBuffer(n < 0 ? '-' : '');
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) out.write(',');
      out.write(s[i]);
    }
    return out.toString();
  }
}
