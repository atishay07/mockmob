import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/keycards/data/keycards_cache.dart';
import 'package:mockmob/features/keycards/data/keycards_providers.dart';

import 'support/keycards_fakes.dart';

/// Offline (KEYCARDS-BUILD-SPEC 4): each opened deck is kept under `keycards_deck_<chapterKey>` with its sha,
/// the home with its chapter states ("as of 9:40 PM"), and the due queue.
/// Reads an auto-disposed provider's value while something listens to it.
Future<T> held<T>(ProviderContainer c, ProviderListenable<AsyncValue<T>> p) async {
  final sub = c.listen(p, (_, _) {});
  try {
    while (true) {
      final v = c.read(p);
      if (v.hasValue && !v.isLoading) return v.value as T;
      if (v.hasError && !v.isLoading) throw v.error!;
      await Future<void>.delayed(Duration.zero);
    }
  } finally {
    sub.close();
  }
}

void main() {
  ProviderContainer container(FakeKeyCardsApi api, PrefsStore store) {
    final c = ProviderContainer(overrides: keyCardsOverrides(api, store: store));
    addTearDown(c.dispose);
    return c;
  }

  test('a deck is kept under its spec key with its sha, and only for the account that read it', () async {
    final store = MemoryPrefsStore();
    final cache = KeyCardsCache(store, userId: 'u1', now: () => kcNow);
    final body = FakeKeyCardsApi().deckBody(kcChapter1);
    final sha = await cache.saveDeck(kcChapter1, body);
    expect(store.values.keys, contains('keycards_deck_$kcChapter1'));
    expect(sha, hasLength(64));
    expect(KeyCardsCache.shaOf({...body}), sha);
    expect(KeyCardsCache.shaOf({'sha256': 'abc'}), 'abc');
    final kept = await cache.deck(kcChapter1);
    expect(kept!.sha, sha);
    expect(kept.deck.cards, hasLength(5));
    expect(kept.savedAt, kcNow.toUtc());
    expect(await KeyCardsCache(store, userId: 'u2').deck(kcChapter1), isNull);
    expect(await KeyCardsCache(store, userId: null).deck(kcChapter1), isNull);
  });

  test('online, the home is read from the server and kept; offline, the kept copy comes back with its time', () async {
    final api = FakeKeyCardsApi.withProgress();
    final store = MemoryPrefsStore();
    final live = container(api, store);
    final first = await held(live, keyCardsHomeProvider);
    expect(first.cached, isFalse);
    expect(first.value.enabled, isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(store.values.keys, contains(KeyCardsCache.homeKey));

    api.failWith = kcOffline;
    final offline = container(api, store);
    final kept = await held(offline, keyCardsHomeProvider);
    expect(kept.cached, isTrue);
    expect(kept.savedAt, kcNow.toUtc());
    expect(kept.value.subjects, hasLength(2));
  });

  test('offline with nothing kept: the read fails, and the screen says so', () async {
    final c = container(FakeKeyCardsApi(failWith: kcOffline), MemoryPrefsStore());
    await expectLater(held(c, keyCardsHomeProvider), throwsA(anything));
  });

  test('switched off on the server: off, nothing kept, and Revise has no Key cards', () async {
    final store = MemoryPrefsStore();
    final c = container(FakeKeyCardsApi(off: true), store);
    expect((await held(c, keyCardsHomeProvider)).value.enabled, isFalse);
    expect((await held(c, keyCardsDueProvider)).value.cards, isEmpty);
    expect(store.values, isEmpty);
  });

  test('the due queue offline: the kept queue, put in order again, without the cards rated since', () async {
    final api = FakeKeyCardsApi.withProgress();
    final store = MemoryPrefsStore();
    final live = container(api, store);
    final due = await held(live, keyCardsDueProvider);
    expect(due.value.cards, hasLength(5));
    await Future<void>.delayed(Duration.zero);
    final first = due.value.cards.first.card.id;
    await KeyCardsCache(store, userId: 'u1', now: () => kcNow).markReviewed(first, kcNow);

    api.failWith = kcOffline;
    final offline = container(api, store);
    final kept = await held(offline, keyCardsDueProvider);
    expect(kept.cached, isTrue);
    expect(kept.value.cards.map((c) => c.card.id), isNot(contains(first)));
    expect(kept.value.cards, hasLength(4));
  });

  test('the line you needed is nothing when the read fails or Key cards are off', () async {
    final off = await held(container(FakeKeyCardsApi(off: true), MemoryPrefsStore()), keyCardsLineProvider('q-wrong-1'));
    expect(off.shows, isFalse);
    final failed = await held(container(FakeKeyCardsApi.withProgress(failWith: kcOffline), MemoryPrefsStore()), keyCardsLineProvider('q-wrong-1'));
    expect(failed.shows, isFalse);
    final found = await held(container(FakeKeyCardsApi.withProgress(), MemoryPrefsStore()), keyCardsLineProvider('q-wrong-1'));
    expect(found.shows, isTrue);
    expect(found.cards, hasLength(2));
  });

  test("a line read once is kept while the app runs: opening the answer again spends none of Free's lines", () async {
    final api = FakeKeyCardsApi.withProgress();
    final c = container(api, MemoryPrefsStore());
    expect((await held(c, keyCardsLineProvider('q-wrong-1'))).shows, isTrue);
    // The row folds (nothing listens), then opens again.
    await Future<void>.delayed(Duration.zero);
    expect((await held(c, keyCardsLineProvider('q-wrong-1'))).shows, isTrue);
    expect(api.lineReads, 1);
  });

  test('without the routes wired (the default), nothing is read and everything is off', () async {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    expect((await held(c, keyCardsHomeProvider)).value.enabled, isFalse);
    expect((await held(c, keyCardsDueProvider)).value.cards, isEmpty);
    expect((await held(c, keyCardsLineProvider('q'))).shows, isFalse);
  });
}
