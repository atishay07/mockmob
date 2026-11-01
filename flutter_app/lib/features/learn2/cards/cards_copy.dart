// Every word of the Cards view and Find (APP-1101 section 5, H home), as the website's learn2/cards writes them: plain, sentence
// case, no exclamation marks, no emoji, no middle dots, no arrows on keys, never "mastered". Words Key cards already has
// (Must-know, In Revise, In short, the Pro line) are used from KeyCardsCopy, so the two places never say them differently.
library;

import '../../keycards/keycards_copy.dart';
import 'cards_shared.dart';

abstract final class CardsCopy {
  // ---- The page ----
  static const String title = 'Key cards';
  static const String backFallback = 'Chapter';
  static const String loading = 'Loading the cards';
  static const String loadFailedTitle = 'The cards did not load';
  static const String loadFailedLine = 'Check your connection and try again.';
  static const String tryAgain = 'Try again';

  /// "Accountancy, Ch 1, 46 cards"; on Free "Accountancy, Ch 1, 5 of 46 cards open on Free".
  static String headLine({required String subject, String? ref, required int cards, int? of}) => [
    if (subject.isNotEmpty) subject,
    ?ref,
    if (of == null) CardsShared.countWord(cards, 'card') else '$cards of $of cards open on Free',
  ].join(', ');

  // ---- Filters ----
  static const String filtersLabel = 'Which cards';
  static const String filterAll = 'All';
  static const String filterMust = KeyCardsCopy.mustKnow;
  static const String filterRevise = KeyCardsCopy.inRevise;
  static const String filterMissed = 'Missed lately';

  /// Under a filter with nothing in it: [title] then [line].
  static const Map<String, ({String title, String line})> empty = {
    'must': (title: 'No Must-know cards in this chapter.', line: 'Every card here is a good one to know; none is marked Must-know yet.'),
    'revise': (title: 'No cards from this chapter are in Revise yet.', line: 'Rate a card in a run and it joins.'),
    'missed': (title: 'No missed cards in the last 14 days.', line: 'A card you miss in a run shows here until you get it right.'),
    'all': (title: 'No cards for this chapter yet.', line: 'Cards are written from the NCERT book and checked before they open here.'),
  };

  // ---- Tools ----
  static const String showAnswers = 'Show answers';
  static const String sections = 'Sections';
  static const String chapters = 'Chapters';
  static const String jumpSection = 'Jump to a section';
  static const String jumpChapter = 'Jump to a chapter';
  static const String pick = 'Pick';
  static const String pickDone = 'Done';
  static const String pickLabel = 'Pick cards';
  static const String pickDoneLabel = 'Done picking';

  // ---- Keys ----
  static String studyThese(int n) => 'Study these $n';
  static String studyFirst(int max) => 'Study the first $max, in book order';
  static String picked(int n) => '$n picked';
  static const String pickedLabel = 'Picked cards';
  static const String clear = 'Clear';
  static const String studyThisCard = 'Study this card';
  static const String report = 'Report';
  static const String seePro = 'See Pro';

  // ---- A row ----
  static const String show = 'Show';
  static const String hide = 'Hide';
  static String showLabel(String front) => 'Show the NCERT line: $front';
  static String hideLabel(String front) => 'Hide the NCERT line: $front';
  static String pickThis(String front) => 'Pick this card: $front';
  static const String missedLately = 'Missed lately';
  static const String mustKnow = KeyCardsCopy.mustKnow;
  static const String inRevise = KeyCardsCopy.inRevise;
  static const String inShort = KeyCardsCopy.inShort;
  static String sectionCount(int shown, int total) => total > shown ? '$shown of $total' : '$shown';

  // ---- Find ----
  static String resultsFor(String query) => 'Results for “$query”';
  static const String findHint = 'Type at least 2 letters to search.';
  static const String findLoading = 'Loading the cards';
  static const String findFailedTitle = 'Search did not load';
  static const String findFailedLine = 'Check your connection and try again.';
  static String noMatchTitle(String query) => 'Nothing matches “$query”.';
  static const String noMatchLine = 'Check the spelling, or try a term from the book.';
  static String over(int n, int max) => '$n cards match. Pick up to $max to study them, or add a word.';
  static String more(int n) => '${CardsShared.countWord(n, 'more card')} match. Add a word to narrow it.';
  static String lockedMatches(int n) => '$n more ${n == 1 ? 'card matches' : 'cards match'} in cards Pro opens. ${KeyCardsCopy.proLine}';
  static String showAll(int n, String noun) => 'Show all $n $noun';
  static const String chaptersGroup = 'Chapters';
  static const String lessonsGroup = 'Lessons';
  static const String lessonMeta = 'lesson';
  static String chapterMeta(int cards) => 'chapter, ${CardsShared.countWord(cards, 'card')}';
  static String inChapters(int n) => 'In ${CardsShared.countWord(n, 'chapter')}';
}
