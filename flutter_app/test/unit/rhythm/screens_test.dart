import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_slot.dart';
import 'package:mockmob/features/rhythm/screens/rhythm_screen.dart';
import 'package:mockmob/features/rhythm/widgets/week_strip_section.dart';
import 'package:mockmob/features/rhythm/widgets/weekly_ending_card.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/test_db.dart';

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
    testWidgets('Edit goal saves the new goal only after the server acknowledges', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      await tester.tap(find.text('Edit goal'));
      await settle(tester);
      expect(find.text('Weekly goal'), findsOneWidget);
      await tester.tap(find.text('5'));
      await tester.pump();
      expect(find.text('Your goal is 5 study days. The other days are rest days.'), findsOneWidget);
      await tester.tap(find.text('Save goal'));
      await settle(tester);
      expect(goalRepo.saved, [5]);
      expect(find.text('Weekly goal'), findsNothing);
    });

    testWidgets('a pause preset sends the Sunday of this week and keeps the goal', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      final thisWeek = find.bySemanticsLabel('Pause rhythm, This week');
      await tester.scrollUntilVisible(thisWeek, 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(thisWeek);
      await settle(tester);
      expect(goalRepo.saved, [4]);
      expect(goalRepo.savedPause, ['2026-10-18']);
    });

    testWidgets('2 weeks pauses to the Sunday after next, the long pause is the 100 day limit', (tester) async {
      await pumpMockmob(tester, const YouRhythmScreen(), wrapInScaffold: false, disableAnimations: true, overrides: overrides(rhythmFixture()));
      await tester.scrollUntilVisible(find.text('2 weeks'), 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.text('2 weeks'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2 weeks'));
      await settle(tester);
      await tester.scrollUntilVisible(find.text('Until I turn it on'), 200, scrollable: find.byType(Scrollable).first);
      await tester.ensureVisible(find.text('Until I turn it on'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Until I turn it on'));
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
  });

  group('Weekly ending section', () {
    final closedMet = rhythmFixture(lastClosed: const RhythmWeek(weekStart: '', studyDays: 4, goal: 4, met: true));
    final closedUnmet = rhythmFixture(streak: 0, lastClosed: const RhythmWeek(weekStart: '', studyDays: 2, goal: 4, met: false));

    testWidgets('Try 5 saves the goal, says so, and the card does not come back', (tester) async {
      await pumpMockmob(tester, const SingleChildScrollView(child: WeeklyEndingSection()), overrides: overrides(closedMet));
      await settle(tester);
      expect(find.text('You finished 4 study days last week. That met your goal.'), findsOneWidget);
      await tester.tap(find.text('Try 5'));
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
      await tester.tap(find.text('Keep 4'));
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
