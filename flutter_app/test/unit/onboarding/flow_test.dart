import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/onboarding_routes.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/widgets/hold_to_seal.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

Future<ProviderContainer> _pump(WidgetTester tester, {OnboardingAnswers answers = OnboardingAnswers.empty}) async {
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
    overrides: onboardingOverrides(answers: answers),
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp.router(theme: buildTheme(Brightness.dark), routerConfig: router),
    ),
  );
  await tester.pumpWidget(scope);
  await _settle(tester);
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
    expect(find.text('This set keeps B.Com (Hons) open.'), findsOneWidget);
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
    // One control: hold to seal.
    final hold = await tester.startGesture(tester.getCenter(find.byType(HoldToSeal)));
    for (var i = 0; i < 16; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await hold.up();
    await _settle(tester);
    await _tap(tester, OnboardingCopy.next);

    expect(find.text(OnboardingCopy.saveTitle), findsOneWidget);
    expect(find.text(OnboardingCopy.useEmailCode), findsNothing, reason: 'age comes first');
    await _tap(tester, AgeAnswer.minor.label);
    expect(find.text(OnboardingCopy.useEmailCode), findsOneWidget);
    await _tap(tester, OnboardingCopy.notNow);
    expect(find.text(OnboardingCopy.firstMoveTitle), findsOneWidget);

    await c.read(onboardingAnswersProvider.notifier).flushed();
    final a = c.read(onboardingAnswersProvider).value!;
    expect(a.stage, Stage.classTwelve);
    expect(a.courseId, 'b-com-hons');
    expect(a.colleges, ['Hindu College']);
    expect(a.subjects, [SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics]);
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
    await _pump(tester, answers: studentUpTo(Steps.stage, step: Steps.course));
    await _tap(tester, OnboardingCopy.continuePlan);
    expect(find.text(OnboardingCopy.courseTitle), findsOneWidget);
    await tester.tap(find.bySemanticsLabel(OnboardingCopy.back));
    await _settle(tester);
    expect(find.text(OnboardingCopy.stageTitle), findsOneWidget);
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
}
