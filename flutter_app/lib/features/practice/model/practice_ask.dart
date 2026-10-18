import '../../../core/models/models.dart' show QuestionOption;
import '../../insights/data/ask_mobi_context.dart';
import 'practice_result_model.dart';

/// What "Ask Mobi about Q7" hands to the sheet for one wrong answer of a Quick, Smart or chapter set, the same
/// context the full result's answer rows hand it ([askContextOfAnswer]): the paper's own reference
/// (`<attemptId>:<questionId>`, so the server reads the question itself), the number, the chapter, what was picked
/// and, only where the key rule allows it ([keyView] ready), the key. Never a transcript.
AskMobiContext askContextOfSetAnswer(ResultQuestion q, KeyView keyView, {required String attemptId}) {
  final options = q.question?.options ?? const <QuestionOption>[];
  QuestionOption? at(int? i) => i == null || i < 0 || i >= options.length ? null : options[i];
  final pick = at(q.givenIndex);
  final key = keyView.state == KeyState.ready ? at(keyView.keyIndex) : null;
  return AskMobiContext.question(
    number: q.number,
    ref: '$attemptId:${q.qid}',
    stem: q.question?.question,
    chapter: q.chapter,
    pickLetter: pick?.key,
    pickText: pick?.text,
    keyLetter: key?.key,
    keyText: key?.text,
  );
}
