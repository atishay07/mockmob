import '../../../core/copy/formatters.dart';
import 'review_again_data.dart';

/// Every line of Review again: the mistakes the student has already repaired, asked once more
/// with the key hidden, judged on the phone. Plain sentences, no middle dots, no exclamation marks.
abstract final class ReviewAgainCopy {
  /// The route Review again lives at. The Shell area registers it as a root page; the entry points
  /// push this path.
  static const path = '/review/again';

  static const title = 'Review again';

  /// The row's name while Revise has cards due today: it opens Revise, so it says so.
  static const reviseTitle = 'Revise';

  /// The quiet link under a repair's ending keys: this run's repaired mistakes, asked once more.
  static const reviewThese = 'Review these again';

  /// The row's note: how many repaired mistakes are waiting, and that the key stays hidden first.
  static String rowNote(int repaired) => '${plural(repaired, 'mistake')} you repaired, answered before the key shows.';

  /// When Revise has cards due, the same row names them.
  static String rowNoteDue(int due, int total) => '$due due today, $total in all';

  static String progress(int answered, int total) => '$answered of $total';
  static String progressSpoken(int answered, int total) => '$answered of $total answered';

  /// "Partnership: admission, Q11 in Mock 2".
  static String whereLine(String chapter, int number, String source) => '$chapter, Q$number in $source';
  static String repairedWhen(String when) => 'Repaired $when';

  static const check = 'Check';
  static const checkNeedsPick = 'Check, pick an option first';
  static const next = 'Next question';
  static const seeHow = 'See how it went';

  static const verdictRight = 'Right. This one held.';
  static String verdictWrong(String? keyLetter) => keyLetter == null ? 'Not yet.' : 'Not yet. The key is $keyLetter.';
  static const why = 'Why';
  static const repairItAgain = 'Repair it again';

  /// The end: "6 of 8", then the word under it.
  static const heldWord = 'held';
  static String endFigureSpoken(int held, int total) => '$held of $total held';
  static String comeBackFirst(int n) => n == 1 ? '1 comes back first next time.' : '$n come back first next time.';
  static const backToReview = 'Back to Review';
  static const anotherSet = 'Review again';

  /// The line over the figure. It never says "most" of a set that all held.
  static String endTitleFor(AgainTone tone, {required int held, required int total}) {
    if (total > 0 && held == total) return total == 1 ? 'It held.' : 'All of them held.';
    return switch (tone) {
      AgainTone.proud => 'Most of them held.',
      AgainTone.nod => 'Some held.',
      AgainTone.encourage => 'These need another look.',
    };
  }

  // ---- States ---------------------------------------------------------------------------------

  static const emptyTitle = 'Nothing to review again yet';
  static const emptyMessage = 'Repair a mistake and it comes back here.';
  static const emptyAction = 'See your mistakes';
  static const buildingLabel = 'Getting your questions ready';
  static String someNeedConnection(int ready) => 'Some questions need a connection. ${plural(ready, 'question')} ${ready == 1 ? 'is' : 'are'} ready.';
}
