import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';

/// A phone store whose writes of put-away sheets can fail.
class _Prefs extends MemoryPrefsStore {
  bool failParking = false;

  @override
  Future<void> setString(String key, String value) async {
    if (failParking && key == AnswersStore.parkedKey) throw StateError('storage full');
    return super.setString(key, value);
  }
}

final _now = DateTime(2026, 10, 13, 21, 45);
final _sealed = OnboardingAnswers(
  stage: Stage.classTwelve,
  subjects: const [SheetSubject.english, SheetSubject.economics],
  sealedAt: DateTime(2026, 10, 13, 21, 40),
);

void main() {
  group('owner on the stored sheet', () {
    test('round-trips', () {
      final a = _sealed.copyWith(owner: 'u1');
      expect(OnboardingAnswers.fromJson(a.toJson()).owner, 'u1');
    });

    test('a sheet stored before owners were kept belongs to the account it was written to', () {
      final json = _sealed.copyWith(syncedFor: 'u1').toJson()..remove('owner');
      expect(OnboardingAnswers.fromJson(json).owner, 'u1');
    });

    test('blank means no answers, whatever step or seed it holds', () {
      expect(const OnboardingAnswers(step: Steps.course, seed: 7).blank, isTrue);
      expect(const OnboardingAnswers().mark(Steps.stage).blank, isFalse);
      expect(const OnboardingAnswers(courseId: 'b-com-hons').blank, isFalse);
      expect(_sealed.blank, isFalse);
    });
  });

  group('put-away sheets', () {
    test("a finished sheet is not replaced by an unfinished one of the same account", () async {
      final store = AnswersStore(MemoryPrefsStore());
      await store.park(_sealed.copyWith(owner: 'u1'), _now);
      await store.park(const OnboardingAnswers(owner: 'u1').mark(Steps.stage), _now);
      expect((await store.parked('u1', _now))?.sealed, isTrue);
    });

    test('one account never gets another account\'s sheet back', () async {
      final store = AnswersStore(MemoryPrefsStore());
      await store.park(_sealed.copyWith(owner: 'u1'), _now);
      expect(await store.parked('u2', _now), isNull);
    });

    test('an entry this build cannot read is kept until it expires', () async {
      final prefs = MemoryPrefsStore()
        ..values[AnswersStore.parkedKey] = jsonEncode({
          'u9': {'at': _now.toIso8601String(), 'sheet': {'v': OnboardingAnswers.version + 1}},
        });
      final store = AnswersStore(prefs);
      await store.park(_sealed.copyWith(owner: 'u1'), _now);
      final kept = jsonDecode(prefs.values[AnswersStore.parkedKey]! as String) as Map;
      expect(kept.keys, containsAll(['u1', 'u9']));
    });
  });

  group('AnswersController.leave', () {
    ProviderContainer start(_Prefs prefs, OnboardingAnswers stored) {
      prefs.values[AnswersStore.key] = jsonEncode(stored.toJson());
      final c = ProviderContainer(overrides: [
        answersStoreProvider.overrideWithValue(AnswersStore(prefs)),
        nowProvider.overrideWithValue(() => _now),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    test("puts unsent answers away for their account, off the screen", () async {
      final prefs = _Prefs();
      final c = start(prefs, _sealed.copyWith(owner: 'u1'));
      await c.read(onboardingAnswersProvider.future);
      await c.read(onboardingAnswersProvider.notifier).leave('u1');
      expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse);
      expect(prefs.values.containsKey(AnswersStore.key), isFalse);
      expect((await AnswersStore(prefs).parked('u1', _now))?.subjects, _sealed.subjects);
    });

    test('keeps the sheet where it is when it cannot be put away', () async {
      final prefs = _Prefs()..failParking = true;
      final c = start(prefs, _sealed.copyWith(owner: 'u1'));
      await c.read(onboardingAnswersProvider.future);
      await c.read(onboardingAnswersProvider.notifier).leave('u1');
      expect(c.read(onboardingAnswersProvider).value!.sealed, isTrue, reason: 'never lost');
      expect((await AnswersStore(prefs).load()).owner, 'u1', reason: 'still kept for u1 only');
    });

    test("another account's leaving never touches this sheet", () async {
      final prefs = _Prefs();
      final c = start(prefs, _sealed.copyWith(owner: 'u1'));
      await c.read(onboardingAnswersProvider.future);
      await c.read(onboardingAnswersProvider.notifier).leave('u2');
      expect(c.read(onboardingAnswersProvider).value!.owner, 'u1');
      expect(c.read(onboardingAnswersProvider).value!.sealed, isTrue);
    });
  });

  group('AnswersController.takeFor', () {
    test('a sheet started while signed out is claimed by the first account', () async {
      final prefs = _Prefs()..values[AnswersStore.key] = jsonEncode(_sealed.toJson());
      final c = ProviderContainer(overrides: [
        answersStoreProvider.overrideWithValue(AnswersStore(prefs)),
        nowProvider.overrideWithValue(() => _now),
      ]);
      addTearDown(c.dispose);
      await c.read(onboardingAnswersProvider.future);
      await c.read(onboardingAnswersProvider.notifier).takeFor('u1');
      await c.read(onboardingAnswersProvider.notifier).flushed();
      expect((await AnswersStore(prefs).load()).owner, 'u1');
    });

    test("another account's sheet stays on screen when it cannot be put away", () async {
      final prefs = _Prefs()
        ..values[AnswersStore.key] = jsonEncode(_sealed.copyWith(owner: 'u1').toJson())
        ..failParking = true;
      final c = ProviderContainer(overrides: [
        answersStoreProvider.overrideWithValue(AnswersStore(prefs)),
        nowProvider.overrideWithValue(() => _now),
      ]);
      addTearDown(c.dispose);
      await c.read(onboardingAnswersProvider.future);
      await c.read(onboardingAnswersProvider.notifier).takeFor('u2');
      expect(c.read(onboardingAnswersProvider).value!.owner, 'u1', reason: 'not handed to u2, and not lost');
    });
  });
}
