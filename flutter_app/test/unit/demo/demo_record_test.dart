// The device demo is how the owner sees the signed-in app before a real sign-in, so its numbers
// must agree from screen to screen, and a submit must show the paper just sat (review round 1,
// P0-2 and P0-4).
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/mock_ordinal.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/rhythm/logic/tokens.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';

import '../../device_demo/demo_book.dart';
import '../../device_demo/demo_questions.dart';
import '../today/support/today_fixtures.dart';

void main() {
  final now = tuesdayEvening;

  test("Today's Mock 7 is the paper the reveal opens, with the same marks", () {
    final book = DemoBook(now);
    final attempts = book.attempts;
    final detail = book.detail(demoMockId)!;
    final recap = buildRecapModel(attempt: detail.attempt, detail: detail, attempts: attempts, milestones: book.milestones(const []));
    final view = buildToday(ashaInputs(now: now, attempts: attempts));
    final row = view.sheet.firstWhere((r) => r.attemptId == demoMockId);
    expect(row.label, 'Mock 7');
    expect(row.marks, 115);
    expect(recap.breakdown.scored, 115);
    expect(recap.ordinal, 7);
  });

  test("Today and Review offer the same repair: the same chapter, the same count", () {
    final book = DemoBook(now);
    final attempts = book.attempts;
    final move = buildMove(ashaInputs(now: now, attempts: attempts));
    final index = buildReviewIndex(attempts, const []);
    final tonight = index.tonight!;
    expect(move.evidenceId, demoMockId);
    expect(tonight.attemptId, demoMockId);
    expect(tonight.chapter, 'Admission of a partner');
    expect(move.number, '${tonight.items.length}');
    expect(move.meaning, 'All ${tonight.items.length} in Admission of a partner, from Mock 7 on ${move.meaning.split(' on ').last}');
  });

  test('every demo question belongs to its own chapter, and Business Studies has twenty', () {
    final book = DemoBook(now);
    final mock = book.detail(demoMockId)!.attempt;
    final pool = demoPool('accountancy');
    for (final q in mock.questions) {
      expect(pool.any((p) => p.question == q.question && p.chapter == q.chapter), isTrue, reason: q.id);
    }
    expect({for (final q in demoPool('business_studies')) q.question}.length, greaterThanOrEqualTo(20));
  });

  test('a submitted NTA paper becomes Mock 8, marked from the answers, at the time it was sent', () {
    final book = DemoBook(now);
    final questions = demoQuestions('accountancy', 50, 'demo-nta1');
    final pool = demoPool('accountancy');
    final answers = {questions[0].id: pool[0].key, questions[1].id: (pool[1].key + 1) % 4};
    final at = now.add(const Duration(minutes: 3));
    book.record(demoPracticeDetail(id: 'demo-nta1-result', subject: 'accountancy', questions: questions, answers: answers, completedAt: at, mode: 'nta'), at);
    final paper = book.detail('demo-nta1-result')!.attempt;
    expect(mockOrdinal(book.attempts, paper), 8);
    expect((paper.correct, paper.wrong, paper.unattempted), (1, 1, 48));
    expect(paper.completedAt, at);
    expect(book.receivedAt['demo-nta1-result'], at);
    expect(book.attempts.first.id, 'demo-nta1-result');
  });

  test('the milestones follow the record: no repair, then the first repair the moment one lands', () {
    final book = DemoBook(now);
    TokenSlot slot(List<RepairLocalRecord> r, MilestoneToken t) => tokenSlots(book.milestones(r)).firstWhere((s) => s.token == t);
    expect(slot(const [], MilestoneToken.firstMock).earned, isTrue);
    expect(slot(const [], MilestoneToken.firstRepair).earned, isFalse);
    final at = now.add(const Duration(minutes: 20));
    final repair = RepairLocalRecord(attemptId: demoMockId, questionId: '$demoMockId-q2', requestId: 'r1', status: RepairLocalStatus.explained, ackedAt: at);
    expect(slot([repair], MilestoneToken.firstRepair).earned, isTrue);
    expect(book.studyDays([repair]), contains(dayKey(at)));
  });
}
