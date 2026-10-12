import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/data/guest_sample.dart';
import 'package:mockmob/features/onboarding/data/sample_questions.dart';
import 'package:mockmob/features/onboarding/state/onboarding_providers.dart';

import 'support.dart';

void main() {
  group('sample questions', () {
    final set = SampleSet.parse(sampleSource());

    test('five questions with ids q1 to q5 and options A to D', () {
      expect(set.total, 5);
      expect([for (final q in set.questions) q.id], kSampleQuestionIds);
      for (final q in set.questions) {
        expect([for (final o in q.options) o.key], ['A', 'B', 'C', 'D']);
      }
    });

    test('correct keys match what the server scores against', () {
      expect([for (final q in set.questions) q.correctKey], rightKeys);
    });

    test('carries the version and the disclaimer', () {
      expect(set.version, 'landing-v1');
      expect(set.disclaimer, 'Five original sample questions. No signup. Not an official PYQ or a scored diagnostic.');
    });

    test('text is copied verbatim from the landing drill', () {
      final jsx = File('../src/components/landing/DemoDrill.jsx');
      if (!jsx.existsSync()) {
        markTestSkipped('DemoDrill.jsx is not next to the app in this checkout');
        return;
      }
      final source = jsx.readAsStringSync();
      for (final q in set.questions) {
        expect(source, contains(q.prompt), reason: q.id);
        expect(source, contains(q.why), reason: q.id);
        for (final o in q.options) {
          expect(source, contains(o.text), reason: '${q.id} ${o.key}');
        }
      }
    });
  });

  group('guest sample', () {
    test('round trips through the store and reads damaged data as empty', () async {
      final prefs = MemoryPrefsStore();
      final store = GuestSampleStore(prefs);
      expect((await store.load()).hasStarted, isFalse);

      await store.save(guestWith(keys: ['B', 'A']));
      final back = await store.load();
      expect(back.subject, 'accountancy');
      expect(back.answers, {'q1': 'B', 'q2': 'A'});
      expect(back.importKey, 'import-key-0000000001');

      await prefs.setString(GuestSampleStore.storageKey, '{not json');
      expect((await store.load()).hasStarted, isFalse);
    });

    test('first unanswered question and completeness', () {
      final g = guestWith(keys: ['B', 'A']);
      expect(g.firstUnanswered(kSampleQuestionIds), 3);
      expect(g.isComplete(5), isFalse);
      expect(guestWith(keys: rightKeys).firstUnanswered(kSampleQuestionIds), isNull);
      expect(guestWith(keys: rightKeys).isComplete(5), isTrue);
    });

    test('the controller keeps the first answer and one import key', () async {
      final h = OnboardingHarness();
      final container = ProviderContainer(overrides: h.overrides());
      addTearDown(container.dispose);
      final controller = container.read(guestSampleProvider.notifier);

      await container.read(guestSampleProvider.future);
      await controller.chooseSubject('economics');
      final key = container.read(guestSampleProvider).requireValue.importKey;
      expect(key, isNotNull);
      await controller.answer('q1', 'A');
      await controller.answer('q1', 'B');
      final after = container.read(guestSampleProvider).requireValue;
      expect(after.answers, {'q1': 'A'});
      expect(after.importKey, key);
      expect(after.imported, isFalse);

      // It was written to the phone, not only held in memory.
      expect((await h.store.load()).answers, {'q1': 'A'});
    });
  });
}
