import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/rhythm/screens/bests_screen.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

class _Auth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
}

class _Attempts extends AttemptsRepository {
  _Attempts(this.initial);

  final List<Attempt> initial;

  @override
  RemoteState<List<Attempt>> build() => RemoteState(value: initial, fetchedAt: kNow);

  @override
  Future<void> refresh({bool force = false}) async {}

  void setAttempts(List<Attempt> list) => state = RemoteState(value: list, fetchedAt: kNow);
}

/// The real bests notifier with a network read that only counts.
class _CountingBests extends BestsRepository {
  int fetches = 0;

  @override
  Future<CachedValue<List<PersonalBest>>?> readCache(String userId) async => null;

  @override
  Future<Fetched<List<PersonalBest>>> fetchRemote() async {
    fetches++;
    return const Fetched(<PersonalBest>[], null);
  }

  @override
  Future<void> writeCache(String userId, Fetched<List<PersonalBest>> fetched, DateTime at) async {}
}

class _RefreshCountingBests extends FakeBestsRepo {
  _RefreshCountingBests() : super(const RemoteState(value: []));

  final forced = <bool>[];

  @override
  Future<void> refresh({bool force = false}) async => forced.add(force);
}

void main() {
  test('the bests are read again when a new scored attempt arrives', () async {
    final attempts = _Attempts(scoredSets(2));
    final bests = _CountingBests();
    final c = ProviderContainer(
      overrides: [
        authSnapshotProvider.overrideWith(_Auth.new),
        nowProvider.overrideWithValue(() => kNow),
        attemptsRepositoryProvider.overrideWith(() => attempts),
        bestsRepositoryProvider.overrideWith(() => bests),
      ],
    );
    addTearDown(c.dispose);
    // Today keeps the attempts list alive for the whole session.
    c.listen(attemptsRepositoryProvider, (_, _) {});
    c.listen(bestsRepositoryProvider, (_, _) {});
    await pumpEventQueue();
    expect(bests.fetches, 1);

    // A session is submitted: a new attempt is added at the top of the list.
    attempts.setAttempts(scoredSets(3));
    await pumpEventQueue();
    expect(bests.fetches, 2);

    // The same list again changes nothing.
    attempts.setAttempts(scoredSets(3));
    await pumpEventQueue();
    expect(bests.fetches, 2);
  });

  group('Personal bests screen', () {
    setUpAll(loadAppFonts);

    testWidgets('reads the bests again when it opens', (tester) async {
      final bests = _RefreshCountingBests();
      await pumpMockmob(
        tester,
        const YouBestsScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          userIdProvider.overrideWithValue('u1'),
          nowProvider.overrideWithValue(() => kNow),
          studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
          rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
          rhythmRepositoryProvider.overrideWith(() => FakeRhythmRepo(loaded(rhythmFixture()))),
          goalRepositoryProvider.overrideWith(() => FakeGoalRepo(RemoteState(value: const Goal(daysPerWeek: 4), fetchedAt: kNow))),
          bestsRepositoryProvider.overrideWith(() => bests),
        ],
      );
      await tester.pump();
      expect(bests.forced, [true]);
    });
  });
}
