import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/rhythm/logic/dates.dart';
import 'package:mockmob/features/rhythm/logic/week_view.dart';

import 'fixtures.dart';

void main() {
  final today = DateTime.utc(2026, 10, 14);

  group('buildWeekView', () {
    test('marks study days by date and finds today inside the week', () {
      final view = buildWeekView(rhythmFixture(), today: today);
      expect([for (final d in view.days) d.studyDay], [true, false, true, false, false, false, false]);
      expect(view.days.indexWhere((d) => d.isToday), 2);
      expect(view.label, '2 of 4 study days');
      expect(view.status, WeekStatus.open);
    });

    test('a stale cache marks no day as today', () {
      final view = buildWeekView(rhythmFixture(), today: DateTime.utc(2026, 10, 26));
      expect(view.days.any((d) => d.isToday), isFalse);
    });

    test('met week reads "This week is done." and extra days read plainly', () {
      final met = buildWeekView(
        rhythmFixture(studyDayDates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'], met: true),
        today: today,
      );
      expect(met.label, '4 of 4 study days. This week is done.');
      final extra = buildWeekView(
        rhythmFixture(studyDayDates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'], met: true),
        today: today,
      );
      expect(extra.label, '5 days this week');
      expect(extra.status, WeekStatus.extra);
    });

    test('a goal of one day is singular', () {
      expect(buildWeekView(rhythmFixture(goal: 1, studyDayDates: []), today: today).label, '0 of 1 study day');
    });

    test('paused says so in words with the date', () {
      final view = buildWeekView(rhythmFixture(paused: true), today: today, pausedUntil: '2026-10-26');
      expect(view.label, 'Rhythm is paused until 26 October.');
      expect(buildWeekView(rhythmFixture(paused: true), today: today).label, 'Rhythm is paused.');
    });

    test('an unreadable week start does not crash and marks nothing', () {
      final view = buildWeekView(rhythmFixture(weekStart: 'oops'), today: today);
      expect(view.days.every((d) => !d.studyDay && !d.isToday), isTrue);
    });
  });

  group('run language', () {
    test('weeks in rhythm is never shown as 0', () {
      expect(weeksInRhythmText(rhythmFixture(streak: 3)), 'Weeks in rhythm: 3');
      final none = weeksInRhythmText(rhythmFixture(streak: 0));
      expect(none, isNot(contains('0')));
      expect(none, RhythmCopy.weeksInRhythmNone);
    });

    test('an ended run keeps the best and never says lost', () {
      final note = runNote(rhythmFixture(streak: 0, best: 6))!;
      expect(note, 'A new run starts this week. Your best is still 6 weeks.');
      expect(note.toLowerCase(), isNot(contains('lost')));
    });

    test('no note while the run runs, or for a student with no best yet', () {
      expect(runNote(rhythmFixture(streak: 2, best: 6)), isNull);
      expect(runNote(rhythmFixture(streak: 0, best: 0)), isNull);
    });
  });

  group('closed weeks and counts', () {
    test('closed week rows read as the spec says', () {
      expect(
        closedWeekText(const RhythmWeek(weekStart: '2026-10-05', studyDays: 4, goal: 4, met: true)),
        'Week of 5 October, 4 of 4 days.',
      );
    });

    test('week counts omit zeros and unknowns', () {
      expect(RhythmCopy.weekCounts(mocks: 2, repairs: 7), '2 mocks, 7 mistakes repaired this week.');
      expect(RhythmCopy.weekCounts(mocks: 0, repairs: 1), '1 mistake repaired this week.');
      expect(RhythmCopy.weekCounts(mocks: 0, repairs: 0), isNull);
      expect(RhythmCopy.weekCounts(), isNull);
    });
  });

  group('dates', () {
    test('parseIsoDate rejects impossible dates', () {
      expect(parseIsoDate('2026-02-30'), isNull);
      expect(parseIsoDate('2026-10-12'), DateTime.utc(2026, 10, 12));
      expect(parseIsoDate(null), isNull);
    });

    test('studentDate follows the student zone, not the phone', () {
      // 8:30 PM UTC on 12 October is already 13 October in India.
      expect(studentDate(DateTime.utc(2026, 10, 12, 20, 30), 'Asia/Kolkata'), DateTime.utc(2026, 10, 13));
      expect(studentDate(DateTime.utc(2026, 10, 12, 20, 30), 'Europe/London'), DateTime.utc(2026, 10, 12));
    });

    test('achieved dates add the year only when it differs', () {
      final now = DateTime.utc(2026, 10, 12);
      expect(formatAchievedDate(DateTime.utc(2026, 10, 9, 10), 'Asia/Kolkata', now), '9 October');
      expect(formatAchievedDate(DateTime.utc(2025, 12, 31, 10), 'Asia/Kolkata', now), '31 December 2025');
    });
  });
}
