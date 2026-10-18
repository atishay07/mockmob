// Bug hunt round 2 (Today): the week strip follows the student's date when the clock ticks,
// the length chip belongs to one student on one day, and the pinned bar's ground lets drags
// through to the page.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/dismissal_repository.dart' show DismissalKey;
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/plan_repository.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/widgets/widgets.dart' show BarMove, LiveCapsule;
import 'package:mockmob/features/review/data/mistake_index.dart' show buildReviewIndex;
import 'package:mockmob/features/review/data/review_providers.dart' show reviewIndexProvider;
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';
import 'package:mockmob/features/rhythm/data/rhythm_providers.dart';
import 'package:mockmob/features/rhythm/data/study_days.dart';
import 'package:mockmob/features/today/data/road_plan.dart' show RoadAccount, roadAccountProvider;
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../golden/today/today_golden_support.dart' show PhoneFrame, todayOverrides;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../helpers/no_open_paper.dart';
import '../rhythm/fixtures.dart';
import 'support/today_fixtures.dart';

class _Rhythm extends RhythmRepository {
  _Rhythm(this.initial, this.refreshes);

  final Rhythm initial;
  final List<bool> refreshes;

  @override
  RemoteState<Rhythm> build() => RemoteState(value: initial, fetchedAt: DateTime.utc(2026, 10, 12));

  @override
  Future<void> refresh({bool force = false}) async => refreshes.add(force);
}

class _Goal extends GoalRepository {
  @override
  RemoteState<Goal> build() => RemoteState(value: const Goal(daysPerWeek: 4), fetchedAt: DateTime.utc(2026, 10, 12));

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Attempts extends AttemptsRepository {
  @override
  RemoteState<List<Attempt>> build() => RemoteState(value: const [], fetchedAt: DateTime.utc(2026, 10, 12));

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Plan extends PlanRepository {
  _Plan(super.minutes);

  @override
  RemoteState<LearningPlan> build() => const RemoteState.idle();

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Online extends NetworkStatusNotifier {
  @override
  NetworkStatus build() => NetworkStatus.online;
}

class _UserId extends Notifier<String?> {
  @override
  String? build() => 'u1';

  void set(String? id) => state = id;
}

final _userIdSource = NotifierProvider<_UserId, String?>(_UserId.new);

void main() {
  const kolkata = 'Asia/Kolkata';

  setUpAll(loadAppFonts);

  group('the week strip follows the student date on a clock tick (today-new-r2-02)', () {
    late DateTime now;
    late List<bool> refreshes;

    ProviderContainer containerFor(Rhythm rhythm, {List<Override> extra = const []}) => ProviderContainer(overrides: [
          ...extra,
          nowProvider.overrideWithValue(() => now),
          studentTimezoneProvider.overrideWithValue(kolkata),
          ...noOpenPaperOverrides,
          latestSessionDraftProvider.overrideWith((ref) => Stream<SessionDraft?>.value(null)),
          rhythmRepositoryProvider.overrideWith(() => _Rhythm(rhythm, refreshes)),
          goalRepositoryProvider.overrideWith(_Goal.new),
        ]);

    int todayIndex(ProviderContainer c) => c.read(rhythmSnapshotProvider).week!.days.indexWhere((d) => d.isToday);

    setUp(() => refreshes = []);

    test('after midnight the strip marks the new day, not yesterday', () {
      now = DateTime.utc(2026, 10, 14, 17, 30); // Wednesday 11:00 PM in Kolkata
      final c = containerFor(rhythmFixture());
      addTearDown(c.dispose);
      c.listen(todayClockProvider, (_, _) {}, fireImmediately: true);
      c.listen(rhythmSnapshotProvider, (_, _) {}, fireImmediately: true);
      expect(todayIndex(c), 2, reason: 'Wednesday is the third day of the week of 12 October');

      now = DateTime.utc(2026, 10, 14, 19, 0); // Thursday 12:30 AM
      c.read(todayClockProvider.notifier).refresh();
      expect(todayIndex(c), 3);
      expect(refreshes, isEmpty, reason: 'Thursday is still inside the cached week');
    });

    test('on a new week the week is read from the server again', () {
      now = DateTime.utc(2026, 10, 18, 17, 30); // Sunday 11:00 PM
      final c = containerFor(rhythmFixture());
      addTearDown(c.dispose);
      c.listen(todayClockProvider, (_, _) {}, fireImmediately: true);
      c.listen(rhythmSnapshotProvider, (_, _) {}, fireImmediately: true);
      c.read(todayClockProvider.notifier).refresh();
      expect(refreshes, isEmpty, reason: 'Sunday is the last day of the cached week');

      now = DateTime.utc(2026, 10, 18, 19, 0); // Monday 12:30 AM
      c.read(todayClockProvider.notifier).refresh();
      expect(refreshes, [true], reason: 'the cached week ended: ask the server for the new one');
      expect(todayIndex(c), -1, reason: 'until it answers, nothing is marked as today');
    });

    test('the inputs Today builds carry the new day', () {
      now = DateTime.utc(2026, 10, 14, 17, 30);
      final c = containerFor(rhythmFixture(), extra: [
        authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1')),
        attemptsRepositoryProvider.overrideWith(_Attempts.new),
        planRepositoryProvider(todayPlanMinutes).overrideWith(() => _Plan(todayPlanMinutes)),
        repairLocalRecordsProvider.overrideWith((ref) => Stream<List<RepairLocalRecord>>.value(const [])),
        unopenedResultsProvider.overrideWith((ref) => Stream<List<PendingResult>>.value(const [])),
        allPendingResultsProvider.overrideWith((ref) => Stream<List<PendingResult>>.value(const [])),
        reviewIndexProvider.overrideWithValue(null),
        todayDismissalsProvider.overrideWith((ref) {
          ref.watch(todayClockProvider);
          return Stream<Set<DismissalKey>>.value(const {});
        }),
        networkStatusProvider.overrideWith(_Online.new),
        todayDraftProvider.overrideWith((ref) async => null),
        todayProfileProvider.overrideWithValue(null),
        rhythmVisibleProvider.overrideWithValue(true),
        studyDayPlanProvider.overrideWithValue(null),
        roadAccountProvider.overrideWithValue(RoadAccount.none),
      ]);
      addTearDown(c.dispose);
      c.listen(todayInputsProvider, (_, _) {}, fireImmediately: true);
      expect(c.read(todayInputsProvider).week!.todayIndex, 2);
      now = DateTime.utc(2026, 10, 14, 19, 0);
      c.read(todayClockProvider.notifier).refresh();
      expect(c.read(todayInputsProvider).week!.todayIndex, 3);
    });

    test('the open-repairs count Today carries is the one Review prints (one source, v15 M6)', () {
      now = DateTime.utc(2026, 10, 14, 17, 30);
      final index = buildReviewIndex(ashaRecord(now), const []);
      expect(index.openCount, greaterThan(0));
      final c = containerFor(rhythmFixture(), extra: [
        authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1')),
        attemptsRepositoryProvider.overrideWith(_Attempts.new),
        planRepositoryProvider(todayPlanMinutes).overrideWith(() => _Plan(todayPlanMinutes)),
        repairLocalRecordsProvider.overrideWith((ref) => Stream<List<RepairLocalRecord>>.value(const [])),
        unopenedResultsProvider.overrideWith((ref) => Stream<List<PendingResult>>.value(const [])),
        allPendingResultsProvider.overrideWith((ref) => Stream<List<PendingResult>>.value(const [])),
        reviewIndexProvider.overrideWithValue(index),
        todayDismissalsProvider.overrideWith((ref) {
          ref.watch(todayClockProvider);
          return Stream<Set<DismissalKey>>.value(const {});
        }),
        networkStatusProvider.overrideWith(_Online.new),
        todayDraftProvider.overrideWith((ref) async => null),
        todayProfileProvider.overrideWithValue(null),
        rhythmVisibleProvider.overrideWithValue(true),
        studyDayPlanProvider.overrideWithValue(null),
        roadAccountProvider.overrideWithValue(RoadAccount.none),
      ]);
      addTearDown(c.dispose);
      c.listen(todayInputsProvider, (_, _) {}, fireImmediately: true);
      expect(c.read(todayInputsProvider).openRepairs, index.openCount);
    });
  });

  group('the length chip belongs to one student on one day (today-new-r2-03)', () {
    late DateTime now;

    ProviderContainer container() => ProviderContainer(overrides: [
          nowProvider.overrideWithValue(() => now),
          studentTimezoneProvider.overrideWithValue(kolkata),
          ...noOpenPaperOverrides,
          latestSessionDraftProvider.overrideWith((ref) => Stream<SessionDraft?>.value(null)),
          userIdProvider.overrideWith((ref) => ref.watch(_userIdSource)),
        ]);

    test("a new account does not inherit the last student's pick", () {
      now = tuesdayEvening;
      final c = container();
      addTearDown(c.dispose);
      c.listen(todayMinutesProvider, (_, _) {}, fireImmediately: true);
      c.read(todayMinutesProvider.notifier).choose(20);
      expect(c.read(todayMinutesProvider), 20);
      c.read(_userIdSource.notifier).set('u2');
      expect(c.read(todayMinutesProvider), isNull);
    });

    test('the pick lasts through the day and is gone the next', () {
      now = tuesdayEvening; // 8:40 PM
      final c = container();
      addTearDown(c.dispose);
      c.listen(todayClockProvider, (_, _) {}, fireImmediately: true);
      c.listen(todayMinutesProvider, (_, _) {}, fireImmediately: true);
      c.read(todayMinutesProvider.notifier).choose(20);

      now = tuesdayLate; // 11:40 PM, same date
      c.read(todayClockProvider.notifier).refresh();
      expect(c.read(todayMinutesProvider), 20, reason: 'an hourly tick on the same date keeps it');

      now = DateTime.utc(2026, 10, 14, 1, 0); // 6:30 AM Wednesday
      c.read(todayClockProvider.notifier).refresh();
      expect(c.read(todayMinutesProvider), isNull);
    });
  });

  group('the move capsule leaves the page scrollable (today-new-r2-04)', () {
    Future<ScrollController> pumpPinned(WidgetTester tester) async {
      final controller = ScrollController();
      addTearDown(controller.dispose);
      await pumpMockmob(
        tester,
        PhoneFrame(
          child: TodayBody(
            view: buildToday(ashaInputs(now: tuesdayLate)),
            skeletonDelay: Duration.zero,
            controller: controller,
            callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
          ),
        ),
        // A phone short enough that the key and the length selector are both below the bar: the
        // capsule only stands in for a key that is wholly out of view (the owner's 15 Oct rule).
        size: const Size(360, 640),
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await tester.pump();
      await tester.pump();
      // The capsule waits until the whole hero card is out (audit 20): scroll it out first.
      controller.jumpTo(controller.position.maxScrollExtent);
      await tester.pump();
      await tester.pump();
      expect(capsule(), findsOneWidget);
      return controller;
    }

    testWidgets('a drag that starts just above the capsule scrolls the page: no ground slab sits over it', (tester) async {
      final controller = await pumpPinned(tester);
      final rect = tester.getRect(capsule());
      final before = controller.offset;
      await tester.dragFrom(Offset(180, rect.top - 8), const Offset(0, 120));
      await tester.pump();
      expect(controller.offset, lessThan(before));
    });

    testWidgets('a drag that starts beside the capsule scrolls too', (tester) async {
      final controller = await pumpPinned(tester);
      final rect = tester.getRect(capsule());
      final before = controller.offset;
      await tester.dragFrom(Offset(rect.left / 2, rect.center.dy), const Offset(0, 120));
      await tester.pump();
      expect(controller.offset, lessThan(before));
    });
  });
}

/// Tonight's move as the bar's live capsule.
Finder capsule() => find.byWidgetPredicate((w) => w is LiveCapsule && w.live is BarMove);
