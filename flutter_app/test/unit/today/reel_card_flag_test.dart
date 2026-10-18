// M3 of the v15 emulator walk (D29): "Play your paper back, 20 s" never appeared on Today after a Quick set, because the
// card was keyed on "the result is unopened" and the Quick result marks itself opened the moment it lands. The card is
// now keyed on its own flag: it shows once after ANY fresh submission, until the reel is played or turned down.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/models/models.dart' show Attempt;
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/paper_reel/data/reel_seen.dart';
import 'package:mockmob/features/today/data/today_providers.dart' show todayReelPendingProvider;
import 'package:mockmob/features/today/logic/reel_pending.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import '../core_data/support/test_db.dart';
import 'support/today_fixtures.dart';

class _FakeAttempts extends AttemptsRepository {
  _FakeAttempts(this.list);

  final List<Attempt> list;

  @override
  RemoteState<List<Attempt>> build() => RemoteState(value: list, fetchedAt: tuesdayEvening);

  @override
  Future<void> refresh({bool force = false}) async {}
}

void main() {
  final now = tuesdayEvening;
  PendingResult pending(String id, {Duration age = const Duration(minutes: 5), bool opened = false}) => PendingResult(
        attemptId: id,
        receivedAt: now.subtract(age),
        openedAt: opened ? now.subtract(age - const Duration(seconds: 3)) : null,
      );

  group('which papers owe a reel card', () {
    test('a Quick set whose result opened itself at once is still due, until its flag is set', () {
      final quick = pending('q10', opened: true);
      expect(reelPendingFrom(pending: [quick], seen: <String>{}, knownAttempts: {'q10'}, now: now).map((d) => d.attemptId), ['q10']);
      expect(reelPendingFrom(pending: [quick], seen: {'q10'}, knownAttempts: {'q10'}, now: now), isEmpty);
    });

    test('a result that was never opened is due however old, as it always was', () {
      final old = pending('m3', age: const Duration(days: 5));
      expect(reelPendingFrom(pending: [old], seen: <String>{}, knownAttempts: const {}, now: now).map((d) => d.attemptId), ['m3']);
    });

    test('an old opened result is not offered a reel the day an update appears', () {
      final old = pending('q9', age: const Duration(days: 3), opened: true);
      expect(reelPendingFrom(pending: [old], seen: <String>{}, knownAttempts: {'q9'}, now: now), isEmpty);
      final edge = pending('q8', age: reelCardWindow - const Duration(minutes: 1), opened: true);
      expect(reelPendingFrom(pending: [edge], seen: <String>{}, knownAttempts: {'q8'}, now: now), hasLength(1));
    });

    test('an opened paper waits for its attempt to be on the phone, so the card can name it', () {
      final quick = pending('q10', opened: true);
      expect(reelPendingFrom(pending: [quick], seen: <String>{}, knownAttempts: const {}, now: now), isEmpty);
    });

    test('while the flag memory is being read, an opened paper never flashes a card for one already played', () {
      final quick = pending('q10', opened: true);
      final unopened = pending('m7');
      final due = reelPendingFrom(pending: [quick, unopened], seen: null, knownAttempts: {'q10', 'm7'}, now: now);
      expect(due.map((d) => d.attemptId), ['m7'], reason: 'only the paper whose result is still unopened, as before');
    });

    test('newest first', () {
      final due = reelPendingFrom(
        pending: [pending('old', age: const Duration(hours: 3), opened: true), pending('new', age: const Duration(minutes: 2), opened: true)],
        seen: <String>{},
        knownAttempts: {'old', 'new'},
        now: now,
      );
      expect(due.map((d) => d.attemptId), ['new', 'old']);
    });
  });

  group('Today builds the card from the reel list', () {
    test('after a Quick set (result opened) the card leads once, naming the set and its subject', () {
      final view = buildToday(ashaInputs(reelPending: [(attemptId: 'q1', receivedAt: now)]));
      final hero = view.hero;
      expect(hero, isA<SealedHero>());
      final sealed = hero! as SealedHero;
      expect(sealed.attemptId, 'q1');
      expect(sealed.title, 'Quick 10, Business Studies');
    });

    test('once played or turned down the Up next card is back', () {
      final view = buildToday(ashaInputs(reelPending: const []));
      expect(view.hero, isA<MoveHero>());
    });

    test('without a reel list the card still follows the unopened results (callers that predate the flag)', () {
      final view = buildToday(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: now)]));
      expect(view.hero, isA<SealedHero>());
    });

    test('two papers due: the newest leads and the other is counted in words', () {
      final view = buildToday(ashaInputs(reelPending: [(attemptId: 'm7', receivedAt: now), (attemptId: 'q1', receivedAt: now.subtract(const Duration(hours: 1)))]));
      final hero = view.hero! as SealedHero;
      expect(hero.attemptId, 'm7');
      expect(hero.moreLine, '1 more paper to play back.');
    });
  });

  group('the flag itself', () {
    test('is read before it is trusted, remembered across a restart, and capped', () async {
      final store = MemoryPrefsStore();
      ProviderContainer open() => ProviderContainer(overrides: [reelPrefsStoreProvider.overrideWithValue(store)]);

      final first = open();
      expect(first.read(reelSeenProvider).value, isNull, reason: 'null while the memory is read');
      expect(await first.read(reelSeenProvider.future), isEmpty);
      await first.read(reelSeenProvider.notifier).mark('q10');
      await first.read(reelSeenProvider.notifier).mark('q10');
      expect(first.read(reelSeenProvider).value, {'q10'});
      first.dispose();

      final second = open();
      expect(await second.read(reelSeenProvider.future), {'q10'}, reason: 'a restart does not bring the card back');
      for (var i = 0; i < reelSeenKept + 5; i++) {
        await second.read(reelSeenProvider.notifier).mark('p$i');
      }
      final kept = second.read(reelSeenProvider).value!;
      expect(kept.length, reelSeenKept);
      expect(kept, contains('p${reelSeenKept + 4}'));
      expect(kept, isNot(contains('q10')), reason: 'the oldest are forgotten first');
      second.dispose();
    });
  });

  group('from the phone\'s own records, through the providers', () {
    late AppDatabase db;
    late ProviderContainer container;

    setUp(() {
      db = newTestDb();
      final scope = LocalScope(db, () => 'u1', () => now);
      final quick = paper(
        id: 'q10',
        completedAt: now.subtract(const Duration(minutes: 5)),
        mode: 'quick',
        runs: const [('Staffing', V.right, 6), ('Staffing', V.wrong, 4)],
      );
      container = ProviderContainer(overrides: [
        nowProvider.overrideWithValue(() => now),
        userIdProvider.overrideWithValue('u1'),
        localScopeProvider.overrideWithValue(scope),
        reelPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        attemptsRepositoryProvider.overrideWith(() => _FakeAttempts([quick])),
      ]);
    });

    tearDown(() async {
      container.dispose();
      await db.close();
    });

    test('a Quick set marked opened the moment it landed still gets its card, and "Not now" ends it', () async {
      final repo = container.read(pendingResultRepositoryProvider);
      await repo.recordReceived('q10');
      await repo.markOpened('q10'); // what the Quick result does on first data
      expect(await repo.unopened(), isEmpty, reason: 'the result counts as opened: that is not the card\'s flag');

      final sub = container.listen(todayReelPendingProvider, (_, _) {});
      addTearDown(sub.close);
      await container.read(allPendingResultsProvider.future);
      await container.read(reelSeenProvider.future);
      await Future<void>.delayed(Duration.zero);
      expect(container.read(todayReelPendingProvider).map((d) => d.attemptId), ['q10']);

      await container.read(reelSeenProvider.notifier).mark('q10');
      expect(container.read(todayReelPendingProvider), isEmpty);
    });
  });
}
