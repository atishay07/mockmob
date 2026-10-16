import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_slot.dart';
import 'package:mockmob/features/rhythm/data/rhythm_providers.dart';
import 'package:mockmob/features/rhythm/screens/rhythm_screen.dart';
import 'package:mockmob/features/rhythm/screens/week_sheet.dart';
import 'package:mockmob/core/widgets/widgets.dart' show StudyWeekLegendMemory;
import 'package:mockmob/features/rhythm/widgets/rhythm_page.dart' show QuietPill;
import 'package:mockmob/features/rhythm/widgets/week_strip_section.dart';
import 'package:mockmob/features/rhythm/widgets/weekly_ending_card.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/test_db.dart';

class _FailingGoalRepo extends FakeGoalRepo {
  _FailingGoalRepo(super.initial);

  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil, String? expectUserId}) async =>
      throw const ApiError(kind: ApiErrorKind.network, code: 'network');
}

/// The goal saves, but remembering that the weekly card was seen fails.
class _DismissFailsSeenRepo extends RhythmSeenRepository {
  _DismissFailsSeenRepo(super.scope);

  @override
  Future<bool> markCelebrated(String id) async {
    if (id.startsWith('week-card:')) throw StateError('database closed');
    return super.markCelebrated(id);
  }
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(loadAppFonts);

  late AppDatabase db;
  late FakeGoalRepo goalRepo;
  late MemoryPrefsStore store;

  setUp(() {
    db = newTestDb();
    goalRepo = FakeGoalRepo(RemoteState(value: const Goal(daysPerWeek: 4), fetchedAt: kNow));
    store = MemoryPrefsStore();
  });

  tearDown(() => db.close());

  List<Override> overrides(Rhythm r, {bool hidden = false}) => [
        ...rhythmOverrides(rhythm: loaded(r), goalRepo: goalRepo, hidden: hidden, store: store),
        rhythmSeenRepositoryProvider.overrideWithValue(RhythmSeenRepository(LocalScope(db, () => 'u1', () => kNow))),
      ];

  group('You rhythm screen', () {
    testWidgets('Edit goal picks study days and saves the goal only after the server acknowledges', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      // The hero is taller than the first screen now, so the Plan rows are scrolled to.
      await tester.ensureVisible(find.text('Weekly goal'));
      await tester.pump();
      await tester.tap(find.text('Weekly goal'));
      await settle(tester);
      expect(find.text('Your study days'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Wednesday, rest day'));
      await tester.pump();
      expect(find.text('5 study days a week.'), findsOneWidget);
      await tester.tap(find.text('Save study days'));
      await settle(tester);
      expect(goalRepo.saved, [5]);
      expect(find.text('Your study days'), findsNothing);
      // The receipt says what the server holds and what stays on this phone.
      expect(find.text('Goal saved: 5 study days a week. Your days are kept on this phone.'), findsOneWidget);
      expect(store.values['rhythm_days_u1'], isNotNull);
    });

    testWidgets('a failed goal save shows no receipt and keeps the editor open', (tester) async {
      final failing = _FailingGoalRepo(RemoteState(value: const Goal(daysPerWeek: 4), fetchedAt: kNow));
      await pumpMockmob(
        tester,
        const YouRhythmScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          ...rhythmOverrides(rhythm: loaded(rhythmFixture()), goalRepo: failing, store: store),
          rhythmSeenRepositoryProvider.overrideWithValue(RhythmSeenRepository(LocalScope(db, () => 'u1', () => kNow))),
        ],
      );
      // The hero is taller than the first screen now, so the Plan rows are scrolled to.
      await tester.ensureVisible(find.text('Weekly goal'));
      await tester.pump();
      await tester.tap(find.text('Weekly goal'));
      await settle(tester);
      await tester.tap(find.text('Save study days'));
      await settle(tester);
      expect(find.text('We could not save your goal. Try again.'), findsOneWidget);
      expect(find.textContaining('Goal saved'), findsNothing);
      expect(store.values['rhythm_days_u1'], isNull);
    });

    testWidgets('without a plan the study days row says Not set and the strip names its marks on one line', (tester) async {
      StudyWeekLegendMemory.session.reset();
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      await settle(tester);
      expect(find.text('Study days'), findsOneWidget);
      expect(find.text('Not set'), findsOneWidget);
      expect(find.text('Set your study days'), findsNothing);
      expect(find.text('Counted'), findsOneWidget);
      expect(find.text('Not counted'), findsOneWidget);
      expect(find.text('Planned'), findsNothing);
      // Each day is its own stop for a screen reader.
      expect(find.bySemanticsLabel('Wednesday, today, study day, counted'), findsOneWidget);
    });

    testWidgets('a paused week says until when, and that the run is kept', (tester) async {
      await pumpMockmob(
        tester,
        const YouRhythmScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          ...rhythmOverrides(
            rhythm: loaded(rhythmFixture(paused: true)),
            goal: const Goal(daysPerWeek: 4, pausedUntil: '2027-01-21'),
            store: store,
          ),
          rhythmSeenRepositoryProvider.overrideWithValue(RhythmSeenRepository(LocalScope(db, () => 'u1', () => kNow))),
        ],
      );
      await settle(tester);
      // The date is said once, in the week card; the pause group says only that the run is kept.
      expect(find.text('Rhythm is paused until 21 January.'), findsOneWidget);
      final line = find.text('Paused. Your run is kept.');
      await tester.scrollUntilVisible(line, 200, scrollable: find.byType(Scrollable).first);
      expect(line, findsOneWidget);
      expect(find.textContaining('Paused until'), findsNothing);
      expect(find.text('Resume rhythm'), findsOneWidget);
    });

    testWidgets('a pause preset sends the Sunday of this week and keeps the goal', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      final key = find.text('Pause now');
      await tester.scrollUntilVisible(key, 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(key);
      await tester.pumpAndSettle();
      // Nothing is written by choosing a chip; the date it ends on is said first.
      expect(goalRepo.savedPause, isEmpty);
      expect(find.text('Back on 19 Oct.'), findsOneWidget);
      await tester.tap(key);
      await settle(tester);
      expect(goalRepo.saved, [4]);
      expect(goalRepo.savedPause, ['2026-10-18']);
    });

    testWidgets('2 weeks pauses to the Sunday after next, the long pause is labelled as the 100 day limit', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      await tester.scrollUntilVisible(find.text('2 weeks'), 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.text('2 weeks'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2 weeks'));
      await settle(tester);
      expect(find.text('Back on 26 Oct.'), findsOneWidget);
      await tester.tap(find.text('Pause now'));
      await settle(tester);
      await tester.scrollUntilVisible(find.text('3 months'), 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.text('3 months'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('3 months'));
      await settle(tester);
      // 100 days from Wednesday 14 October, then the day after it.
      expect(find.text('Back on 23 Jan.'), findsOneWidget);
      await tester.tap(find.text('Pause now'));
      await settle(tester);
      expect(goalRepo.savedPause, ['2026-10-25', '2027-01-22']);
    });

    testWidgets('turning rhythm off asks first, then hides it and keeps the records', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      await settle(tester);
      await tester.scrollUntilVisible(find.text('Turn off rhythm'), 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.text('Turn off rhythm'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Turn off rhythm'));
      await settle(tester);
      expect(find.text('Turn off rhythm?'), findsOneWidget);
      await tester.tap(find.text('Turn off'));
      await settle(tester);
      expect(find.text('Rhythm is off'), findsOneWidget);
      expect(find.text('Turn on rhythm'), findsWidgets);
      expect(find.text('Turn off rhythm'), findsNothing);
      expect(store.values['rhythm_hidden_u1'], true);
    });

    testWidgets('the Celebrations choice is saved', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      await settle(tester);
      await tester.scrollUntilVisible(find.text('Quiet'), 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.text('Quiet'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Quiet'));
      await settle(tester);
      expect(store.values['rhythm_celebrations_u1'], 'quiet');
      expect(find.text('Plain text only, with no movement.'), findsOneWidget);
    });

    testWidgets('a failed read offers Try again and shows no count', (tester) async {
      await pumpMockmob(
        tester,
        const YouRhythmScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: rhythmOverrides(rhythm: kFailedRhythm, store: store),
      );
      await settle(tester);
      expect(find.text('We could not load your rhythm'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(find.textContaining('study days'), findsNothing);
    });
  });

  group('Today strip', () {
    testWidgets('is hidden when the student turned rhythm off', (tester) async {
      await pumpMockmob(tester, const WeekStripSection(), overrides: overrides(rhythmFixture(), hidden: true));
      await settle(tester);
      expect(find.byType(WeekStripBody), findsNothing);
    });

    testWidgets('shows the count and opens the week sheet', (tester) async {
      var opened = 0;
      await pumpMockmob(tester, WeekStripSection(onOpen: () => opened++), overrides: overrides(rhythmFixture()));
      await settle(tester);
      expect(find.text('2 of 4 study days'), findsOneWidget);
      await tester.tap(find.text('2 of 4 study days'));
      expect(opened, 1);
    });

    testWidgets('a failed read offers a Try again key of at least 48 dp that retries', (tester) async {
      var retried = 0;
      final snapshot = composeSnapshot(
        rhythmState: kFailedRhythm,
        goalState: const RemoteState(value: Goal(daysPerWeek: 4)),
        now: kNow,
        timezone: 'Asia/Kolkata',
      );
      await pumpMockmob(tester, WeekStripBody(snapshot: snapshot, onOpen: () {}, onRetry: () => retried++), overrides: overrides(rhythmFixture()));
      expect(find.text('We could not load this week.'), findsOneWidget);
      expect(tester.getSize(find.byType(QuietPill)).height, greaterThanOrEqualTo(48));
      await tester.tap(find.byType(QuietPill));
      expect(retried, 1);
    });
  });

  group('Week sheet', () {
    testWidgets('names the week under the title, once', (tester) async {
      final snapshot = composeSnapshot(
        rhythmState: loaded(rhythmFixture()),
        goalState: const RemoteState(value: Goal(daysPerWeek: 4)),
        now: kNow,
        timezone: 'Asia/Kolkata',
      );
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: WeekSheetBody(snapshot: snapshot, rhythmOff: false, onRetry: () {}, onTurnOn: () {}, onSeeRhythm: () {})),
        overrides: overrides(rhythmFixture()),
      );
      expect(find.text('12 to 18 October'), findsOneWidget);
    });
  });

  group('Weekly ending section', () {
    final closedMet = rhythmFixture(lastClosed: const RhythmWeek(weekStart: '', studyDays: 4, goal: 4, met: true));
    final closedUnmet = rhythmFixture(streak: 0, lastClosed: const RhythmWeek(weekStart: '', studyDays: 2, goal: 4, met: false));

    testWidgets('Try 5 saves the goal, says so, and the card does not come back', (tester) async {
      await pumpMockmob(tester, const SingleChildScrollView(child: WeeklyEndingSection()), overrides: overrides(closedMet));
      await settle(tester);
      expect(find.text('You finished 4 study days last week. That met your goal.'), findsOneWidget);
      await tester.tap(find.text('Aim for 5 days'));
      await settle(tester);
      expect(goalRepo.saved, [5]);
      expect(find.text('Goal is now 5 days a week.'), findsOneWidget);
      expect(find.byType(WeeklyEndingCard), findsNothing);
      expect((await RhythmSeenRepository(LocalScope(db, () => 'u1', () => kNow)).read()).celebratedIds, contains('week-card:2026-10-05'));
    });

    testWidgets('Take a rest week pauses until this Sunday', (tester) async {
      await pumpMockmob(tester, const SingleChildScrollView(child: WeeklyEndingSection()), overrides: overrides(closedUnmet));
      await settle(tester);
      expect(find.text('You finished 2 of 4 study days. Nothing is lost. Your record is as you left it.'), findsOneWidget);
      await tester.tap(find.text('Take a rest week'));
      await settle(tester);
      expect(goalRepo.savedPause, ['2026-10-18']);
      expect(find.text('Rhythm is paused until 18 October.'), findsOneWidget);
    });

    testWidgets('Keep 4 only dismisses: the goal is untouched', (tester) async {
      await pumpMockmob(tester, const SingleChildScrollView(child: WeeklyEndingSection()), overrides: overrides(closedMet));
      await settle(tester);
      await tester.tap(find.text('Keep 4 days a week'));
      await settle(tester);
      expect(goalRepo.saved, isEmpty);
      expect(find.byType(WeeklyEndingCard), findsNothing);
    });

    testWidgets('the met week celebrates once, with the ring', (tester) async {
      await pumpMockmob(tester, const SingleChildScrollView(child: WeeklyEndingSection()), overrides: overrides(closedMet));
      await settle(tester);
      final container = ProviderScope.containerOf(tester.element(find.byType(WeeklyEndingSection)));
      final state = container.read(celebrationControllerProvider);
      expect(state.byScope.keys, ['weekly-ending:2026-10-05']);
      expect(state.byScope.values.single.ring, isTrue);
    });

    testWidgets('nothing is shown while rhythm is off', (tester) async {
      await pumpMockmob(tester, const WeeklyEndingSection(), overrides: overrides(closedMet, hidden: true));
      await settle(tester);
      expect(find.byType(WeeklyEndingCard), findsNothing);
    });

    testWidgets('a saved goal whose dismissal fails says it was saved, never could not save', (tester) async {
      await pumpMockmob(
        tester,
        const SingleChildScrollView(child: WeeklyEndingSection()),
        overrides: [
          ...rhythmOverrides(rhythm: loaded(closedMet), goalRepo: goalRepo, store: store),
          rhythmSeenRepositoryProvider.overrideWithValue(_DismissFailsSeenRepo(LocalScope(db, () => 'u1', () => kNow))),
        ],
      );
      await settle(tester);
      await tester.tap(find.text('Aim for 5 days'));
      await settle(tester);
      expect(goalRepo.saved, [5]);
      expect(find.text('Goal is now 5 days a week.'), findsOneWidget);
      expect(find.text('We could not save that. Try again.'), findsNothing);
      // The card still closes for this run.
      expect(find.byType(WeeklyEndingCard), findsNothing);
    });

    testWidgets('Keep closes the card even when remembering it fails', (tester) async {
      await pumpMockmob(
        tester,
        const SingleChildScrollView(child: WeeklyEndingSection()),
        overrides: [
          ...rhythmOverrides(rhythm: loaded(closedMet), goalRepo: goalRepo, store: store),
          rhythmSeenRepositoryProvider.overrideWithValue(_DismissFailsSeenRepo(LocalScope(db, () => 'u1', () => kNow))),
        ],
      );
      await settle(tester);
      expect(find.byType(WeeklyEndingCard), findsOneWidget);
      await tester.tap(find.text('Keep 4 days a week'));
      await settle(tester);
      expect(goalRepo.saved, isEmpty);
      expect(find.byType(WeeklyEndingCard), findsNothing);
    });
  });

  group('Celebration slot', () {
    testWidgets('shows the receipt for its own scope only and exposes it to TalkBack', (tester) async {
      await pumpMockmob(
        tester,
        const Column(children: [CelebrationSlot(scope: 'repair:a1'), CelebrationSlot(scope: 'repair:other')]),
        overrides: overrides(rhythmFixture()),
      );
      final container = ProviderScope.containerOf(tester.element(find.byType(CelebrationSlot).first));
      await tester.runAsync(
        () => container.read(celebrationControllerProvider.notifier).celebrate(
              CelebrationEvent.repairFinished(attemptId: 'a1', firstRequestId: 'r1', at: DateTime(2026, 10, 12, 23, 51)),
            ),
      );
      await settle(tester);
      expect(find.byType(CelebrationMoment), findsOneWidget);
      expect(find.text('Repair finished. Recorded at 11:51 PM.'), findsOneWidget);
      expect(find.bySemanticsLabel('Repair finished. Recorded at 11:51 PM.'), findsOneWidget);
    });

    testWidgets('the first repair milestone draws its sentence and dated receipt on Today', (tester) async {
      await pumpMockmob(tester, const CelebrationSlot(scope: CelebrationScope.today), overrides: overrides(rhythmFixture()));
      final container = ProviderScope.containerOf(tester.element(find.byType(CelebrationSlot)));
      final shown = await tester.runAsync(
        () => container.read(celebrationControllerProvider.notifier).celebrate(
              CelebrationEvent.milestone(RhythmMilestone(id: 'first_repair', achievedAt: kNow), date: '14 October'),
            ),
      );
      await settle(tester);
      expect(shown, isNotNull);
      expect(find.byType(CelebrationMoment), findsOneWidget);
      expect(find.text('That was your first repair.'), findsOneWidget);
      expect(find.text('First repair finished on 14 October.'), findsOneWidget);
    });

    testWidgets('while rhythm is off the slot draws nothing and the moment is not used up', (tester) async {
      await pumpMockmob(tester, const CelebrationSlot(scope: CelebrationScope.today), overrides: overrides(rhythmFixture(), hidden: true));
      await settle(tester);
      final container = ProviderScope.containerOf(tester.element(find.byType(CelebrationSlot)));
      final shown = await tester.runAsync(
        () => container.read(celebrationControllerProvider.notifier).celebrate(
              CelebrationEvent.milestone(RhythmMilestone(id: 'first_repair', achievedAt: kNow), date: '14 October'),
            ),
      );
      await settle(tester);
      expect(shown, isNull);
      expect(find.byType(CelebrationMoment), findsNothing);
      final seen = await tester.runAsync(() => RhythmSeenRepository(LocalScope(db, () => 'u1', () => kNow)).read());
      expect(seen!.celebratedIds, isNot(contains('first_repair')));
    });

    testWidgets('the away receipt shows once with a link to the milestones', (tester) async {
      await pumpMockmob(tester, const CelebrationSlot(scope: CelebrationScope.today), overrides: overrides(rhythmFixture()));
      final container = ProviderScope.containerOf(tester.element(find.byType(CelebrationSlot)));
      await tester.runAsync(
        () => container.read(celebrationControllerProvider.notifier).celebrate(
              CelebrationEvent.milestoneReceipt(newest: RhythmMilestone(id: 'first_repair', achievedAt: kNow), date: '11 October'),
            ),
      );
      await settle(tester);
      expect(find.text('Your first repair landed on 11 October.'), findsOneWidget);
      expect(find.text('See your milestones'), findsOneWidget);
    });

    testWidgets('an L3 row never draws a moment', (tester) async {
      await pumpMockmob(tester, const CelebrationSlot(scope: 'today'), overrides: overrides(rhythmFixture()));
      final container = ProviderScope.containerOf(tester.element(find.byType(CelebrationSlot)));
      await tester.runAsync(
        () => container.read(celebrationControllerProvider.notifier).celebrate(
              CelebrationEvent.milestone(RhythmMilestone(id: 'weeks_met_4', achievedAt: kNow)),
            ),
      );
      await settle(tester);
      expect(find.byType(CelebrationMoment), findsNothing);
    });
  });
}
