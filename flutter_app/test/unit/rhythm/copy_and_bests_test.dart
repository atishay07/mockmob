import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/rhythm/screens/bests_screen.dart';
import 'package:mockmob/features/rhythm/screens/milestones_screen.dart';

void main() {
  group('copy follows the binding rules', () {
    final samples = <String>[
      RhythmCopy.weekLoadFailed,
      RhythmCopy.rhythmOffBody,
      RhythmCopy.asOf(DateTime(2026, 10, 12, 21, 15)),
      RhythmCopy.stripOpen(2, 4),
      RhythmCopy.stripMet(4, 4),
      RhythmCopy.stripExtra(5),
      RhythmCopy.paused('26 October'),
      RhythmCopy.goalSentence(4),
      RhythmCopy.goalSentence(7),
      RhythmCopy.weeksInRhythm(3),
      RhythmCopy.weeksInRhythmNone,
      RhythmCopy.bestRun(6),
      RhythmCopy.newRun(6),
      RhythmCopy.goalRow(4),
      RhythmCopy.goalSaved(5),
      RhythmCopy.turnOffConfirmBody,
      RhythmCopy.closedWeekRow('5 October', 4, 4),
      RhythmCopy.celebrationsFullHint,
      RhythmCopy.celebrationsQuietHint,
      RhythmCopy.milestonesEmptyBody,
      RhythmCopy.bestsEmptyBody,
      RhythmCopy.bestsFootnote,
      RhythmCopy.bestFirst('full mock'),
      RhythmCopy.bestPair('142 of 250 marks', '131 of 250 marks'),
      RhythmCopy.bestDates('3 October', '9 October'),
      RhythmCopy.endingMet(4),
      RhythmCopy.endingNotMet(2, 4),
      RhythmCopy.endingGoalNow(5),
      RhythmCopy.endingRestWeek('18 October'),
      RhythmCopy.welcomeBack,
      RhythmCopy.nothingLost,
      RhythmCopy.lastNight(3, 3),
      RhythmCopy.lateNightStop,
      RhythmCopy.firstRepairSentence,
      RhythmCopy.weekDoneSentence,
      RhythmCopy.firstWeekSentence,
      RhythmCopy.weekReceipt(4, 4),
      for (final id in ['first_scored_session', 'first_full_mock', 'first_repair', 'repairs_5', 'repairs_10', 'repairs_25', 'sessions_10', 'first_week_met', 'weeks_met_4'])
        RhythmCopy.milestoneRow(id, '9 October')!,
    ];

    test('no middle dots, emoji, arrows, exclamation marks, prices or "mastered"', () {
      final emoji = RegExp(r'[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]', unicode: true);
      for (final s in samples) {
        expect(s, isNot(contains('·')), reason: s);
        expect(s, isNot(contains('!')), reason: s);
        expect(s, isNot(contains('→')), reason: s);
        expect(s, isNot(contains('▸')), reason: s);
        expect(s.contains(emoji), isFalse, reason: s);
        expect(s.toLowerCase(), isNot(contains('mastered')), reason: s);
        expect(s, isNot(contains('₹')), reason: s);
        expect(s.toLowerCase(), isNot(contains('streak')), reason: s);
        expect(s.toLowerCase(), isNot(contains('flame')), reason: s);
        expect(s.toLowerCase(), isNot(contains('lost your')), reason: s);
      }
    });

    test('exact spec lines', () {
      expect(RhythmCopy.lastNight(3, 3), 'Last night: 3 mistakes repaired. 3 are waiting.');
      expect(RhythmCopy.lastNight(1, 1), 'Last night: 1 mistake repaired. 1 is waiting.');
      expect(RhythmCopy.welcomeBack, 'Welcome back. Pick up with a small next step.');
      expect(RhythmCopy.goalRow(4), 'Goal: 4 days a week');
      expect(RhythmCopy.bestRun(1), 'Best run: 1 week');
    });

    test('an unknown milestone id prints nothing rather than a raw id', () {
      expect(RhythmCopy.milestoneRow('fresh_check_done', '9 October'), isNull);
    });
  });

  group('milestone rows', () {
    final now = DateTime.utc(2026, 10, 12);

    test('earned rows only, newest first, dated in the student zone', () {
      final rows = milestoneRows(
        [
          RhythmMilestone(id: 'first_scored_session', achievedAt: DateTime.utc(2026, 9, 1, 10)),
          RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 9, 10)),
          const RhythmMilestone(id: 'repairs_5'),
          RhythmMilestone(id: 'mystery', achievedAt: DateTime.utc(2026, 10, 10)),
        ],
        zone: 'Asia/Kolkata',
        now: now,
      );
      expect([for (final r in rows) r.text], ['First repair finished on 9 October', 'First scored session on 1 September']);
    });
  });

  group('personal bests', () {
    final json = {
      'bests': [
        {
          'formatId': 'full:accountancy:q50:server_snapshot_v1',
          'subject': 'accountancy',
          'mode': 'full',
          'attempts': 2,
          'best': {'marks': 142, 'max': 250, 'attemptId': 'a1', 'completedAt': 1760000000000},
          'latest': {'marks': 131, 'max': 250, 'attemptId': 'a2', 'completedAt': 1760500000000},
        },
        {
          'formatId': 'quick:accountancy:q10:server_practice_v1',
          'subject': 'accountancy',
          'mode': 'quick',
          'attempts': 3,
          'best': {'marks': 30, 'max': 50, 'attemptId': 'a3'},
          'latest': {'marks': 30, 'max': 50, 'attemptId': 'a3'},
        },
      ],
    };

    test('parses and reads the question count from the format id', () {
      final list = BestsRepository().parse(json);
      expect(list, hasLength(2));
      expect(list.first.questions, 50);
      expect(list.first.isMock, isTrue);
      expect(list.last.isMock, isFalse);
    });

    test('two attempts show best and latest with denominators, no percentile', () {
      final b = BestsRepository().parse(json).first;
      expect(bestBody(b), 'Best on this mock type: 142 of 250 marks. Latest: 131 of 250 marks.');
      expect(bestBody(b), isNot(contains('%')));
    });

    test('one attempt promises a change only after a second', () {
      const mark = BestMark(marks: 120, max: 250, attemptId: 'a');
      const one = PersonalBest(formatId: 'full:accountancy:q50:v', subject: 'accountancy', mode: 'full', attempts: 1, best: mark, latest: mark);
      expect(bestBody(one), 'First full mock saved. A second one will show your change.');
    });

    test('negative marks use the real minus sign', () {
      const mark = BestMark(marks: -12, max: 250, attemptId: 'a');
      expect(marksText(mark), '−12 of 250 marks');
    });

    test('subject slugs read as words', () {
      expect(humanizeSlug('general_test'), 'General test');
      expect(modeLabel('nta'), 'NTA-style mock');
    });
  });
}
