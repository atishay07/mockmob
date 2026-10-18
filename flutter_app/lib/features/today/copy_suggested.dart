// "Suggested for you" (D51, refined by SWIPE-V2-1018 for D90): the card deck under the lead card.
// Sentence case, no arrows, no middle dots, no exclamation marks; every count says what it counts.
// The two directions have one name each everywhere (the stamp, the button, the coach line and the
// screen reader): right is "Up next" (the card moves into the lead card; nothing starts, nothing is
// spent) and left is "Not now" (the card waits at the back; nothing is hidden for good).
abstract final class SuggestedCopy {
  static const String title = 'Suggested for you';

  /// The count over the deck on a first-run visit, before any card moved: "4 cards".
  static String countFirst(int n) => n == 1 ? '1 card' : '$n cards';

  /// The count over the stack: the cards still to come in this pass, out of the deck.
  static String moreAfter(int more, int of) => more <= 0 ? 'Last of $of' : '$more more after this';
  static const String noneLeft = 'None left';

  /// First run only, under the heading: what the cards are.
  static const String intro = 'More ways to win back marks today, one card at a time.';

  // The coach line (first run).
  static const String coachIdle = 'Drag the card, or tap a button.';
  static const String coachRight = 'Right puts it up next, in the card above.';
  static const String coachLeft = 'Left is not now. It waits at the back.';
  static const String letGoRight = 'Let go: it goes up next';
  static const String letGoLeft = 'Let go: it waits at the back';
  static const String letGoLast = 'Let go: that was the last one';

  /// The first left swipe ever: where the card went and what the deck will do (DeckMemory).
  static const String learnedLeft = 'At the back now.\nCards you often pass on sit lower next time.';

  // The two directions and the way back.
  static const String upNext = 'Up next';
  static const String notNow = 'Not now';
  static const String undo = 'Undo';
  static const String suggestedTag = 'Suggested';

  // The confirmation bar after Up next.
  static const String barLineFirst = 'Up next, in the card above. Nothing starts until you tap Start.';
  static const String barLine = 'Up next, in the card above.';

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
  static String _about(int minutes) => 'about $minutes min';
  static String costFree(int minutes) => 'Free, about $minutes min';
  static String costMock(String subject, int questions, int minutes) => '$subject, $questions questions, $minutes min';

  /// The one evidence line.
  static String weakestLine(String chapter, int missed, int asked, int marks) => '$chapter: $missed of $asked missed, $marks marks open.';

  /// The lead card's own noun ("6 mistakes come back today"), so the move reads the same in both.
  static String reviseLine(int due) => due == 1 ? '1 mistake you repaired comes back today.' : '$due mistakes you repaired come back today.';

  // The end of the deck. "Today", never "tonight": the deck is passed on at any hour (W7).
  static String allSeen(int n) => n == 1 ? "That's the one for today" : "That's all ${_word(n)} for today";
  static const String endOurPick = 'The card above is still our pick for you.';
  static const String endYourPick = 'Your pick is ready in the card above.';
  static const String again = 'Go through them again';
  static const String everyWay = 'See every way to practise';

  // Screen readers: the row is the path, so each button says what it does.
  static String cardSemantics(int at, int of, String? cost, String title, String line, {required bool suggested}) =>
      'Card $at of $of. ${suggested ? '$suggestedTag. ' : ''}$title. ${cost == null ? '' : '$cost. '}$line';
  static String notNowSemantics(String title) => 'Not now: $title. It waits at the back.';
  static String upNextSemantics(String title) => 'Up next: $title. It moves into the card above. Nothing starts until you tap Start.';
  static String undoSemantics(String title) => 'Undo: brings back $title.';
  static const String undoNone = 'Undo, nothing to undo yet.';

  // What a screen reader hears after a commit.
  static String saidUpNext(String title) => '$title is up next, in the card above.';
  static String saidNotNow(String count) => 'Not now. $count.';

  static String _word(int n) => switch (n) {
        2 => 'two',
        3 => 'three',
        4 => 'four',
        5 => 'five',
        _ => '$n',
      };
}
