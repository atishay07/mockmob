// The device demo is how the owner sees the signed-in app before a real sign-in, so its numbers
// must agree from screen to screen (integrity review, round 1, item 10).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/rhythm/logic/tokens.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';

import '../../device_demo/demo_record.dart';
import '../runner/support/fake_session.dart' as runner;
import '../today/support/today_fixtures.dart';

void main() {
  final now = tuesdayEvening;
  final attempts = demoAttempts(now);
  final detail = demoMockDetail(now);
  final recap = buildRecapModel(attempt: detail.attempt, detail: detail, attempts: attempts, milestones: demoMilestones(attempts));

  test("Today's Mock 7 is the paper the reveal opens, with the same marks", () {
    final view = buildToday(ashaInputs(attempts: attempts));
    final row = view.sheet.firstWhere((r) => r.attemptId == demoMockId);
    expect(row.label, 'Mock 7');
    expect(row.marks, recap.breakdown.scored);
    expect(recap.breakdown.scored, 115);
    expect(recap.ordinal, 7);
  });

  test("Today's and Review's mistakes are the result's repair candidates", () {
    final move = buildMove(ashaInputs(attempts: attempts));
    expect(move.evidenceId, demoMockId);
    expect(move.meaning, contains('of the ${recap.candidates.length} from Mock 7'));
    final index = buildReviewIndex(attempts, const []);
    final open = index.groups.expand((g) => g.items).where((i) => i.attemptId == demoMockId && i.stage.isOpen);
    expect(open.length, recap.candidates.length);
    expect(index.tonight!.attemptId, demoMockId);
  });

  test('the submit page and the practice result count the same answers', () {
    final questions = runner.accountancyQuestions(10);
    final answers = {'q1': 0, 'q2': 1, 'q3': 1, 'q4': 0, 'q5': 2, 'q7': 1};
    final result = practiceDetailFrom(questions, answers, now).attempt;
    expect(result.correct + result.wrong, answers.length, reason: 'answered on the submit page');
    expect(result.unattempted, questions.length - answers.length, reason: 'not answered on the submit page');
    expect(result.correct, 3);
  });

  test('the milestone shelf matches the record: seven mocks, no repair yet', () {
    final slots = tokenSlots(demoMilestones(attempts));
    expect(slots.firstWhere((s) => s.token == MilestoneToken.firstMock).earned, isTrue);
    expect(slots.firstWhere((s) => s.token == MilestoneToken.firstRepair).earned, isFalse);
    // Review has no repair recorded in the demo, so nothing in it reads as repaired.
    final index = buildReviewIndex(attempts, const []);
    expect(index.groups.every((g) => g.repairedCount == 0), isTrue);
  });
}
