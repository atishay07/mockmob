// Goldens of the badges (app-you-1016 section 3) at 390x844, Night and Day: the Badges page with
// six earned of 16, the same page with nothing earned, the badge sheet for an earned badge (with
// its record line) and for a not-yet badge (with its count and key), and Personal bests with the
// longest run and the fastest right answer.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/widgets.dart' show StudyWeekLegendMemory;
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/screens/bests_screen.dart';
import 'package:mockmob/features/rhythm/screens/milestones_screen.dart';
import 'package:mockmob/features/rhythm/widgets/step_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../you/you_golden_kit.dart' show loadMaterialIcons;
import 'rhythm_test_kit.dart';

const _size = Size(390, 844);

Attempt _attempt(
  String id, {
  required int day,
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
      'completedAt': DateTime.utc(2026, 9, day, 6).millisecondsSinceEpoch,
    });

List<Attempt> _attempts() => [
      _attempt('s1', day: 1),
      _attempt('s2', day: 2, subject: 'english'),
      _attempt(
        's3',
        day: 3,
        subject: 'business_studies',
        correct: 10,
        wrong: 0,
        details: const [
          {'qid': 'q1', 'givenIndex': 1, 'isCorrect': true, 'timeMs': 21000},
          {'qid': 'q2', 'givenIndex': 0, 'isCorrect': true, 'timeMs': 9000},
        ],
      ),
      _attempt('s4', day: 4),
      _attempt('s5', day: 5),
      _attempt('m1', day: 6, mode: 'full', total: 50, correct: 30, wrong: 6, formatId: 'full:accountancy:q50:server_snapshot_v1'),
      _attempt('m2', day: 12, mode: 'full', total: 50, correct: 33, wrong: 5, formatId: 'full:accountancy:q50:server_snapshot_v1'),
    ];

final _rhythm = rhythmFixture(
  streak: 2,
  best: 5,
  milestones: [
    RhythmMilestone(id: 'first_scored_session', achievedAt: DateTime.utc(2026, 9, 1, 10)),
    RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 9, 6, 10)),
    RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 9, 10)),
    RhythmMilestone(id: 'first_week_met', achievedAt: DateTime.utc(2026, 9, 13, 10)),
    const RhythmMilestone(id: 'sessions_10'),
    const RhythmMilestone(id: 'repairs_5'),
  ],
);

const _bests = [
  PersonalBest(
    formatId: 'full:accountancy:q50:server_snapshot_v1',
    subject: 'accountancy',
    mode: 'full',
    attempts: 2,
    best: BestMark(marks: 140, max: 250, attemptId: 'm2'),
    latest: BestMark(marks: 140, max: 250, attemptId: 'm2'),
  ),
];

StepView _view(String id, StepStatus status, {DateTime? at}) => StepView(milestoneSteps.firstWhere((s) => s.id == id), status, at);

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });
  setUp(StudyWeekLegendMemory.session.reset);

  Future<void> shoot(
    WidgetTester tester,
    String name,
    Brightness brightness,
    Widget screen, {
    required List<Override> overrides,
    double scrollBy = 0,
  }) async {
    await pumpMockmob(
      tester,
      screen,
      brightness: brightness,
      size: _size,
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: overrides,
    );
    await tester.pump(const Duration(milliseconds: 100));
    if (scrollBy != 0) {
      await tester.drag(find.byType(Scrollable).first, Offset(0, -scrollBy));
      await tester.pump(const Duration(milliseconds: 100));
    }
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${brightness == Brightness.dark ? 'night' : 'day'}.png'));
  }

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final b = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('badges, six earned of 16, $b', (tester) async {
      await shoot(
        tester,
        'badges_390',
        brightness,
        const YouMilestonesScreen(),
        overrides: rhythmOverrides(rhythm: loaded(_rhythm), attempts: _attempts()),
      );
    });

    testWidgets('badges scrolled to your best work, $b', (tester) async {
      await shoot(
        tester,
        'badges_390_scrolled',
        brightness,
        const YouMilestonesScreen(),
        overrides: rhythmOverrides(rhythm: loaded(_rhythm), attempts: _attempts()),
        scrollBy: 1500,
      );
    });

    testWidgets('badges, none earned, $b', (tester) async {
      await shoot(tester, 'badges_empty_390', brightness, const YouMilestonesScreen(), overrides: rhythmOverrides(rhythm: loaded(rhythmFixture())));
    });

    testWidgets('badge sheet, earned with its record, $b', (tester) async {
      await shoot(
        tester,
        'badge_sheet_earned_390',
        brightness,
        _Framed(
          samples: [
            (
              'New best',
              SheetFrame(
                child: StepSheetBody(
                  view: _view('new_best', StepStatus.earned, at: DateTime.utc(2026, 9, 12, 6)),
                  dateOf: (d) => '12 September',
                  pathLine: 'Your best work. Any of these can come first.',
                  record: 'From your Accountancy full mock, 12 September: 160 of 250 (before: 144)',
                  paperId: 'm2',
                  onAction: (_) {},
                ),
              ),
            ),
          ],
        ),
        overrides: rhythmOverrides(rhythm: loaded(_rhythm)),
      );
    });

    testWidgets('badge sheet, not yet with its count, $b', (tester) async {
      await shoot(
        tester,
        'badge_sheet_notyet_390',
        brightness,
        _Framed(
          samples: [
            (
              '10 scored sets',
              SheetFrame(
                child: StepSheetBody(
                  view: _view('sessions_10', StepStatus.next),
                  previous: _view('first_nta', StepStatus.next),
                  dateOf: (d) => '',
                  count: 6,
                  pathLine: 'Papers, step 4 of 5.',
                  onAction: (_) {},
                ),
              ),
            ),
          ],
        ),
        overrides: rhythmOverrides(rhythm: loaded(_rhythm)),
      );
    });

    testWidgets('personal bests with the run and the fastest answer, $b', (tester) async {
      await shoot(
        tester,
        'bests_run_fastest_390',
        brightness,
        const YouBestsScreen(),
        overrides: rhythmOverrides(rhythm: loaded(_rhythm), bests: const RemoteState(value: _bests), attempts: _attempts()),
      );
    });

    testWidgets('personal bests empty, $b', (tester) async {
      await shoot(tester, 'bests_empty_390', brightness, const YouBestsScreen(), overrides: rhythmOverrides(rhythm: loaded(rhythmFixture())));
    });
  }
}

/// The sheet samples sit on a Material, as a real sheet does, so no text draws the debug underline.
class _Framed extends StatelessWidget {
  const _Framed({required this.samples});

  final List<(String, Widget)> samples;

  @override
  Widget build(BuildContext context) => Material(type: MaterialType.transparency, child: SheetColumn(samples: samples));
}
