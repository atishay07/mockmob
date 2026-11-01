import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show practiceSubjectProvider;

import '../support/fixture_learn_api.dart';

/// Lets the microtasks and zero-length timers of a read run.
Future<void> settle([int turns = 20]) async {
  for (var i = 0; i < turns; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

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
  ProviderContainer container(FixtureLearnApi api, {PrefsStore? store, String subject = 'accountancy'}) {
    final c = ProviderContainer(overrides: learnFixtureOverrides(api, store: store, subject: subject));
    addTearDown(c.dispose);
    return c;
  }

  test('OffLearnApi is the default: Learn v2 is off and nothing is read', () async {
    final c = ProviderContainer(overrides: [learn2PrefsStoreProvider.overrideWithValue(MemoryPrefsStore())]);
    addTearDown(c.dispose);
    expect(c.read(learnApiProvider), isA<OffLearnApi>());
    expect(c.read(learnOnProvider), isFalse);
    await settle();
    expect(c.read(learnOnProvider), isFalse);
    await expectLater(held(c, learnSubjectProvider('accountancy')), throwsA(isA<LearnError>().having((e) => e.kind, 'kind', LearnErrorKind.off)));
  });

  test('the families read through the API; the subject id is canonical', () async {
    final api = FixtureLearnApi();
    final c = container(api);
    expect(c.read(learnSubjectIdProvider), 'accountancy');
    expect((await held(c, learnSubjectProvider('accountancy'))).suggestions, hasLength(3));
    expect((await held(c, learnCoversProvider('accountancy'))).covers, isNotEmpty);
    expect((await held(c, learnShelvesProvider('accountancy'))).dueTotal, 27);
    expect((await held(c, learnChapterCardsProvider((chapterKey: l2Aop, filter: 'must')))).counts.must, 14);
    expect((await held(c, learnSubjectCardsProvider((subject: 'accountancy', filter: 'due')))).filter, 'due');
    expect((await held(c, learnPreviewProvider(LearnPreviewKey(chapterKey: l2Aop, minutes: 20)))).minutes, 20);
    await held(c, learnSubjectProvider('business'));
    expect(api.calls, contains('subject business_studies'));
  });

  test("Practice's subject is Learn's, as a public id", () {
    final c = ProviderContainer(overrides: [practiceSubjectProvider.overrideWithBuild((ref, notifier) => 'business')]);
    addTearDown(c.dispose);
    expect(c.read(learnSubjectIdProvider), 'business_studies');
  });

  test('search under two characters asks nothing', () async {
    final api = FixtureLearnApi();
    final c = container(api);
    final short = await held(c, learnSearchProvider((subject: 'accountancy', query: ' g ')));
    expect(short.tooShort, isTrue);
    expect(api.calls.where((x) => x.startsWith('search')), isEmpty);
    final hit = await held(c, learnSearchProvider((subject: 'accountancy', query: 'goodwill')));
    expect(hit.cards, isNotEmpty);
  });

  test('equal preview keys share one read', () async {
    final api = FixtureLearnApi();
    final c = container(api);
    final a = LearnPreviewKey(chapterKey: l2Aop, minutes: 10, leaveOut: ['questions', 'cards']);
    final b = LearnPreviewKey(chapterKey: l2Aop, minutes: 10, leaveOut: ['cards', 'questions']);
    final sub = c.listen(learnPreviewProvider(a), (_, _) {});
    addTearDown(sub.close);
    await held(c, learnPreviewProvider(b));
    expect(api.previews, hasLength(1));
  });

  test('a refresh keeps the previous value on screen, and a failed refresh keeps it too', () async {
    final api = FixtureLearnApi(slow: const Duration(milliseconds: 5));
    final c = container(api);
    final p = learnSubjectProvider('accountancy');
    final sub = c.listen(p, (_, _) {});
    addTearDown(sub.close);
    final first = await held(c, p);
    c.invalidate(p);
    final refreshing = c.read(p);
    expect(refreshing.isLoading, isTrue);
    expect(refreshing.isRefreshing, isTrue);
    expect(refreshing.value, same(first));
    await held(c, p);
    api.offline = true;
    invalidateLearnReads(c.invalidate);
    expect(c.read(p).value, isNotNull);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await settle();
    final failed = c.read(p);
    expect(failed.hasError, isTrue);
    expect(failed.value!.suggestions, hasLength(3));
    expect((failed.error! as LearnError).offline, isTrue);
  });

  group('learnOnProvider, the server switch', () {
    test('a subject answer turns it on and keeps that on the phone', () async {
      final store = MemoryPrefsStore();
      final c = container(FixtureLearnApi(), store: store);
      final sub = c.listen(learnOnProvider, (_, _) {});
      addTearDown(sub.close);
      expect(c.read(learnOnProvider), isFalse);
      await settle();
      expect(c.read(learnOnProvider), isTrue);
      expect(store.values[LearnPrefs.onKey], isTrue);
    });

    test('404 LEARN_OFF turns it off and keeps that', () async {
      final store = MemoryPrefsStore()..values[LearnPrefs.onKey] = true;
      final c = container(FixtureLearnApi(off: true), store: store);
      final seen = <bool>[];
      final sub = c.listen(learnOnProvider, (_, next) => seen.add(next), fireImmediately: true);
      addTearDown(sub.close);
      await settle();
      expect(c.read(learnOnProvider), isFalse);
      expect(store.values[LearnPrefs.onKey], isFalse);
    });

    test('the kept answer shows at once, and a failed read keeps it (no flash)', () async {
      final store = MemoryPrefsStore()..values[LearnPrefs.onKey] = true;
      final api = FixtureLearnApi(offline: true, slow: const Duration(milliseconds: 5));
      final c = container(api, store: store);
      final seen = <bool>[];
      final sub = c.listen(learnOnProvider, (_, next) => seen.add(next), fireImmediately: true);
      addTearDown(sub.close);
      await settle();
      expect(c.read(learnOnProvider), isTrue);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      await settle();
      expect(c.read(learnOnProvider), isTrue);
      expect(seen.where((on) => !on).length, lessThanOrEqualTo(1));
      expect(seen.last, isTrue);
      expect(store.values[LearnPrefs.onKey], isTrue);
    });

    test('restored completes once the kept answer is read, so a door can wait for it', () async {
      final store = MemoryPrefsStore()..values[LearnPrefs.onKey] = true;
      final c = container(FixtureLearnApi(slow: const Duration(milliseconds: 50)), store: store);
      final sub = c.listen(learnOnProvider, (_, _) {});
      addTearDown(sub.close);
      await c.read(learnOnProvider.notifier).restored;
      expect(c.read(learnOnProvider), isTrue);
    });

    test('a subject the Learn home read first answers at once', () async {
      final c = container(FixtureLearnApi());
      final home = c.listen(learnSubjectProvider('accountancy'), (_, _) {});
      addTearDown(home.close);
      await held(c, learnSubjectProvider('accountancy'));
      final sub = c.listen(learnOnProvider, (_, _) {});
      addTearDown(sub.close);
      expect(c.read(learnOnProvider), isTrue);
    });
  });

  group('the lengths kept on the phone', () {
    test('the feed length restores from the phone and is written when chosen', () async {
      final store = MemoryPrefsStore()..values[LearnPrefs.feedMinutesKey] = 20;
      final c = container(FixtureLearnApi(), store: store);
      final sub = c.listen(learnFeedMinutesProvider, (_, _) {});
      addTearDown(sub.close);
      expect(c.read(learnFeedMinutesProvider), 10);
      await settle();
      expect(c.read(learnFeedMinutesProvider), 20);
      c.read(learnFeedMinutesProvider.notifier).set(5);
      expect(c.read(learnFeedMinutesProvider), 5);
      await settle();
      expect(store.values[LearnPrefs.feedMinutesKey], 5);
      c.read(learnFeedMinutesProvider.notifier).set(7);
      expect(c.read(learnFeedMinutesProvider), 5);
    });

    test('a length chosen before the store answers wins', () async {
      final store = MemoryPrefsStore()..values[LearnPrefs.minutesKey] = 30;
      final c = container(FixtureLearnApi(), store: store);
      final sub = c.listen(learnChapterMinutesProvider, (_, _) {});
      addTearDown(sub.close);
      expect(c.read(learnChapterMinutesProvider), isNull);
      c.read(learnChapterMinutesProvider.notifier).set(45);
      await settle();
      expect(c.read(learnChapterMinutesProvider), 45);
      expect(store.values[LearnPrefs.minutesKey], 45);
    });
  });
}
