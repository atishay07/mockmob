import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subject_sets.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/widgets/subject_row.dart';

import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/steps/save_step.dart';
import 'package:mockmob/features/onboarding/widgets/choice_tile.dart';
import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The v15 taste pass on onboarding (owner, 18 Oct 7:40 pm, D89-D90; OWNER-TASTE-PROFILE.md):
/// each behaviour the Opus taste critics asked for, locked.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

/// The flow at a step on a phone of [size] dp, signed out.
Future<ProviderContainer> _flowAt(
  WidgetTester tester,
  OnboardingAnswers answers, {
  Size size = const Size(360, 800),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: onboardingOverrides(answers: answers),
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: child!),
        home: const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      ),
    ),
  ));
  await _settle(tester);
  return ProviderScope.containerOf(tester.element(find.byType(OnboardingFlow)));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

OnboardingAnswers _answers(ProviderContainer c) => c.read(onboardingAnswersProvider).value!;

OnboardingAnswers _notSure(String step) => studentUpTo(Steps.stage, step: step).copyWith(courseUndecided: true).mark(Steps.course);

void main() {
  setUpAll(loadAppFonts);

  group('Subjects: a set tap leads to the rating', () {
    testWidgets('the rated rows slide into view, the other sets fold, and Mobi asks for honesty', (tester) async {
      final c = await _flowAt(tester, _notSure(Steps.subjects), size: const Size(412, 915));
      await _tap(tester, find.text(SubjectSets.commerce.title));
      expect(_answers(c).subjects.toSet(), SubjectSets.commerce.subjects.toSet());
      expect(find.text(ChoicesCopy.otherSets), findsOneWidget, reason: 'the two other sets fold into one quiet row');
      expect(find.text(SubjectSets.commerceMaths.title), findsNothing);
      expect(find.text(OnboardingCopy.mobiRateNow, findRichText: true), findsOneWidget, reason: 'Mobi asks for the rating');
      // The first rated row is on screen, above the key.
      final first = find.byType(SubjectRow).first;
      final keyTop = tester.getTopLeft(find.text(OnboardingCopy.next)).dy;
      expect(tester.getRect(first).top, lessThan(keyTop));
      expect(find.text('Shaky'), findsWidgets);
      // The fold opens again with a tap.
      await _tap(tester, find.text(ChoicesCopy.otherSets));
      expect(find.text(SubjectSets.commerceMaths.title), findsOneWidget);
      expect(find.text(ChoicesCopy.otherSets), findsNothing);
      // Rating stays optional: the key is live.
      expect(_answers(c).confidence, isEmpty);
      expect(tester.takeException(), isNull);
    });
  });

  group('Save: the sign-in keys never look disabled', () {
    testWidgets('before the age, Google is live, a tap asks the age; the age answers are 52 dp tiles with no dot', (tester) async {
      final c = await _flowAt(tester, studentUpTo(Steps.plan, step: Steps.save), size: const Size(412, 915));
      expect(_answers(c).age, isNull);
      final google = find.widgetWithText(KeyButton, OnboardingCopy.continueWithGoogle);
      expect(tester.widget<KeyButton>(google).onPressed, isNotNull);
      final email = find.widgetWithText(KeyButton, OnboardingCopy.useEmailCode);
      expect(tester.widget<KeyButton>(email).onPressed, isNotNull);
      final pills = find.byType(ChoicePills<AgeAnswer>);
      expect(find.descendant(of: pills, matching: find.byType(SelectBubble)), findsNothing, reason: 'answers, not radio rows');
      final yes = find.ancestor(of: find.text(AgeAnswer.adult.label), matching: find.byType(AnimatedContainer)).first;
      expect(tester.getSize(yes).height, 52);
      await tester.tap(google);
      await _settle(tester);
      expect(_answers(c).age, isNull);
      expect(find.byType(SaveStep), findsOneWidget, reason: 'still on the save step: the age comes first');
      await _tap(tester, find.text(AgeAnswer.adult.label));
      expect(_answers(c).age, AgeAnswer.adult);
      expect(tester.takeException(), isNull);
    });
  });
}
