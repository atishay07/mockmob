// Shared set-up for the rhythm golden and widget tests: fake repositories that serve a fixed
// state, a fixed clock (Wednesday 14 October 2026, 10:00 AM in India) and a loaded prefs store.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/haptics/haptics.dart' show HapticDriver;
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';


export '../../unit/rhythm/fixtures.dart';

/// 10:00 AM IST on Wednesday 14 October 2026.
final DateTime kNow = DateTime.utc(2026, 10, 14, 4, 30);

class FakeRhythmRepo extends RhythmRepository {
  FakeRhythmRepo(this.initial);

  final RemoteState<Rhythm> initial;

  @override
  RemoteState<Rhythm> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {}
}

class FakeAttemptsRepo extends AttemptsRepository {
  FakeAttemptsRepo(this.initial);

  final RemoteState<List<Attempt>> initial;

  @override
  RemoteState<List<Attempt>> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {}
}

/// [n] server-scored sets of ten answers, newest first.
List<Attempt> scoredSets(int n) => [
      for (var k = 0; k < n; k++)
        Attempt.fromJson({
          'id': 's$k',
          'subject': 'accountancy',
          'score': 0,
          'correct': 7,
          'wrong': 2,
          'unattempted': 1,
          'total': 10,
          'details': const [],
          'questionsSnapshot': const [],
          'selectionMeta': {'mode': 'quick', 'scoringVersion': 'server_practice_v1'},
          'completedAt': kNow.subtract(Duration(days: k + 1)).millisecondsSinceEpoch,
        }),
    ];

class FakeGoalRepo extends GoalRepository {
  FakeGoalRepo(this.initial);

  final RemoteState<Goal> initial;
  final List<int> saved = [];
  final List<String?> savedPause = [];

  @override
  RemoteState<Goal> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {}

  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil, String? expectUserId}) async {
    saved.add(daysPerWeek);
    savedPause.add(pausedUntil);
    final goal = Goal(daysPerWeek: daysPerWeek, pausedUntil: pausedUntil);
    state = RemoteState(value: goal, fetchedAt: kNow);
    return goal;
  }
}

class FakeBestsRepo extends BestsRepository {
  FakeBestsRepo(this.initial);

  final RemoteState<List<PersonalBest>> initial;

  @override
  RemoteState<List<PersonalBest>> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {}
}

RemoteState<Rhythm> loaded(Rhythm r, {DateTime? at}) => RemoteState(value: r, fetchedAt: at ?? kNow);

RemoteState<Rhythm> staleState(Rhythm r) => RemoteState(
      value: r,
      fetchedAt: DateTime.utc(2026, 10, 13, 15, 45),
      fromCache: true,
      error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
    );

const RemoteState<Rhythm> kLoadingRhythm = RemoteState(loading: true);

const RemoteState<Rhythm> kFailedRhythm = RemoteState(error: ApiError(kind: ApiErrorKind.network, code: 'network'));

/// Overrides for a screen test. [hidden] is "Turn off rhythm".
List<Override> rhythmOverrides({
  required RemoteState<Rhythm> rhythm,
  Goal? goal,
  FakeGoalRepo? goalRepo,
  bool hidden = false,
  CelebrationMode mode = CelebrationMode.full,
  RemoteState<List<PersonalBest>> bests = const RemoteState(value: []),
  MemoryPrefsStore? store,
  String zone = 'Asia/Kolkata',
  List<Attempt> attempts = const [],
}) {
  final prefsStore = store ?? MemoryPrefsStore();
  prefsStore.values['rhythm_hidden_u1'] = hidden;
  prefsStore.values['rhythm_celebrations_u1'] = mode.name;
  return [
    userIdProvider.overrideWithValue('u1'),
    nowProvider.overrideWithValue(() => kNow),
    studentTimezoneProvider.overrideWithValue(zone),
    rhythmPrefsStoreProvider.overrideWithValue(prefsStore),
    rhythmRepositoryProvider.overrideWith(() => FakeRhythmRepo(rhythm)),
    goalRepositoryProvider.overrideWith(
      () => goalRepo ?? FakeGoalRepo(RemoteState(value: goal ?? Goal(daysPerWeek: rhythm.value?.daysGoal ?? 4), fetchedAt: kNow)),
    ),
    bestsRepositoryProvider.overrideWith(() => FakeBestsRepo(bests)),
    attemptsRepositoryProvider.overrideWith(() => FakeAttemptsRepo(RemoteState(value: attempts, fetchedAt: kNow))),
  ];
}

/// A frame shaped like the modal sheet, for sheet bodies.
class SheetFrame extends StatelessWidget {
  const SheetFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.raised, borderRadius: MmRadius.sheetTopOnly, border: Border.all(color: colors.line)),
      child: Padding(padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20), child: child),
    );
  }
}

/// Sheets span the full width of the phone, so their samples do too: only the caption is padded.
class SheetColumn extends StatelessWidget {
  const SheetColumn({super.key, required this.samples});

  final List<(String, Widget)> samples;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (label, child) in samples) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Text(label, style: context.mmType.small.copyWith(color: colors.ink3, fontSize: 12, height: 1.2)),
            ),
            child,
          ],
        ],
      ),
    );
  }
}

/// `rhythm_seen` in memory.
class MemorySeen implements RhythmSeenRepository {
  final Set<String> ids = {};
  bool unreadable = false;

  @override
  Future<RhythmSeenState> read() async {
    if (unreadable) throw StateError('no storage');
    return RhythmSeenState(celebratedIds: {...ids});
  }

  @override
  Future<bool> markCelebrated(String id) async => ids.add(id);

  @override
  Future<bool> hasCelebrated(String id) async => ids.contains(id);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class CountingDriver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}
