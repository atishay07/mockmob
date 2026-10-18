// The pure logic of the badge home, the badge sheet and the "Badge earned" row (BADGES-REFINE-1018): the head,
// the shelf order, which badge is the next one, the exact count left and its words, the next badge on a path, what
// the sheet says, which badges a paper earned, and the counts the board reads from the server. Every rule here is
// the website's (`src/lib/badgeShelf.js`), so web and phone agree.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/badge_record.dart';
import 'package:mockmob/features/rhythm/logic/badge_shelf.dart';
import 'package:mockmob/features/rhythm/logic/dates.dart';
import 'package:mockmob/features/rhythm/logic/milestone_progress.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';

import 'fixtures.dart';

/// A board where [earned] have dates; the two new server ids are listed (so they are readable) unless [listNew] is false.
List<TrackView> board(Map<String, DateTime> earned, {Set<String> unreadable = const {}, bool listNew = true}) => milestoneTracks(
      [
        for (final e in earned.entries) RhythmMilestone(id: e.key, achievedAt: e.value),
        if (listNew) ...[
          if (!earned.containsKey('first_hold')) const RhythmMilestone(id: 'first_hold'),
          if (!earned.containsKey('run_weeks_3')) const RhythmMilestone(id: 'run_weeks_3'),
        ],
      ],
      unreadable: unreadable,
    );

final _t0 = DateTime.utc(2026, 9, 1, 6);
DateTime _day(int n) => _t0.add(Duration(days: n));

/// Every badge dated, one a day in shelf order.
Map<String, DateTime> _all() => {for (final (i, s) in milestoneSteps.indexed) s.id: _day(i)};

void main() {
  group('the head and the shelf', () {
    test('the head counts earned of all sixteen, and none is "0 of 16", never blank', () {
      expect(badgesHead(board({'first_scored_session': _day(0), 'first_repair': _day(1)})), 'Badges, 2 of 16');
      expect(badgesHead(board(const {})), 'Badges, 0 of 16');
      expect(badgesHead(board(_all())), 'Badges, 16 of 16');
    });

    test('the shelf is the earned badges, newest first, and holds nothing that is not dated', () {
      final tracks = board({'first_scored_session': _day(5), 'first_repair': _day(9), 'clean_set': _day(7)});
      expect([for (final b in earnedShelf(tracks)) b.id], ['first_repair', 'clean_set', 'first_scored_session']);
      expect(earnedShelf(board(const {})), isEmpty);
    });

    test('two badges dated the same moment keep the shelf order', () {
      final tracks = board({'first_scored_session': _day(5), 'first_full_mock': _day(5)});
      expect([for (final b in earnedShelf(tracks)) b.id], ['first_scored_session', 'first_full_mock']);
    });
  });

  group('counts and their words', () {
    test('a count has its denominator and says how many are left', () {
      final c = countLeft('full_mocks_5', const {'full_mocks_5': 3})!;
      expect(c.so, '3 of 5 full mocks');
      expect(c.short, '3 of 5');
      expect(c.more, '2 more full mocks');
      expect(c.left, 2);
      expect(c.fraction, closeTo(0.6, 1e-9));
      expect(countLeft('repairs_10', const {'repairs_10': 9})!.more, '1 more repair');
    });

    test('unknown is never zero: no count, no words', () {
      expect(countLeft('repairs_10', const {}), isNull);
      expect(milestoneFraction('repairs_10', const {}), isNull);
    });

    test('a badge that is a single event has no count, and a count at or past its target is not "left"', () {
      expect(countLeft('first_repair', const {'first_repair': 0}), isNull);
      expect(countLeft('sessions_10', const {'sessions_10': 10}), isNull);
      expect(countLeft('sessions_10', const {'sessions_10': 12}), isNull);
    });

    test('the ghost line is the path, the count and what is left; without an exact count it is the path and the condition', () {
      final tracks = board({'first_scored_session': _day(0), 'first_repair': _day(1), 'repairs_5': _day(2)});
      final next = pickNext(tracks, const {'repairs_10': 7})!;
      expect(next.id, 'repairs_10');
      expect(ghostLine(next, const {'repairs_10': 7}), 'Repairs: 7 of 10. 3 more repairs.');
      final plain = pickNext(board(const {}), const {})!;
      expect(ghostLine(plain, const {}), 'Papers. Lands when a set with 5 or more answers is scored.');
    });
  });

  group('which badge is next', () {
    test('the one closest to done where an exact count exists', () {
      final tracks = board({'first_scored_session': _day(0), 'first_full_mock': _day(0), 'first_repair': _day(0)});
      // Papers: first_nta is next (no count); repairs: repairs_5 at 4 of 5; weeks: first_week_met (no count).
      expect(pickNext(tracks, const {'repairs_5': 4})!.id, 'repairs_5');
      // Two counted candidates: the fuller one wins.
      expect(pickNext(tracks, const {'repairs_5': 1, 'four_subjects': 3, 'full_mocks_5': 1})!.id, 'four_subjects');
    });

    test('a count of nothing yet is not "close": a new student is shown the first badge in shelf order', () {
      expect(pickNext(board(const {}), const {'sessions_10': 0, 'repairs_5': 0, 'run_weeks_3': 0})!.id, 'first_scored_session');
    });

    test('a badge that could not be read is never next, and never held up as "not yet"', () {
      final tracks = board(const {}, unreadable: const {'first_nta'});
      final papers = tracks.firstWhere((t) => t.track == MilestoneTrack.papers);
      expect(papers.steps.firstWhere((s) => s.step.id == 'first_nta').status, StepStatus.unknown);
      expect(pickNext(tracks, const {})!.id, 'first_scored_session');
    });

    test('nothing is next when every readable badge is earned', () {
      expect(pickNext(board(_all()), const {}), isNull);
    });
  });

  group('the next badge on a path', () {
    test('after this one on the same path, with later ones named too', () {
      final tracks = board({'first_scored_session': _day(0), 'first_repair': _day(1)});
      final n = nextOnPath(tracks, 'first_repair')!;
      expect(n.badge.id, 'repairs_5');
      expect(n.also, isFalse);
    });

    test('your best work is not a sequence: it is the other badge still to earn', () {
      final tracks = board({'clean_set': _day(0)});
      final n = nextOnPath(tracks, 'clean_set')!;
      expect(n.also, isTrue);
      expect(n.badge.id, 'four_subjects');
      expect(nextOnPath(board({'clean_set': _day(0), 'four_subjects': _day(1), 'new_best': _day(2)}), 'clean_set'), isNull);
    });

    test('the last badge of a path has none, and an unreadable badge is not named', () {
      final partway = board({'first_repair': _day(0), 'repairs_5': _day(1), 'repairs_10': _day(2), 'repairs_25': _day(3)});
      expect(nextOnPath(partway, 'repairs_25')!.badge.id, 'first_hold');
      expect(nextOnPath(board(_all()), 'first_hold'), isNull);
      final unlisted = board({'first_repair': _day(0), 'repairs_5': _day(1), 'repairs_10': _day(2), 'repairs_25': _day(3)}, listNew: false);
      expect(nextOnPath(unlisted, 'repairs_25'), isNull, reason: 'first_hold was not listed, so it could not be read');
    });
  });

  group('what the sheet says', () {
    final at = DateTime.utc(2026, 10, 17, 15, 42); // 9:12 PM in India

    test('an earned badge says the day and the 12-hour time, in the student\'s zone', () {
      final d = detailOf(board({'first_repair': at}), 'first_repair')!;
      expect(d.earnedLine, 'Earned Sat 17 Oct, 9:12 PM');
      expect(d.earned, isTrue);
      expect(formatWhen(DateTime.utc(2026, 10, 17, 18, 31), 'Asia/Kolkata'), 'Sun 18 Oct, 12:01 AM');
      expect(formatWhen(DateTime.utc(2026, 10, 18, 6, 30), 'Asia/Kolkata'), 'Sun 18 Oct, 12:00 PM');
    });

    test('the paper it came from, with its marks and what it beat; its own time is not said twice', () {
      final record = BadgeRecord(attemptId: 'a1', subject: 'accountancy', mode: 'full', at: at, marks: 152, max: 250, before: 142);
      final d = detailOf(board({'new_best': at}), 'new_best', records: {'new_best': record})!;
      expect(d.paper!.attemptId, 'a1');
      expect(d.paper!.from, 'From Accountancy full mock');
      expect(d.paper!.marks, '152 of 250 marks, 142 before');
      final later = BadgeRecord(attemptId: 'a1', subject: 'accountancy', mode: 'full', at: at.subtract(const Duration(hours: 2)), marks: 152, max: 250);
      expect(detailOf(board({'new_best': at}), 'new_best', records: {'new_best': later})!.paper!.from, 'From Accountancy full mock, Sat 17 Oct, 7:12 PM');
    });

    test('a badge with no record names no paper: no source is ever made up', () {
      expect(detailOf(board({'first_repair': at}), 'first_repair')!.paper, isNull);
    });

    test('a badge not earned has no date, its condition and count so far with the denominator, and the key that earns it', () {
      final d = detailOf(board({'first_scored_session': _day(0)}), 'sessions_10', progress: const {'sessions_10': 4})!;
      expect(d.earnedLine, isNull);
      expect(d.count!.so, '4 of 10 scored sets');
      expect(d.action!.label, 'Start a quick practice');
      expect(d.badge.step.condition, 'Lands with your 10th scored set of 5 or more answers.');
    });

    test('an earned badge leads on to the next one with the count left and the next one\'s own key', () {
      final tracks = board({'first_scored_session': _day(0), 'first_repair': at});
      final d = detailOf(tracks, 'first_repair', progress: const {'repairs_5': 3})!;
      expect(d.next!.badge.id, 'repairs_5');
      expect(d.nextCount!.more, '2 more repairs');
      expect(d.action!.label, 'Open your mistakes');
    });

    test('a badge that could not be read has no count, no key and says so', () {
      final d = detailOf(board(const {}, unreadable: const {'clean_set'}), 'clean_set', progress: const {'full_mocks_5': 2})!;
      expect(d.unknown, isTrue);
      expect(d.count, isNull);
      expect(d.action, isNull);
      expect(d.earnedLine, isNull);
    });

    test('a later badge says what comes before it, and where it sits on its path', () {
      final d = detailOf(board({'first_scored_session': _day(0)}), 'repairs_10')!;
      expect(d.after, '5 repairs');
      expect(d.pathLine, 'Repairs, step 3 of 5.');
      expect(detailOf(board(const {}), 'clean_set')!.pathLine, 'Your best work. Any of these can come first.');
    });

    test('an id that is not on the board has no sheet', () {
      expect(detailOf(board(const {}), 'nope'), isNull);
    });
  });

  group('the paper that earned a badge', () {
    final done = DateTime.utc(2026, 10, 17, 15, 42);
    final now = DateTime.utc(2026, 10, 17, 16);

    List<String> ids(List<TrackView> t, {Map<String, BadgeRecord> records = const {}, String attempt = 'a1', DateTime? completed, DateTime? at}) => [
          for (final b in earnedByAttempt(t, records, attemptId: attempt, completedAt: completed ?? done, now: at ?? now)) b.id,
        ];

    test('a record that names this paper ties its badge to it', () {
      final tracks = board({'clean_set': done});
      final records = {'clean_set': BadgeRecord(attemptId: 'a1', subject: 'accountancy', mode: 'quick', at: done, marks: 50, max: 50)};
      expect(ids(tracks, records: records), ['clean_set']);
      expect(ids(tracks, records: records, attempt: 'other', completed: done.subtract(const Duration(hours: 1))), isEmpty);
    });

    test('a papers, weeks or best-work badge dated within two minutes of the paper belongs to it', () {
      expect(ids(board({'first_full_mock': done.add(const Duration(seconds: 90))})), ['first_full_mock']);
      expect(ids(board({'first_full_mock': done.add(const Duration(minutes: 3))})), isEmpty);
      expect(ids(board({'first_week_met': done})), ['first_week_met']);
    });

    test('a repair is dated by the repair, so only a record can tie it to a paper', () {
      expect(ids(board({'first_repair': done})), isEmpty);
    });

    test('a badge with no date never counts, and after three days a result announces nothing', () {
      expect(ids(board(const {})), isEmpty);
      expect(ids(board({'first_scored_session': done}), at: done.add(const Duration(days: 3, minutes: 1))), isEmpty);
      expect(ids(board({'first_scored_session': done}), at: done.add(const Duration(days: 2))), ['first_scored_session']);
    });

    test('a paper with no real date matches nothing by time', () {
      expect(ids(board({'first_scored_session': DateTime.utc(1970)}), completed: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true), at: DateTime.utc(1970, 1, 2)), isEmpty);
    });
  });

  group('the words of the earned row and the once-only key', () {
    test('one badge, or a count of badges with their names', () {
      final tracks = board({'first_scored_session': _day(0), 'first_full_mock': _day(0), 'clean_set': _day(0)});
      List<BoardBadge> pick(List<String> ids) => [for (final b in boardOf(tracks)) if (ids.contains(b.id)) b];
      final one = momentWords(pick(['clean_set']))!;
      expect(one.title, 'Badge earned');
      expect(one.detail, 'Clean set');
      final two = momentWords(pick(['first_scored_session', 'first_full_mock']))!;
      expect(two.title, '2 badges earned');
      expect(two.detail, 'First scored set and First full mock');
      expect(momentWords(const []), isNull);
    });

    test('the seen key holds the id and the server\'s own date, so a badge dated again is a new moment', () {
      final a = badgeSeenKey('clean_set', DateTime.utc(2026, 10, 17, 15, 42));
      expect(a, 'badge-seen:clean_set:${DateTime.utc(2026, 10, 17, 15, 42).millisecondsSinceEpoch}');
      expect(badgeSeenKey('clean_set', DateTime.utc(2026, 10, 18)), isNot(a));
    });
  });

  group('the counts the board reads', () {
    test('finished repairs come from the server\'s own count, never from the phone', () {
      final rhythm = rhythmFixture(streak: 0, counts: const RhythmCounts(sessions: 3, repairs: 7, weeksMet: 2));
      final p = milestoneProgress(rhythm: rhythm);
      expect(p['repairs_10'], 7);
      expect(p['repairs_25'], 7);
      expect(p['weeks_met_4'], 2);
      expect(p['sessions_10'], 3, reason: 'from the server when the phone holds no attempts');
    });

    test('a server that sends no counts leaves repairs unknown, not zero', () {
      final p = milestoneProgress(rhythm: rhythmFixture());
      expect(p.containsKey('repairs_5'), isFalse);
      expect(p.containsKey('repairs_10'), isFalse);
    });

    test('a repair badge already earned, or a count at its target, is dropped', () {
      final rhythm = rhythmFixture(
        counts: const RhythmCounts(repairs: 10),
        milestones: [RhythmMilestone(id: 'repairs_5', achievedAt: _t0)],
      );
      final p = milestoneProgress(rhythm: rhythm);
      expect(p.containsKey('repairs_5'), isFalse);
      expect(p.containsKey('repairs_10'), isFalse, reason: 'it reached 10, so the server dates it, not the count');
      expect(p['repairs_25'], 10);
    });

    test('3 weeks in a row counts the run now, never an older best run', () {
      expect(milestoneProgress(rhythm: rhythmFixture(streak: 2, best: 6))['run_weeks_3'], 2);
      expect(milestoneProgress(rhythm: rhythmFixture(streak: 0, best: 6))['run_weeks_3'], 0);
    });
  });

  group('parity with the website: the sixteen ids', () {
    test('the phone has exactly the website\'s ids, in the website\'s order, on the same four paths', () {
      const web = [
        ('first_scored_session', 'papers'),
        ('first_full_mock', 'papers'),
        ('first_nta', 'papers'),
        ('sessions_10', 'papers'),
        ('full_mocks_5', 'papers'),
        ('first_repair', 'repairs'),
        ('repairs_5', 'repairs'),
        ('repairs_10', 'repairs'),
        ('repairs_25', 'repairs'),
        ('first_hold', 'repairs'),
        ('first_week_met', 'rhythm'),
        ('weeks_met_4', 'rhythm'),
        ('run_weeks_3', 'rhythm'),
        ('clean_set', 'best'),
        ('four_subjects', 'best'),
        ('new_best', 'best'),
      ];
      expect([for (final s in milestoneSteps) (s.id, s.track.name)], web);
    });

    test('names and conditions are the website\'s words', () {
      String name(String id) => milestoneSteps.firstWhere((s) => s.id == id).name;
      String cond(String id) => milestoneSteps.firstWhere((s) => s.id == id).condition;
      expect(name('first_nta'), 'Exam-day rehearsal');
      expect(name('first_hold'), 'It held');
      expect(name('run_weeks_3'), '3 weeks in a row');
      expect(cond('first_full_mock'), 'Lands when a 50-question full mock is scored.');
      expect(cond('weeks_met_4'), 'Lands when a fourth week reaches its goal. They need not be in a row.');
      expect(cond('new_best'), 'Lands when you beat your own marks on the same kind of mock.');
    });
  });
}
