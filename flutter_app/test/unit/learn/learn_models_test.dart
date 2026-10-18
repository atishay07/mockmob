import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/study.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/models/run_item.dart';
import 'package:mockmob/features/learn/widgets/due_card.dart';

import 'support/learn_fixtures.dart';

void main() {
  group('lesson status words', () {
    test('every UnitView.status value maps to a word, and none says mastered', () {
      const expected = {
        StudyUnitStatus.newUnit: 'New',
        StudyUnitStatus.inProgress: 'In progress',
        StudyUnitStatus.lockIn: 'In progress',
        StudyUnitStatus.due: 'Due',
        StudyUnitStatus.learned: 'Done for now',
        StudyUnitStatus.unknown: 'New',
      };
      for (final status in StudyUnitStatus.values) {
        expect(LearnCopy.statusWord(status), expected[status], reason: status.name);
        expect(LearnCopy.statusWord(status).toLowerCase(), isNot(contains('master')));
      }
      for (final wire in ['new', 'in_progress', 'lock_in', 'due', 'learned']) {
        expect(StudyUnitStatus.fromWire(wire), isNot(StudyUnitStatus.unknown), reason: wire);
      }
    });
  });

  group('catalog', () {
    test('reads lessons, subjects in syllabus order, the open run and the queue', () {
      final c = catalog(due: 12);
      expect(c.units, hasLength(5));
      expect([for (final s in c.subjectsWithLessons) s.title], ['Accountancy', 'English']);
      expect(c.unitsOf('english').map((u) => u.id), ['eng-vocab', 'eng-passage']);
      final goodwill = c.unitById('acc-goodwill')!;
      expect(goodwill.runId, 'run-9');
      expect(goodwill.step, 3);
      expect(c.unitById('eng-vocab')!.dueCards, 4);
      expect(c.queue.dueCount, 12);
      expect(c.next!.id, 'acc-sacrifice');
    });

    test('a disabled catalog is reported as disabled', () {
      expect(catalog(state: 'disabled').isDisabled, isTrue);
      expect(catalog().isDisabled, isFalse);
    });

    test('new cards are offered only inside the allowance and never while paused', () {
      expect(StudyQueueView.of(catalog(due: 0, newCount: 3)).newReady, 3);
      expect(StudyQueueView.of(catalog(due: 0, newCount: 9)).newReady, 5);
      expect(StudyQueueView.of(catalog(due: 0, newCount: 3, pausedNew: true)).newReady, 0);
    });

    test('a lesson with an unknown subject still gets a readable heading', () {
      final c = LearnCatalog.fromJson({
        'state': 'ready',
        'units': [unitJson('x-1', 'A lesson', 'new', subject: 'business-studies')],
      });
      expect(c.subjectsWithLessons.single.title, 'Business studies');
    });
  });

  group('run items', () {
    test('a self-rated card, a choice card and a text card are told apart', () {
      expect(RunItem.fromJson(revealCard()).type, RunItemType.reveal);
      expect(RunItem.fromJson(choiceCard()).type, RunItemType.choice);
      expect(RunItem.fromJson(textCard()).type, RunItemType.text);
      expect(RunItem.fromJson(readingBlock()).isReading, isTrue);
    });

    test('the answer is only present once the server revealed it', () {
      expect(RunItem.fromJson(choiceCard()).answerIndex, isNull);
      expect(RunItem.fromJson(choiceCard(revealed: true, answer: 2)).answerIndex, 2);
      expect(RunItem.fromJson(revealCard(revealed: true)).answerText, 'Old share − New share');
    });

    test('cards rated Forgot or Hard are listed for the ending', () {
      final r = run(state: 'complete', item: null, reviewed: [
        {'title': 'Sacrifice formula', 'rating': 1},
        {'title': 'Gain formula', 'rating': 3},
        {'title': 'Old ratio rule', 'rating': 2},
      ]);
      expect(r.cardsToSeeAgain, ['Sacrifice formula', 'Old ratio rule']);
    });

    test('the server time of the last change is read when it is given', () {
      expect(run(updatedAt: '2026-10-12T12:42:00.000Z').serverUpdatedAt, DateTime.utc(2026, 10, 12, 12, 42));
      expect(run().serverUpdatedAt, isNull);
    });
  });

  group('copy rules', () {
    test('the due summary is a count, with no minutes and no dates', () {
      expect(LearnCopy.dueSummary(12), '12 cards due.');
      expect(LearnCopy.dueSummary(1), '1 card due.');
      expect(LearnCopy.nothingDue, 'Nothing is due right now.');
      for (final line in [LearnCopy.dueSummary(12), LearnCopy.nothingDue, LearnCopy.newReady(3), LearnCopy.stillDue(4)]) {
        expect(line, isNot(matches(RegExp(r'minute|today|tomorrow|\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)'))));
      }
    });

    test('the run ending lines are exact and use 12-hour times', () {
      final at = DateTime(2026, 10, 12, 18, 12);
      String plain(String t) => t.replaceAll(' ', ' ');
      expect(LearnCopy.recallFinished(8), 'Review finished. 8 cards reviewed.');
      expect(LearnCopy.recallFinished(1), 'Review finished. 1 card reviewed.');
      expect(LearnCopy.recallFinished(8, lessons: ['Goodwill on admission']), 'Review finished. 8 cards from Goodwill on admission.');
      expect(LearnCopy.recallFinished(8, lessons: ['Goodwill', 'Revaluation']), 'Review finished. 8 cards from Goodwill and Revaluation.');
      expect(LearnCopy.recallFinished(8, lessons: ['A', 'B', 'C']), 'Review finished. 8 cards from 3 lessons.');
      expect(LearnCopy.lessonFinished('Sacrificing and gaining ratios'), 'Lesson finished: Sacrificing and gaining ratios.');
      expect(LearnCopy.lessonFinished(null), 'Lesson finished.');
      expect(plain(LearnCopy.recordedAt(at)), 'Recorded at 6:12 PM.');
      expect(LearnCopy.againMore(3), 'and 3 more to see again');
      expect(LearnCopy.stillDue(4), '4 cards are still due.');
      expect(LearnCopy.stillDue(1), '1 card is still due.');
    });

    test('the state lines are the spec words', () {
      expect(LearnCopy.disabledTitle, 'Lessons are paused right now.');
      expect(LearnCopy.dailyNewLimit, "You have done today's new cards. Review is still open.");
      expect(LearnCopy.contentChangedOpening, 'This lesson was updated. Opening the new version.');
      expect(LearnCopy.reviewedOffline, 'Reviewed offline, sending when online');
      expect(LearnCopy.forgot, 'Forgot');
      expect(LearnCopy.hard, 'Hard');
      expect(LearnCopy.gotIt, 'Got it');
      expect(LearnCopy.easy, 'Easy');
      expect(LearnCopy.keepForOffline, 'Keep for offline');
    });

    test('sizes read as KB or MB', () {
      expect(LearnCopy.bytes(0), '0 KB');
      expect(LearnCopy.bytes(310 * 1024), '310 KB');
      expect(LearnCopy.bytes((4.2 * 1024 * 1024).round()), '4.2 MB');
      expect(LearnCopy.bytes(12 * 1024 * 1024), '12 MB');
    });

    test('no learn string has a middle dot, an emoji, an arrow or an exclamation mark', () {
      final strings = <String>[
        LearnCopy.title, LearnCopy.nothingDue, LearnCopy.startReview, LearnCopy.startNewCards, LearnCopy.newCardsPaused,
        LearnCopy.resumeHeading, LearnCopy.disabledTitle, LearnCopy.disabledMessage, LearnCopy.offlineMessage,
        LearnCopy.keepNothingYet, LearnCopy.connectToStart, LearnCopy.dailyNewLimit, LearnCopy.lessonNotRead,
        LearnCopy.startFailed, LearnCopy.contentChangedOpening, LearnCopy.unitMissingMessage, LearnCopy.unitOfflineMessage,
        LearnCopy.tapToReveal, LearnCopy.howWell, LearnCopy.correct, LearnCopy.notQuite, LearnCopy.reviewedOffline,
        LearnCopy.connectToReveal, LearnCopy.connectToCheck, LearnCopy.sendFailed, LearnCopy.leaveRun,
        LearnCopy.doneSetAside, LearnCopy.doneInvalidated, LearnCopy.recallFinished(8), LearnCopy.recordedAt(DateTime(2026, 10, 12, 18, 12)),
        LearnCopy.supersededElsewhere, LearnCopy.unknownStep, LearnCopy.stillActive, LearnCopy.howLine, LearnCopy.untaughtNote,
        LearnCopy.pendingOnPhone(2), LearnCopy.newReady(3), LearnCopy.keepSize('4.2 MB'),
      ];
      for (final s in strings) {
        expect(s, isNot(contains('·')), reason: s);
        expect(s, isNot(contains('!')), reason: s);
        expect(s, isNot(matches(RegExp(r'[←-⇿☀-➿\u{1F300}-\u{1FAFF}]', unicode: true))), reason: s);
        expect(s.toLowerCase(), isNot(contains('mastered')), reason: s);
        expect(s, isNot(matches(RegExp(r'[Rr]un'))), reason: s);
      }
    });
  });
}
