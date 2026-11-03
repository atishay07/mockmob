import '../../../core/models/attempt.dart';
import '../../../core/models/question.dart';
import '../../../core/widgets/question_strip.dart' show QuestionCell;

enum Verdict { correct, wrong, blank }

/// One question of a finished practice, in the order it was asked.
class ResultQuestion {
  const ResultQuestion({required this.number, required this.qid, required this.verdict, this.question, this.givenIndex});

  /// 1-based, as the student saw it ("Question 3").
  final int number;
  final String qid;
  final Verdict verdict;

  /// The stored question with its options. Null when the snapshot does not hold it.
  final SnapshotQuestion? question;

  /// The option the student chose, or null when left blank.
  final int? givenIndex;

  String? get chapter => question?.chapter;

  QuestionCell get cell => switch (verdict) {
    Verdict.correct => QuestionCell.right,
    Verdict.wrong => QuestionCell.wrong,
    Verdict.blank => QuestionCell.blank,
  };
}

/// The practice result as the screen needs it, built only from the server's per-question
/// verdicts (`details`): correct, wrong and not attempted are three separate things and are
/// never merged (binding rule: wrong and not attempted stay separate).
class PracticeResultModel {
  const PracticeResultModel({required this.questions, required this.total});

  factory PracticeResultModel.from(Attempt attempt) {
    final byId = {for (final q in attempt.questions) q.id: q};
    final out = <ResultQuestion>[];
    for (var i = 0; i < attempt.details.length; i++) {
      final d = attempt.details[i];
      out.add(
        ResultQuestion(
          number: i + 1,
          qid: d.qid,
          verdict: d.isCorrect == true
              ? Verdict.correct
              : d.isCorrect == false
              ? Verdict.wrong
              : Verdict.blank,
          question: byId[d.qid],
          givenIndex: d.givenIndex,
        ),
      );
    }
    return PracticeResultModel(questions: out, total: attempt.total);
  }

  final List<ResultQuestion> questions;
  final int total;

  List<ResultQuestion> get wrong => [
    for (final q in questions)
      if (q.verdict == Verdict.wrong) q,
  ];
  List<ResultQuestion> get blank => [
    for (final q in questions)
      if (q.verdict == Verdict.blank) q,
  ];
  List<ResultQuestion> get correct => [
    for (final q in questions)
      if (q.verdict == Verdict.correct) q,
  ];

  List<QuestionCell> get cells => [for (final q in questions) q.cell];

  /// The questions can be listed. False when the attempt carries no per-question rows (only
  /// the counts are known), in which case the screen shows the figure and nothing else.
  bool get hasRows => questions.isNotEmpty;
}

/// The key rule of spec 5.7 for one practice question, derived from [AttemptDetail].
class KeyView {
  const KeyView({required this.state, this.keyIndex, this.explanation});

  /// `loading` until the result read arrives; `held` for any non-corrected review;
  /// `unavailable` when the whole result has no keys; otherwise `ready`.
  final KeyState state;
  final int? keyIndex;
  final String? explanation;

  static const loading = KeyView(state: KeyState.loading);

  factory KeyView.of(AttemptDetail? detail, String qid) {
    if (detail == null) return loading;
    if (detail.reviewsUnavailable) return const KeyView(state: KeyState.unavailable);
    final review = detail.answerReviews[qid];
    if (review != null && !review.isCorrected) return const KeyView(state: KeyState.held);
    return KeyView(state: KeyState.ready, keyIndex: detail.visibleKeyIndex(qid), explanation: detail.visibleExplanation(qid));
  }
}

enum KeyState { loading, ready, held, unavailable }
