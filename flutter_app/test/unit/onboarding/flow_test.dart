import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/onboarding_routes.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/steps/plan_step.dart';
import 'package:mockmob/features/onboarding/widgets/hold_to_seal.dart';
import 'package:mockmob/features/onboarding/widgets/step_frame.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

Future<ProviderContainer> _pump(WidgetTester tester, {OnboardingAnswers answers = OnboardingAnswers.empty, AnswersStore? store, bool settle = true}) async {
  tester.view.physicalSize = const Size(768, 1706);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  Widget stub(String name) => Scaffold(body: Center(child: Text('STUB $name')));
  final router = GoRouter(
    initialLocation: AppRoutes.welcome,
    routes: [
      GoRoute(path: AppRoutes.welcome, builder: welcomeScreen),
      GoRoute(path: AppRoutes.signIn, builder: (c, s) => stub('sign-in')),
      GoRoute(path: AppRoutes.today, builder: (c, s) => stub('today')),
    ],
  );
  addTearDown(router.dispose);
  final scope = ProviderScope(
    overrides: onboardingOverrides(answers: answers, store: store),
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
    ),
  );
  await tester.pumpWidget(scope);
  if (settle) await _settle(tester);
  return ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
}

Future<void> _tap(WidgetTester tester, String text) async {
  final f = find.text(text).last;
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a whole run: every answer lands on the phone and Not now ends on the first move', (tester) async {
    final c = await _pump(tester);
    expect(find.text(OnboardingCopy.welcomeHeadlineSet), findsOneWidget);

    await _tap(tester, OnboardingCopy.buildPlan);
    expect(find.text(OnboardingCopy.stageTitle), findsOneWidget);
    await _tap(tester, Stage.classTwelve.option);
    expect(find.text(OnboardingCopy.weeksUnit(2027)), findsOneWidget, reason: 'the weeks roll onto the sheet');
    await _tap(tester, OnboardingCopy.next);

    await _tap(tester, 'B.Com (Hons)');
    expect(find.text(OnboardingCopy.ladderTitle), findsOneWidget);
    expect(find.text('924.3'), findsOneWidget);
    await _tap(tester, 'Hindu College');
    await _tap(tester, OnboardingCopy.next);

    expect(find.text(OnboardingCopy.subjectsTitle), findsOneWidget);
    // Nothing is assumed (D42): the Commerce set ticks in one tap.
    await _tap(tester, 'Commerce');
    expect(find.text('Your 4 subjects open B.Com (Hons) at your college.'), findsOneWidget);
    await _tap(tester, OnboardingCopy.next);

    await _tap(tester, Worry.knewIt.option);
    expect(find.text(Worry.knewIt.mobiShort, findRichText: true), findsOneWidget, reason: "Mobi says it in the top bar");
    await _tap(tester, OnboardingCopy.next);

    expect(find.text(OnboardingCopy.questionTitle('Accountancy')), findsOneWidget);
    await _tap(tester, '12:8:5');
    expect(find.text(OnboardingCopy.trapLead), findsOneWidget);
    await _tap(tester, OnboardingCopy.next);

    expect(find.text(OnboardingCopy.rhythmTitle), findsOneWidget);
    await _tap(tester, OnboardingCopy.next);

    expect(find.text('Week one starts with Partnership.'), findsOneWidget);
    // Hold to seal (the tap-to-seal link under it is the plain alternative).
    final hold = await tester.startGesture(tester.getCenter(find.byType(HoldToSeal)));
    for (var i = 0; i < 16; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await hold.up();
    await _settle(tester);
    await _tap(tester, OnboardingCopy.next);

    expect(find.text(OnboardingCopy.saveTitle), findsOneWidget);
    // The keys stand in place from the start (answering the age moves nothing); they wait, off,
    // for the age.
    final email = find.widgetWithText(KeyButton, OnboardingCopy.useEmailCode);
    expect(tester.widget<KeyButton>(email).onPressed, isNull, reason: 'age comes first');
    await _tap(tester, AgeAnswer.minor.label);
    expect(tester.widget<KeyButton>(email).onPressed, isNotNull);
    await _tap(tester, OnboardingCopy.notNow);
    expect(find.text(OnboardingCopy.firstMoveTitle), findsOneWidget);

    await c.read(onboardingAnswersProvider.notifier).flushed();
    final a = c.read(onboardingAnswersProvider).value!;
    expect(a.stage, Stage.classTwelve);
    expect(a.courseId, 'b-com-hons');
    expect(a.colleges, ['Hindu College']);
    expect(a.subjects, [SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics, SheetSubject.english]);
    expect(a.worry, Worry.knewIt);
    expect(a.warmup!.correct, isFalse);
    expect(a.sealed, isTrue);
    expect(a.age, AgeAnswer.minor);
    expect(a.notNow, isTrue);
    expect(a.step, Steps.firstMove);
    for (final s in kOnboardingDeck.sheetSteps) {
      expect(a.isDone(s.id), isTrue, reason: s.id);
    }
  });

  testWidgets('a return opens on Welcome with the sheet waiting, and picks up at the same step', (tester) async {
    await _pump(tester, answers: studentUpTo(Steps.subjects, step: Steps.worry));
    expect(find.text(OnboardingCopy.continuePlan), findsOneWidget);
    await _tap(tester, OnboardingCopy.continuePlan);
    expect(find.text(OnboardingCopy.worryTitle), findsOneWidget);
  });

  testWidgets('back walks the deck backwards, and from the first step returns to Welcome', (tester) async {
    final semantics = tester.ensureSemantics();
    final c = await _pump(tester, answers: studentUpTo(Steps.stage, step: Steps.course));
    await _tap(tester, OnboardingCopy.continuePlan);
    expect(find.text(OnboardingCopy.courseTitle), findsOneWidget);
    // D43: a labelled Back in the action row, left of the primary key, both 48 dp or taller.
    final back = find.byKey(StepBackKey.keyKey);
    expect(back, findsOneWidget);
    expect(tester.getSize(back).height, greaterThanOrEqualTo(48));
    expect(tester.getTopLeft(back).dx, moreOrLessEquals(MmSpace.gutter, epsilon: 0.5), reason: 'Back starts the action row, on the left');
    await tester.tap(back);
    await _settle(tester);
    expect(find.text(OnboardingCopy.stageTitle), findsOneWidget);
    expect(c.read(onboardingAnswersProvider).value!.stage, Stage.classTwelve, reason: 'Back keeps the answers');
    expect(find.byKey(StepBackKey.keyKey), findsNothing, reason: 'the first step has no labelled Back');
    // The small top icon stays, and from the first step it returns to Welcome.
    await tester.tap(find.bySemanticsLabel(OnboardingCopy.back));
    await _settle(tester);
    expect(find.text(OnboardingCopy.continuePlan), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('skip leaves a dotted bubble and moves on', (tester) async {
    final c = await _pump(tester, answers: const OnboardingAnswers(step: Steps.stage));
    await _tap(tester, OnboardingCopy.buildPlan);
    await _tap(tester, OnboardingCopy.skip);
    expect(find.text(OnboardingCopy.courseTitle), findsOneWidget);
    expect(c.read(onboardingAnswersProvider).value!.isSkipped(Steps.stage), isTrue);
  });

  testWidgets('holding the seal for 1.2 seconds seals the sheet', (tester) async {
    final semantics = tester.ensureSemantics();
    final c = await _pump(tester, answers: studentUpTo(Steps.rhythm, step: Steps.plan));
    await _tap(tester, OnboardingCopy.continuePlan);
    final hold = find.bySemanticsLabel(OnboardingCopy.holdToSeal);
    final gesture = await tester.startGesture(tester.getCenter(hold));
    for (var i = 0; i < 7; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse, reason: 'not yet');
    expect(find.text(OnboardingCopy.sealing), findsWidgets, reason: 'the pill fills while held');
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await gesture.up();
    await _settle(tester);
    expect(c.read(onboardingAnswersProvider).value!.sealed, isTrue);
    semantics.dispose();
  });

  testWidgets('letting go early does not seal', (tester) async {
    final semantics = tester.ensureSemantics();
    final c = await _pump(tester, answers: studentUpTo(Steps.rhythm, step: Steps.plan));
    await _tap(tester, OnboardingCopy.continuePlan);
    final gesture = await tester.startGesture(tester.getCenter(find.bySemanticsLabel(OnboardingCopy.holdToSeal)));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await gesture.up();
    await _settle(tester);
    expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse);
    semantics.dispose();
  });

  testWidgets('the hint line under the one full-width hold seals at once, at a full touch target', (tester) async {
    final c = await _pump(tester, answers: studentUpTo(Steps.rhythm, step: Steps.plan));
    await _tap(tester, OnboardingCopy.continuePlan);
    final seal = find.byKey(PlanStep.tapToSealKey);
    expect(seal, findsOneWidget);
    expect(find.text(OnboardingCopy.sealHint, findRichText: true), findsOneWidget);
    expect(find.byType(HoldToSeal), findsOneWidget, reason: 'the hold stays, as the one dominant control');
    expect(find.widgetWithText(KeyButton, OnboardingCopy.sealIt), findsNothing, reason: 'not a second key under the hold');
    expect(tester.getSize(seal).height, greaterThanOrEqualTo(48));
    expect(tester.getTopLeft(seal).dy, greaterThan(tester.getBottomLeft(find.byType(HoldToSeal)).dy - 1), reason: 'the line sits under the hold');
    // D43: Back stands left of the hold; the hold takes the rest of the row, the hint the whole width.
    final back = find.byKey(StepBackKey.keyKey);
    expect(tester.getTopRight(back).dx, lessThan(tester.getTopLeft(find.byType(HoldToSeal)).dx));
    expect(tester.getSize(find.byType(HoldToSeal)).width, greaterThan(200), reason: 'the hold takes the rest of the row');
    expect(tester.getSize(seal).width, greaterThan(300), reason: 'the hint runs the whole width');
    await tester.tap(seal);
    await _settle(tester);
    expect(c.read(onboardingAnswersProvider).value!.sealed, isTrue);
  });

  testWidgets('Build my plan tapped before the stored sheet is read still opens the deck', (tester) async {
    final slow = _SlowStore(const OnboardingAnswers(step: Steps.stage));
    await _pump(tester, store: slow, settle: false);
    await tester.pump();
    expect(find.text(OnboardingCopy.buildPlan), findsOneWidget);
    await tester.tap(find.text(OnboardingCopy.buildPlan));
    await tester.pump();
    expect(find.text(OnboardingCopy.stageTitle), findsNothing, reason: 'not read yet');
    slow.gate.complete();
    await _settle(tester);
    expect(find.text(OnboardingCopy.stageTitle), findsOneWidget);
  });

  testWidgets('a sheet that cannot be read is never shown as new or written over', (tester) async {
    final prefs = _FailingPrefs()..values[AnswersStore.key] = jsonEncode(studentUpTo(Steps.subjects, step: Steps.worry).toJson());
    final c = await _pump(tester, store: AnswersStore(prefs));
    expect(find.text(OnboardingCopy.continuePlan), findsNothing);
    expect(find.text(OnboardingCopy.sheetUnreadable), findsOneWidget);
    await _tap(tester, OnboardingCopy.tryAgain);
    expect(find.text(OnboardingCopy.stageTitle), findsNothing);
    expect(prefs.saved, isEmpty, reason: 'no empty sheet saved over the real one');
    expect(c.read(onboardingAnswersProvider).hasError, isTrue);

    // Storage comes back: the next tap reads the real sheet and picks up where it was.
    prefs.fail = false;
    await _tap(tester, OnboardingCopy.tryAgain);
    expect(find.text(OnboardingCopy.worryTitle), findsOneWidget);
  });

  testWidgets('a tap kept while the sheet loads, then a failed read, leaves Try again tappable', (tester) async {
    final prefs = _FailingPrefs()..values[AnswersStore.key] = jsonEncode(studentUpTo(Steps.subjects, step: Steps.worry).toJson());
    final slow = _SlowFailingStore(prefs);
    await _pump(tester, store: slow, settle: false);
    await tester.pump();
    await tester.tap(find.text(OnboardingCopy.buildPlan));
    await tester.pump();
    slow.gate.complete();
    await _settle(tester);

    expect(find.text(OnboardingCopy.sheetUnreadable), findsOneWidget);
    final key = tester.widget<KeyButton>(find.widgetWithText(KeyButton, OnboardingCopy.tryAgain));
    expect(key.loading, isFalse, reason: 'the kept tap is spent when the read fails');
    expect(key.onPressed, isNotNull);

    // Storage comes back: Try again reads the real sheet and opens the deck where it was.
    prefs.fail = false;
    await _tap(tester, OnboardingCopy.tryAgain);
    expect(find.text(OnboardingCopy.worryTitle), findsOneWidget);
  });

  testWidgets('course Next says why it waits', (tester) async {
    await _pump(tester, answers: studentUpTo(Steps.stage, step: Steps.course).copyWith(courseId: 'b-com-hons'));
    await _tap(tester, OnboardingCopy.continuePlan);
    expect(find.text(OnboardingCopy.ladderTitle), findsOneWidget);
    expect(find.text(OnboardingCopy.pickCollege), findsOneWidget);
    await _tap(tester, 'Hindu College');
    expect(find.text(OnboardingCopy.pickCollege), findsNothing);
  });
}

class _SlowStore extends AnswersStore {
  _SlowStore(this.answers) : super(MemoryPrefsStore());

  final OnboardingAnswers answers;
  final Completer<void> gate = Completer<void>();

  @override
  Future<OnboardingAnswers> load() async {
    await gate.future;
    return answers;
  }
}

class _SlowFailingStore extends AnswersStore {
  _SlowFailingStore(super.prefs);

  final Completer<void> gate = Completer<void>();
  bool _first = true;

  @override
  Future<OnboardingAnswers> load() async {
    if (_first) {
      _first = false;
      await gate.future;
    }
    return super.load();
  }
}

class _FailingPrefs extends MemoryPrefsStore {
  bool fail = true;
  final List<String> saved = [];

  @override
  Future<String?> getString(String key) async {
    if (fail) throw StateError('storage unavailable');
    return super.getString(key);
  }

  @override
  Future<void> setString(String key, String value) async {
    if (key == AnswersStore.key) saved.add(value);
    return super.setString(key, value);
  }
}
