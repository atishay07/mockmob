// "Suggested for you" (D51, TODAY-SWIPE-1018): the card stack under the lead card. Sentence case,
// no arrows, no middle dots, no exclamation marks; every count says what it counts. A right swipe
// only makes a card the lead: no line here promises that it starts anything.
abstract final class SuggestedCopy {
  static const String title = 'Suggested for you';

  /// The count over the stack: the cards still to come in this pass, out of the deck.
  static String moreAfter(int more, int of) => more <= 0 ? 'Last of $of' : '$more more after this';
  static const String noneLeft = 'None left';

  // A card.
  static const String skip = 'Skip';
  static const String doThis = 'Do this instead';
  static const String suggestedTag = 'Suggested';
  // Fallbacks only: a card takes its move's own title, the words the lead card shows once it swaps.
  static const String titleWeakest = 'Practise your weakest chapter';
  static const String titleRevise = 'Revise what is due';
  static const String titleRepair = 'Repair a mistake';
  static const String titleMock = 'A full mock';

  /// What a card costs and how long it is: "Accountancy, 10 questions", "Free, about 10 min".
  static String costQuestions(String subject, int questions) => '$subject, $questions questions';
  static String costMinutes(String subject, int minutes) => '$subject, ${_about(minutes)}';
  /// A repair's cost: it spends 1 AI credit a repair ("Accountancy, 1 AI credit each, about 15 min").
  static String costRepair(String? subject, int minutes) => subject == null ? '1 AI credit each, ${_about(minutes)}' : '$subject, 1 AI credit each, ${_about(minutes)}';

  /// "about 15 min", held together on one line (no break before the number or the unit).
  static String _about(int minutes) => 'about\u00A0$minutes\u00A0min';
  static String costFree(int minutes) => 'Free, about $minutes min';
  static String costMock(String subject, int questions, int minutes) => '$subject, $questions questions, $minutes min';

  /// The one evidence line.
  static String weakestLine(String chapter, int missed, int asked, int marks) => '$chapter: $missed of $asked missed, $marks marks open.';
  /// The lead card's own noun ("6 mistakes come back today"), so the move reads the same in both.
  static String reviseLine(int due) => due == 1 ? '1 mistake you repaired comes back today.' : '$due mistakes you repaired come back today.';

  // The gesture.
  static const String hint = 'Swipe right to do it instead, left to skip';
  static const String letGoRight = 'Let go: it moves into the card above, its key ready';
  static String letGoLeft(String next) => 'Let go: $next comes up next';

  /// The short forms, for a phone too narrow to hold the long ones on one line.
  static const String letGoRightShort = 'Let go: it moves into the card above';
  static const String letGoLeftShort = 'Let go: the next one comes up';
  static const String letGoLast = 'Let go: that was the last one';

  // The end of the deck.
  static String allSeen(int n) => n == 1 ? 'That was the one for tonight' : 'That was all ${_word(n)} for tonight';
  static const String again = 'Go through them again';
  static const String or = 'or';
  static const String everyWay = 'see every way to practise';
  static const String everyWaySemantics = 'See every way to practise';

  // Screen readers: the buttons are the path, so each says what it does.
  static String cardSemantics(int at, int of, String? cost, String title, String line, {required bool suggested}) =>
      '${suggested ? '$suggestedTag. ' : ''}$title. ${cost == null ? '' : '$cost. '}$line Card $at of $of.';
  static String skipSemantics(String title) => 'Skip $title. It goes to the back.';
  static String doThisSemantics(String title) => 'Do this instead: $title. It moves into the card above; its key starts it.';

  static String _word(int n) => switch (n) {
        2 => 'two',
        3 => 'three',
        4 => 'four',
        5 => 'five',
        _ => '$n',
      };
}
