// "How many questions?" (owner, 18 Oct, D50): Practice's own lengths (5, 10, 15 and 20) and the full
// mock as the last row, and a day-one Weak chapters line that names where to start from the planner's
// ranking, never from an invented marks figure.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/data/chapter_order.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/glance_builder.dart';
import 'package:mockmob/features/today/logic/links.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

MoveHero _move(TodayView v) => v.hero! as MoveHero;

void main() {
  final cleanRecord = [accountancyMock('clean', daysBefore(tuesdayEvening, 1))];

  group('the lengths', () {
    test('Today offers whatever Practice offers, in its order, then the full mock last', () {
      expect(practiceChoices, practiceCounts);
      final m = _move(buildToday(ashaInputs(attempts: cleanRecord)));
      expect([for (final d in m.durations) d.minutes], [...practiceCounts, 60]);
      expect([for (final d in m.durations) d.fullMock], [false, false, false, false, true]);
      expect(m.durations.last.questions, mockQuestionCount);
      expect([for (final d in m.durations) TodayCopy.lengthRowWords(d)], [
        '5 questions',
        '10 questions',
        '15 questions',
        '20 questions',
        'Full mock: 50 questions, 60 min',
      ]);
    });

    test('the pill says 60 min for the full mock and the count for the rest', () {
      expect(TodayCopy.lengthWords(const DurationChoice(minutes: 15, questions: 15)), '15 questions');
      expect(TodayCopy.lengthWords(const DurationChoice.fullMock(questions: 50)), '60 min');
      expect(const DurationChoice.fullMock(questions: 50).label, '60 min');
      expect(const DurationChoice.fullMock(questions: 50), isNot(const DurationChoice(minutes: 60, questions: 50)));
    });

    test('15 is a real pick: the number, the sentence and the key follow it', () {
      final m = _move(buildToday(ashaInputs(attempts: const [], selectedMinutes: 15)));
      expect(m.number, '15');
      expect(m.selectedMinutes, 15);
      expect(m.primary.label, 'Start now, 15 min');
      expect((m.primary.target as GoTo).location, contains('count=15'));
    });
  });

  group('the full mock row', () {
    test('on day one it starts the same full mock "Full mock instead" starts', () {
      final before = _move(buildToday(ashaInputs(attempts: const [])));
      final viaChoice = before.secondary!;
      expect(viaChoice.label, TodayCopy.fullMockInstead);
      final m = _move(buildToday(ashaInputs(attempts: const [], selectedMinutes: fullMockMinutes)));
      expect(m.selectedMinutes, 60);
      expect(m.kind, MoveKind.mock);
      expect(m.number, '50');
      expect(m.numberLabel, 'questions in\n60 minutes');
      expect(m.primary.label, 'Start full mock, 60 min');
      expect(m.primary.startsSession, isTrue);
      expect(m.primary.actionType, 'mock');
      // Same set-up, so the same credits rule, confirm sheet and NTA rules.
      expect(m.primary.target, viaChoice.target);
      expect((m.primary.target as GoTo).location, TodayLinks.fullMock(subject: 'accountancy'));
      // The card is the full mock now: no second Full mock key beside it.
      expect(m.secondary, isNull);
      expect(m.canChangeLength, isTrue, reason: 'the pill stays, so the student can go back to a count');
    });

    test('on another practice move it keeps its other key and still opens the full mock', () {
      final m = _move(buildToday(ashaInputs(attempts: cleanRecord, selectedMinutes: fullMockMinutes)));
      expect(m.primary.actionType, 'mock');
      expect(m.primary.label, 'Start full mock, 60 min');
      expect((m.primary.target as GoTo).location, TodayLinks.fullMock(subject: 'accountancy'));
      expect(m.secondary?.label, TodayCopy.somethingElse);
    });

    test('a repair never turns into a mock because 60 was picked earlier', () {
      final m = _move(buildToday(ashaInputs(selectedMinutes: fullMockMinutes)));
      expect(m.primary.actionType, 'repair');
      expect(m.durations.any((d) => d.fullMock), isFalse);
    });

    test('the next-action reader (the recap) sees the same full mock', () {
      final m = buildMove(ashaInputs(attempts: const [], selectedMinutes: fullMockMinutes));
      expect(m.primary.actionType, 'mock');
    });

    test('a swapped-in card follows the pick too, and keeps a count otherwise', () {
      final i = ashaInputs(attempts: cleanRecord, selectedMinutes: fullMockMinutes);
      expect(otherSubjectMoveFor(i, subject: 'economics').primary.actionType, 'mock');
      final i10 = ashaInputs(attempts: cleanRecord);
      expect(otherSubjectMoveFor(i10, subject: 'economics').number, '10');
    });
  });

  group('day-one Weak chapters', () {
    test('names the first two ranked chapters of the subject', () {
      final w = buildWeakChapters(ashaInputs(attempts: const []));
      expect(w.dayOne, isTrue);
      expect(w.startChapters, ['Partnership', 'Company Accounts']);
      expect(GlanceCopy.weakDayOneStart(w.startChapters), 'Start with Partnership and Company Accounts. Your first paper shows where your marks go.');
    });

    test('follows the subject the lead card is about', () {
      final i = ashaInputs(attempts: const [], profile: const TodayProfile(weakestSubject: 'economics'));
      expect(dayOneSubject(i), 'economics');
      expect(buildWeakChapters(i).startChapters, ['Money and Banking', 'National Income']);
      final bst = ashaInputs(attempts: const [], profile: const TodayProfile(weakestSubject: 'business'));
      expect(buildWeakChapters(bst).startChapters, ['Principles of Management', 'Marketing']);
    });

    test("a subject with no ranking keeps today's line", () {
      final w = buildWeakChapters(ashaInputs(attempts: const [], profile: const TodayProfile(weakestSubject: 'history')));
      expect(w.dayOne, isTrue);
      expect(w.startChapters, isEmpty);
      expect(rankedChapters('history'), isNull);
      expect(rankedChapters(null), isNull);
      expect(GlanceCopy.weakDayOne, 'Your weak chapters show here after your first paper: where the marks go, chapter by chapter.');
    });

    test('with a paper on record the day-one list is gone', () {
      final w = buildWeakChapters(ashaInputs(attempts: cleanRecord));
      expect(w.dayOne, isFalse);
      expect(w.startChapters, isEmpty);
    });

    test('the ranked subjects are exactly the ones the planner file ranks, in its order', () {
      final raw = jsonDecode(File('../data/cuet_chapter_priorities.json').readAsStringSync()) as Map<String, dynamic>;
      expect({for (final s in kRankedSubjects) s.id}, {...raw.keys}..remove('gat'));
      for (final s in kRankedSubjects) {
        expect(rankedChapters(s.id), (raw[s.id] as List).take(2).cast<String>().toList(), reason: s.id);
      }
    });

    test('the line says where to start and claims no marks', () {
      final line = GlanceCopy.weakDayOneStart(const ['Partnership', 'Company Accounts']);
      expect(line, isNot(contains('marks ride')));
      expect(line, isNot(matches(RegExp(r'\d'))));
    });
  });
}
