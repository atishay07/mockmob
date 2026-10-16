import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/review/data/repair_check_api.dart';

/// The website's check contract, copied byte for byte from
/// `data/tests/fixtures/repair4/contract_check_v1.json` (branch web/repair4-1016).
Map<String, dynamic> contract() => jsonDecode(File('test/fixtures/repair4/contract_check_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// The `check` examples of the repair response (`ready`, `none`, `answered`, `unchecked`).
Map<String, dynamic> examples() => ((contract()['repairResponseGains'] as Map)['examples'] as Map).cast<String, dynamic>();

/// A well-formed check question with four options (the contract's example abbreviates them).
Map<String, dynamic> checkJson({String basis = 'topic', String id = 'q_fresh_1'}) {
  final c = ((contract()['get'] as Map)['ready'] as Map)['body'] as Map;
  final check = Map<String, dynamic>.from(c['check'] as Map);
  check['basis'] = basis;
  check['checkQuestionId'] = id;
  check['question'] = 'On the admission of a new partner, goodwill is brought in by the new partner. Which entry records it?';
  check['options'] = [
    for (var i = 0; i < 4; i++) {'index': i, 'text': const ['Debit Cash, credit Goodwill', 'Debit Goodwill, credit the sacrificing partners', 'Debit Premium, credit Capital', 'Debit Revaluation, credit Goodwill'][i]},
  ];
  return check;
}

/// The marked answer: [pick] is the position the student saw, the key is option B (index 1).
Map<String, dynamic> resultJson({bool right = false, int pick = 2, Map<String, dynamic>? revise, bool noRevise = false, String? explanation, String? ruleLine}) {
  final base = (((contract()['post'] as Map)['ok'] as Map)['body'] as Map)['result'] as Map;
  final r = Map<String, dynamic>.from(base);
  final q = checkJson();
  final texts = [for (final o in q['options'] as List) (o as Map)['text'] as String];
  final chosen = right ? 1 : pick;
  r['right'] = right;
  r['pick'] = chosen;
  r['key'] = {'index': 1, 'text': texts[1]};
  r['picked'] = {'index': chosen, 'text': texts[chosen]};
  r['line'] = right
      ? 'Right on a new question from the same topic. One question is a check, not a measure.'
      : 'Missed on a new question from the same topic.';
  r['explanation'] = explanation ?? 'Goodwill brought in by the new partner is credited to the sacrificing partners in their sacrificing ratio.';
  r['ruleLine'] = ruleLine ?? 'Split the sacrifice before you subtract.';
  r['options'] = [
    for (var i = 0; i < 4; i++) {'index': i, 'text': texts[i], 'isKey': i == 1, 'isPick': i == chosen},
  ];
  if (noRevise) {
    r.remove('revise');
  } else {
    r['revise'] = revise ?? {'scheduled': true, 'nextAt': '2026-10-12T18:30:00.000Z', 'dueDay': '2026-10-13', 'whenLabel': 'tomorrow', 'cards': right ? 1 : 2};
  }
  return r;
}

CheckLoad readyLoad({String basis = 'topic', String id = 'q_fresh_1'}) => CheckLoad.tryParse({'ok': true, 'status': 'ready', 'charged': 0, 'check': checkJson(basis: basis, id: id)})!;

CheckAnswer answer({bool right = false, int pick = 2, bool replayed = false, bool noRevise = false}) => CheckAnswer(result: CheckResult.tryParse(resultJson(right: right, pick: pick, noRevise: noRevise))!, replayed: replayed);

/// What one submit looked like.
class Submitted {
  const Submitted({required this.attemptId, required this.questionId, required this.checkQuestionId, required this.pick, required this.requestId});

  final String attemptId;
  final String questionId;
  final String checkQuestionId;
  final int pick;
  final String requestId;
}

/// A check API the test drives: [onLoad] and [onSubmit] answer (or throw, or wait) call by call.
class FakeCheckApi implements RepairCheckApi {
  FakeCheckApi({FutureOr<CheckLoad> Function(int call)? onLoad, FutureOr<CheckAnswer> Function(int call, Submitted s)? onSubmit})
      : onLoad = onLoad ?? ((_) => readyLoad()),
        onSubmit = onSubmit ?? ((_, _) => answer());

  final FutureOr<CheckLoad> Function(int call) onLoad;
  final FutureOr<CheckAnswer> Function(int call, Submitted s) onSubmit;
  int loads = 0;
  final List<Submitted> submits = [];

  @override
  Future<CheckLoad> load({required String attemptId, required String questionId}) async => onLoad(loads++);

  @override
  Future<CheckAnswer> submit({
    required String attemptId,
    required String questionId,
    required String checkQuestionId,
    required int pick,
    required String requestId,
  }) async {
    final s = Submitted(attemptId: attemptId, questionId: questionId, checkQuestionId: checkQuestionId, pick: pick, requestId: requestId);
    submits.add(s);
    return onSubmit(submits.length - 1, s);
  }
}
