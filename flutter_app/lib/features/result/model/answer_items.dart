import '../../../core/models/models.dart';

enum Verdict { correct, wrong, blank, held }

/// One question of the full result, with what the key rule of spec 5.7 allows to be shown.
class AnswerItem {
  const AnswerItem({
    required this.number,
    required this.question,
    required this.verdict,
    this.given,
    this.keyIndex,
    this.explanation,
    this.changed = false,
    this.repaired = false,
    this.repairable = false,
  });

  /// 1-based paper position.
  final int number;
  final SnapshotQuestion question;
  final Verdict verdict;

  /// The option the student chose.
  final int? given;

  /// The correct option, only when it may be shown (no review, or a corrected one).
  final int? keyIndex;
  final String? explanation;

  /// The answer was changed during the mock (self-reported timing only).
  final bool changed;
  final bool repaired;

  /// A wrong answer that Mistake Repair can take.
  final bool repairable;

  String get qid => question.id;
}

/// The answers grouped in Lab order: wrong first (they lead with Mistake Repair), then the ones
/// being checked, then not attempted (no repair key), then correct.
class AnswerGroups {
  const AnswerGroups({required this.wrong, required this.held, required this.blank, required this.correct});

  final List<AnswerItem> wrong;
  final List<AnswerItem> held;
  final List<AnswerItem> blank;
  final List<AnswerItem> correct;

  List<AnswerItem> get all => [...wrong, ...held, ...blank, ...correct];
}

/// Builds the groups. [detail] is null when only the cached attempt is known: then no key and no
/// explanation is shown, because the review state is unknown.
AnswerGroups buildAnswerGroups(
  Attempt attempt, {
  AttemptDetail? detail,
  Set<String> repairedIds = const {},
  Set<String> candidateIds = const {},
}) {
  final changes = attempt.selectionMeta.recovery?.isUsable == true
      ? attempt.selectionMeta.recovery!.answerChangeQids.toSet()
      : const <String>{};
  final wrong = <AnswerItem>[], held = <AnswerItem>[], blank = <AnswerItem>[], correct = <AnswerItem>[];
  for (var i = 0; i < attempt.questions.length; i++) {
    final q = attempt.questions[i];
    final d = attempt.detailFor(q.id);
    final isHeld = detail?.answerReviews[q.id]?.isHeld ?? false;
    final verdict = isHeld
        ? Verdict.held
        : d?.isCorrect == true
        ? Verdict.correct
        : d?.isCorrect == false
        ? Verdict.wrong
        : Verdict.blank;
    final item = AnswerItem(
      number: i + 1,
      question: q,
      verdict: verdict,
      given: d?.givenIndex,
      keyIndex: detail?.visibleKeyIndex(q.id),
      explanation: detail?.visibleExplanation(q.id),
      changed: changes.contains(q.id),
      repaired: repairedIds.contains(q.id),
      repairable: candidateIds.contains(q.id),
    );
    switch (verdict) {
      case Verdict.wrong:
        wrong.add(item);
      case Verdict.held:
        held.add(item);
      case Verdict.blank:
        blank.add(item);
      case Verdict.correct:
        correct.add(item);
    }
  }
  return AnswerGroups(wrong: wrong, held: held, blank: blank, correct: correct);
}
