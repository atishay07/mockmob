import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/model/recap_model.dart';

/// A question's outcome in a fixture.
enum V { right, wrong, blank }

const _pool = [
  (
    'A and B share profits in the ratio 3 : 2. C is admitted for a 1/5 share, which he takes equally from A and B. What is the new profit-sharing ratio?',
    ['11 : 7 : 5', '12 : 8 : 5', '2 : 1 : 1', '3 : 2 : 1'],
    0,
  ),
  (
    'On the admission of a partner, the balance in the Workmen Compensation Reserve in excess of the claim is credited to:',
    ['Revaluation Account', "Old partners' capital accounts", 'Realisation Account', "New partner's capital account"],
    1,
  ),
  (
    'Goodwill is valued at two years\' purchase of the average profit of the last three years. Profits were 40,000, 50,000 and 60,000. Goodwill is:',
    ['50,000', '1,00,000', '1,50,000', '1,20,000'],
    1,
  ),
  (
    'Interest on drawings is charged on the drawings of a partner when:',
    ['The partnership deed says so', 'Always', 'Never', 'Only on a loss'],
    0,
  ),
];

/// One question of a fixture attempt, with its chapter and outcome.
Map<String, dynamic> _question(int i, String chapter) {
  final q = _pool[i % _pool.length];
  return {
    'id': 'q${i + 1}',
    'subject': 'accountancy',
    'chapter': chapter,
    'question': q.$1,
    'options': q.$2,
    'correctIndex': q.$3,
    'explanation': 'The sacrifice is shared equally, so each old share falls by 1/10.',
  };
}

/// The spec fixture: 50 questions, 26 correct, 15 wrong, 9 not attempted (115 of 250). The
/// leading chapter, admission of a partner, has 9 questions: 3 correct, 4 wrong, 2 blank.
List<(String, V)> specPaper() {
  final out = <(String, V)>[];
  void add(String chapter, int right, int wrong, int blank) {
    final vs = [...List.filled(right, V.right), ...List.filled(wrong, V.wrong), ...List.filled(blank, V.blank)];
    // Interleave so the sheet looks like a real paper, not blocks.
    for (final v in vs) {
      out.add((chapter, v));
    }
  }

  add('Admission of a partner', 3, 4, 2); // 9 q, lost 34
  add('Goodwill: nature and valuation', 6, 3, 1); // 10 q, lost 23
  add('Retirement and death of a partner', 5, 3, 2); // 10 q, lost 28
  add('Partnership fundamentals', 6, 2, 2); // 10 q, lost 22
  add('Financial statement analysis', 6, 3, 2); // 11 q, lost 28
  // Shuffle deterministically.
  final shuffled = <(String, V)>[];
  for (var k = 0; k < 7; k++) {
    for (var i = k; i < out.length; i += 7) {
      shuffled.add(out[i]);
    }
  }
  return shuffled;
}

Map<String, dynamic> attemptJson({
  String id = 'a7',
  String subject = 'accountancy',
  String mode = 'full',
  DateTime? completedAt,
  List<(String, V)>? paper,
  int duration = 60,
  List<String> changed = const [],
}) {
  final qs = paper ?? specPaper();
  final questions = [for (var i = 0; i < qs.length; i++) _question(i, qs[i].$1)];
  final details = [
    for (var i = 0; i < qs.length; i++)
      {
        'qid': 'q${i + 1}',
        'givenIndex': switch (qs[i].$2) {
          V.right => _pool[i % _pool.length].$3,
          V.wrong => (_pool[i % _pool.length].$3 + 1) % 4,
          V.blank => null,
        },
        'isCorrect': switch (qs[i].$2) {
          V.right => true,
          V.wrong => false,
          V.blank => null,
        },
      },
  ];
  return {
    'id': id,
    'userId': 'u1',
    'subject': subject,
    'score': 0,
    'correct': qs.where((q) => q.$2 == V.right).length,
    'wrong': qs.where((q) => q.$2 == V.wrong).length,
    'unattempted': qs.where((q) => q.$2 == V.blank).length,
    'total': qs.length,
    'details': details,
    'questionsSnapshot': questions,
    'selectionMeta': {
      'mode': mode,
      'durationMinutes': duration,
      'scoringVersion': 'server_snapshot_v1',
      'recovery': {
        'telemetry': 'self_reported',
        'observed': {
          'answerChanges': [
            for (final c in changed) {'qid': c},
          ],
        },
      },
    },
    'completedAt': (completedAt ?? DateTime.utc(2026, 10, 12, 17, 12)).toIso8601String(),
  };
}

Attempt attempt({
  String id = 'a7',
  String mode = 'full',
  DateTime? completedAt,
  List<(String, V)>? paper,
  String subject = 'accountancy',
}) => Attempt.fromJson(attemptJson(id: id, mode: mode, completedAt: completedAt, paper: paper, subject: subject));

AttemptDetail detail({
  Map<String, dynamic>? attemptBody,
  Map<String, Map<String, dynamic>> reviews = const {},
  String state = 'ready',
  Map<String, dynamic>? recap,
}) => AttemptDetail.fromJson({...(attemptBody ?? attemptJson()), 'answerReviews': reviews, 'answerReviewState': state, 'recap': ?recap});

/// Six earlier full mocks in accountancy (so this is Mock 7), two of them this month.
List<Attempt> history({int count = 6}) => [
  for (var i = 0; i < count; i++)
    attempt(
      id: 'p$i',
      completedAt: DateTime.utc(2026, i < count - 2 ? 9 : 10, 2 + i * 2, 15),
      paper: [for (var k = 0; k < 10; k++) ('Goodwill: nature and valuation', k.isEven ? V.right : V.wrong)],
    ),
];

/// The standard Mock 7 model, with overrides for the variants.
RecapModel mock7({
  AttemptDetail? withDetail,
  List<Attempt>? attempts,
  int? credits = 12,
  List<RhythmMilestone> milestones = const [],
  Set<String> repaired = const {},
}) {
  final d = withDetail ?? detail();
  final list = attempts ?? [...history(), d.attempt];
  return buildRecapModel(
    attempt: d.attempt,
    detail: d,
    attempts: list,
    creditBalance: credits,
    receivedAt: DateTime.utc(2026, 10, 12, 17, 14),
    milestones: milestones,
    repairedIds: repaired,
  );
}
