// The result's next-move rules read plain rows (next_move.dart); this file turns the app's records into them, so the
// practice result and the full mock result feed the rules the same way.
import '../../../core/models/models.dart' show Attempt, AttemptDetail, RepairOrder;
import 'next_move.dart';

/// The paper's rows in paper order, from the attempt's own answers: the question order of the snapshot when the
/// attempt carries one (a mock), else the order of its answers (a practice set).
MoveAnalysis moveAnalysisOf(Attempt attempt) {
  final byId = {for (final q in attempt.questions) q.id: q};
  final rows = <MoveRow>[];
  if (attempt.questions.isNotEmpty) {
    for (var i = 0; i < attempt.questions.length; i++) {
      final q = attempt.questions[i];
      final d = attempt.detailFor(q.id);
      rows.add(MoveRow(qid: q.id, number: i + 1, chapter: q.chapter, verdict: _verdict(d?.isCorrect), givenIndex: d?.givenIndex));
    }
  } else {
    for (var i = 0; i < attempt.details.length; i++) {
      final d = attempt.details[i];
      rows.add(MoveRow(qid: d.qid, number: i + 1, chapter: byId[d.qid]?.chapter, verdict: _verdict(d.isCorrect), givenIndex: d.givenIndex));
    }
  }
  return MoveAnalysis(rows);
}

RowVerdict _verdict(bool? isCorrect) => isCorrect == true
    ? RowVerdict.correct
    : isCorrect == false
    ? RowVerdict.wrong
    : RowVerdict.skipped;

/// Answer keys under re-check or corrected, by question id (`answerReviews[qid].state`).
Map<String, String> moveReviewsOf(AttemptDetail? detail) => {
  if (detail != null)
    for (final e in detail.answerReviews.entries) e.key: e.value.state,
};

/// The server's repair order, as the rules read it. Null when the server sent none.
MoveOrder? moveOrderOf(RepairOrder? order) {
  if (order == null) return null;
  return MoveOrder(
    cohort: order.isCohort,
    items: [for (final i in order.items) MoveOrderItem(qid: i.qid, reason: i.reason, line: i.line)],
  );
}

/// Time on the paper, summed from the time recorded on every answer. Null when any answer has no time, so the receipt
/// never shows a part-count as the whole.
Duration? timeOnPaper(Attempt attempt) {
  if (attempt.details.isEmpty) return null;
  var ms = 0;
  for (final d in attempt.details) {
    final t = d.timeMs;
    if (t == null || t < 0) return null;
    ms += t;
  }
  return ms == 0 ? null : Duration(milliseconds: ms);
}

const _heldStates = {'withdrawn', 'under_review', 'content_changed', 'key_changed_unverified'};

/// The one notice line under the costliest line (RESULT-1017 4.2): a key under re-check first, else a corrected key.
/// Null when every key stands. [numberOf] gives a question's 1-based number on this paper.
String? keyNotice(Map<String, String> reviews, int? Function(String qid) numberOf) {
  List<int> numbers(bool Function(String state) test) => [
    for (final e in reviews.entries)
      if (test(e.value)) ?numberOf(e.key),
  ]..sort();
  final held = numbers(_heldStates.contains);
  if (held.length == 1) return "Q${held.first}'s answer key is being re-checked. It is left out of repairs until the check ends.";
  if (held.length > 1) {
    return '${held.length} answer keys are being re-checked (${held.map((n) => 'Q$n').join(', ')}). They are left out of repairs until the checks end.';
  }
  final corrected = numbers((s) => s == 'corrected');
  if (corrected.length == 1) return 'We corrected the answer key for Q${corrected.first}. Your marks follow the corrected key.';
  if (corrected.length > 1) return 'We corrected ${corrected.length} answer keys (${corrected.map((n) => 'Q$n').join(', ')}). Your marks follow the corrected keys.';
  return null;
}

/// True when the key of [qid] is under re-check (no marks either way, no repair, no charge).
bool keyHeld(Map<String, String> reviews, String qid) => _heldStates.contains(reviews[qid]);

/// The option letter of [index] ("A" for 0), or null.
String? letterOf(int? index) => index == null || index < 0 || index > 7 ? null : String.fromCharCode(65 + index);
