// The words of the Explore page (web: ExploreCovers.jsx and DiscoveryFeed.jsx, the phone band, rounds 2 to 4). Plain words,
// sentence case, no exclamation marks, no emoji, no arrows on keys; a time after a label is " · N min". The words of a cover live in
// cover_model.dart, Free's lines in data/learn_words.dart.
import '../data/learn_words.dart';
import 'cover_model.dart';

abstract final class ExploreCopy {
  /// The page's title (the way the website names this page).
  static const String title = 'Explore';

  /// The covers section's heading.
  static const String feedsHeading = 'Chapter feeds';
  static const String feedsNote = 'Key cards and questions, one at a time.';

  /// Free with 20 minutes picked: its sessions are composed as 10.
  static const String freeCapped = LearnFreeWords.capped;

  /// Free once today's one Learn session is used (R3 ruling F): "That was today's free session. Single questions stay free."
  static const String freeDone = '${LearnFreeWords.doneHeadline} Single questions stay free.';
  static const String seePro = LearnWords.seePro;

  static const String lengthLabel = 'Feed length in minutes';
  static const String subjectLabel = 'Subject';

  static const String loadFailed = 'Chapter feeds did not load.';
  static const String tryAgain = 'Try again';
  static String none(String subject) => 'No chapter feeds for $subject yet. The questions below still work.';
  static const String thisSubject = 'this subject';
  static const String loading = 'Loading chapter feeds';

  static const String previous = 'Previous chapter';
  static const String next = 'Next chapter';

  /// "3 of 14", under the row.
  static String pager(int at, int of) => '${CoverModel.grouped(at)} of ${CoverModel.grouped(of)}';

  /// The announcement after a length is picked.
  static String showing(int minutes) => 'Showing $minutes minute feeds.';

  /// A segment of the length control: "5 min", or just "5" where the row is narrow.
  static String length(int minutes, {required bool unit}) => unit ? '$minutes min' : '$minutes';

  /// The face of a cover whose first card is on Pro.
  static const String proCard = 'Opens with a Pro card';

  /// The section under the covers.
  static const String questionsHeading = 'Questions';
}
