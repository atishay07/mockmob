// Shared set-up for the rhythm golden and widget tests: fake repositories that serve a fixed
// state, a fixed clock (Wednesday 14 October 2026, 10:00 AM in India) and a loaded prefs store.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
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
  Future<Goal> save({required int daysPerWeek, String? pausedUntil}) async {
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
