// The explanation the demo's Mistake Repair gives for one mistake, written from that question's
// own key and book explanation, so every repairable demo mistake (a wrong answer in any demo
// paper, in any subject) has a real explanation and none falls back to a generic line.
// ignore_for_file: depend_on_referenced_packages
import 'package:mockmob/core/models/models.dart';

/// The `POST /api/recovery/repair` body for [questionId] of [paper] (an `explained` answer that
/// charges one explanation credit), or null when the paper has no such question.
RepairResponse? demoRepairResponse(AttemptDetail? paper, String questionId, {DateTime? at}) {
  final attempt = paper?.attempt;
  final q = attempt?.questions.where((x) => x.id == questionId).firstOrNull;
  if (attempt == null || q == null || q.options.isEmpty) return null;
  final chosen = attempt.detailFor(questionId)?.givenIndex;
  final key = q.correctIndex;
  if (key == null || key < 0 || key >= q.options.length) return null;
  final explanation = q.explanation;
  if (explanation == null || explanation.trim().isEmpty) return null;
  String option(int? i) => i == null || i < 0 || i >= q.options.length ? '' : q.options[i].text;
  return RepairResponse.fromJson({
    'status': 'explained',
    'repair': {
      'why_tempting': chosen == null ? 'It was left blank, which costs nothing but gains nothing.' : '“${option(chosen)}” belongs to the same chapter, so it sounds right when you are moving fast.',
      'why_wrong': 'The answer is “${option(key)}”${chosen == null ? '' : ', not “${option(chosen)}”'}.',
      'key_idea': explanation,
      'next_step': 'Before you choose, say the rule of ${q.chapter ?? 'this chapter'} in one line.',
      'generatedAt': (at ?? DateTime.now()).toUtc().toIso8601String(),
    },
    'charged': 1,
    'wallet': {'state': 'available', 'known': true, 'spendable': 8},
    'chosenIndex': chosen ?? -1,
    'keyIndex': key,
  });
}
