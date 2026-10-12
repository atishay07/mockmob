import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';

import '../../helpers/fonts.dart';
import 'support.dart';

Future<void> _tapText(WidgetTester tester, String text) async {
  await tester.tap(find.text(text).first);
  await settleFlow(tester);
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('welcome: the promise, Try 5 questions, no Prove clause, the footer', (tester) async {
    final h = OnboardingHarness();
    final router = await h.pumpFlow(tester);

    expect(find.text(OnboardingCopy.welcomeHeadline), findsOneWidget);
    expect(find.textContaining('Prove'), findsNothing);
    expect(find.text(OnboardingCopy.tryFive), findsOneWidget);
    expect(find.text(OnboardingCopy.haveAccount), findsOneWidget);
    expect(find.text(OnboardingCopy.notAffiliated), findsOneWidget);
    expect(find.byType(Mobi), findsOneWidget);

    await _tapText(tester, OnboardingCopy.tryFive);
    expect(locationOf(router), AppRoutes.onboardingSubject);
  });

  testWidgets('welcome: I already have an account opens sign-in', (tester) async {
    final router = await OnboardingHarness().pumpFlow(tester);
    await _tapText(tester, OnboardingCopy.haveAccount);
    expect(locationOf(router), AppRoutes.signIn);
  });

  testWidgets('welcome: a half finished sample is welcomed back to the next question', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: ['B', 'A']));
    final router = await h.pumpFlow(tester);
    expect(find.text(OnboardingCopy.welcomeBack(2, 5)), findsOneWidget);
    await _tapText(tester, OnboardingCopy.continueSample);
    expect(locationOf(router), AppRoutes.onboardingSample(3));
  });

  testWidgets('subject: four 56 dp rows, the reason line, one tap goes to question 1', (tester) async {
    final h = OnboardingHarness();
    final router = await h.pumpFlow(tester, initial: AppRoutes.onboardingSubject);

    expect(find.text(OnboardingCopy.subjectTitle), findsOneWidget);
    for (final name in ['English', 'Accountancy', 'Business Studies', 'Economics']) {
      final row = find.ancestor(of: find.text(name), matching: find.byType(KeyButtonFace)).first;
      expect(tester.getSize(row).height, greaterThanOrEqualTo(56), reason: name);
    }
    expect(find.text(OnboardingCopy.subjectReason), findsOneWidget);
    expect(find.text(OnboardingCopy.sameQuestions), findsOneWidget);
    expect(find.text(OnboardingCopy.otherSubjects), findsOneWidget);

    await _tapText(tester, 'Accountancy');
    expect(locationOf(router), AppRoutes.onboardingSample(1));
    expect((await h.store.load()).subject, 'accountancy');
  });

  testWidgets('subject: Other subjects lists the remaining supported papers', (tester) async {
    final h = OnboardingHarness();
    final router = await h.pumpFlow(tester, initial: AppRoutes.onboardingSubject);
    await _tapText(tester, OnboardingCopy.otherSubjects);
    expect(find.text('Physics'), findsOneWidget);
    expect(find.text(OnboardingCopy.otherSubjectsNote), findsOneWidget);
    await _tapText(tester, 'Physics');
    expect((await h.store.load()).subject, 'physics');
    expect(locationOf(router), AppRoutes.onboardingSample(1));
  });

  testWidgets('question: no Mobi before a choice, Mobi and the reason after a right answer', (tester) async {
    final h = OnboardingHarness(guest: guestWith());
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSample(1));

    expect(find.text('Question 1 of 5'), findsOneWidget);
    expect(find.text(OnboardingCopy.sampleCaption), findsOneWidget);
    expect(find.byType(Mobi), findsNothing);
    expect(find.text(OnboardingCopy.sampleDisclaimer), findsOneWidget);

    await _tapText(tester, 'Frank');
    expect(find.byType(Mobi), findsOneWidget);
    expect(find.text(OnboardingCopy.answerCorrect), findsOneWidget);
    expect(find.textContaining('Candid means frank'), findsOneWidget);
    expect(find.text(OnboardingCopy.nextQuestion), findsOneWidget);
    expect((await h.store.load()).answers, {'q1': 'B'});
  });

  testWidgets('question: a wrong answer shows the right one in words and the explanation', (tester) async {
    final h = OnboardingHarness(guest: guestWith());
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSample(1));

    await _tapText(tester, 'Hidden');
    expect(find.text(OnboardingCopy.answerWrong), findsOneWidget);
    expect(find.text(OnboardingCopy.answerIs('B', 'Frank')), findsOneWidget);
    expect(find.byType(Mobi), findsOneWidget);
    expect((await h.store.load()).answers, {'q1': 'A'});
  });

  testWidgets('question: other keys stop answering once one is chosen', (tester) async {
    final h = OnboardingHarness(guest: guestWith());
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSample(1));
    await _tapText(tester, 'Frank');
    await _tapText(tester, 'Hidden');
    expect((await h.store.load()).answers, {'q1': 'B'});
  });

  testWidgets('question: going back to an answered question shows it resolved and loses nothing', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: ['A']));
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSample(1));
    expect(find.text(OnboardingCopy.answerWrong), findsOneWidget);
    expect(find.text(OnboardingCopy.nextQuestion), findsOneWidget);
    expect(find.text(OnboardingCopy.sampleDisclaimer).hitTestable(), findsNothing);
  });

  testWidgets('question: the last question offers See my result', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: ['B', 'B', 'C', 'C']));
    final router = await h.pumpFlow(tester, initial: AppRoutes.onboardingSample(5));
    await _tapText(tester, 'Controlling');
    expect(find.text(OnboardingCopy.seeMyResult), findsOneWidget);
    await _tapText(tester, OnboardingCopy.seeMyResult);
    expect(locationOf(router), AppRoutes.onboardingSampleResult);
  });

  testWidgets('result: the true count, the sheet note, the dashed example and the two keys', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: ['B', 'B', 'C', 'A', 'B']));
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSampleResult);

    expect(find.bySemanticsLabel('4 of 5 correct'), findsOneWidget);
    expect(find.text(OnboardingCopy.resultLine), findsOneWidget);
    expect(find.text(OnboardingCopy.exampleLabel), findsOneWidget);
    expect(find.text(OnboardingCopy.exampleBody), findsOneWidget);
    expect(find.text(OnboardingCopy.saveAndContinue), findsOneWidget);
    expect(find.text(OnboardingCopy.tryAnotherSubject), findsOneWidget);
    expect(find.byType(Mobi), findsNothing);
  });

  testWidgets('result: a poor result gets the same calm page', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: ['A', 'A', 'A', 'A', 'A']));
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSampleResult);
    expect(find.bySemanticsLabel('0 of 5 correct'), findsOneWidget);
    expect(find.text(OnboardingCopy.resultLine), findsOneWidget);
  });

  testWidgets('result: opened early it says where things stand and continues the sample', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: ['B', 'B', 'C']));
    final router = await h.pumpFlow(tester, initial: AppRoutes.onboardingSampleResult);
    expect(find.text(OnboardingCopy.unfinishedTitle(3, 5)), findsOneWidget);
    await _tapText(tester, OnboardingCopy.continueSample);
    expect(locationOf(router), AppRoutes.onboardingSample(4));
  });

  testWidgets('result: Save this and continue opens the account step, still on this phone', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: rightKeys));
    await h.pumpFlow(tester, initial: AppRoutes.onboardingSampleResult);
    await _tapText(tester, OnboardingCopy.saveAndContinue);

    expect(find.text(OnboardingCopy.accountTitle), findsOneWidget);
    expect(find.text(OnboardingCopy.accountOnPhone), findsOneWidget);
    expect(find.text(OnboardingCopy.continueWithGoogle), findsOneWidget);
    expect(find.text(OnboardingCopy.useEmailCode), findsOneWidget);
    expect(find.textContaining('Saved to your account'), findsNothing);
  });

  testWidgets('account step: the email code route opens sign-in', (tester) async {
    final h = OnboardingHarness(guest: guestWith(keys: rightKeys));
    final router = await h.pumpFlow(tester, initial: AppRoutes.onboardingSampleResult);
    await _tapText(tester, OnboardingCopy.saveAndContinue);
    await _tapText(tester, OnboardingCopy.useEmailCode);
    expect(locationOf(router), AppRoutes.signIn);
  });
}
