// One student record for the whole device demo, so every screen tells the same story: Today's
// Mock 7 is the paper the reveal opens (115 of 250), Review lists that paper's mistakes, the
// milestone shelf matches seven mocks and no repair yet, and a practice result is marked from
// the answers actually given in the runner.
import 'package:mockmob/core/models/models.dart';

import '../unit/result/support/fixtures.dart' as result;
import '../unit/today/support/today_fixtures.dart' as today;

/// Mock 7 in the demo is the result fixture's paper, under the id the result screens use.
const String demoMockId = 'a7';

/// The demo's attempts, newest first: Mock 7 (the reveal's paper, two days ago), then Asha's
/// earlier record from the Today fixtures.
List<Attempt> demoAttempts(DateTime nowUtc) {
  final mock7 = demoMockDetail(nowUtc).attempt;
  return [mock7, ...today.ashaRecord(nowUtc).where((a) => a.id != 'm7')];
}

/// The detail behind Mock 7, with the same completion time as in [demoAttempts].
AttemptDetail demoMockDetail(DateTime nowUtc) =>
    result.detail(attemptBody: result.attemptJson(id: demoMockId, completedAt: today.daysBefore(nowUtc, 2)));

/// What the server would say for this record: a first full mock long ago, a week that met its
/// goal, and no repair yet (Review has none recorded).
List<RhythmMilestone> demoMilestones(List<Attempt> attempts) {
  final mocks = [for (final a in attempts) if (a.isMock) a]..sort((a, b) => a.completedAt.compareTo(b.completedAt));
  return [
    if (mocks.isNotEmpty) RhythmMilestone(id: 'first_full_mock', achievedAt: mocks.first.completedAt),
    const RhythmMilestone(id: 'first_repair'),
    RhythmMilestone(id: 'first_week_met', achievedAt: mocks.length > 2 ? mocks[2].completedAt : null),
  ];
}

/// The right option of each question in the runner's accountancy pool (5:3:2; Rs 45,000; new
/// ratio minus old ratio), cycling as the pool does.
const List<int> _poolKeys = [0, 0, 1];

int demoCorrectIndex(int questionIndex) => _poolKeys[questionIndex % _poolKeys.length];

/// The practice attempt as the server would mark it from [answers] (question id to option
/// index): same questions, same order, same counts as the submit page.
AttemptDetail practiceDetailFrom(List<SessionQuestion> questions, Map<String, int> answers, DateTime completedAt, {String id = 'demo-practice'}) {
  var correct = 0, wrong = 0, blank = 0;
  final details = <Map<String, dynamic>>[];
  for (var i = 0; i < questions.length; i++) {
    final q = questions[i];
    final given = answers[q.id];
    final right = demoCorrectIndex(i);
    if (given == null) {
      blank++;
    } else if (given == right) {
      correct++;
    } else {
      wrong++;
    }
    details.add({'qid': q.id, 'givenIndex': given, 'isCorrect': given == null ? null : given == right});
  }
  return AttemptDetail.fromJson({
    'id': id,
    'userId': 'u1',
    'subject': 'accountancy',
    'score': correct * 5 - wrong,
    'correct': correct,
    'wrong': wrong,
    'unattempted': blank,
    'total': questions.length,
    'details': details,
    'questionsSnapshot': [
      for (var i = 0; i < questions.length; i++)
        {
          'id': questions[i].id,
          'subject': questions[i].subject,
          'chapter': questions[i].chapter,
          'question': questions[i].question,
          'options': [for (final o in questions[i].options) o.text],
          'correctIndex': demoCorrectIndex(i),
          'explanation': 'Work it from the definition, one line at a time.',
        },
    ],
    'selectionMeta': {'mode': 'quick', 'scoringVersion': 'server_practice_v1'},
    'completedAt': completedAt.toUtc().toIso8601String(),
    'answerReviews': <String, dynamic>{},
    'answerReviewState': 'ready',
  });
}
