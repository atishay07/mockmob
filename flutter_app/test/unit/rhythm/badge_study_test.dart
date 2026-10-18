// The study side of the badges: the paper behind a derived badge, a derived badge landing as one
// quiet moment (never five ceremonies at once), Mobi reading it on You, and the two new blocks of
// Personal bests.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/celebration/rhythm_watcher.dart';
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/rhythm/logic/badge_record.dart';
import 'package:mockmob/features/rhythm/logic/derived_badges.dart';
import 'package:mockmob/features/rhythm/logic/fastest_answer.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/rhythm/screens/bests_screen.dart';
import 'package:mockmob/features/you/hub/hub_mobi.dart';
import 'package:mockmob/features/you/hub/sheet_fields.dart';

import '../../helpers/golden_harness.dart';
import 'fixtures.dart';

Attempt _a(
  String id, {
  required DateTime at,
  String subject = 'accountancy',
  String mode = 'quick',
  int correct = 7,
  int wrong = 2,
  int total = 10,
  String? formatId,
  List<Map<String, Object?>> details = const [],
}) =>
    Attempt.fromJson({
      'id': id,
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': total - correct - wrong,
      'total': total,
      'details': details,
      'questionsSnapshot': const [],
      'selectionMeta': {'mode': mode, 'scoringVersion': 'server_practice_v1'},
      'formatId': ?formatId,
      'completedAt': at.millisecondsSinceEpoch,
    });

void main() {
  group('the paper behind a derived badge', () {
    test('a new best names the paper, its marks and the marks it beat', () {
      final attempts = [
        _a('m1', at: DateTime.utc(2026, 9, 6), mode: 'full', total: 50, correct: 30, wrong: 6, formatId: 'f1'),
        _a('m2', at: DateTime.utc(2026, 9, 12), mode: 'full', total: 50, correct: 33, wrong: 5, formatId: 'f1'),
      ];
      final records = badgeRecords(deriveBadges(attempts), attempts);
      final text = records['new_best']!.text((d) => '12 September', (s) => 'Accountancy');
      expect(text, 'From your Accountancy full mock, 12 September: 160 of 250 (before: 144)');
      expect(records['new_best']!.attemptId, 'm2');
    });

    test('a badge with no paper on the phone has no record', () {
      final derived = {'clean_set': DerivedBadge('clean_set', DateTime.utc(2026, 9, 1), 'gone')};
      expect(badgeRecords(derived, const []), isEmpty);
    });
  });

  group('a derived badge landing', () {
    final now = DateTime.utc(2026, 10, 14, 8);
    RhythmSeenState seenWeek() => RhythmSeenState(lastSeenWeek: LastSeenWeek.fromRhythm(rhythmFixture()));

    test('a badge a paper earned is a dated row, never a second announcement on Today (the result says it once)', () {
      final rhythm = rhythmFixture();
      final merged = mergeDerived(rhythm.milestones, {'clean_set': DerivedBadge('clean_set', now.subtract(const Duration(hours: 3)), 'a')});
      final plan = planMilestones(rhythm, seenWeek(), now, milestones: merged);
      expect(plan.events, hasLength(1));
      expect(plan.events.single.id, 'clean_set');
      expect(plan.events.single.level, CelebrationLevel.l3);
      expect(plan.events.single.sentence, isNull);
    });

    test('inside 48 hours a new server badge is one quiet line with its name, once', () {
      final rhythm = rhythmFixture();
      final listed = [RhythmMilestone(id: 'run_weeks_3', achievedAt: now.subtract(const Duration(hours: 3)))];
      final plan = planMilestones(rhythm, seenWeek(), now, milestones: listed);
      expect(plan.events, hasLength(1));
      expect(plan.events.single.level, CelebrationLevel.l1);
      expect(plan.events.single.sentence, '3 weeks in a row landed.');
    });

    test('a badge already shown on a result is not announced again (its plain id is spent with it)', () {
      final rhythm = rhythmFixture();
      final merged = mergeDerived(rhythm.milestones, {'clean_set': DerivedBadge('clean_set', now.subtract(const Duration(hours: 3)), 'a')});
      final seen = RhythmSeenState(lastSeenWeek: LastSeenWeek.fromRhythm(rhythm), celebratedIds: const {'clean_set'});
      expect(planMilestones(rhythm, seen, now, milestones: merged).events, isEmpty);
    });

    test('five old ones become one receipt, never five ceremonies', () {
      final rhythm = rhythmFixture();
      final old = now.subtract(const Duration(days: 20));
      final derived = {
        for (final (i, id) in const ['first_nta', 'full_mocks_5', 'clean_set', 'four_subjects', 'new_best'].indexed)
          id: DerivedBadge(id, old.add(Duration(days: i)), 'a$i'),
      };
      final plan = planMilestones(rhythm, seenWeek(), now, milestones: mergeDerived(rhythm.milestones, derived));
      expect(plan.events, hasLength(1));
      expect(plan.events.single.kind, CelebrationKind.milestoneReceipt);
      expect(plan.events.single.extraIds, hasLength(4));
    });

    test('on a phone that has not seen the student yet, they are remembered silently', () {
      final rhythm = rhythmFixture();
      final merged = mergeDerived(rhythm.milestones, {'clean_set': DerivedBadge('clean_set', now.subtract(const Duration(hours: 3)), 'a')});
      final plan = planMilestones(rhythm, const RhythmSeenState(), now, milestones: merged);
      expect(plan.events, isEmpty);
      expect(plan.silent, contains('clean_set'));
    });

    test('a badge the server already dates stays a dated row, not a moment', () {
      final event = CelebrationEvent.milestone(RhythmMilestone(id: 'first_full_mock', achievedAt: now), date: '14 October');
      expect(event.level, CelebrationLevel.l3);
    });
  });

  group('Mobi on You reads a landed badge', () {
    const week = SheetWeek.ready(days: [], count: '3 of 4 study days', description: '', done: 3, goal: 4);

    test('it wins over the week, with the badge name and no more', () {
      final reading = readWeek(week: week, now: DateTime(2026, 10, 14, 19), mode: CelebrationMode.full, landedBadge: 'Clean set');
      expect(reading!.gate, HubMobiGate.badge);
      // It says it is a badge, so "5 full mocks" is never read as a count of full mocks (final walk, H8).
      expect(reading.line, 'Badge earned: Clean set.');
    });

    test('Off plays nothing; Quiet nods', () {
      expect(readWeek(week: week, now: DateTime(2026, 10, 14, 19), mode: CelebrationMode.off, landedBadge: 'Clean set')!.gate, isNot(HubMobiGate.badge));
      expect(readWeek(week: week, now: DateTime(2026, 10, 14, 19), mode: CelebrationMode.quiet, landedBadge: 'Clean set')!.gate, HubMobiGate.badge);
    });

    test('the newest fresh badge is the one he names', () {
      final name = freshBadgeName({'clean_set', 'first_nta'}, [
        RhythmMilestone(id: 'first_nta', achievedAt: DateTime.utc(2026, 10, 1)),
        RhythmMilestone(id: 'clean_set', achievedAt: DateTime.utc(2026, 10, 3)),
        RhythmMilestone(id: 'new_best', achievedAt: DateTime.utc(2026, 10, 9)),
      ]);
      expect(name, 'Clean set');
      expect(freshBadgeName({'nope'}, const []), isNull);
    });
  });

  group('Personal bests blocks', () {
    const bests = [
      PersonalBest(
        formatId: 'full:accountancy:q50:server_snapshot_v1',
        subject: 'accountancy',
        mode: 'full',
        attempts: 2,
        best: BestMark(marks: 140, max: 250, attemptId: 'm2'),
        latest: BestMark(marks: 140, max: 250, attemptId: 'm2'),
      ),
    ];
    final fastest = FastestAnswer(timeMs: 9000, subject: 'business_studies', at: DateTime.utc(2026, 9, 3, 6), attemptId: 's3', question: 14);

    Future<void> pump(WidgetTester tester, {FastestAnswer? fast, List<PersonalBest> mocks = bests, String? opened}) async {
      await pumpMockmob(
        tester,
        buildBestsPage(
          state: RemoteState(value: mocks, fetchedAt: DateTime.utc(2026, 10, 14)),
          mocks: mocks,
          zone: 'Asia/Kolkata',
          rhythm: rhythmFixture(streak: 2, best: 5),
          fastest: fast,
          onOpenPaper: (_) {},
          onStart: () {},
          onRetry: () {},
        ),
        disableAnimations: true,
        wrapInScaffold: false,
        size: const Size(390, 1600),
      );
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('the run and the fastest right answer each carry their words and date', (tester) async {
      await pump(tester, fast: fastest);
      expect(find.text('Longest run at your goal'), findsOneWidget);
      expect(find.text('Now: 2 weeks in a row. Goal: 4 study days a week.'), findsOneWidget);
      expect(find.text('Fastest right answer'), findsOneWidget);
      expect(find.textContaining('Business Studies, question 14, 3 September'), findsOneWidget);
      expect(find.text('Answers under 3 seconds are not counted.'), findsOneWidget);
      expect(find.text('Open that question'), findsOneWidget);
    });

    testWidgets('with no timed answer it says so and claims nothing', (tester) async {
      await pump(tester);
      expect(find.text('No timed answers yet. Timings are kept from your next paper.'), findsOneWidget);
      expect(find.text('Open that question'), findsNothing);
    });

    testWidgets('with nothing scored the page asks for a first practice', (tester) async {
      await pump(tester, mocks: const []);
      expect(find.text('Your bests show after your first scored set.'), findsOneWidget);
      expect(find.text('Start a quick practice'), findsOneWidget);
    });
  });
}
