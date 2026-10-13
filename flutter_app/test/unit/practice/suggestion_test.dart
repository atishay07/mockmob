import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/practice/data/suggestion.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';

import '../core_data/support/fixtures.dart';

void main() {
  final now = DateTime(2026, 10, 13, 21);
  int ms(Duration ago) => now.subtract(ago).millisecondsSinceEpoch;

  test('an open session wins over everything', () {
    final draft = draftOf(endsAtWallMs: now.add(const Duration(minutes: 20)).millisecondsSinceEpoch);
    final s = suggestPractice(draft: draft, now: now, attempts: const [], fallbackSubject: 'accountancy', chosenSubjects: const ['english']);
    expect(s, isA<ResumeSuggestion>());
  });

  test('a finished draft is not offered', () {
    final draft = draftOf(endsAtWallMs: now.subtract(const Duration(minutes: 5)).millisecondsSinceEpoch);
    final s = suggestPractice(draft: draft, now: now, attempts: const [], fallbackSubject: 'accountancy', chosenSubjects: const ['english']);
    expect(s, isA<StartingSuggestion>());
  });

  test('no attempts: the first chosen subject, asked as a baseline only when the list is known empty', () {
    final known = suggestPractice(draft: null, now: now, attempts: const [], fallbackSubject: 'accountancy', chosenSubjects: const ['economics', 'english']);
    expect(known, isA<StartingSuggestion>());
    expect(known.subjectId, 'economics');
    expect((known as StartingSuggestion).selection.purpose, 'baseline');

    final unknown = suggestPractice(draft: null, now: now, attempts: null, fallbackSubject: 'accountancy', chosenSubjects: const ['economics']);
    expect((unknown as StartingSuggestion).firstEver, isFalse);
    expect(unknown.selection.purpose, isNull);
  });

  test('the chapter that cost the most in the latest paper of a chosen subject', () {
    final older = attemptOf(id: 'a', completedAt: ms(const Duration(days: 3)), questions: chapterOf('Goodwill', wrong: 4));
    final latest = attemptOf(
      id: 'b',
      completedAt: ms(const Duration(hours: 5)),
      questions: [...chapterOf('Admission of a partner', right: 1, wrong: 2, blank: 1), ...chapterOf('Goodwill', right: 3)],
    );
    final s = suggestPractice(draft: null, now: now, attempts: [older, latest], fallbackSubject: 'accountancy', chosenSubjects: const ['accountancy']);
    expect(s, isA<ChapterSuggestion>());
    final c = s as ChapterSuggestion;
    expect(c.chapter, 'Admission of a partner');
    expect(c.marksLost, 2 * 6 + 5);
    expect(c.missed, 3);
    expect(c.mockNumber, 2);
    expect(c.attempt.id, 'b');
    expect(c.selection.mode, PracticeMode.chapter);
    expect(c.selection.chapter, 'Admission of a partner');
  });

  test('a chapter with blanks only, or too few questions, is not named', () {
    final blanks = attemptOf(id: 'a', mode: 'quick', completedAt: ms(const Duration(hours: 1)), questions: chapterOf('Goodwill', right: 1, blank: 3));
    expect(suggestPractice(draft: null, now: now, attempts: [blanks], fallbackSubject: 'accountancy', chosenSubjects: const ['accountancy']), isA<SubjectSuggestion>());
    final thin = attemptOf(id: 'b', mode: 'quick', completedAt: ms(const Duration(hours: 1)), questions: [('Goodwill', V.wrong), ('Shares', V.wrong)]);
    expect(suggestPractice(draft: null, now: now, attempts: [thin], fallbackSubject: 'accountancy', chosenSubjects: const ['accountancy']), isA<SubjectSuggestion>());
  });

  test('General Test attempts map back to the public id', () {
    final gat = attemptOf(id: 'g', subject: 'gat', mode: 'quick', completedAt: ms(const Duration(hours: 1)), questions: [('Reasoning', V.right)]);
    final s = suggestPractice(draft: null, now: now, attempts: [gat], fallbackSubject: 'accountancy', chosenSubjects: const ['general_test']);
    expect(s.subjectId, 'general_test');
  });
}
