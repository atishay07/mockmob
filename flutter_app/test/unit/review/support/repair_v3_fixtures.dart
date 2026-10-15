import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/mistake_insights.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/review_providers.dart' show ConceptLink;

import '../../../golden/review/review_golden_support.dart';
import 'review_fixtures.dart';

/// Repair v3 fixtures (Mistake Repair v3, packet P3): a v3 body as the server sends it, the free
/// record lines of the result read, and the overrides that put them on the repair screen.

const Object _keep = Object();

/// A v3 repair body (CONTRACT C.1): every field, the two older aliases, the pattern and the
/// wallet. Question m7-q0 of Mock 7: the student chose A, the key is B.
Map<String, dynamic> v3Json({String status = 'explained', Map<String, dynamic>? repair, Object? pattern = _keep, int? charged = 1}) => {
  'status': status,
  'repair':
      repair ??
      {
        'version': 3,
        'trap_type': 'partly_true',
        'trap': 'A names the right total sacrifice.',
        'why_wrong': 'It takes the whole sacrifice from each partner.',
        'why_right': 'Each partner gives up 1/10, so the new ratio is 5:3:2.',
        'contrast': 'If C took 1/5 from A alone, A would fit. Here both give, so B.',
        'others': [
          {'index': 2, 'why': 'It hands C the wrong share.'},
          {'index': 3, 'why': 'It adds the shares instead of sharing the sacrifice.'},
        ],
        'rule': 'Split the sacrifice before you subtract.',
        'memory_hook': 'Sacrifice first, ratio second.',
        'another_way': 'Picture C paying each partner one tenth of the firm.',
        'why_tempting': 'A names the right total sacrifice.',
        'key_idea': 'Split the sacrifice before you subtract.',
        'model': 'gpt-6-luna',
        'generatedAt': '2026-10-15T09:12:03.000Z',
      },
  'pattern': identical(pattern, _keep)
      ? {
          'line': '2 of your 3 repaired mistakes in Partnership had the same trap: a partly true option.',
          'scope': 'chapter',
          'k': 2,
          'n': 3,
          'trapType': 'partly_true',
        }
      : pattern,
  'charged': charged,
  'wallet': {'total': 43, 'state': 'ok'},
  'chosenIndex': 0,
  'keyIndex': 1,
};

/// The v3 repair with only its required fields: no contrast, no other options, no hook, no second
/// explanation.
Map<String, dynamic> v3Bare() => {
  'version': 3,
  'trap_type': 'reversed',
  'trap': 'A turns the relation around.',
  'why_wrong': 'It says the sacrifice is given, not taken.',
  'why_right': 'B has the sacrifice taken from A and B in equal parts.',
  'rule': 'Say who gives and who takes before you work.',
};

OutcomeExplained v3Outcome(Map<String, dynamic> json, {bool reopened = false}) =>
    OutcomeExplained(RepairResponse.fromJson(json), ackedAt: DateTime.utc(2026, 10, 15, 9, 12), requestId: 'req-v3', reopened: reopened);

/// The free lines the result read gives for Mock 7's first mistake.
Map<String, MistakeInsights> v3Insights() => {
  'm7-q0': MistakeInsights.fromJson({
    'lines': [
      {'kind': 'change', 'text': 'You first chose B here, then changed to A.'},
      {'kind': 'time', 'text': '41s on this question. Your median in this paper was 55s over 48 timed questions.'},
      {'kind': 'chapter', 'text': 'Partnership so far: 7 right of 12 answered across 3 papers, this one included.'},
    ],
  }),
};

/// A repair API that fails the test if it is called: the second explanation is free and local.
class NoCallRepairApi implements RepairApi {
  int calls = 0;

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId}) async {
    calls++;
    throw StateError('the second explanation must not call the repair');
  }
}

/// The Review overrides with [outcome] on screen. [before] are the outcomes of the mistakes ahead
/// of it: a repair opened again only stays on screen inside a run that has repaired something.
List<Override> v3Overrides(
  OutcomeExplained outcome, {
  Map<String, MistakeInsights> insights = const {},
  RepairApi? api,
  List<MistakeOutcome?> before = const [],
  ConceptLink? concept,
}) => [
  // The shared fixtures read Mock 7 without any insights; this replaces just that one read.
  for (final o in reviewOverrides(records: [repairedRecord], run: runOf(outcomes: [...before, outcome], index: before.length), concept: concept))
    // ignore: unrelated_type_equality_checks
    if (o.origin != attemptDetailProvider('m7')) o,
  // The result read with its free record lines (`AttemptDetail.mistakeInsights`).
  attemptDetailProvider('m7').overrideWithBuild(
    (ref, n) => RemoteState(value: AttemptDetail(attempt: mock7, mistakeInsights: insights), fetchedAt: eveningUtc),
  ),
  ?(api == null ? null : repairApiProvider.overrideWithValue(api)),
];
