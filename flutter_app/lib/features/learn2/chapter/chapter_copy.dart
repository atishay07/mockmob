/// Every word the chapter page draws that is not the server's (APP-1101 section 8: plain words, sentence case, no exclamation
/// marks, no emoji, no arrows on keys, 12-hour time, never "mastered"; a time after a label is " · N min", the web's ruling W).
/// The server's own lines (the pile minutes, the Free lines) are shown as it sends them. The words of the page's rules live with
/// them, in chapter_model.dart (the Start, Continue and recap keys, the place, the shelf lines).
library;

abstract final class ChapterCopy {
  /// The back key's word: where it goes.
  static const String back = 'Learn';
  static const String backLabel = 'Back to Learn';

  /// The back key's spoken name once the subject is known: it goes to that subject's Learn home.
  static String backTo(String subject) => 'Back to $subject';

  static const String lengthHead = 'How long have you got?';
  static const String lastPileIn = 'Keep at least one pile in.';
  static const String coach = 'Tap a pile to leave it out.';
  static const String listLabel = 'Lined up for this run';

  static String resumeHead(int done, int of) => 'You stopped at $done of $of today.';

  /// The spoken name of the Continue key: "Continue · 5 min, 6 of 16 done".
  static String resumeLabel(String key, int done, int of) => '$key, $done of $of done';

  /// The text key under an unfinished run's Continue: it opens the length picker for a new run.
  static const String freshKey = 'Start fresh instead';

  /// "First up": the first three real card fronts the run opens with.
  static const String firstUp = 'First up';

  /// A new length could not be lined up: the last numbers stay.
  static const String stale = 'We could not update this. The last lined-up run is shown.';
  static const String failed = 'We could not line this up.';
  static const String offline = 'You are offline. This chapter needs a connection to line up.';
  static const String tryAgain = 'Try again';
  static const String loading = 'Lining up this chapter';

  /// A chapter the book list does not hold (404).
  static const String missingTitle = 'Chapter';
  static const String missing = 'This chapter is not in your book list.';
  static const String backToLearn = 'Back to Learn';

  /// The quiet text key under Free's limit lines.
  static const String seePro = 'See Pro';

  /// The shelf's one row while the dry run failed: the cards still open.
  static const String shelfCardsFallback = 'Every card in this chapter, by section';
}
