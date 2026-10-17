import '../../../core/models/models.dart' show QuestionOption;
import '../../insights/data/ask_mobi_context.dart';
import 'answer_items.dart';

/// What "Ask Mobi about Q7" hands to the sheet for one answer of a result: the paper's own
/// reference (`<attemptId>:<questionId>`, so the server reads the question itself), the number, the
/// chapter, what was picked and, only where the key rule allows it, the key. Never a transcript.
AskMobiContext askContextOfAnswer(AnswerItem item, {required String attemptId}) {
  final options = item.question.options;
  QuestionOption? at(int? i) => i == null || i < 0 || i >= options.length ? null : options[i];
  final pick = at(item.given);
  // [AnswerItem.keyIndex] is already null while the key may not be shown.
  final key = at(item.keyIndex);
  return AskMobiContext.question(
    number: item.number,
    ref: '$attemptId:${item.qid}',
    stem: item.question.question,
    chapter: item.question.chapter,
    pickLetter: pick?.key,
    pickText: pick?.text,
    keyLetter: key?.key,
    keyText: key?.text,
  );
}
