import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/celebration/rhythm_watcher.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';

import '../core_data/support/test_db.dart';
import 'fixtures.dart';

class _RecordingDriver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<void> selectionClick() async => calls.add('tick');
}

void main() {
  late AppDatabase db;
  late MemoryPrefsStore store;
  late _RecordingDriver driver;
  late ProviderContainer container;
  final at = DateTime(2026, 10, 12, 23, 51);

  CelebrationController controller() => container.read(celebrationControllerProvider.notifier);

  CelebrationEvent repair(String request, {String attempt = 'a1', bool first = false, CelebrationSuppression? suppressed}) =>
      CelebrationEvent.repairFinished(attemptId: attempt, firstRequestId: request, at: at, firstEver: first, suppressedBy: suppressed);

  setUp(() {
    db = newTestDb();
    store = MemoryPrefsStore();
    driver = _RecordingDriver();
    container = ProviderContainer(
      overrides: [
        userIdProvider.overrideWithValue('u1'),
        rhythmSeenRepositoryProvider.overrideWithValue(RhythmSeenRepository(LocalScope(db, () => 'u1', () => at))),
        rhythmPrefsStoreProvider.overrideWithValue(store),
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver)),
      ],
    );
  });

  tearDown(() async {
    container.dispose();
    await db.close();
  });

  group('once by stable id', () {
    test('a repair finished fires once and the receipt says when it was recorded', () async {
      final first = await controller().celebrate(repair('r1'));
      expect(first, isNotNull);
      expect(first!.level, CelebrationLevel.l1);
      expect(first.receipt, 'Repair finished. Recorded at 11:51 PM.');
      expect(first.sentence, isNull);
      expect(await controller().celebrate(repair('r1', attempt: 'a1')), isNull);
    });

    test('the id survives a new controller, because it is stored', () async {
      await controller().celebrate(repair('r1'));
      container.invalidate(celebrationControllerProvider);
      expect(await controller().celebrate(repair('r1')), isNull);
    });

    test('a repair id is attempt plus the first acknowledged request', () {
      expect(repair('req-9', attempt: 'att-3').id, 'repair:att-3:req-9');
      expect(CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4).id, 'week:2026-10-05');
    });
  });

  group('suppression and scope', () {
    test('no celebration after a failed repair, a lower result, a held result or a first mock', () async {
      for (final reason in CelebrationSuppression.values) {
        expect(await controller().celebrate(repair('r-${reason.name}', suppressed: reason)), isNull, reason: reason.name);
      }
      expect(driver.calls, isEmpty);
    });

    test('a suppressed moment is not used up: it can fire later', () async {
      expect(await controller().celebrate(repair('r1', suppressed: CelebrationSuppression.failedRepair)), isNull);
      expect(await controller().celebrate(repair('r1')), isNotNull);
    });

    test('at most one celebration per scope', () async {
      expect(await controller().celebrate(repair('r1')), isNotNull);
      expect(await controller().celebrate(repair('r2')), isNull);
      // The same id was not used up by the refused call.
      controller().clearScope(CelebrationScope.repair('a1'));
      expect(await controller().celebrate(repair('r2')), isNotNull);
    });

    test('another scope is independent', () async {
      expect(await controller().celebrate(repair('r1', attempt: 'a1')), isNotNull);
      expect(await controller().celebrate(repair('r2', attempt: 'a2')), isNotNull);
    });

    test('celebrateBest fires the highest level only', () async {
      final shown = await controller().celebrateBest([
        repair('r1'),
        repair('r1', first: true),
      ]);
      expect(shown!.level, CelebrationLevel.l2);
      expect(shown.sentence, 'That was your first repair.');
      expect(shown.mobiHop, isTrue);
    });

    test('a first repair also uses up the first_repair milestone', () async {
      await controller().celebrate(repair('r1', first: true));
      final milestone = CelebrationEvent.milestone(RhythmMilestone(id: 'first_repair', achievedAt: at));
      expect(await controller().celebrate(milestone), isNull);
    });
  });

  group('Celebrations setting', () {
    test('Full: one open haptic, the ring for a met week, a hop for a first', () async {
      final week = await controller().celebrate(CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4));
      expect(week!.ring, isTrue);
      expect(week.mobiHop, isFalse);
      expect(week.receipt, '4 of 4 study days. Saved on the server.');
      expect(driver.calls, ['medium']);
      final first = await controller().celebrate(CelebrationEvent.weekMet(weekStart: '2026-10-12', studyDays: 4, goal: 4, firstEver: true));
      expect(first!.mobiHop, isTrue);
      expect(first.sentence, 'Your first week in rhythm is done.');
    });

    test('Quiet: the same words as plain text, no ring, no hop, no haptic', () async {
      await container.read(rhythmPrefsProvider.notifier).setMode(CelebrationMode.quiet);
      final c = await controller().celebrate(CelebrationEvent.weekMet(weekStart: '2026-10-05', studyDays: 4, goal: 4, firstEver: true));
      expect(c!.textOnly, isTrue);
      expect(c.ring, isFalse);
      expect(c.mobiHop, isFalse);
      expect(c.sentence, isNotNull);
      expect(driver.calls, isEmpty);
    });

    test('Off: nothing is shown, and the id is still used up', () async {
      await container.read(rhythmPrefsProvider.notifier).setMode(CelebrationMode.off);
      expect(await controller().celebrate(repair('r1')), isNull);
      expect(container.read(celebrationControllerProvider).byScope, isEmpty);
      await container.read(rhythmPrefsProvider.notifier).setMode(CelebrationMode.full);
      expect(await controller().celebrate(repair('r1')), isNull);
    });

    test('touch feedback off means no haptic even in Full', () async {
      final quietContainer = ProviderContainer(
        overrides: [
          userIdProvider.overrideWithValue('u1'),
          rhythmSeenRepositoryProvider.overrideWithValue(RhythmSeenRepository(LocalScope(db, () => 'u1', () => at))),
          rhythmPrefsStoreProvider.overrideWithValue(store),
          hapticsProvider.overrideWithValue(Haptics(enabled: false, driver: driver)),
        ],
      );
      addTearDown(quietContainer.dispose);
      await quietContainer.read(celebrationControllerProvider.notifier).celebrate(repair('r9'));
      expect(driver.calls, isEmpty);
    });
  });

  group('milestone rows (L3)', () {
    test('a dated row is fresh until the milestone screen has shown it', () async {
      final m = RhythmMilestone(id: 'weeks_met_4', achievedAt: at);
      final c = await controller().celebrate(CelebrationEvent.milestone(m));
      expect(c!.level, CelebrationLevel.l3);
      expect(c.showsMoment, isFalse);
      expect(container.read(celebrationControllerProvider).freshRows, {'weeks_met_4'});
      expect(driver.calls, isEmpty, reason: 'a row has no haptic');
      controller().clearFreshRows();
      expect(container.read(celebrationControllerProvider).freshRows, isEmpty);
    });

    test('the first full mock is a row only, never a moment tied to the score', () {
      final e = CelebrationEvent.milestone(RhythmMilestone(id: 'first_full_mock', achievedAt: at));
      expect(e.level, CelebrationLevel.l3);
      expect(e.sentence, isNull);
    });

    test('rows do not use up the scope of a moment', () async {
      await controller().celebrate(CelebrationEvent.milestone(RhythmMilestone(id: 'repairs_5', achievedAt: at)));
      expect(await controller().celebrate(CelebrationEvent.milestone(RhythmMilestone(id: 'first_repair', achievedAt: at))), isNotNull);
    });
  });

  group('planMilestones', () {
    final now = DateTime.utc(2026, 10, 12, 12);
    final rhythm = rhythmFixture(
      milestones: [
        RhythmMilestone(id: 'first_scored_session', achievedAt: DateTime.utc(2026, 9, 1)),
        RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 12, 9)),
        const RhythmMilestone(id: 'repairs_5'),
      ],
    );

    test('the first read on a phone is a baseline: nothing celebrates', () {
      final plan = planMilestones(rhythm, const RhythmSeenState(), now);
      expect(plan.events, isEmpty);
      expect(plan.silent, ['first_scored_session', 'first_repair']);
    });

    test('later, only news inside 48 hours celebrates; old history stays quiet', () {
      final seen = RhythmSeenState(
        lastSeenWeek: LastSeenWeek.fromRhythm(rhythmFixture()),
      );
      final plan = planMilestones(rhythm, seen, now);
      expect([for (final e in plan.events) e.id], ['first_repair']);
      expect(plan.silent, ['first_scored_session']);
    });

    test('ids already celebrated are skipped, and unearned ones never count', () {
      final seen = RhythmSeenState(
        lastSeenWeek: LastSeenWeek.fromRhythm(rhythmFixture()),
        celebratedIds: const {'first_repair', 'first_scored_session'},
      );
      final plan = planMilestones(rhythm, seen, now);
      expect(plan.events, isEmpty);
      expect(plan.silent, isEmpty);
    });
  });

  group('prefs', () {
    test('rhythm off and the Celebrations choice persist per account', () async {
      final prefs = container.read(rhythmPrefsProvider.notifier);
      await prefs.ensureLoaded();
      expect(container.read(rhythmVisibleProvider), isTrue);
      await prefs.setHidden(true);
      await prefs.setMode(CelebrationMode.quiet);
      expect(container.read(rhythmVisibleProvider), isFalse);

      final again = ProviderContainer(overrides: [userIdProvider.overrideWithValue('u1'), rhythmPrefsStoreProvider.overrideWithValue(store)]);
      addTearDown(again.dispose);
      await again.read(rhythmPrefsProvider.notifier).ensureLoaded();
      expect(again.read(rhythmPrefsProvider).hidden, isTrue);
      expect(again.read(rhythmPrefsProvider).mode, CelebrationMode.quiet);

      final other = ProviderContainer(overrides: [userIdProvider.overrideWithValue('u2'), rhythmPrefsStoreProvider.overrideWithValue(store)]);
      addTearDown(other.dispose);
      await other.read(rhythmPrefsProvider.notifier).ensureLoaded();
      expect(other.read(rhythmPrefsProvider).hidden, isFalse);
      expect(other.read(rhythmPrefsProvider).mode, CelebrationMode.full);
    });

    test('the strip stays hidden until the choices are read, so it never flashes', () {
      expect(container.read(rhythmVisibleProvider), isFalse);
    });
  });
}
