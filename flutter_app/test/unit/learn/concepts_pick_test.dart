import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn/data/concepts_pick.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';

import 'support/learn_fixtures.dart';

const _costs = [
  ChapterCost(subject: 'accountancy', chapter: 'Admission of a Partner', open: 3),
  ChapterCost(subject: 'accountancy', chapter: 'change in profit-sharing ratio', open: 2),
];

/// Learn's numbers (LEARN-REVIEW-1017 5.9, P-LR6), the app port of the website's data/study/concepts_pick.mjs: the one
/// lesson to read next, the chapters that cost marks, every chapter of the subject, the search and the record line.
void main() {
  group('Read this next', () {
    test('an unfinished lesson run comes first', () {
      final pick = conceptsPick(catalog(active: {'id': 'run-9', 'mode': 'learn', 'title': 'Goodwill on admission', 'step': 3, 'total': 9, 'unitId': 'acc-goodwill'}), _costs);
      expect(pick.kind, PickKind.finish);
      expect(pick.title, 'Goodwill on admission');
      expect(pick.lead, 'Finish this next.');
      expect(pick.reason, 'You stopped at step 3 of 9. Everything before it is saved.');
      expect(pick.key, 'Finish the lesson, step 3 of 9');
      expect(pick.runId, 'run-9');
    });

    test('then the costliest chapter with a lesson to read: a chapter with no lesson is passed over, names compared loosely', () {
      final pick = conceptsPick(catalog(), _costs);
      expect(pick.kind, PickKind.mistakes);
      // Goodwill is part way through, so it is picked before the unread one, and its own run is reopened.
      expect(pick.title, 'Goodwill on admission');
      expect(pick.reason, '2 of your open mistakes are in its chapter, Change in Profit Sharing Ratio.');
      expect(pick.key, 'Finish the lesson, step 3 of 9');
      expect(pick.runId, 'run-9');
      expect(pick.cost, 'Free. Its 6 cards then join Revise.');
    });

    test('then the next lesson the catalog names; the key counts Learn plus Lock it in', () {
      final pick = conceptsPick(catalog(), const []);
      expect(pick.kind, PickKind.next);
      expect(pick.title, 'Sacrificing and gaining ratios');
      expect(pick.lead, 'Read this next.', reason: 'lessons have been read already');
      expect(pick.reason, 'Work out who gave up profit share and who gained it.');
      expect(pick.key, 'Start the lesson, 9 minutes');
      expect(pick.runId, isNull);
    });

    test('with every lesson read: practise questions; due cards are never the pick', () {
      final json = catalogJson(due: 12)
        ..['nextUnit'] = null
        ..['units'] = [unitJson('acc-reval', 'Revaluation account', 'learned', due: 5)];
      final pick = conceptsPick(LearnCatalog.fromJson(json), _costs);
      expect(pick.kind, PickKind.practise);
      expect(pick.key, 'Practise questions');
    });

    test('a first lesson says Start here', () {
      final json = catalogJson()..['units'] = [unitJson('acc-sacrifice', 'Sacrificing and gaining ratios', 'new', order: 1)];
      expect(conceptsPick(LearnCatalog.fromJson(json), const []).lead, 'Start here.');
    });
  });

  test('Where you lose marks: one subject, costliest first, a wrong answer costs 6 marks', () {
    final rows = loseMarks(catalog(), _costs, 'accountancy');
    expect([for (final r in rows) (r.name, r.marks)], [('Admission of a Partner', 18), ('Change in Profit Sharing Ratio', 12)]);
    expect(rows.first.meta, '3 open mistakes. No lesson yet. Practise the chapter');
    expect(rows.last.meta, '2 open mistakes. 3 lessons, 1 read');
    expect(loseMarks(catalog(), _costs, 'english'), isEmpty);
  });

  test('All chapters: every syllabus chapter in order, the open cost where there is one, the head adds up', () {
    final all = allChapters(catalog(), _costs, 'accountancy');
    expect([for (final c in all.chapters) c.name], ['Change in Profit Sharing Ratio', 'Admission of a Partner', 'Retirement of a Partner']);
    expect([for (final c in all.chapters) c.marks], [12, 18, 0]);
    expect(all.chapters.last.meta, 'No lesson yet. Practice ready');
    expect(all.head, '3 lessons, 1 of 3 chapters');
  });

  test('search: lessons and chapters without one, across subjects; under two letters it is off', () {
    expect(searchConcepts('p', catalog()), isNull);
    final hits = searchConcepts('partner', catalog())!;
    expect(hits.lessons, isEmpty);
    expect([for (final c in hits.chapters) c.name], ['Admission of a Partner', 'Retirement of a Partner']);
    expect([for (final u in searchConcepts('vocab', catalog())!.lessons) u.id], ['eng-vocab']);
  });

  test('the record line counts what the server sends, and lessons read from the catalog otherwise', () {
    expect(recordLine(catalog()).text, '3 of 5 lessons read');
    final json = catalogJson()..['progress'] = {'lessonsRead': 2, 'lessonsAvailable': 9, 'cardsStarted': 8, 'recallReviews': 23};
    expect(recordLine(LearnCatalog.fromJson(json)).text, '2 of 9 lessons read, 8 cards in Revise, 23 cards recalled');
  });

  test("Practice's Learn line names the lesson and its time, and why", () {
    final panel = practicePanel(catalog(), _costs);
    expect(panel.title, 'Goodwill on admission, 9 min');
    expect(panel.line, '2 of your open mistakes are in its chapter, Change in Profit Sharing Ratio.');
  });

  test('where a lesson was opened from is read back, never guessed', () {
    expect(LessonFrom.parse('today'), isA<FromToday>());
    final q = LessonFrom.parse('q:m3:42')! as FromQuestion;
    expect((q.attemptId, q.number), ('m3', 42));
    final c = LessonFrom.parse('chapter:accountancy:Admission of a Partner: goodwill')! as FromChapter;
    expect((c.subject, c.chapter), ('accountancy', 'Admission of a Partner: goodwill'));
    expect(LessonFrom.parse('chapter:accountancy: '), isNull);
    expect(LessonFrom.parse('q:m3:x'), isNull);
    expect(LessonFrom.parse(null), isNull);
  });

  test('names match the way a student reads them', () {
    expect(nameKey('Retirement & Death of a Partner'), nameKey('retirement and death of partner'));
    expect(catalogSubjectId('accounts'), 'accountancy');
    expect(catalogSubjectId('bst'), 'business_studies');
  });
}
