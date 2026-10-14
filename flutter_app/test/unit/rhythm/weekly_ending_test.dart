import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/late_night.dart';
import 'package:mockmob/features/rhythm/logic/weekly_ending.dart';

import 'fixtures.dart';

RhythmWeek _closed({int days = 4, int goal = 4, bool met = true}) =>
    RhythmWeek(weekStart: '', studyDays: days, goal: goal, met: met);

void main() {
  group('weekly ending', () {
    test('met week: exact words and the three keys', () {
      final data = weeklyEndingFor(rhythmFixture(goal: 4, lastClosed: _closed()), dismissed: {})!;
      expect(data.body, 'You finished 4 study days last week. That met your goal.');
      expect([for (final k in data.keys) k.label], ['Keep 4 days a week', 'Aim for 5 days', 'Aim for 3 days']);
      expect(data.keys[1].goal, 5);
      expect(data.keys[2].goal, 3);
      expect(data.weekId, '2026-10-05');
      expect(data.celebrationId, 'week:2026-10-05');
      expect(data.dismissId, 'week-card:2026-10-05');
    });

    test('unmet week: nothing is lost, keys are Keep, Aim for, Take a rest week', () {
      final data = weeklyEndingFor(
        rhythmFixture(goal: 4, streak: 0, best: 6, lastClosed: _closed(days: 2, met: false)),
        dismissed: {},
      )!;
      expect(data.body, 'You finished 2 of 4 study days. Nothing is lost. Your record is as you left it.');
      expect([for (final k in data.keys) k.label], ['Keep 4 days a week', 'Aim for 2 days', 'Take a rest week']);
      expect(data.runNote, 'A new run starts this week. Your best is still 6 weeks.');
      expect(data.restUntil, '2026-10-18');
    });

    test('goal limits hide impossible keys', () {
      final seven = weeklyEndingFor(rhythmFixture(goal: 7, lastClosed: _closed(days: 7, goal: 7)), dismissed: {})!;
      expect([for (final k in seven.keys) k.label], ['Keep 7 days a week', 'Aim for 6 days']);
      final one = weeklyEndingFor(rhythmFixture(goal: 1, lastClosed: _closed(days: 1, goal: 1)), dismissed: {})!;
      expect([for (final k in one.keys) k.label], ['Keep 1', 'Try 2']);
    });

    test('shows once: a dismissed week stays away', () {
      final r = rhythmFixture(lastClosed: _closed());
      expect(weeklyEndingFor(r, dismissed: {'week-card:2026-10-05'}), isNull);
    });

    test('nothing honest to say means no card', () {
      expect(weeklyEndingFor(rhythmFixture(), dismissed: {}), isNull);
      expect(weeklyEndingFor(rhythmFixture(lastClosed: _closed(days: 0, met: false)), dismissed: {}), isNull);
      expect(weeklyEndingFor(rhythmFixture(paused: true, lastClosed: _closed(days: 2, met: false)), dismissed: {}), isNull);
      expect(weeklyEndingFor(rhythmFixture(weekStart: 'nope', lastClosed: _closed()), dismissed: {}), isNull);
    });
  });

  group('late-night line', () {
    test('runs from 11 PM to 5 AM only', () {
      expect(isLateNight(DateTime(2026, 10, 12, 23)), isTrue);
      expect(isLateNight(DateTime(2026, 10, 13, 3)), isTrue);
      expect(isLateNight(DateTime(2026, 10, 13, 4, 59)), isTrue);
      expect(isLateNight(DateTime(2026, 10, 13, 5)), isFalse);
      expect(isLateNight(DateTime(2026, 10, 13, 6, 59)), isFalse);
      expect(isLateNight(DateTime(2026, 10, 12, 22, 59)), isFalse);
      expect(lateNightLine(DateTime(2026, 10, 12, 12)), isNull);
      expect(lateNightLine(DateTime(2026, 10, 12, 23, 30)), 'That is a good place to stop for tonight.');
    });

    test('a night keeps one key across midnight', () {
      expect(lateNightKey(DateTime(2026, 10, 12, 23, 30)), lateNightKey(DateTime(2026, 10, 13, 1)));
      expect(lateNightKey(DateTime(2026, 10, 12, 23, 30)), lateNightKey(DateTime(2026, 10, 13, 4, 59)));
      expect(lateNightKey(DateTime(2026, 10, 13, 23, 30)), isNot(lateNightKey(DateTime(2026, 10, 13, 1))));
    });
  });
}
