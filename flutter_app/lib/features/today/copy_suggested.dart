// "Suggested for you" (D51, refined by SWIPE-V2-1018 for D90): the card deck under the lead card.
// Sentence case, no arrows, no middle dots, no exclamation marks; every count says what it counts.
// The two directions have one name each everywhere (the stamp, the button, the coach line and the
// screen reader): right is "Do this next", a verb that names the outcome (the card moves into the
// lead card; nothing starts, nothing is spent), and left is "Not now" (the card waits at the back;
// nothing is hidden for good). The result keeps the noun: the bar and the lead card's overline say
// "Up next", so a first-timer never reads the button as "show the next card" (round 1, item 4).
// Every line that teaches the right action says the verb and its outcome, the screen reader's own
// words ("Do this next. It moves into the card above."); "Up next" stays only where the result is
// shown: the bar, the lead card's overline and what a screen reader hears after it (round 2, item 3).
import '../../core/copy/sentences.dart';

abstract final class SuggestedCopy {
  static const String title = 'Suggested for you';

  /// The count over the deck on a first-run visit, before any card moved: "4 cards".
  static String countFirst(int n) => n == 1 ? '1 card' : '$n cards';

  /// The count over the stack: the cards still to come in this pass, out of the deck.
  static String moreAfter(int more, int of) => more <= 0 ? 'Last of $of' : '$more more after this';
  /// Over the end card: every card has been seen, and they are all still there (Not now says
  /// "It waits at the back", so the end never says they are gone).
  static const String noneLeft = 'All seen';

  /// First run only, under the heading: what the cards are.
  static const String intro = 'Here are more ways to win marks today, one card at a time.';

  // The coach line (first run).
  static const String coachIdle = 'Drag the card, or tap a button.';
  static const String coachRight = 'Right: do this next. It moves into the card above.';
  static const String coachLeft = 'Left: not now. It waits at the back.';
  static const String letGoRight = 'Let go: it moves into the card above';
  static const String letGoLeft = 'Let go: it waits at the back';
  static const String letGoLast = 'Let go: that was the last one';

  /// The first left swipe ever: where the card went, in whole sentences (19 Oct, G12: the old
  /// "At the back now." read as a clipped fragment). "Can": the passed cards come back with "Go
  /// through them again" once the others are seen.
  static const String learnedLeft = "It's at the back now. You can see it again after the others.";

  // The two directions and the way back.
  static const String upNext = 'Do this next';
  static const String notNow = 'Not now';
  static const String undo = 'Undo';
  static const String suggestedTag = 'Suggested';

  // The confirmation bar after Up next.
  static const String barLineFirst = "It's up next in the card above. Nothing starts until you tap Start.";
  static const String barLine = "It's up next in the card above.";

  // Fallbacks only: a card takes its move's own title, the words the lead card shows once it swaps.
  static const String titleWeakest = 'Practise your weakest chapter';
  static const String titleRevise = 'Revise what is due';
  static const String titleRepair = 'Repair a mistake';
  static const String titleMock = 'Sit a full mock';

  /// The full mock card's evidence line: what a timed paper gives that a short set does not.
  static const String mockLine = 'It is timed like the real exam, so you see how you do against the clock.';

  /// What a card costs and how long it is: "Accountancy, 10 questions", "Free, about 10 min".
  static String costQuestions(String subject, int questions) => '$subject, $questions questions';
  static String costMinutes(String subject, int minutes) => '$subject, ${_about(minutes)}';

  /// A repair's cost: it spends 1 AI credit a repair. Price then time, like the free card's "Free,
  /// about 10 min", on one line at 412 dp: "Accountancy, 1 AI credit each, about 15 min" wrapped and
  /// pushed the title a line down (W8). The subject's object in the card's corner names the subject,
  /// and the lead card's overline says it once the card is up next.
  static String costRepair(int minutes) => '1 credit each, ${_about(minutes)}';

  /// "about 15 min", held together on one line (no break before the number or the unit).
  static String _about(int minutes) => 'about $minutes min';
  static String costFree(int minutes) => 'Free, about $minutes min';
  static String costMock(String subject, int questions, int minutes) => '$subject, $questions questions, $minutes min';

  /// The one evidence line.
  static String weakestLine(String chapter, int missed, int asked, int marks) => 'You missed $missed of $asked in $chapter, and that cost you $marks marks.';

  /// A repair card's evidence line: how many mistakes the repair fixes, and why now (19 Oct, D114:
  /// the card used to repeat the lead card's source fragment). Null without a count.
  static String? repairLine(int? n) => n == null || n <= 0
      ? null
      : n == 1
          ? 'Fix this mistake now, before it costs you marks again.'
          : 'Fix these $n mistakes now, before they cost you marks again.';

  /// The lead card's own noun ("6 mistakes come back today"), so the move reads the same in both.
  static String reviseLine(int due) => due == 1 ? '1 mistake you repaired comes back today.' : '$due mistakes you repaired come back today.';

  // The end of the deck: it shows only once every card has been seen, and they all wait behind it
  // ("Go through them again" in the row brings them back). 19 Oct, G12: "You passed this one. It
  // waits here." and "Go through them again" over a single card read as bad English; the end now
  // says what is true in plain words, for one card, two, or more.
  static String allSeen(int n) => switch (n) {
        1 => 'That was the only card.',
        2 => "You've seen both cards.",
        _ => "You've seen all ${_word(n)}.",
      };
  static const String endOurPick = 'The card above is still our pick for you.';
  static const String endYourPick = 'Your pick is ready in the card above.';
  static const String again = 'Go through them again';

  /// "Go through them again" over one card: there is no "them".
  static const String againOne = 'See it again';
  static String againFor(int n) => n == 1 ? againOne : again;
  static const String everyWay = 'See every way to practise';

  // Screen readers: the row is the path, so each button says what it does.
  static String cardSemantics(int at, int of, String? cost, String title, String line, {required bool suggested}) =>
      joinSentences(['Card $at of $of', if (suggested) suggestedTag, title, cost, line]);
  static String notNowSemantics(String title) => 'Not now: $title. It waits at the back.';
  static String upNextSemantics(String title) => 'Do this next: $title. It moves into the card above. Nothing starts until you tap Start.';
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

/// The deck's cards for a student with no paper yet (19 Oct, G12): built from the subjects the
/// student picked, so a fresh account gets four or five real moves. Every card's first sentence is
/// its evidence line on the card; the rest shows on the lead card once it moves up.
abstract final class StarterCopy {
  static const String titleWeakest = 'Practise your weakest subject';
  static const String titleChapter = 'Practise one chapter';
  static const String titleNextChapter = 'Practise another chapter';
  static const String titleMob = 'Sit the same paper as your friends';
  static const String titleSubjects = 'Add your other subjects';
  static const String titleSubjectsNone = 'Add your subjects';

  /// The subject the student rated weakest in the setup.
  static String weakestWhy(String subject, int n) => 'You rated $subject your weakest subject, so it has the most marks waiting for you. $n questions show where it stands today.';

  /// Any other subject, before a paper exists.
  static String quickWhy(String subject, int n) => 'A quick $n in $subject shows where you stand in about $n minutes.';

  /// The language paper (English).
  static String languageWhy(String subject, int n) => 'Most DU courses count a language paper, and $subject is the usual one. $n questions keep it sharp.';

  /// The first chapter of a subject in MockMob's order, and the one after it.
  static String chapterWhy(String chapter, String subject, int n) => 'Start $subject with $chapter. $n questions on one chapter make an easy first step.';
  static String nextChapterWhy(String chapter, int n) => 'Try $chapter next. $n questions on one chapter keep the set short and focused.';

  /// The Mob (it opens the Mob page; nothing starts from the deck).
  static const String mobCost = '10 questions a week, with friends';
  static const String mobLine = 'Up to 5 of you get the same questions each week, free of credits.';
  static const String mobKey = 'Open the Mob';

  /// Fewer subjects than DU counts: the way to add them.
  static const String subjectsLine = 'Most DU courses count a language and three subjects. Add yours to practise them here.';
  static const String subjectsKey = 'Add subjects';

  static String numberOn(String chapter) => 'questions on\n$chapter';
  static String numberIn(String subject) => 'questions in\n$subject';
  static String summary(String what) => 'Practise $what';
  static String key(int n) => 'Start practice, $n min';
}
