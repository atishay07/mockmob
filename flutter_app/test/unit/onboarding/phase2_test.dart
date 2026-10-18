// UI phase 2, onboarding: regression tests for the verified robustness bugs (ROBUSTNESS.json
// onboarding-03, -04, -06; -01 and -02 are in sheet_sync_test.dart) and the motion rules this
// round applied (MOTION.md 4.2, P0-5, P0-6, P1-9; SPACING-AUDIT O2, O3, O4).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/steps/plan_step.dart';
import 'package:mockmob/features/onboarding/steps/save_step.dart';
import 'package:mockmob/features/onboarding/widgets/answer_sheet_card.dart';
import 'package:mockmob/features/onboarding/widgets/first_move_hero.dart';
import 'package:mockmob/features/onboarding/widgets/plan_seal_moment.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show CelebrationMode, celebrationModeProvider;

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// A phone store that can refuse reads, every write, or only the backup write.
class _Storage extends MemoryPrefsStore {
  bool failReads = false;
  bool failWrites = false;
  bool failBackup = false;

  @override
  Future<String?> getString(String key) async {
    if (failReads) throw StateError('storage unavailable');
    return super.getString(key);
  }

  @override
  Future<void> setString(String key, String value) async {
    if (failWrites || (failBackup && key == AnswersStore.backupKey)) throw StateError('storage full');
    return super.setString(key, value);
  }
}

/// A store whose look-up of a put-away sheet waits for [gate], so a change can land mid-hand-over.
class _SlowParkedStore extends AnswersStore {
  _SlowParkedStore(super.prefs);

  Completer<void>? gate;

  @override
  Future<OnboardingAnswers?> parked(String userId, DateTime now) async {
    final g = gate;
    if (g != null) await g.future;
    return super.parked(userId, now);
  }
}

class _CountingHaptics implements HapticDriver {
  int selection = 0;
  int light = 0;
  int medium = 0;

  @override
  Future<void> selectionClick() async => selection++;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async => medium++;
}

final _now = DateTime(2026, 10, 13, 21, 45);

ProviderContainer _container(AnswersStore store) {
  final c = ProviderContainer(overrides: [
    answersStoreProvider.overrideWithValue(store),
    nowProvider.overrideWithValue(() => _now),
  ]);
  addTearDown(c.dispose);
  return c;
}

Future<void> _settle() async {
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('onboarding-03: an unreadable sheet that cannot be backed up', () {
    test('can be given up, once confirmed, and the new sheet saves', () async {
      final prefs = _Storage()
        ..values[AnswersStore.key] = 'not json'
        ..failBackup = true;
      final c = _container(AnswersStore(prefs));
      final sub = c.listen(onboardingAnswersProvider, (_, _) {});
      addTearDown(sub.close);
      await _settle();
      final controller = c.read(onboardingAnswersProvider.notifier);
      expect(controller.readError?.backedUp, isFalse);
      expect(controller.startFresh(), isFalse, reason: 'the silent path still refuses');

      await controller.discardUnreadable();
      expect(controller.readError, isNull);
      expect(c.read(onboardingAnswersProvider).value, OnboardingAnswers.empty);
      controller.goTo(Steps.stage);
      expect(await controller.flushed(), isTrue);
      expect(OnboardingAnswers.fromJson(jsonDecode(prefs.values[AnswersStore.key]! as String) as Map<String, Object?>).step, Steps.stage);
    });

    test('a backup that works by then is taken before the sheet is given up', () async {
      final prefs = _Storage()
        ..values[AnswersStore.key] = 'not json'
        ..failBackup = true;
      final c = _container(AnswersStore(prefs));
      final sub = c.listen(onboardingAnswersProvider, (_, _) {});
      addTearDown(sub.close);
      await _settle();
      prefs.failBackup = false;
      await c.read(onboardingAnswersProvider.notifier).discardUnreadable();
      expect(prefs.values[AnswersStore.backupKey], 'not json');
    });

    testWidgets('Welcome offers a confirmed way out instead of only Try again', (tester) async {
      final prefs = _Storage()
        ..values[AnswersStore.key] = 'not json'
        ..failBackup = true;
      await pumpMockmob(
        tester,
        const OnboardingFlow(skipColdOpen: true),
        size: kPhone,
        overrides: onboardingOverrides(store: AnswersStore(prefs)),
      );
      await tester.pump(const Duration(seconds: 2));
      expect(find.text(OnboardingCopy.tryAgain), findsOneWidget);
      await tester.tap(find.text(OnboardingCopy.startOver));
      await tester.pumpAndSettle();
      expect(find.text(OnboardingCopy.startOverTitle), findsOneWidget, reason: 'asked first');
      // Welcome's own quiet key carries the same words; the sheet's confirm key is the last one.
      await tester.tap(find.widgetWithText(KeyButton, OnboardingCopy.startOverConfirm).last);
      await tester.pumpAndSettle();
      expect(find.text(OnboardingCopy.stageTitle), findsOneWidget, reason: 'the deck opens on a new sheet');
    });
  });

  group('onboarding-04: a save that fails is said, not swallowed', () {
    test('flushed reports the failure, the notice flag is up, and Try again clears it', () async {
      final prefs = _Storage()..values[AnswersStore.key] = jsonEncode(const OnboardingAnswers(step: Steps.stage).toJson());
      final c = _container(AnswersStore(prefs));
      await c.read(onboardingAnswersProvider.future);
      final controller = c.read(onboardingAnswersProvider.notifier);

      prefs.failWrites = true;
      controller.setStage(Stage.classTwelve);
      expect(await controller.flushed(), isFalse);
      expect(c.read(onboardingSaveFailedProvider), isTrue);

      prefs.failWrites = false;
      expect(await controller.retrySave(), isTrue);
      expect(c.read(onboardingSaveFailedProvider), isFalse);
      expect((await AnswersStore(prefs).load()).stage, Stage.classTwelve, reason: 'the answer on screen is the answer on the phone');
    });

    testWidgets('the step shows the notice with Try again', (tester) async {
      final prefs = _Storage();
      await pumpMockmob(
        tester,
        const OnboardingFlow(skipColdOpen: true, startInDeck: true),
        size: kPhone,
        disableAnimations: true,
        overrides: onboardingOverrides(answers: const OnboardingAnswers(step: Steps.stage), store: AnswersStore(prefs)),
      );
      await tester.pump(const Duration(milliseconds: 500));
      prefs.failWrites = true;
      await tester.tap(find.text(Stage.classTwelve.option));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text(OnboardingCopy.saveFailed), findsOneWidget);

      prefs.failWrites = false;
      await tester.tap(find.text(OnboardingCopy.tryAgain));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text(OnboardingCopy.saveFailed), findsNothing);
    });
  });

  group('onboarding-06: a change during the hand-over to another account', () {
    test('does not leave the previous account\'s sheet on screen; the change is put away for it', () async {
      final prefs = MemoryPrefsStore()
        ..values[AnswersStore.key] = jsonEncode(
          const OnboardingAnswers(owner: 'u1', stage: Stage.classTwelve, step: Steps.save).mark(Steps.stage).toJson(),
        );
      final store = _SlowParkedStore(prefs);
      final c = _container(store);
      await c.read(onboardingAnswersProvider.future);
      final controller = c.read(onboardingAnswersProvider.notifier);

      store.gate = Completer<void>();
      final handOver = controller.takeFor('u2');
      await _settle();
      // A tap on the step still on screen while the hand-over waits.
      controller.setAge(AgeAnswer.adult);
      store.gate!.complete();
      store.gate = null;
      await handOver;

      final now = c.read(onboardingAnswersProvider).value!;
      expect(now.owner, 'u2', reason: "u2 never keeps u1's sheet");
      expect(now.stage, isNull);
      final parked = await AnswersStore(prefs).parked('u1', _now);
      expect(parked?.age, AgeAnswer.adult, reason: "the tap went to u1's sheet, which waits for u1");
    });
  });

  group('the seal reads the Celebrations setting (P0-6)', () {
    Future<_CountingHaptics> seal(WidgetTester tester, CelebrationMode mode) async {
      final haptics = _CountingHaptics();
      await pumpMockmob(
        tester,
        const OnboardingFlow(skipColdOpen: true, startInDeck: true),
        size: kPhone,
        overrides: [
          ...onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)),
          celebrationModeProvider.overrideWithValue(mode),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
      );
      for (var i = 0; i < 30; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.byKey(PlanStep.tapToSealKey));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      return haptics;
    }

    bool waveOut(WidgetTester tester) =>
        find.byWidgetPredicate((w) => w is CustomPaint && w.foregroundPainter?.runtimeType.toString() == '_WavePainter').evaluate().isNotEmpty;

    // In the flow the seal strikes the painted sheet (PlanSealBackdrop): its one light event is
    // the foil flecks thrown from the rim, not a ring on the card, which is out of sight.
    double flecks(WidgetTester tester) => tester.widget<PlanSealBackdrop>(find.byType(PlanSealBackdrop)).moment.burst;

    testWidgets('Full: a firm tap and one burst of foil flecks', (tester) async {
      final h = await seal(tester, CelebrationMode.full);
      await tester.pump(const Duration(milliseconds: 50));
      expect(h.medium, 1);
      expect(flecks(tester), greaterThan(0));
      expect(waveOut(tester), isFalse, reason: 'one light event, not two');
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Quiet: no wave, a selection tick', (tester) async {
      final h = await seal(tester, CelebrationMode.quiet);
      expect(h.medium, 0);
      expect(waveOut(tester), isFalse);
      expect(flecks(tester), 0);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Off: the seal is shown, with no wave and no tap', (tester) async {
      final h = await seal(tester, CelebrationMode.off);
      final before = h.selection;
      expect(h.medium, 0);
      expect(waveOut(tester), isFalse);
      await tester.pump(const Duration(seconds: 3));
      expect(h.selection, before);
      expect(find.text(OnboardingCopy.mobiSealed), findsWidgets, reason: 'the words stay');
    });
  });

  testWidgets('the Celebrations setting reaches every Mobi on the onboarding screens', (tester) async {
    for (final (mode, level) in [
      (CelebrationMode.full, MobiCelebrationLevel.full),
      (CelebrationMode.quiet, MobiCelebrationLevel.quiet),
      (CelebrationMode.off, MobiCelebrationLevel.off),
    ]) {
      await pumpMockmob(
        tester,
        const OnboardingFlow(skipColdOpen: true),
        size: kPhone,
        disableAnimations: true,
        overrides: [...onboardingOverrides(), celebrationModeProvider.overrideWithValue(mode)],
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(MobiCelebrations.of(tester.element(find.byType(MobiStage))), level, reason: '$mode');
    }
  });

  testWidgets('an answer inks with a selection tick, not a light impact (P1-9)', (tester) async {
    final haptics = _CountingHaptics();
    await pumpMockmob(
      tester,
      const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      size: kPhone,
      disableAnimations: true,
      overrides: [
        ...onboardingOverrides(answers: const OnboardingAnswers(step: Steps.stage)),
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
      ],
    );
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text(Stage.classTwelve.option));
    await tester.pump(const Duration(milliseconds: 500));
    expect(haptics.light, 0);
    expect(haptics.selection, greaterThan(0));
  });

  testWidgets('the first step shows the whole sheet for its reveal, then the strip (O2)', (tester) async {
    await pumpMockmob(
      tester,
      const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      size: kPhone,
      overrides: onboardingOverrides(answers: const OnboardingAnswers(step: Steps.stage)),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.widget<AnswerSheetCard>(find.byType(AnswerSheetCard)).slim, isFalse, reason: 'the cold reveal');
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump(const Duration(milliseconds: 600));
    expect(tester.widget<AnswerSheetCard>(find.byType(AnswerSheetCard)).slim, isTrue, reason: 'one header height on every step');
  });

  testWidgets('"later" is a 48 dp ghost key under Start, inside the card (O3)', (tester) async {
    final student = studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(notNow: true);
    await pumpMockmob(
      tester,
      const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      size: kPhone,
      disableAnimations: true,
      overrides: onboardingOverrides(answers: student),
    );
    await tester.pump(const Duration(milliseconds: 500));
    final ghost = find.byType(GhostKey);
    expect(ghost, findsOneWidget);
    expect(tester.getSize(ghost).height, 48);
    final start = find.byWidgetPredicate((w) => w is KeyButton && w.label == OnboardingCopy.startNow);
    expect(tester.getTopLeft(ghost).dy - tester.getBottomLeft(start).dy, moreOrLessEquals(8, epsilon: 0.5));
  });

  testWidgets('the save step pins its keys and Not now; answering the age moves nothing (O4)', (tester) async {
    AgeAnswer? age;
    var googled = 0;
    late StateSetter set;
    await pumpMockmob(
      tester,
      StatefulBuilder(builder: (context, setState) {
        set = setState;
        return SaveView(age: age, onAge: (a) => setState(() => age = a), onGoogle: () => googled++, onEmail: () {}, onNotNow: () {});
      }),
      size: kPhone,
      disableAnimations: true,
      overrides: onboardingOverrides(),
    );
    await tester.pump();
    final google = find.widgetWithText(KeyButton, OnboardingCopy.continueWithGoogle);
    // Drawn at full strength (v15 taste pass): a tap asks the age instead of signing in.
    expect(tester.widget<KeyButton>(google).onPressed, isNotNull, reason: 'never looks disabled');
    await tester.tap(google);
    await tester.pump(const Duration(milliseconds: 400));
    expect(googled, 0, reason: 'the age comes first');
    final before = tester.getTopLeft(google);
    final notNow = tester.getTopLeft(find.text(OnboardingCopy.notNow));
    set(() => age = AgeAnswer.adult);
    await tester.pump();
    await tester.tap(google);
    await tester.pump(const Duration(milliseconds: 400));
    expect(googled, 1, reason: 'answered, the key signs in');
    expect(tester.getTopLeft(google), before, reason: 'nothing moves when the age is answered');
    expect(tester.getTopLeft(find.text(OnboardingCopy.notNow)), notNow);
    expect(notNow.dy, greaterThan(kPhone.height - 140), reason: 'pinned at the thumb, not under a hole');
  });

  test('only row-completing bubbles burst (P0-5)', () {
    expect(burstSteps, {Steps.stage, Steps.course, Steps.subjects, Steps.plan});
  });
}
