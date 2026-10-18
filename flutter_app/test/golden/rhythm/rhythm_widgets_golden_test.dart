import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_slot.dart';
import 'package:mockmob/features/rhythm/data/rhythm_providers.dart';
import 'package:mockmob/features/rhythm/logic/dates.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/logic/weekly_ending.dart';
import 'package:mockmob/core/widgets/widgets.dart' show StudyWeekLegendMemory;
import 'package:mockmob/features/rhythm/screens/week_sheet.dart';
import 'package:mockmob/features/rhythm/widgets/goal_editor.dart';
import 'package:mockmob/features/rhythm/widgets/milestone_track_card.dart';
import 'package:mockmob/features/rhythm/widgets/returning_card.dart';
import 'package:mockmob/features/rhythm/widgets/week_strip_section.dart';
import 'package:mockmob/features/rhythm/widgets/weekly_ending_card.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../you/you_golden_kit.dart' show kSheetSize;
import 'rhythm_test_kit.dart';

RhythmSnapshot _snap(RemoteState<Rhythm> state, {String? pausedUntil}) => composeSnapshot(
      rhythmState: state,
      goalState: RemoteState(value: Goal(daysPerWeek: state.value?.daysGoal ?? 4, pausedUntil: pausedUntil)),
      now: kNow,
      timezone: 'Asia/Kolkata',
    );

Widget _sheet(RhythmSnapshot s, {bool off = false}) => SheetFrame(
      child: WeekSheetBody(snapshot: s, rhythmOff: off, onRetry: () {}, onTurnOn: () {}, onSeeRhythm: () {}),
    );

final _open = rhythmFixture(repairs: 7, mocks: 2);
final _met = rhythmFixture(
  studyDayDates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'],
  met: true,
  streak: 4,
  best: 6,
  repairs: 3,
  mocks: 1,
);
final _paused = rhythmFixture(paused: true, studyDayDates: ['2026-10-12']);
final _runEnded = rhythmFixture(streak: 0, best: 6, studyDayDates: ['2026-10-13']);

Celebration _moment(CelebrationEvent e, {bool quiet = false}) => Celebration(
      id: e.id,
      scope: e.scope,
      level: e.level,
      kind: e.kind,
      sentence: e.sentence,
      receipt: e.receipt,
      ring: e.ring && !quiet,
      studyDays: e.studyDays,
      goal: e.goal,
      mobiHop: e.level == CelebrationLevel.l2 && !quiet,
      textOnly: quiet,
      linkLabel: e.linkLabel,
      link: e.link,
    );

void main() {
  setUpAll(loadAppFonts);
  setUp(StudyWeekLegendMemory.session.reset);

  void golden(String name, Widget Function() build) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('$name, $tag', (tester) async {
        await pumpMockmob(
          tester,
          build(),
          brightness: brightness,
          size: kSheetSize,
          disableAnimations: true,
          overrides: [...rhythmOverrides(rhythm: loaded(_open))],
        );
        await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      });
    }
  }

  golden(
    'week_sheet_open_and_met',
    () => SheetColumn(samples: [
      ('Open week, counts from the server', _sheet(_snap(loaded(_open)))),
      ('Goal met', _sheet(_snap(loaded(_met)))),
    ]),
  );

  golden(
    'week_sheet_paused_and_run_ended',
    () => SheetColumn(samples: [
      ('Paused', _sheet(_snap(loaded(_paused), pausedUntil: '2026-10-26'))),
      ('Run ended, cached copy', _sheet(_snap(staleState(_runEnded)))),
    ]),
  );

  golden(
    'week_sheet_loading_failed_off',
    () => SheetColumn(samples: [
      ('Loading', _sheet(_snap(kLoadingRhythm))),
      ('Could not load', _sheet(_snap(kFailedRhythm))),
      ('Rhythm turned off', _sheet(_snap(loaded(_open)), off: true)),
    ]),
  );

  golden(
    'week_strip_states',
    () => SampleColumn(gap: 12, children: [
      Sample('Open', WeekStripBody(snapshot: _snap(loaded(_open)), onOpen: () {}, onRetry: () {})),
      Sample('Met', WeekStripBody(snapshot: _snap(loaded(_met)), onOpen: () {}, onRetry: () {})),
      Sample('Paused', WeekStripBody(snapshot: _snap(loaded(_paused), pausedUntil: '2026-10-26'), onOpen: () {}, onRetry: () {})),
      Sample('Cached copy', WeekStripBody(snapshot: _snap(staleState(_open)), onOpen: () {}, onRetry: () {})),
      Sample('Loading', WeekStripBody(snapshot: _snap(kLoadingRhythm), onOpen: () {}, onRetry: () {})),
      Sample('Could not load', WeekStripBody(snapshot: _snap(kFailedRhythm), onOpen: () {}, onRetry: () {})),
    ]),
  );

  golden(
    'weekly_ending_cards',
    () => SampleColumn(children: [
      Sample(
        'Met, ring sweeps once',
        WeeklyEndingCard(
          data: weeklyEndingFor(rhythmFixture(lastClosed: const RhythmWeek(weekStart: '', studyDays: 4, goal: 4, met: true)), dismissed: {})!,
          ring: true,
          onKey: (_) {},
          onDismiss: () {},
        ),
      ),
      Sample(
        'Not met',
        WeeklyEndingCard(
          data: weeklyEndingFor(
            rhythmFixture(streak: 0, best: 6, lastClosed: const RhythmWeek(weekStart: '', studyDays: 2, goal: 4, met: false)),
            dismissed: {},
          )!,
          onKey: (_) {},
          onDismiss: () {},
        ),
      ),
    ]),
  );

  golden(
    'returning_cards',
    () => SampleColumn(children: [
      Sample(
        'After 10 days, with past weeks',
        ReturningCard(
          rhythm: rhythmFixture(
            returning: true,
            daysSince: 11,
            history: const [
              RhythmWeek(weekStart: '2026-10-05', studyDays: 4, goal: 4, met: true),
              RhythmWeek(weekStart: '2026-09-28', studyDays: 2, goal: 4, met: false),
              RhythmWeek(weekStart: '2026-09-21', studyDays: 3, goal: 3, met: true),
            ],
          ),
          extraLine: 'Your last mock was Mock 7 on 2 October. Your 3 mistakes from it are still here.',
          actionLabel: 'Review your 3 mistakes',
          onAction: () {},
        ),
      ),
      Sample('After 4 days, no history yet', ReturningCard(rhythm: rhythmFixture(returning: true, daysSince: 4))),
    ]),
  );

  golden(
    'celebration_moments',
    () => SampleColumn(gap: 12, children: [
      Sample(
        'L1 repair finished',
        CelebrationMoment(
          celebration: _moment(CelebrationEvent.repairFinished(attemptId: 'a', firstRequestId: 'r', at: DateTime(2026, 10, 12, 23, 51))),
        ),
      ),
      Sample(
        'L2 first repair, one hop',
        CelebrationMoment(
          celebration:
              _moment(CelebrationEvent.repairFinished(attemptId: 'a', firstRequestId: 'r', at: DateTime(2026, 10, 12, 23, 51), firstEver: true)),
        ),
      ),
      Sample('L1 week met, ring', CelebrationMoment(celebration: _moment(CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4)))),
      Sample(
        'L2 first week met, ring and hop',
        CelebrationMoment(celebration: _moment(CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4, firstEver: true))),
      ),
      Sample(
        'Quiet: the same words as text',
        CelebrationMoment(celebration: _moment(CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4, firstEver: true), quiet: true)),
      ),
    ]),
  );

  golden(
    'milestone_earned_moment',
    () => SampleColumn(children: [
      Sample(
        'A step just landed: token settled, ring closed, Mobi beside it',
        MilestoneTrackCard(
          track: milestoneTracks([
            RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 13, 15)),
            RhythmMilestone(id: 'repairs_5', achievedAt: DateTime.utc(2026, 10, 14, 4)),
            const RhythmMilestone(id: 'first_hold'),
            const RhythmMilestone(id: 'run_weeks_3'),
          ])[1],
          dateOf: (d) => formatAchievedDate(d, 'Asia/Kolkata', kNow),
          progress: const {'repairs_10': 6},
          freshIds: const {'repairs_5'},
          onOpen: () {},
        ),
      ),
    ]),
  );

  golden(
    'week_sheet_no_plan_key',
    () => SheetColumn(samples: [
      (
        'No study days chosen: the key names the marks, and a link sets the days',
        SheetFrame(
          child: WeekSheetBody(snapshot: _snap(loaded(_open)), rhythmOff: false, onRetry: () {}, onTurnOn: () {}, onSeeRhythm: () {}, onChangeDays: () {}),
        ),
      ),
      (
        'Study days chosen, with the receipt after a save',
        SheetFrame(
          child: WeekSheetBody(
            snapshot: _snap(loaded(_open)),
            rhythmOff: false,
            onRetry: () {},
            onTurnOn: () {},
            onSeeRhythm: () {},
            onChangeDays: () {},
            plan: const {0, 2, 4, 5},
            savedLine: 'Goal saved: 4 study days a week. Your days are kept on this phone.',
          ),
        ),
      ),
    ]),
  );

  golden(
    'celebration_receipts',
    () => SampleColumn(gap: 12, children: [
      Sample(
        'First repair, with its dated receipt',
        CelebrationMoment(
          celebration: _moment(CelebrationEvent.milestone(RhythmMilestone(id: 'first_repair', achievedAt: kNow), date: '14 October')),
        ),
      ),
      Sample(
        'Landed while away: one quiet receipt and a link',
        CelebrationMoment(
          celebration: _moment(
            CelebrationEvent.milestoneReceipt(
              newest: RhythmMilestone(id: 'first_repair', achievedAt: kNow),
              date: '11 October',
              others: const ['first_scored_session'],
            ),
          ),
        ),
      ),
    ]),
  );

  golden(
    'goal_editor',
    () => SheetColumn(samples: [
      ('Goal editor', const SheetFrame(child: GoalEditor(initialDays: 4))),
      ('Goal editor, seven days', SheetFrame(child: GoalEditor(initialDays: 7, onSave: (_) async {}))),
    ]),
  );

  testWidgets('slot shows nothing when nothing fired', (tester) async {
    await pumpMockmob(tester, const CelebrationSlot(scope: 'x'), overrides: rhythmOverrides(rhythm: loaded(_open)));
    expect(find.byType(CelebrationMoment), findsNothing);
  });
}
