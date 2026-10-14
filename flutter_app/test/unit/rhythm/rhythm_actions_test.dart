import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/features/rhythm/data/rhythm_providers.dart';

import 'fixtures.dart';

/// A rhythm repository on the real refresh logic, with reads the test answers by hand.
class _ManualRhythm extends RhythmRepository {
  _ManualRhythm(this.initial);

  final Rhythm initial;
  final reads = <Completer<Rhythm>>[];

  @override
  RemoteState<Rhythm> build() {
    userId = 'u1';
    return RemoteState(value: initial, fetchedAt: DateTime.utc(2026, 10, 12));
  }

  @override
  Future<CachedValue<Rhythm>?> readCache(String userId) async => null;

  @override
  Future<Fetched<Rhythm>> fetchRemote() async {
    final read = Completer<Rhythm>();
    reads.add(read);
    return Fetched(await read.future, null);
  }

  @override
  Future<void> writeCache(String userId, Fetched<Rhythm> fetched, DateTime at) async {}
}

class _Goal extends GoalRepository {
  _Goal(this.initial, {this.loadsTo});

  final RemoteState<Goal> initial;

  /// What a refresh brings back, or null when the read fails.
  final Goal? loadsTo;
  final saves = <({int days, String? pausedUntil})>[];

  @override
  RemoteState<Goal> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {
    final goal = loadsTo;
    if (goal != null) state = RemoteState(value: goal, fetchedAt: DateTime.utc(2026, 10, 12));
  }

  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil, String? expectUserId}) async {
    saves.add((days: daysPerWeek, pausedUntil: pausedUntil));
    final goal = Goal(daysPerWeek: daysPerWeek, pausedUntil: pausedUntil);
    state = RemoteState(value: goal, fetchedAt: DateTime.utc(2026, 10, 12));
    return goal;
  }
}

class _StillRhythm extends RhythmRepository {
  _StillRhythm(this.initial);

  final Rhythm initial;

  @override
  RemoteState<Rhythm> build() => RemoteState(value: initial, fetchedAt: DateTime.utc(2026, 10, 12));

  @override
  Future<void> refresh({bool force = false}) async {}
}

ProviderContainer _container({required DateTime now, required RhythmRepository Function() rhythm, required _Goal goal}) {
  final container = ProviderContainer(
    overrides: [
      nowProvider.overrideWithValue(() => now),
      studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
      rhythmRepositoryProvider.overrideWith(rhythm),
      goalRepositoryProvider.overrideWith(() => goal),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  final monday = DateTime.utc(2026, 10, 12, 6); // 11:30 AM in India, Monday 12 October.

  test('a pause ends on a fresh week even when a read started before the write', () async {
    final repo = _ManualRhythm(rhythmFixture());
    final goal = _Goal(const RemoteState(value: Goal(daysPerWeek: 4)));
    final c = _container(now: monday, rhythm: () => repo, goal: goal);
    c.listen(rhythmRepositoryProvider, (_, _) {});
    c.read(rhythmRepositoryProvider);

    // The screen's own read is running when the student taps Pause this week.
    final screenRead = c.read(rhythmRepositoryProvider.notifier).refresh();
    await pumpEventQueue();
    expect(repo.reads, hasLength(1));

    final pause = c.read(rhythmActionsProvider).pauseThisWeek();
    await pumpEventQueue();
    // The read that started before the pause answers with the old week.
    repo.reads[0].complete(rhythmFixture());
    await screenRead;
    await pumpEventQueue();
    // A second read follows, and it has the pause.
    expect(repo.reads, hasLength(2));
    repo.reads[1].complete(rhythmFixture(paused: true));
    await pause;

    expect(c.read(rhythmRepositoryProvider).value!.paused, isTrue);
  });

  test('Pause this week uses the student today, not a cached week from before Sunday midnight', () async {
    final goal = _Goal(const RemoteState(value: Goal(daysPerWeek: 4)));
    // Monday 19 October, with last week still cached.
    final c = _container(now: DateTime.utc(2026, 10, 19, 6), rhythm: () => _StillRhythm(rhythmFixture(weekStart: '2026-10-12')), goal: goal);
    await c.read(rhythmActionsProvider).pauseThisWeek();
    await c.read(rhythmActionsProvider).pauseTwoWeeks();
    expect(goal.saves.map((s) => s.pausedUntil), ['2026-10-25', '2026-11-01']);
  });

  test('a goal save keeps the pause when the goal had not loaded yet', () async {
    final goal = _Goal(const RemoteState(), loadsTo: const Goal(daysPerWeek: 4, pausedUntil: '2026-10-25'));
    final c = _container(now: monday, rhythm: () => _StillRhythm(rhythmFixture(paused: true)), goal: goal);
    await c.read(rhythmActionsProvider).saveGoal(5);
    expect(goal.saves.single, (days: 5, pausedUntil: '2026-10-25'));
  });

  test('a goal save is refused, not sent without the pause, when the goal cannot be read', () async {
    final goal = _Goal(const RemoteState(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
    final c = _container(now: monday, rhythm: () => _StillRhythm(rhythmFixture(paused: true)), goal: goal);
    await expectLater(c.read(rhythmActionsProvider).saveGoal(5), throwsA(isA<ApiError>()));
    expect(goal.saves, isEmpty);
  });
}
