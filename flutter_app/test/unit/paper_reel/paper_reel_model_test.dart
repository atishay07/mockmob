import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/paper_reel/paper_reel.dart';

import 'reel_fixture.dart';

void main() {
  group('PaperReelModel', () {
    test('one question per bubble, in paper order, with the server results', () {
      final m = PaperReelModel.tryFrom(reelDetail(), subjectLabel: 'Accountancy')!;
      expect(m.questions, hasLength(30));
      expect(m.questions.first.number, 1);
      expect(m.questions[3].result, ReelResult.wrong);
      expect(m.questions[8].result, ReelResult.blank);
      expect(m.right + m.wrong + m.blank, 30);
      expect(m.subject, 'Accountancy');
    });

    test('the score counts up per question and lands on the server marks', () {
      final d = reelDetail();
      final m = PaperReelModel.tryFrom(d)!;
      expect(m.perQuestionScore, isTrue);
      expect(m.finalMarks, d.attempt.marks);
      expect(m.maxMarks, 150);
      expect(m.marksAfter(1), 5);
      expect(m.marksAfter(4), 14);
      expect(m.frameAt(m.totalMs).marks, d.attempt.marks);
    });

    test('a score that does not add up runs evenly to the server number', () {
      final j = reelAttemptJson()..['correct'] = 1;
      final m = PaperReelModel.tryFrom(AttemptDetail.fromJson(j))!;
      expect(m.perQuestionScore, isFalse);
      expect(m.frameAt(m.totalMs + 1).marks, AttemptDetail.fromJson(j).attempt.marks);
    });

    test('moments are the real ones: right to wrong, the stall, a changed wrong', () {
      final m = PaperReelModel.tryFrom(reelDetail())!;
      expect(m.moments.map((x) => x.kind), [ReelMomentKind.changedFromRight, ReelMomentKind.stall, ReelMomentKind.changedToWrong]);
      expect(m.moments[0].line, 'Q7: you changed a right answer to wrong.');
      expect(m.moments[1].line, 'Q18: 6 min 40 s here. It ended wrong.');
      expect(m.moments[2].line, 'Q25: you changed this answer, and it ended wrong.');
    });

    test('without the Lab it never claims a right answer was changed', () {
      final m = PaperReelModel.tryFrom(reelDetail(withLab: false))!;
      expect(m.moments.any((x) => x.kind == ReelMomentKind.changedFromRight), isFalse);
      // The stall still comes from the times (6 min 40 s is far above the middle time).
      expect(m.moments.where((x) => x.kind == ReelMomentKind.stall).single.index, 17);
      expect(m.moments.where((x) => x.kind == ReelMomentKind.changedToWrong).map((x) => x.index), containsAll([6, 24]));
    });

    test('no times and no records: no moments, nothing invented', () {
      final m = PaperReelModel.tryFrom(reelDetail(withLab: false, withTimes: false, changed: false))!;
      expect(m.moments, isEmpty);
      expect(m.questions.every((q) => q.timeSec == null), isTrue);
    });

    test('unreliable timing hides times', () {
      final j = reelAttemptJson(withLab: false)..['recap'] = {'timingReliable': false};
      final m = PaperReelModel.tryFrom(AttemptDetail.fromJson(j))!;
      expect(m.questions.every((q) => q.timeSec == null), isTrue);
      expect(m.moments.any((x) => x.kind == ReelMomentKind.stall), isFalse);
    });

    test('lands on the costliest chapter and one next move to repair it', () {
      final m = PaperReelModel.tryFrom(reelDetail())!;
      // Chapter 2: 4 wrong (24) + 2 blank (10) = 34 of 50.
      expect(m.chapter!.name, 'Accounting for share capital');
      expect(m.chapter!.lost, 34);
      expect(m.chapter!.max, 50);
      expect(m.nextMove.kind, ReelMoveKind.repairChapter);
      expect(m.nextMove.label, 'Repair those 4 wrong answers');
      expect(m.nextMove.qids, hasLength(6));
    });

    test('a perfect paper has no chapter and ends on the next mock', () {
      final m = PaperReelModel.tryFrom(reelDetail(pattern: 'rrrrrrrrrr', withLab: false))!;
      expect(m.chapter, isNull);
      expect(m.nextMove.kind, ReelMoveKind.nextMock);
    });

    test('blanks only: go through what was missed', () {
      final m = PaperReelModel.tryFrom(reelDetail(pattern: 'rrrrbrrrrr', withLab: false))!;
      expect(m.nextMove.kind, ReelMoveKind.reviewMistakes);
    });

    test('held keys add no marks', () {
      final d = reelDetail(withLab: false);
      final held = AttemptDetail(attempt: d.attempt, answerReviews: {'q4': AnswerReview.fromJson(const {'state': 'under_review'})});
      final m = PaperReelModel.tryFrom(held)!;
      if (held.hasHeld) {
        expect(m.questions[3].result, ReelResult.held);
        expect(m.questions[3].marks, 0);
      }
    });

    test('about 20 s with three moments, never under 15 s', () {
      final m = PaperReelModel.tryFrom(reelDetail())!;
      expect(m.totalMs, inInclusiveRange(18000, 22000));
      expect(m.seconds, 20);
      final plain = PaperReelModel.tryFrom(reelDetail(withLab: false, withTimes: false, changed: false))!;
      expect(plain.totalMs, greaterThanOrEqualTo(15000));
    });

    test('the timeline is contiguous and frames walk the phases in order', () {
      final m = PaperReelModel.tryFrom(reelDetail())!;
      for (var i = 1; i < m.segments.length; i++) {
        expect(m.segments[i].startMs, m.segments[i - 1].endMs);
      }
      expect(m.frameAt(0).phase, ReelPhase.intro);
      expect(m.frameAt(PaperReelModel.introMs + 1).revealed, 1);
      final pause = m.segments.firstWhere((s) => s.phase == ReelPhase.pause);
      final f = m.frameAt(pause.startMs + 10);
      expect(f.phase, ReelPhase.pause);
      expect(f.moment!.index, 6);
      expect(f.revealed, 7);
      final chapter = m.segments.firstWhere((s) => s.phase == ReelPhase.chapter);
      expect(m.frameAt(chapter.startMs).revealed, 30);
      expect(m.frameAt(m.totalMs).isEnd, isTrue);
    });

    test('an empty paper has no reel', () {
      final j = reelAttemptJson()
        ..['questionsSnapshot'] = <Object>[]
        ..['details'] = <Object>[];
      expect(PaperReelModel.tryFrom(AttemptDetail.fromJson(j)), isNull);
    });
  });
}
