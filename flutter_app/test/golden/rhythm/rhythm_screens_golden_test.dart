import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/rhythm/screens/bests_screen.dart';
import 'package:mockmob/features/rhythm/screens/milestones_screen.dart';
import 'package:mockmob/features/rhythm/screens/rhythm_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../you/you_golden_kit.dart' show kSheetSize, loadMaterialIcons;
import 'rhythm_test_kit.dart';

const _history = [
  RhythmWeek(weekStart: '2026-10-05', studyDays: 4, goal: 4, met: true),
  RhythmWeek(weekStart: '2026-09-28', studyDays: 5, goal: 4, met: true),
  RhythmWeek(weekStart: '2026-09-21', studyDays: 4, goal: 4, met: true),
  RhythmWeek(weekStart: '2026-09-14', studyDays: 2, goal: 4, met: false),
  RhythmWeek(weekStart: '2026-09-07', studyDays: 4, goal: 3, met: true),
];

final _rhythm = rhythmFixture(
  streak: 3,
  best: 6,
  history: _history,
  milestones: [
    RhythmMilestone(id: 'first_scored_session', achievedAt: DateTime.utc(2026, 9, 1, 10)),
    RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 9, 6, 10)),
    RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 9, 10)),
    RhythmMilestone(id: 'first_week_met', achievedAt: DateTime.utc(2026, 9, 13, 10)),
    const RhythmMilestone(id: 'repairs_5'),
    const RhythmMilestone(id: 'weeks_met_4'),
  ],
);

const _bests = [
  PersonalBest(
    formatId: 'full:accountancy:q50:server_snapshot_v1',
    subject: 'accountancy',
    mode: 'full',
    attempts: 3,
    best: BestMark(marks: 142, max: 250, attemptId: 'a1'),
    latest: BestMark(marks: 131, max: 250, attemptId: 'a3'),
  ),
  PersonalBest(
    formatId: 'nta:business_studies:q50:server_snapshot_v1',
    subject: 'business_studies',
    mode: 'nta',
    attempts: 1,
    best: BestMark(marks: 118, max: 250, attemptId: 'b1'),
    latest: BestMark(marks: 118, max: 250, attemptId: 'b1'),
  ),
];

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });

  Future<void> shoot(
    WidgetTester tester,
    String name,
    Brightness brightness,
    Widget screen, {
    required RemoteState<Rhythm> rhythm,
    Goal? goal,
    bool hidden = false,
    RemoteState<List<PersonalBest>> bests = const RemoteState(value: []),
    double scrollBy = 0,
    List<Attempt> attempts = const [],
  }) async {
    await pumpMockmob(
      tester,
      screen,
      brightness: brightness,
      size: kSheetSize,
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: rhythmOverrides(rhythm: rhythm, goal: goal, hidden: hidden, bests: bests, attempts: attempts),
    );
    await tester.pump(const Duration(milliseconds: 100));
    if (scrollBy != 0) {
      await tester.drag(find.byType(Scrollable).first, Offset(0, -scrollBy));
      await tester.pump(const Duration(milliseconds: 100));
    }
    await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_${brightness == Brightness.dark ? 'night' : 'day'}.png'));
  }

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final b = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('rhythm screen top, $b', (tester) async {
      await shoot(tester, 'rhythm_screen_top', brightness, const YouRhythmScreen(), rhythm: loaded(_rhythm));
    });

    testWidgets('rhythm screen scrolled, $b', (tester) async {
      await shoot(tester, 'rhythm_screen_scrolled', brightness, const YouRhythmScreen(), rhythm: loaded(_rhythm), scrollBy: 700);
    });

    testWidgets('rhythm screen paused, run ended, $b', (tester) async {
      await shoot(
        tester,
        'rhythm_screen_paused',
        brightness,
        const YouRhythmScreen(),
        rhythm: loaded(rhythmFixture(paused: true, streak: 0, best: 6, history: _history.take(2).toList())),
        goal: const Goal(daysPerWeek: 4, pausedUntil: '2026-10-26'),
      );
    });

    testWidgets('rhythm screen off, new student, $b', (tester) async {
      await shoot(
        tester,
        'rhythm_screen_off',
        brightness,
        const YouRhythmScreen(),
        rhythm: loaded(rhythmFixture(streak: 0, best: 0, studyDayDates: [])),
        hidden: true,
      );
    });

    testWidgets('rhythm screen could not load, $b', (tester) async {
      await shoot(tester, 'rhythm_screen_error', brightness, const YouRhythmScreen(), rhythm: kFailedRhythm);
    });

    testWidgets('milestones list, $b', (tester) async {
      await shoot(tester, 'milestones_list', brightness, const YouMilestonesScreen(), rhythm: loaded(_rhythm), attempts: scoredSets(6));
    });

    testWidgets('milestones list scrolled, $b', (tester) async {
      await shoot(tester, 'milestones_list_scrolled', brightness, const YouMilestonesScreen(), rhythm: loaded(_rhythm), attempts: scoredSets(6), scrollBy: 500);
    });

    testWidgets('milestones empty, $b', (tester) async {
      await shoot(tester, 'milestones_empty', brightness, const YouMilestonesScreen(), rhythm: loaded(rhythmFixture()));
    });

    testWidgets('milestones, every path landed, $b', (tester) async {
      await shoot(
        tester,
        'milestones_complete',
        brightness,
        const YouMilestonesScreen(),
        rhythm: loaded(
          rhythmFixture(
            milestones: [
              for (final (i, id) in const [
                'first_scored_session',
                'first_full_mock',
                'sessions_10',
                'first_repair',
                'repairs_5',
                'repairs_10',
                'repairs_25',
                'first_week_met',
                'weeks_met_4',
              ].indexed)
                RhythmMilestone(id: id, achievedAt: DateTime.utc(2026, 9, 1 + i * 3, 10)),
            ],
          ),
        ),
      );
    });

    testWidgets('bests list, $b', (tester) async {
      await shoot(tester, 'bests_list', brightness, const YouBestsScreen(), rhythm: loaded(_rhythm), bests: const RemoteState(value: _bests));
    });

    testWidgets('bests empty, $b', (tester) async {
      await shoot(tester, 'bests_empty', brightness, const YouBestsScreen(), rhythm: loaded(_rhythm));
    });
  }
}
