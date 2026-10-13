// The device demo is how the owner sees the signed-in app before a real sign-in, so its numbers
// must agree from screen to screen, and a submit must show the paper just sat (review round 1,
// P0-2 and P0-4).
import 'dart:async';

import 'package:clock/clock.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/domain/mock_ordinal.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/rhythm/logic/tokens.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';

import '../../device_demo/demo_book.dart';
import '../../device_demo/demo_questions.dart';
import '../../device_demo/demo_repair.dart';
import '../../device_demo/demo_session.dart';
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

  const subjects = [
    'accountancy', 'business_studies', 'economics', 'english', 'mathematics', 'physics', 'chemistry', 'biology',
    'history', 'political_science', 'geography', 'psychology', 'sociology', 'computer_science', 'general_test',
  ];

  group('repair explanations', () {
    test('every demo question has a key inside its options and a book explanation to repair from', () {
      for (final subject in subjects) {
        for (final q in demoPool(subject)) {
          expect(q.options.length, 4, reason: '$subject: ${q.question}');
          expect(q.key, inInclusiveRange(0, q.options.length - 1), reason: '$subject: ${q.question}');
          expect(q.explanation.trim(), isNotEmpty, reason: '$subject: ${q.question}');
          expect(q.explanation.length, lessThanOrEqualTo(320), reason: 'the contract caps key_idea at 320');
        }
      }
    });

    test('every wrong answer in every demo paper has an explanation written from its own question', () {
      final book = DemoBook(now);
      // A practice in each subject the student could start, with the first three questions wrong.
      for (final subject in subjects) {
        final questions = demoQuestions(subject, 10, 'rp-$subject');
        final pool = demoPool(subject);
        final answers = {for (var i = 0; i < 10; i++) questions[i].id: i < 3 ? (pool[i % pool.length].key + 1) % 4 : pool[i % pool.length].key};
        book.record(
          demoPracticeDetail(id: 'rp-$subject-result', subject: subject, questions: questions, answers: answers, completedAt: now.add(const Duration(minutes: 1)), mode: 'quick'),
          now,
        );
      }
      var checked = 0;
      for (final a in book.attempts) {
        final paper = book.detail(a.id)!;
        for (final d in paper.attempt.details.where((d) => d.isCorrect == false)) {
          final q = paper.attempt.questions.firstWhere((x) => x.id == d.qid);
          final r = demoRepairResponse(paper, d.qid);
          expect(r, isNotNull, reason: '${a.id}/${d.qid}');
          expect(r!.status, RepairStatus.explained, reason: '${a.id}/${d.qid}');
          final e = r.explanation!;
          expect(e.keyIdea, q.explanation, reason: "the idea is the question's own explanation");
          expect(e.keyIdea.length, lessThanOrEqualTo(320));
          expect(e.whyWrong, contains(q.options[q.correctIndex!].text));
          expect(e.whyWrong!.length, lessThanOrEqualTo(220));
          expect(e.whyTempting!.length, lessThanOrEqualTo(220));
          expect(r.keyIndex, q.correctIndex);
          checked++;
        }
      }
      expect(checked, greaterThan(100));
    });

    test('a question the paper does not hold has no explanation to give', () {
      final book = DemoBook(now);
      expect(demoRepairResponse(book.detail(demoMockId), 'not-a-question'), isNull);
      expect(demoRepairResponse(null, 'a7-q1'), isNull);
    });
  });

  group('Business Studies practice', () {
    for (final count in [10, 20]) {
      test('a $count question practice holds $count different questions, each in its own chapter', () {
        final questions = demoQuestions('business_studies', count, 'bs$count');
        expect(questions.length, count);
        expect({for (final q in questions) q.question}.length, count, reason: 'no question repeats inside one practice');
        final pool = demoPool('business_studies');
        for (final q in questions) {
          expect(pool.any((p) => p.question == q.question && p.chapter == q.chapter), isTrue, reason: q.id);
        }
        final paper = demoPracticeDetail(
          id: 'bs$count-result',
          subject: 'business_studies',
          questions: questions,
          answers: {for (var i = 0; i < count; i++) questions[i].id: pool[i].key},
          completedAt: now,
        );
        expect(paper.attempt.correct, count);
        expect(paper.attempt.total, count);
      });
    }

    test('the subjects the student studies have enough questions for a ten question practice', () {
      for (final subject in const ['accountancy', 'business_studies', 'economics', 'english']) {
        final texts = {for (final q in demoQuestions(subject, 10, 'ten-$subject')) q.question};
        expect(texts.length, 10, reason: subject);
      }
    });
  });

  group("the record's clock", () {
    final days = [
      tuesdayEvening, // 8:40 PM in Kolkata
      DateTime.utc(2026, 10, 13, 20, 0), // 1:30 AM the next day in Kolkata
      DateTime.utc(2026, 10, 13, 3, 0), // 8:30 AM
    ];

    for (final at in days) {
      test('Mock 7 is two Kolkata days before today, newest of the mocks and of the list, at 8:10 PM ($at)', () {
        final book = DemoBook(at);
        final list = book.attempts;
        for (var i = 0; i + 1 < list.length; i++) {
          expect(list[i].completedAt.isAfter(list[i + 1].completedAt), isTrue, reason: '${list[i].id} is listed before ${list[i + 1].id}');
        }
        expect(list.first.id, demoMockId);
        expect(list.first.completedAt.isBefore(at), isTrue, reason: 'nothing is dated after today');

        final mock7 = book.detail(demoMockId)!.attempt;
        expect(mockOrdinal(list, mock7), 7);
        final mocks = [for (final a in list) if (a.isMock) a]..sort((a, b) => a.completedAt.compareTo(b.completedAt));
        expect(mocks.last.id, demoMockId);

        final ist = istOf(mock7.completedAt);
        expect((ist.hour, ist.minute), (20, 10));
        final today = istOf(at);
        expect(DateTime.utc(ist.year, ist.month, ist.day), DateTime.utc(today.year, today.month, today.day - 2));
      });
    }
  });

  group('the demo NTA clock', () {
    test('counts down while the paper is open, warns at 5 and 1 minute, and submits at zero', () {
      fakeAsync((async) {
        final warnings = <SessionWarning>[];
        final session = DemoSession(
          'clock-t1',
          questions: demoQuestions('accountancy', 50, 'clock-t1'),
          mode: 'nta',
          subject: 'accountancy',
          remaining: const Duration(minutes: 60),
          endsAt: clock.now().add(const Duration(minutes: 60)),
        );
        final sub = session.warnings.listen(warnings.add);
        expect(session.remaining.value, const Duration(minutes: 60));

        async.elapse(const Duration(seconds: 5));
        expect(session.remaining.value, const Duration(minutes: 59, seconds: 55));
        async.elapse(const Duration(minutes: 30));
        expect(session.remaining.value, const Duration(minutes: 29, seconds: 55));

        async.elapse(const Duration(minutes: 25));
        expect(session.remaining.value, const Duration(minutes: 4, seconds: 55));
        expect(warnings, [SessionWarning.fiveMinutes]);

        async.elapse(const Duration(minutes: 4));
        expect(warnings, [SessionWarning.fiveMinutes, SessionWarning.oneMinute]);

        async.elapse(const Duration(minutes: 1));
        async.flushTimers();
        async.flushMicrotasks();
        expect(session.remaining.value, Duration.zero);
        expect(warnings.last, SessionWarning.timeUp);
        expect(demoBook.detail(session.resultId), isNotNull, reason: 'time up submits and records the paper');

        unawaited(sub.cancel());
        unawaited(session.close());
        async.flushMicrotasks();
      });
    });

    test('a paper that opens late finds the clock already moved on', () {
      fakeAsync((async) {
        final session = DemoSession(
          'clock-t2',
          questions: demoQuestions('accountancy', 50, 'clock-t2'),
          mode: 'nta',
          subject: 'accountancy',
          remaining: const Duration(minutes: 60),
          endsAt: clock.now().add(const Duration(minutes: 60)),
        );
        async.elapse(const Duration(minutes: 12, seconds: 30));
        expect(session.remaining.value, const Duration(minutes: 47, seconds: 30));
        unawaited(session.close());
        async.flushMicrotasks();
      });
    });
  });
}
