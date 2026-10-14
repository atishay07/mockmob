import '../models/attempt.dart';
import 'marks.dart';

/// The marking schemes whose cost of one wrong answer is known exactly. Anything else is unknown
/// and no marks line is shown (a port of `marksAtStake()` in the website's
/// `data/repair_presentation.mjs`, so both surfaces say the same sentence).
enum MarkingScheme { cuet }

/// What one wrong answer cost in its session, from the marking scheme alone: free, past tense,
/// and never a forecast.
class MarksAtStake {
  const MarksAtStake({required this.notEarned, required this.penalty});

  /// The marks a right answer would have earned.
  final int notEarned;

  /// The marks taken off for the wrong answer.
  final int penalty;

  int get total => notEarned + penalty;

  /// "This answer cost 6 marks in this session: 5 not earned and 1 penalty."
  String get line => penalty > 0
      ? 'This answer cost $total marks in this session: $notEarned not earned and $penalty penalty.'
      : 'This answer cost $total marks in this session: $notEarned not earned.';
}

/// The cost of one wrong answer under [scheme], or null when the scheme is unknown.
MarksAtStake? marksAtStake(MarkingScheme? scheme) => switch (scheme) {
  MarkingScheme.cuet => const MarksAtStake(notEarned: marksPerCorrect, penalty: marksPenaltyPerWrong),
  null => null,
};

/// The scheme [attempt] was marked under, or null when it cannot be told. Every paper the app
/// scores with a known mode (full, NTA-style, quick and smart practice) is marked +5 and -1.
MarkingScheme? markingSchemeOf(Attempt? attempt) {
  final mode = attempt?.mode;
  return switch (mode) {
    'full' || 'nta' || 'quick' || 'smart' => MarkingScheme.cuet,
    _ => null,
  };
}
