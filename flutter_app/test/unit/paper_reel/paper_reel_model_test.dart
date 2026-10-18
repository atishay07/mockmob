import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/paper_reel/paper_reel.dart';
import 'package:mockmob/features/paper_reel/copy.dart' show ReelCopy;
import 'package:mockmob/features/result/copy.dart' show ResultCopy;

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
      // Shown against what the whole paper missed (8 wrong x 6 + 3 blank x 5 = 63), never against the chapter's own 50.
      expect(m.chapter!.paperMissed, 63);
      expect(m.chapter!.against, 63);
      expect(ReelCopy.chapterLine(m.chapter!.lost, m.chapter!.against, m.chapter!.wrong, m.chapter!.blank), '34 of the 63 marks you missed: 4 wrong, 2 left blank.');
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

    test('the length depends on the paper size only: 20 s here, with three moments or none, as the cards say', () {
      final m = PaperReelModel.tryFrom(reelDetail())!;
      expect(m.totalMs, 20000);
      expect(m.seconds, 20);
      final plain = PaperReelModel.tryFrom(reelDetail(withLab: false, withTimes: false, changed: false))!;
      expect(plain.totalMs, 20000, reason: 'a moment takes its pause out of the sheet time; the total does not move');
      expect(PaperReelModel.secondsFor(m.questions.length), m.seconds, reason: 'Today\'s card and the result row print the reel\'s own figure');
    });

    test('a short set runs 16 s and a long one 20 s, whatever its moments', () {
      expect(PaperReelModel.lengthMsFor(5), 16000);
      expect(PaperReelModel.lengthMsFor(10), 16000);
      expect(PaperReelModel.lengthMsFor(12), 16000);
      expect(PaperReelModel.lengthMsFor(13), 20000);
      expect(PaperReelModel.lengthMsFor(50), 20000);
      for (final pattern in ['rrwrbrrwrb', 'rwrwrwrwrw', 'bbbbbbbbbb', 'rrrrrrrrrr']) {
        final m = PaperReelModel.tryFrom(reelDetail(pattern: pattern))!;
        expect(m.totalMs, 16000, reason: pattern);
        expect(m.seconds, PaperReelModel.secondsFor(10));
      }
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

  // M5 of the v15 emulator walk: the reel's closing card said "47 of 45 marks missed". 47 counts the wrong answers'
  // penalties (a wrong costs 6), 45 was five marks a question in the chapter, a total with no room for them. The reel and
  // the result's recap card now show a chapter against what the whole paper missed, through one function.
  group('a chapter is never shown as missing more than it is shown against (M5)', () {
    // The walk's Mock 4: 50 questions, 2 right, 5 wrong, 43 blank (a score of 5 of 250). The first chapter (blocks of ten repeat every three in the fixture, so it holds 20 questions) holds 2 wrong
    // and 18 blank questions: 12 + 90 = 102 marks, more than the 100 the chapter's own five-a-question total allows.
    const walkPaper = 'wwbbbbbbbb' 'rrwbbbbbbb' 'wwbbbbbbbb' 'bbbbbbbbbb' 'bbbbbbbbbb';

    ReelChapter chapterOf(String pattern) => PaperReelModel.tryFrom(reelDetail(pattern: pattern, withLab: false, withTimes: false, changed: false))!.chapter!;

    test('the walk\'s paper: 102 of the 245 marks the paper missed, never "102 of 100"', () {
      final c = chapterOf(walkPaper);
      expect(c.lost, 102);
      expect(c.lost, greaterThan(20 * 5), reason: 'more than the chapter\'s own five marks a question: the old denominator');
      expect(c.paperMissed, 5 * 6 + 43 * 5, reason: '250 - the score of 5');
      expect(c.against, 245);
      expect(c.lost, lessThanOrEqualTo(c.against!));
      expect(ReelCopy.chapterLine(c.lost, c.against, c.wrong, c.blank), '102 of the 245 marks you missed: 2 wrong, 18 left blank.');
    });

    test('the same chapter reads the same figure on the recap card', () {
      final c = chapterOf(walkPaper);
      expect(ResultCopy.costLabel(c.lost, c.paperMissed, max: c.paperMax), '102 of the 245 marks you missed were in this chapter.');
      expect(ResultCopy.costUnit(c.paperMissed, max: c.paperMax, cost: c.lost), 'of 245 missed');
      expect(ReelCopy.chapterLine(c.lost, c.against, c.wrong, c.blank), contains('102 of the 245 marks you missed'));
    });

    test('a negative score: the paper missed more than it holds, so no denominator is claimed on either screen', () {
      // Every answer wrong: 30 x -1 = -30 of 150, so 180 marks missed on a 150-mark paper.
      final c = chapterOf('wwwwwwwwww' 'wwwwwwwwww' 'wwwwwwwwww');
      expect(c.paperMissed, 180);
      expect(c.against, isNull);
      expect(ReelCopy.chapterLine(c.lost, c.against, c.wrong, c.blank), '60 marks missed: 10 wrong.');
      expect(ResultCopy.costLabel(c.lost, c.paperMissed, max: c.paperMax), '60 marks cost in this chapter.');
      expect(ResultCopy.costUnit(c.paperMissed, max: c.paperMax, cost: c.lost), 'marks');
    });

    test('whatever the paper, the figure is never above its denominator', () {
      for (final pattern in [reelPattern, walkPaper, 'wwwwwwwwww' 'wwwwwwwwww' 'wwwwwwwwww', 'rrrrrrrrrw' 'bbbbbbbbbb' 'rrrrrrrrrr']) {
        final c = chapterOf(pattern);
        final against = c.against;
        if (against != null) expect(c.lost, lessThanOrEqualTo(against), reason: pattern);
      }
    });
  });
}
