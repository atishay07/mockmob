import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';

/// A phone store whose reads can fail, and which records every write.
class FlakyPrefs extends MemoryPrefsStore {
  bool failReads = false;
  final List<(String, String)> writes = [];

  @override
  Future<String?> getString(String key) async {
    if (failReads) throw StateError('storage unavailable');
    return super.getString(key);
  }

  @override
  Future<void> setString(String key, String value) async {
    writes.add((key, value));
    return super.setString(key, value);
  }
}

final _stored = const OnboardingAnswers(stage: Stage.classTwelve, step: Steps.course).mark(Steps.stage);

void main() {
  group('AnswersStore.load', () {
    test('nothing stored is an empty sheet', () async {
      expect(await AnswersStore(FlakyPrefs()).load(), same(OnboardingAnswers.empty));
    });

    test('a stored sheet reads back', () async {
      final prefs = FlakyPrefs()..values[AnswersStore.key] = jsonEncode(_stored.toJson());
      final a = await AnswersStore(prefs).load();
      expect(a.stage, Stage.classTwelve);
      expect(a.step, Steps.course);
    });

    test('a storage error is an error, not an empty sheet, and copies nothing', () async {
      final prefs = FlakyPrefs()
        ..values[AnswersStore.key] = jsonEncode(_stored.toJson())
        ..failReads = true;
      await expectLater(
        AnswersStore(prefs).load(),
        throwsA(isA<SheetReadError>().having((e) => e.failure, 'failure', SheetReadFailure.unreadable).having((e) => e.backedUp, 'backedUp', false)),
      );
      expect(prefs.writes, isEmpty);
    });

    test('broken JSON is kept in the backup key, untouched', () async {
      const raw = '{"v":1,"stage":';
      final prefs = FlakyPrefs()..values[AnswersStore.key] = raw;
      await expectLater(
        AnswersStore(prefs).load(),
        throwsA(isA<SheetReadError>().having((e) => e.failure, 'failure', SheetReadFailure.broken).having((e) => e.backedUp, 'backedUp', true)),
      );
      expect(prefs.values[AnswersStore.backupKey], raw);
      expect(prefs.values[AnswersStore.key], raw, reason: 'the original stays where it was');
    });

    test('a sheet from a newer build is kept in the backup key', () async {
      final raw = jsonEncode({..._stored.toJson(), 'v': OnboardingAnswers.version + 1, 'newField': 'x'});
      final prefs = FlakyPrefs()..values[AnswersStore.key] = raw;
      await expectLater(
        AnswersStore(prefs).load(),
        throwsA(isA<SheetReadError>().having((e) => e.failure, 'failure', SheetReadFailure.newer).having((e) => e.backedUp, 'backedUp', true)),
      );
      expect(prefs.values[AnswersStore.backupKey], raw);
    });

    test('a field of the wrong type counts as broken', () async {
      final raw = jsonEncode({..._stored.toJson(), 'stage': 12});
      final prefs = FlakyPrefs()..values[AnswersStore.key] = raw;
      await expectLater(AnswersStore(prefs).load(), throwsA(isA<SheetReadError>().having((e) => e.failure, 'failure', SheetReadFailure.broken)));
    });
  });

  group('AnswersController after a failed read', () {
    late FlakyPrefs prefs;

    ProviderContainer start({bool failReads = true, String? raw}) {
      prefs = FlakyPrefs()
        ..values[AnswersStore.key] = raw ?? jsonEncode(_stored.toJson())
        ..failReads = failReads;
      final c = ProviderContainer(overrides: [
        answersStoreProvider.overrideWithValue(AnswersStore(prefs)),
        nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 40)),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    Future<void> settle() async {
      for (var i = 0; i < 10; i++) {
        await Future<void>.delayed(Duration.zero);
      }
    }

    test('a tap after a throwing read never saves an empty sheet', () async {
      final c = start();
      final sub = c.listen(onboardingAnswersProvider, (_, _) {});
      addTearDown(sub.close);
      await settle();
      expect(c.read(onboardingAnswersProvider).hasError, isTrue);
      final controller = c.read(onboardingAnswersProvider.notifier);
      expect(controller.readError?.failure, SheetReadFailure.unreadable);

      controller.setStage(Stage.classEleven);
      controller.goTo(Steps.course);
      await controller.flushed();
      await settle();
      expect(prefs.writes.where((w) => w.$1 == AnswersStore.key), isEmpty, reason: 'writes wait for a good read');
      expect(c.read(onboardingAnswersProvider).hasError, isTrue, reason: 'still the error, not an empty sheet');
      expect(controller.startFresh(), isFalse, reason: 'nothing was backed up, so nothing may be replaced');
    });

    test('once a read succeeds, the stored sheet is back and writes go through', () async {
      final c = start();
      final sub = c.listen(onboardingAnswersProvider, (_, _) {});
      addTearDown(sub.close);
      await settle();
      final controller = c.read(onboardingAnswersProvider.notifier);

      await expectLater(controller.retry(), throwsA(isA<SheetReadError>()));
      prefs.failReads = false;
      final a = await controller.retry();
      expect(a.stage, Stage.classTwelve, reason: 'the real sheet, not a fresh one');

      controller.goTo(Steps.subjects);
      await controller.flushed();
      final saved = OnboardingAnswers.fromJson(jsonDecode(prefs.values[AnswersStore.key]! as String) as Map<String, Object?>);
      expect(saved.stage, Stage.classTwelve);
      expect(saved.step, Steps.subjects);
    });

    test('a broken sheet, once backed up, can be replaced by a fresh one on request', () async {
      const raw = 'not json';
      final c = start(failReads: false, raw: raw);
      final sub = c.listen(onboardingAnswersProvider, (_, _) {});
      addTearDown(sub.close);
      await settle();
      final controller = c.read(onboardingAnswersProvider.notifier);
      controller.goTo(Steps.stage);
      await controller.flushed();
      expect(prefs.values[AnswersStore.key], raw, reason: 'no write before the student chooses');

      expect(controller.startFresh(), isTrue);
      controller.goTo(Steps.stage);
      await controller.flushed();
      expect(prefs.values[AnswersStore.backupKey], raw);
      expect(OnboardingAnswers.fromJson(jsonDecode(prefs.values[AnswersStore.key]! as String) as Map<String, Object?>).step, Steps.stage);
    });

    test('the first answer picks a seed that then stays', () async {
      final c = start(failReads: false, raw: jsonEncode(OnboardingAnswers.empty.toJson()));
      await c.read(onboardingAnswersProvider.future);
      final controller = c.read(onboardingAnswersProvider.notifier);
      controller.setStage(Stage.classTwelve);
      final seed = c.read(onboardingAnswersProvider).value!.seed;
      expect(seed, isNotNull);
      controller.goTo(Steps.course);
      expect(c.read(onboardingAnswersProvider).value!.seed, seed);
      await controller.flushed();
      expect(await AnswersStore(prefs).load().then((a) => a.seed), seed);
    });
  });

  test('an unreadable read is not retried on its own', () async {
    final prefs = FlakyPrefs()
      ..values[AnswersStore.key] = '{}'
      ..failReads = true;
    var reads = 0;
    final counting = _CountingStore(prefs, () => reads++);
    final c = ProviderContainer(overrides: [answersStoreProvider.overrideWithValue(counting)]);
    addTearDown(c.dispose);
    final sub = c.listen(onboardingAnswersProvider, (_, _) {});
    addTearDown(sub.close);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    expect(reads, 1);
  });
}

class _CountingStore extends AnswersStore {
  _CountingStore(super.prefs, this.onLoad);

  final void Function() onLoad;

  @override
  Future<OnboardingAnswers> load() {
    onLoad();
    return super.load();
  }
}
