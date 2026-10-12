import '../models/attempt.dart';

/// A wrong answer that Mistake Repair may be offered for.
class RepairCandidate {
  const RepairCandidate({required this.questionId, required this.number, required this.chapter, this.givenIndex});

  final String questionId;

  /// 1-based position in the paper.
  final int number;
  final String chapter;

  /// The option the student chose.
  final int? givenIndex;
}

/// The mistakes of [attempt] that repair may offer (design spec 5.6).
///
/// Candidates are wrong answers only. Not attempted questions are never candidates: a blank
/// is a skipped question, not a conceptual error, and the client never sends one to repair.
/// Excluded:
/// - questions whose review state is `withdrawn`, `under_review`, `content_changed` or
///   `key_changed_unverified` ([reviews] is `AttemptDetail.answerReviews`, empty when unknown),
/// - questions already repaired on this phone ([repairedIds]),
/// - ids the server answered with `not_a_mistake` ([notAMistakeIds]), hidden quietly.
List<RepairCandidate> repairCandidates(
  Attempt attempt, {
  Map<String, AnswerReview> reviews = const {},
  Set<String> repairedIds = const {},
  Set<String> notAMistakeIds = const {},
}) {
  final out = <RepairCandidate>[];
  for (var i = 0; i < attempt.questions.length; i++) {
    final q = attempt.questions[i];
    final detail = attempt.detailFor(q.id);
    if (detail == null || detail.isCorrect != false) continue;
    if (reviews[q.id]?.isHeld ?? false) continue;
    if (repairedIds.contains(q.id) || notAMistakeIds.contains(q.id)) continue;
    out.add(RepairCandidate(questionId: q.id, number: i + 1, chapter: q.chapter ?? '', givenIndex: detail.givenIndex));
  }
  return out;
}

/// Minutes per mistake, a stated assumption pending a measured figure after the pilot.
const repairMinutesPerMistake = 3;

/// "About" N minutes for [mistakes]: 3 minutes each, rounded up to the nearest 5. Null for
/// none, so no time is shown with zero candidates. 3 mistakes gives 10.
int? repairMinutes(int mistakes) {
  if (mistakes <= 0) return null;
  final raw = mistakes * repairMinutesPerMistake;
  return ((raw + 4) ~/ 5) * 5;
}

/// A duration chip on the recap's last card and the Today card.
class RepairDurationOption {
  const RepairDurationOption({required this.minutes, required this.mistakes});

  final int minutes;

  /// How many mistakes that duration holds.
  final int mistakes;
}

const _optionTable = [
  RepairDurationOption(minutes: 5, mistakes: 2),
  RepairDurationOption(minutes: 10, mistakes: 3),
  RepairDurationOption(minutes: 20, mistakes: 6),
];

/// The 5, 10 and 20 minute chips for a repair, capped by the candidates: a chip that holds
/// more mistakes than exist is not shown, and with 2 or fewer candidates none are shown.
List<RepairDurationOption> repairDurationOptions(int candidateCount) {
  if (candidateCount <= 2) return const [];
  return [for (final o in _optionTable) if (o.mistakes <= candidateCount) o];
}

/// Explanation credits a repair of [mistakes] needs: one per mistake.
int repairCreditsNeeded(int mistakes) => mistakes < 0 ? 0 : mistakes;

/// The wallet cannot cover the task. Null when it can, or when the balance is unknown
/// (an unknown balance shows no line, and never counts as zero).
class RepairWalletShortfall {
  const RepairWalletShortfall({required this.needed, required this.balance});

  final int needed;
  final int balance;

  /// How many mistakes the balance can still cover.
  int get coveredMistakes => balance < 0 ? 0 : balance;
}

RepairWalletShortfall? repairWalletShortfall({required int mistakes, required int? balance}) {
  if (balance == null) return null;
  final needed = repairCreditsNeeded(mistakes);
  return balance >= needed ? null : RepairWalletShortfall(needed: needed, balance: balance);
}
