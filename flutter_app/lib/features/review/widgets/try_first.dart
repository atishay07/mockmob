import '../../../core/models/question.dart';
import '../again/review_again_copy.dart';

/// The judgement a try-first surface makes, in one place: the answer sheet behind "Try it again",
/// Review again and the repair's try step all say how a try went in the same words, and all judge
/// against the same key. Nothing here is sent anywhere or recorded.
class TryFirst {
  const TryFirst._();

  /// Whether the pick [picked] is the key [keyIndex]. Null when there is no pick or no key yet.
  static bool? isRight(int? picked, int? keyIndex) {
    if (picked == null || keyIndex == null) return null;
    return picked == keyIndex;
  }

  /// The line over the revealed answer: "Right. This one held." or "Not yet. The key is C.".
  /// Null while there is nothing to judge (no pick, or the key is not on the phone).
  static String? verdictLine(int? picked, int? keyIndex, List<QuestionOption> options) {
    final right = isRight(picked, keyIndex);
    if (right == null || keyIndex! >= options.length) return null;
    return right ? ReviewAgainCopy.verdictRight : ReviewAgainCopy.verdictWrong(options[keyIndex].key);
  }
}
